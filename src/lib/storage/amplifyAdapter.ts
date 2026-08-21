import { generateClient } from 'aws-amplify/data'
import { downloadData, getProperties, getUrl, list, remove, uploadData } from 'aws-amplify/storage'
import type { Schema } from '../../../amplify/data/resource'
import type { Application, ApplicationStatus } from '../../types'
import { ensureAmplifyConfigured } from './amplifyConfig'
import type { DocKind, ManualProject, SettingsData, StorageAdapter } from './types'

type StoragePath = string | (({ identityId }: { identityId?: string }) => string)

const DOC_FILE_KEY: Partial<Record<DocKind, keyof Application>> = {
  jobPosting: 'jobPostingFile',
  resume: 'resumeFile',
  coverLetter: 'coverLetterFile',
  interest: 'interestFile',
}

let client: ReturnType<typeof generateClient<Schema>> | null = null

async function getClient() {
  await ensureAmplifyConfigured()
  if (!client) client = generateClient<Schema>()
  return client
}

function applicationPath(applicationId: string, filename: string): StoragePath {
  return ({ identityId }) => `applications/${identityId}/${applicationId}/${filename}`
}

function settingsPath(filename: string): StoragePath {
  return ({ identityId }) => `settings/${identityId}/${filename}`
}

async function downloadText(path: StoragePath) {
  const result = await downloadData({ path }).result
  return result.body.text()
}

async function fileExists(path: StoragePath) {
  try {
    await getProperties({ path })
    return true
  } catch {
    return false
  }
}

function mapRecord(r: Schema['Application']['type']): Application {
  return {
    id: r.applicationId,
    company: r.company,
    role: r.role,
    dateAdded: r.dateAdded,
    jobUrl: r.jobUrl ?? undefined,
    jobPostingSource: (r.jobPostingSource ?? 'pasted') as Application['jobPostingSource'],
    location: r.location ?? undefined,
    keywords: r.keywords?.filter((k): k is string => k != null),
    status: r.status as ApplicationStatus,
    fitRating: r.fitRating ?? undefined,
    fitSummary: r.fitSummary ?? undefined,
    tailored: r.tailored,
    jobPostingFile: r.jobPostingFile,
    resumeFile: r.resumeFile ?? undefined,
    resumePdf: r.resumePdf ?? undefined,
    coverLetterFile: r.coverLetterFile ?? undefined,
    coverLetterPdf: r.coverLetterPdf ?? undefined,
    interestFile: r.interestFile ?? undefined,
  }
}

async function getLocalApplications(): Promise<Application[]> {
  const res = await fetch('/applications-manifest.json')
  if (!res.ok) return []
  try {
    return await res.json()
  } catch {
    // A missing static file 200s into Vite's SPA index.html fallback
    // rather than a clean 404 — no manifest yet just means no apps yet.
    return []
  }
}

// Fields Claude Code's skills actually own — deliberately excludes `status`
// (set only via the UI, directly against the cloud, never written back to
// local files) and `dateAdded` (format-only differences after a round-trip
// through AppSync — see syncOneApplication). Comparing this fingerprint is
// what lets a local promotion (e.g. tailored: false -> true) push an update
// to a record that already exists in the cloud, without ever clobbering a
// status change made from a different machine.
function contentFingerprint(app: Application): string {
  return JSON.stringify({
    company: app.company,
    role: app.role,
    jobUrl: app.jobUrl ?? null,
    jobPostingSource: app.jobPostingSource,
    location: app.location ?? null,
    keywords: app.keywords ?? [],
    fitRating: app.fitRating ?? null,
    fitSummary: app.fitSummary ?? null,
    tailored: app.tailored,
    jobPostingFile: app.jobPostingFile,
    resumeFile: app.resumeFile ?? null,
    resumePdf: app.resumePdf ?? null,
    coverLetterFile: app.coverLetterFile ?? null,
    coverLetterPdf: app.coverLetterPdf ?? null,
    interestFile: app.interestFile ?? null,
  })
}

async function diffLocalAndCloud(): Promise<{
  localOnly: Application[]
  cloudOnly: Application[]
  updated: Application[]
}> {
  const [localApps, c] = [await getLocalApplications(), await getClient()]
  const { data } = await c.models.Application.list()
  const cloudApps = data.map(mapRecord)
  const localIds = new Set(localApps.map((a) => a.id))
  const cloudById = new Map(cloudApps.map((a) => [a.id, a]))
  const updated: Application[] = []
  for (const localApp of localApps) {
    const cloudApp = cloudById.get(localApp.id)
    if (cloudApp && contentFingerprint(localApp) !== contentFingerprint(cloudApp)) {
      updated.push(localApp)
    }
  }
  return {
    localOnly: localApps.filter((app) => !cloudById.has(app.id)),
    cloudOnly: cloudApps.filter((app) => !localIds.has(app.id)),
    updated,
  }
}

function textToBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)))
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function uploadApplicationFiles(app: Application) {
  const files: { filename: string; contentType: string }[] = [
    { filename: app.jobPostingFile, contentType: 'text/markdown' },
  ]
  if (app.tailored) {
    if (app.resumeFile) files.push({ filename: app.resumeFile, contentType: 'text/markdown' })
    if (app.coverLetterFile) {
      files.push({ filename: app.coverLetterFile, contentType: 'text/markdown' })
    }
    if (app.resumePdf) files.push({ filename: app.resumePdf, contentType: 'application/pdf' })
    if (app.coverLetterPdf) {
      files.push({ filename: app.coverLetterPdf, contentType: 'application/pdf' })
    }
  }
  if (app.interestFile) files.push({ filename: app.interestFile, contentType: 'text/markdown' })

  for (const file of files) {
    const res = await fetch(`/applications/${app.id}/${file.filename}`)
    if (!res.ok) throw new Error(`Could not read local file ${file.filename}`)
    const data = file.contentType === 'application/pdf' ? await res.blob() : await res.text()
    await uploadData({
      path: applicationPath(app.id, file.filename),
      data,
      options: { contentType: file.contentType },
    }).result
  }
}

async function syncOneApplication(app: Application) {
  const c = await getClient()
  await uploadApplicationFiles(app)

  const { errors } = await c.models.Application.create({
    applicationId: app.id,
    company: app.company,
    role: app.role,
    // Local dateAdded values are bare local-time strings (no timezone),
    // which AppSync's AWSDateTime scalar rejects — Date() parses that as
    // local time per the ES spec, so this preserves the actual moment.
    dateAdded: new Date(app.dateAdded).toISOString(),
    jobUrl: app.jobUrl,
    jobPostingSource: app.jobPostingSource,
    location: app.location,
    keywords: app.keywords,
    status: app.status,
    fitRating: app.fitRating,
    fitSummary: app.fitSummary,
    tailored: app.tailored,
    jobPostingFile: app.jobPostingFile,
    resumeFile: app.resumeFile,
    resumePdf: app.resumePdf,
    coverLetterFile: app.coverLetterFile,
    coverLetterPdf: app.coverLetterPdf,
    interestFile: app.interestFile,
  })
  if (errors) throw new Error(errors.map((e) => e.message).join('; '))
}

// Deliberately omits `status` and `dateAdded` from the payload — those are
// never sourced from local files (see contentFingerprint), so leaving them
// out of the update means Amplify Data just doesn't touch them.
async function pushApplicationUpdate(app: Application) {
  const c = await getClient()
  await uploadApplicationFiles(app)

  const { errors } = await c.models.Application.update({
    applicationId: app.id,
    company: app.company,
    role: app.role,
    jobUrl: app.jobUrl,
    jobPostingSource: app.jobPostingSource,
    location: app.location,
    keywords: app.keywords,
    fitRating: app.fitRating,
    fitSummary: app.fitSummary,
    tailored: app.tailored,
    jobPostingFile: app.jobPostingFile,
    resumeFile: app.resumeFile,
    resumePdf: app.resumePdf,
    coverLetterFile: app.coverLetterFile,
    coverLetterPdf: app.coverLetterPdf,
    interestFile: app.interestFile,
  })
  if (errors) throw new Error(errors.map((e) => e.message).join('; '))
}

async function pullOneApplication(app: Application) {
  const files: { filename: string; contentBase64: string }[] = []

  const addTextFile = async (filename: string) => {
    const text = await downloadText(applicationPath(app.id, filename))
    files.push({ filename, contentBase64: textToBase64(text) })
  }
  const addBinaryFile = async (filename: string) => {
    const result = await downloadData({ path: applicationPath(app.id, filename) }).result
    const blob = await result.body.blob()
    files.push({ filename, contentBase64: await blobToBase64(blob) })
  }

  await addTextFile(app.jobPostingFile)
  if (app.tailored) {
    if (app.resumeFile) await addTextFile(app.resumeFile)
    if (app.coverLetterFile) await addTextFile(app.coverLetterFile)
    if (app.resumePdf) await addBinaryFile(app.resumePdf)
    if (app.coverLetterPdf) await addBinaryFile(app.coverLetterPdf)
  }
  if (app.interestFile) await addTextFile(app.interestFile)

  files.push({ filename: 'meta.json', contentBase64: textToBase64(JSON.stringify(app, null, 2)) })

  const res = await fetch('/api/write-application-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: app.id, files }),
  })
  if (!res.ok) throw new Error('Could not write local files — is `npm run dev` running?')
}

interface LocalFilesStatus {
  hasOriginalResume: boolean
  hasCoverLetterTemplate: boolean
  hasSettings: boolean
}

async function getLocalFilesStatus(): Promise<LocalFilesStatus> {
  const res = await fetch('/api/local-files-status')
  if (!res.ok) return { hasOriginalResume: false, hasCoverLetterTemplate: false, hasSettings: false }
  return res.json()
}

// Keeps the canonical resume, cover-letter template, and Settings in sync
// the same way applications are: push up if this machine has it and the
// cloud doesn't, pull down if the cloud has it and this machine doesn't.
// Claude Code's skills read these as plain local files, so a machine that's
// only ever pulled applications down still needs these to actually tailor
// anything.
async function syncSharedFiles() {
  const status = await getLocalFilesStatus()

  async function syncMarkdownFile(
    filename: 'original-resume.md' | 'cover-letter-template.md',
    hasLocal: boolean,
    uploadEndpoint: string,
  ) {
    const hasCloud = await fileExists(settingsPath(filename))
    if (hasLocal && !hasCloud) {
      const res = await fetch(`/${filename}`)
      if (res.ok) {
        const text = await res.text()
        await uploadData({
          path: settingsPath(filename),
          data: text,
          options: { contentType: 'text/markdown' },
        }).result
      }
    } else if (!hasLocal && hasCloud) {
      const text = await downloadText(settingsPath(filename))
      await fetch(uploadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/markdown' },
        body: text,
      })
    }
  }

  await syncMarkdownFile('original-resume.md', status.hasOriginalResume, '/api/upload-resume')
  await syncMarkdownFile(
    'cover-letter-template.md',
    status.hasCoverLetterTemplate,
    '/api/upload-cover-letter-template',
  )

  if (!status.hasSettings) {
    const c = await getClient()
    const { data } = await c.models.Settings.list()
    const record = data[0]
    if (record) {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: record.name ?? '',
          resumeFilename: record.resumeFilename ?? '',
          coverLetterFilename: record.coverLetterFilename ?? '',
          personalProjectRepos: (record.personalProjectRepos ?? []).filter(
            (r): r is string => r != null,
          ),
          manualProjects: record.manualProjectsJson ? JSON.parse(record.manualProjectsJson) : [],
        }),
      })
    }
  }
}

export const amplifyAdapter: StorageAdapter = {
  async listApplications() {
    const c = await getClient()
    const { data, errors } = await c.models.Application.list()
    if (errors) throw new Error(errors.map((e) => e.message).join('; '))
    return data.map(mapRecord).sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
  },

  async getDocument(application, kind) {
    await ensureAmplifyConfigured()
    if (kind === 'originalResume') {
      return downloadText(settingsPath('original-resume.md'))
    }
    const filename = application[DOC_FILE_KEY[kind]!] as string | undefined
    if (!filename) throw new Error(`No ${kind} file for this application`)
    return downloadText(applicationPath(application.id, filename))
  },

  async getDownloadUrl(application, kind) {
    await ensureAmplifyConfigured()
    const filename = kind === 'resume' ? application.resumePdf : application.coverLetterPdf
    if (!filename) throw new Error('No PDF available for this application')
    const { url } = await getUrl({ path: applicationPath(application.id, filename) })
    return url.toString()
  },

  async updateStatus(id, status) {
    const c = await getClient()
    const { errors } = await c.models.Application.update({ applicationId: id, status })
    if (errors) throw new Error(errors.map((e) => e.message).join('; '))
  },

  async deleteApplication(id) {
    const c = await getClient()
    const { errors } = await c.models.Application.delete({ applicationId: id })
    if (errors) throw new Error(errors.map((e) => e.message).join('; '))
    try {
      const { items } = await list({
        path: ({ identityId }) => `applications/${identityId}/${id}/`,
        options: { listAll: true },
      })
      await Promise.all(items.map((item) => remove({ path: item.path })))
    } catch {
      // Best-effort cleanup — the DB record is already gone, which is what the UI reflects.
    }
  },

  async getSettings() {
    const c = await getClient()
    const { data } = await c.models.Settings.list()
    const record = data[0]
    const [hasResume, hasCoverLetterTemplate] = await Promise.all([
      fileExists(settingsPath('original-resume.md')),
      fileExists(settingsPath('cover-letter-template.md')),
    ])
    if (!record) {
      return {
        name: '',
        resumeFilename: '',
        coverLetterFilename: '',
        personalProjectRepos: [],
        manualProjects: [],
        hasResume,
        hasCoverLetterTemplate,
      }
    }
    return {
      name: record.name ?? '',
      resumeFilename: record.resumeFilename ?? '',
      coverLetterFilename: record.coverLetterFilename ?? '',
      personalProjectRepos: (record.personalProjectRepos ?? []).filter(
        (r): r is string => r != null,
      ),
      manualProjects: record.manualProjectsJson
        ? (JSON.parse(record.manualProjectsJson) as ManualProject[])
        : [],
      hasResume,
      hasCoverLetterTemplate,
    }
  },

  async saveSettings(settings: SettingsData) {
    const c = await getClient()
    const { data } = await c.models.Settings.list()
    const existing = data[0]
    const payload = {
      name: settings.name,
      resumeFilename: settings.resumeFilename,
      coverLetterFilename: settings.coverLetterFilename,
      personalProjectRepos: settings.personalProjectRepos,
      manualProjectsJson: JSON.stringify(settings.manualProjects),
    }
    const { errors } = existing
      ? await c.models.Settings.update({ id: existing.id, ...payload })
      : await c.models.Settings.create(payload)
    if (errors) throw new Error(errors.map((e) => e.message).join('; '))
  },

  supportsReveal: false,
  async revealFile() {
    throw new Error('Revealing a file locally is not supported in cloud mode')
  },

  supportsListingCheck: false,
  async checkListing() {
    throw new Error('Listing checks are not supported in cloud mode yet')
  },

  supportsFileUpload: true,
  async uploadResume(file) {
    const text = await file.text()
    await uploadData({
      path: settingsPath('original-resume.md'),
      data: text,
      options: { contentType: 'text/markdown' },
    }).result
  },
  async uploadCoverLetterTemplate(file) {
    const text = await file.text()
    await uploadData({
      path: settingsPath('cover-letter-template.md'),
      data: text,
      options: { contentType: 'text/markdown' },
    }).result
  },

  supportsSync: true,
  async getPendingSyncCount() {
    await ensureAmplifyConfigured()
    const { localOnly, cloudOnly, updated } = await diffLocalAndCloud()
    return localOnly.length + cloudOnly.length + updated.length
  },
  async sync() {
    await ensureAmplifyConfigured()
    const { localOnly, cloudOnly, updated } = await diffLocalAndCloud()
    let pushed = 0
    let pulled = 0
    const failed: { id: string; error: string }[] = []

    for (const app of localOnly) {
      try {
        await syncOneApplication(app)
        pushed++
      } catch (err) {
        failed.push({ id: app.id, error: err instanceof Error ? err.message : 'Push failed' })
      }
    }
    for (const app of updated) {
      try {
        await pushApplicationUpdate(app)
        pushed++
      } catch (err) {
        failed.push({ id: app.id, error: err instanceof Error ? err.message : 'Update failed' })
      }
    }
    for (const app of cloudOnly) {
      try {
        await pullOneApplication(app)
        pulled++
      } catch (err) {
        failed.push({ id: app.id, error: err instanceof Error ? err.message : 'Pull failed' })
      }
    }
    try {
      await syncSharedFiles()
    } catch {
      // best-effort — Claude Code will just point out these are still missing
    }
    return { pushed, pulled, failed }
  },
}

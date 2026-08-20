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

async function getLocalOnlyApplications(): Promise<Application[]> {
  const localRes = await fetch('/applications-manifest.json')
  const localApps: Application[] = localRes.ok ? await localRes.json() : []
  if (localApps.length === 0) return []
  const c = await getClient()
  const { data } = await c.models.Application.list()
  const cloudIds = new Set(data.map((a) => a.applicationId))
  return localApps.filter((app) => !cloudIds.has(app.id))
}

async function syncOneApplication(app: Application) {
  const c = await getClient()
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

async function syncOriginalResumeIfMissing() {
  const hasResume = await fileExists(settingsPath('original-resume.md'))
  if (hasResume) return
  const res = await fetch('/original-resume.md')
  if (!res.ok) return
  const text = await res.text()
  await uploadData({
    path: settingsPath('original-resume.md'),
    data: text,
    options: { contentType: 'text/markdown' },
  }).result
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
    try {
      const pending = await getLocalOnlyApplications()
      return pending.length
    } catch {
      return 0
    }
  },
  async syncFromLocal() {
    await ensureAmplifyConfigured()
    const pending = await getLocalOnlyApplications()
    let added = 0
    const failed: { id: string; error: string }[] = []
    for (const app of pending) {
      try {
        await syncOneApplication(app)
        added++
      } catch (err) {
        failed.push({ id: app.id, error: err instanceof Error ? err.message : 'Sync failed' })
      }
    }
    try {
      await syncOriginalResumeIfMissing()
    } catch {
      // best-effort — keyword compare just won't have a baseline until this succeeds
    }
    return { added, failed }
  },
}

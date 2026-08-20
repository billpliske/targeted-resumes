import type { Application } from '../../types'
import type {
  CheckListingResult,
  DocKind,
  SettingsData,
  SettingsResult,
  StorageAdapter,
} from './types'

const DOC_FILE_KEY: Partial<Record<DocKind, keyof Application>> = {
  jobPosting: 'jobPostingFile',
  resume: 'resumeFile',
  coverLetter: 'coverLetterFile',
  interest: 'interestFile',
}

async function uploadMarkdownFile(endpoint: string, file: File) {
  const text = await file.text()
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'text/markdown' },
    body: text,
  })
  if (!res.ok) throw new Error('Upload failed')
}

export const localAdapter: StorageAdapter = {
  async listApplications() {
    const res = await fetch('/applications-manifest.json')
    if (!res.ok) return []
    try {
      return (await res.json()) as Application[]
    } catch {
      // A missing static file 200s into Vite's SPA index.html fallback
      // rather than a clean 404 — no manifest yet just means no apps yet.
      return []
    }
  },

  async getDocument(application, kind) {
    const baseUrl = `/applications/${application.id}`
    const url =
      kind === 'originalResume'
        ? '/original-resume.md'
        : `${baseUrl}/${application[DOC_FILE_KEY[kind]!]}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load ${kind}`)
    return res.text()
  },

  async getDownloadUrl(application, kind) {
    const file = kind === 'resume' ? application.resumePdf : application.coverLetterPdf
    return `/applications/${application.id}/${file}`
  },

  async updateStatus(id, status) {
    const res = await fetch('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (!res.ok) throw new Error('Request failed')
  },

  async deleteApplication(id) {
    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) throw new Error('Request failed')
  },

  async getSettings() {
    const res = await fetch('/api/settings')
    if (!res.ok) {
      return {
        name: '',
        resumeFilename: '',
        coverLetterFilename: '',
        personalProjectRepos: [],
        manualProjects: [],
        hasResume: false,
        hasCoverLetterTemplate: false,
      }
    }
    return (await res.json()) as SettingsResult
  },

  async saveSettings(settings: SettingsData) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (!res.ok) throw new Error('Request failed')
  },

  supportsReveal: true,
  async revealFile(id, file) {
    const res = await fetch('/api/reveal-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, file }),
    })
    if (!res.ok) throw new Error('Request failed')
  },

  supportsListingCheck: true,
  async checkListing(id) {
    const res = await fetch('/api/check-listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) throw new Error('Request failed')
    return (await res.json()) as CheckListingResult
  },

  supportsFileUpload: true,
  async uploadResume(file) {
    await uploadMarkdownFile('/api/upload-resume', file)
  },
  async uploadCoverLetterTemplate(file) {
    await uploadMarkdownFile('/api/upload-cover-letter-template', file)
  },

  supportsSync: false,
  async getPendingSyncCount() {
    return 0
  },
  async sync() {
    throw new Error('Sync is not applicable in local mode')
  },
}

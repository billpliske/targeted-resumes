import type { Application, ApplicationStatus } from '../../types'

export interface ManualProject {
  name: string
  description: string
  details: string
}

export interface SettingsData {
  name: string
  resumeFilename: string
  coverLetterFilename: string
  personalProjectRepos: string[]
  manualProjects: ManualProject[]
}

export interface SettingsResult extends SettingsData {
  hasResume: boolean
  hasCoverLetterTemplate: boolean
}

export type DocKind = 'jobPosting' | 'resume' | 'coverLetter' | 'originalResume' | 'interest'

export interface CheckListingResult {
  outcome: 'broken' | 'filled' | 'inconclusive'
}

export interface SyncResult {
  added: number
  failed: { id: string; error: string }[]
}

/**
 * One implementation reads/writes local files via the Vite dev-server's
 * /api/* routes (today's behavior, unchanged); the other reads/writes
 * Amplify Data + Storage directly. Feature-support flags let the UI hide
 * actions an adapter doesn't implement rather than every method needing to
 * exist everywhere.
 */
export interface StorageAdapter {
  listApplications(): Promise<Application[]>
  getDocument(application: Application, kind: DocKind): Promise<string>
  getDownloadUrl(application: Application, kind: 'resume' | 'coverLetter'): Promise<string>
  updateStatus(id: string, status: ApplicationStatus): Promise<void>
  deleteApplication(id: string): Promise<void>
  getSettings(): Promise<SettingsResult>
  saveSettings(settings: SettingsData): Promise<void>

  readonly supportsReveal: boolean
  revealFile(id: string, file: 'resume' | 'coverLetter'): Promise<void>

  readonly supportsListingCheck: boolean
  checkListing(id: string): Promise<CheckListingResult>

  readonly supportsFileUpload: boolean
  uploadResume(file: File): Promise<void>
  uploadCoverLetterTemplate(file: File): Promise<void>

  // Pushes applications that exist in local files (written by the
  // add-application/check-fit Claude Code skills) but not yet in the cloud
  // database — only meaningful in cloud mode, driven by a manual "Sync now"
  // button rather than anything automatic.
  readonly supportsSync: boolean
  getPendingSyncCount(): Promise<number>
  syncFromLocal(): Promise<SyncResult>
}

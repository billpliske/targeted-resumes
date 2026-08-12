export type ApplicationStatus =
  | 'not_applied'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'

export const APPLICATION_STATUSES: {
  value: ApplicationStatus
  label: string
}[] = [
  { value: 'not_applied', label: 'Not applied' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

export interface Application {
  id: string
  company: string
  role: string
  dateAdded: string
  jobUrl?: string
  jobPostingSource: 'url' | 'pasted'
  location?: string
  keywords?: string[]
  status: ApplicationStatus
  jobPostingFile: string
  resumeFile: string
  resumePdf: string
  coverLetterFile: string
  coverLetterPdf: string
}

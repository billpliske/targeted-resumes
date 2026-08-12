export type ApplicationStatus =
  | 'not_applied'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'filled'

export const APPLICATION_STATUSES: {
  value: ApplicationStatus
  label: string
}[] = [
  { value: 'not_applied', label: 'Not applied' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'filled', label: 'Filled' },
]

export type FitRating = 'strong' | 'good' | 'partial' | 'stretch'

export const FIT_RATING_LABELS: Record<FitRating, string> = {
  strong: 'Strong match',
  good: 'Good match',
  partial: 'Partial match',
  stretch: 'Stretch',
}

export const FIT_RATING_ORDER: Record<FitRating, number> = {
  strong: 0,
  good: 1,
  partial: 2,
  stretch: 3,
}

export type SortOrder = 'date' | 'fit'

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
  fitRating?: FitRating
  fitSummary?: string
  tailored: boolean
  jobPostingFile: string
  resumeFile?: string
  resumePdf?: string
  coverLetterFile?: string
  coverLetterPdf?: string
}

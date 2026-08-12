import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Application, ApplicationStatus } from '../types'
import MarkdownView from './MarkdownView'
import KeywordCompare from './KeywordCompare'
import StatusSelect from './StatusSelect'

interface ApplicationDetailProps {
  application: Application
  onBack: () => void
  onStatusChange: (id: string, status: ApplicationStatus) => void
  onDelete: (id: string, label: string) => void
}

type DocKey = 'jobPosting' | 'resume' | 'coverLetter' | 'originalResume'

type TabKey = 'posting' | 'keywords' | 'resume' | 'coverLetter'

function ApplicationDetail({
  application,
  onBack,
  onStatusChange,
  onDelete,
}: ApplicationDetailProps) {
  const [docs, setDocs] = useState<Record<DocKey, string | null>>({
    jobPosting: null,
    resume: null,
    coverLetter: null,
    originalResume: null,
  })
  const [activeTab, setActiveTab] = useState<TabKey>('posting')

  const baseUrl = `/applications/${application.id}`
  const hasKeywords = (application.keywords?.length ?? 0) > 0

  useEffect(() => {
    let cancelled = false

    const files: Record<DocKey, string> = {
      jobPosting: `${baseUrl}/${application.jobPostingFile}`,
      resume: `${baseUrl}/${application.resumeFile}`,
      coverLetter: `${baseUrl}/${application.coverLetterFile}`,
      originalResume: '/original-resume.md',
    }

    Object.entries(files).forEach(([key, url]) => {
      fetch(url)
        .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
        .then((text) => {
          if (!cancelled) {
            setDocs((prev) => ({ ...prev, [key as DocKey]: text }))
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDocs((prev) => ({
              ...prev,
              [key as DocKey]: '_Could not load this file._',
            }))
          }
        })
    })

    return () => {
      cancelled = true
    }
  }, [application, baseUrl])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'posting', label: 'Job posting' },
    ...(hasKeywords
      ? [{ key: 'keywords' as TabKey, label: 'Keyword targeting' }]
      : []),
    { key: 'resume', label: 'Resume' },
    { key: 'coverLetter', label: 'Cover letter' },
  ]

  return (
    <div className="application-detail">
      <button type="button" className="back-link" onClick={onBack}>
        &larr; Back to applications
      </button>

      <header className="detail-header">
        <div className="detail-header-top">
          <h1>{application.role}</h1>
          <div className="detail-header-actions">
            <StatusSelect
              id={application.id}
              status={application.status}
              onChange={onStatusChange}
            />
            <button
              type="button"
              className="delete-button"
              aria-label={`Delete ${application.role} at ${application.company}`}
              onClick={() =>
                onDelete(
                  application.id,
                  `${application.role} at ${application.company}`,
                )
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <p className="detail-subhead">
          {application.company}
          {application.location ? ` — ${application.location}` : ''}
        </p>
        {application.jobUrl && (
          <a href={application.jobUrl} target="_blank" rel="noreferrer">
            View original job posting
          </a>
        )}
      </header>

      <nav className="detail-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={tab.key === activeTab ? 'active' : ''}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'posting' && (
        <section className="detail-section">
          {docs.jobPosting ? (
            <MarkdownView content={docs.jobPosting} />
          ) : (
            <p>Loading…</p>
          )}
        </section>
      )}

      {activeTab === 'keywords' && hasKeywords && (
        <section className="detail-section">
          <p className="detail-hint">
            Terms pulled from the job posting, and how often they appear in
            your original resume versus this tailored version.
          </p>
          {docs.originalResume && docs.resume ? (
            <KeywordCompare
              keywords={application.keywords ?? []}
              originalText={docs.originalResume}
              tailoredText={docs.resume}
            />
          ) : (
            <p>Loading…</p>
          )}
        </section>
      )}

      {activeTab === 'resume' && (
        <section className="detail-section">
          <div className="detail-section-heading">
            <a href={`${baseUrl}/${application.resumePdf}`} download>
              Download PDF
            </a>
          </div>
          {docs.resume ? (
            <MarkdownView content={docs.resume} />
          ) : (
            <p>Loading…</p>
          )}
        </section>
      )}

      {activeTab === 'coverLetter' && (
        <section className="detail-section">
          <div className="detail-section-heading">
            <a href={`${baseUrl}/${application.coverLetterPdf}`} download>
              Download PDF
            </a>
          </div>
          {docs.coverLetter ? (
            <MarkdownView content={docs.coverLetter} />
          ) : (
            <p>Loading…</p>
          )}
        </section>
      )}
    </div>
  )
}

export default ApplicationDetail

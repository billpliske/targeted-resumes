import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Application, ApplicationStatus } from '../types'
import MarkdownView from './MarkdownView'
import KeywordCompare from './KeywordCompare'
import StatusSelect from './StatusSelect'
import FitBadge from './FitBadge'

interface ApplicationDetailProps {
  application: Application
  onBack: () => void
  onStatusChange: (id: string, status: ApplicationStatus) => void
  onDelete: (id: string, label: string) => void
}

type DocKey = 'jobPosting' | 'resume' | 'coverLetter' | 'originalResume'

type TabKey = 'posting' | 'keywords' | 'resume' | 'coverLetter'

// The on-disk filename is the same for every application (from Settings),
// so a plain download would collide/overwrite across companies in the
// Downloads folder — suffix the downloaded name with the company to keep
// them distinct without renaming anything on disk.
function withCompanySuffix(filename: string, company: string) {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return `${filename} - ${company}`
  return `${filename.slice(0, dot)} - ${company}${filename.slice(dot)}`
}

// Label matches what the reveal endpoint can actually do per OS: Finder
// selects the exact file on macOS, so does Explorer on Windows, but Linux
// has no universal "select this file" command across file managers — it
// can only open the containing folder, so the label shouldn't overclaim.
function revealButtonLabel() {
  const platform = navigator.platform || ''
  if (platform.startsWith('Mac')) return 'Reveal in Finder'
  if (platform.startsWith('Win')) return 'Show in Explorer'
  return 'Open folder'
}

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
  const [revealError, setRevealError] = useState<string | null>(null)

  const baseUrl = `/applications/${application.id}`
  const hasKeywords = (application.keywords?.length ?? 0) > 0

  async function handleReveal(file: 'resume' | 'coverLetter') {
    setRevealError(null)
    try {
      const res = await fetch('/api/reveal-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: application.id, file }),
      })
      if (!res.ok) throw new Error('Request failed')
    } catch {
      setRevealError(
        "Couldn't open Finder. Make sure `npm run dev` is running, then try again.",
      )
    }
  }

  useEffect(() => {
    let cancelled = false

    const files: Partial<Record<DocKey, string>> = {
      jobPosting: `${baseUrl}/${application.jobPostingFile}`,
    }
    if (application.tailored) {
      files.resume = `${baseUrl}/${application.resumeFile}`
      files.coverLetter = `${baseUrl}/${application.coverLetterFile}`
      files.originalResume = '/original-resume.md'
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
    ...(application.tailored
      ? [
          ...(hasKeywords
            ? [{ key: 'keywords' as TabKey, label: 'Keyword targeting' }]
            : []),
          { key: 'resume' as TabKey, label: 'Resume' },
          { key: 'coverLetter' as TabKey, label: 'Cover letter' },
        ]
      : []),
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
        {application.fitRating && (
          <div className="fit-summary">
            <FitBadge rating={application.fitRating} />
            {application.fitSummary && <p>{application.fitSummary}</p>}
          </div>
        )}
        {!application.tailored && (
          <p className="screened-only-hint">
            Screened only — no resume or cover letter generated yet. Ask
            Claude Code to "fully tailor the {application.company} application"
            to generate them for this posting.
          </p>
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

      {activeTab === 'resume' && application.resumePdf && (
        <section className="detail-section">
          <div className="detail-section-heading">
            <button
              type="button"
              className="reveal-button"
              onClick={() => handleReveal('resume')}
            >
              {revealButtonLabel()}
            </button>
            <a
              href={`${baseUrl}/${application.resumePdf}`}
              download={withCompanySuffix(application.resumePdf, application.company)}
            >
              Download PDF
            </a>
          </div>
          {revealError && <p className="settings-error">{revealError}</p>}
          {docs.resume ? (
            <MarkdownView content={docs.resume} />
          ) : (
            <p>Loading…</p>
          )}
        </section>
      )}

      {activeTab === 'coverLetter' && application.coverLetterPdf && (
        <section className="detail-section">
          <div className="detail-section-heading">
            <button
              type="button"
              className="reveal-button"
              onClick={() => handleReveal('coverLetter')}
            >
              {revealButtonLabel()}
            </button>
            <a
              href={`${baseUrl}/${application.coverLetterPdf}`}
              download={withCompanySuffix(application.coverLetterPdf, application.company)}
            >
              Download PDF
            </a>
          </div>
          {revealError && <p className="settings-error">{revealError}</p>}
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

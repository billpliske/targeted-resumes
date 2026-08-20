import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Application, ApplicationStatus } from '../types'
import { storage } from '../lib/storage'
import MarkdownView from './MarkdownView'
import KeywordCompare from './KeywordCompare'
import StatusSelect from './StatusSelect'
import FitBadge from './FitBadge'
import Tooltip from './Tooltip'

interface ApplicationDetailProps {
  application: Application
  onBack: () => void
  onStatusChange: (id: string, status: ApplicationStatus) => void
  onDelete: (id: string, label: string) => void
}

type DocKey = 'jobPosting' | 'resume' | 'coverLetter' | 'originalResume' | 'interest'

type TabKey = 'posting' | 'keywords' | 'resume' | 'coverLetter' | 'interest'

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
    interest: null,
  })
  const [downloadUrls, setDownloadUrls] = useState<{
    resume: string | null
    coverLetter: string | null
  }>({ resume: null, coverLetter: null })
  const [activeTab, setActiveTab] = useState<TabKey>('posting')
  const [revealError, setRevealError] = useState<string | null>(null)

  const hasKeywords = (application.keywords?.length ?? 0) > 0

  async function handleReveal(file: 'resume' | 'coverLetter') {
    setRevealError(null)
    try {
      await storage.revealFile(application.id, file)
    } catch {
      setRevealError("Couldn't open Finder. Please try again.")
    }
  }

  useEffect(() => {
    let cancelled = false

    const docKinds: DocKey[] = ['jobPosting']
    if (application.tailored) docKinds.push('resume', 'coverLetter', 'originalResume')
    if (application.interestFile) docKinds.push('interest')

    docKinds.forEach((kind) => {
      storage
        .getDocument(application, kind)
        .then((text) => {
          if (!cancelled) setDocs((prev) => ({ ...prev, [kind]: text }))
        })
        .catch(() => {
          if (!cancelled) {
            setDocs((prev) => ({ ...prev, [kind]: '_Could not load this file._' }))
          }
        })
    })

    if (application.tailored) {
      if (application.resumePdf) {
        storage
          .getDownloadUrl(application, 'resume')
          .then((url) => {
            if (!cancelled) setDownloadUrls((prev) => ({ ...prev, resume: url }))
          })
          .catch(() => {})
      }
      if (application.coverLetterPdf) {
        storage
          .getDownloadUrl(application, 'coverLetter')
          .then((url) => {
            if (!cancelled) setDownloadUrls((prev) => ({ ...prev, coverLetter: url }))
          })
          .catch(() => {})
      }
    }

    return () => {
      cancelled = true
    }
  }, [application])

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
    ...(application.interestFile
      ? [{ key: 'interest' as TabKey, label: 'Interest' }]
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
            <Tooltip label="Permanently deletes this application's resume, cover letter, and job posting files">
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
            </Tooltip>
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
            {storage.supportsReveal && (
              <Tooltip label="Opens your file manager with this exact PDF selected, in its real application folder">
                <button
                  type="button"
                  className="reveal-button"
                  onClick={() => handleReveal('resume')}
                >
                  {revealButtonLabel()}
                </button>
              </Tooltip>
            )}
            {downloadUrls.resume && (
              <a
                href={downloadUrls.resume}
                download={withCompanySuffix(application.resumePdf, application.company)}
              >
                Download PDF
              </a>
            )}
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
            {storage.supportsReveal && (
              <Tooltip label="Opens your file manager with this exact PDF selected, in its real application folder">
                <button
                  type="button"
                  className="reveal-button"
                  onClick={() => handleReveal('coverLetter')}
                >
                  {revealButtonLabel()}
                </button>
              </Tooltip>
            )}
            {downloadUrls.coverLetter && (
              <a
                href={downloadUrls.coverLetter}
                download={withCompanySuffix(application.coverLetterPdf, application.company)}
              >
                Download PDF
              </a>
            )}
          </div>
          {revealError && <p className="settings-error">{revealError}</p>}
          {docs.coverLetter ? (
            <MarkdownView content={docs.coverLetter} />
          ) : (
            <p>Loading…</p>
          )}
        </section>
      )}

      {activeTab === 'interest' && application.interestFile && (
        <section className="detail-section">
          <p className="detail-hint">
            A ready-to-paste answer for "Why are you interested in working
            for our company?"-style application questions.
          </p>
          {docs.interest ? (
            <MarkdownView content={docs.interest} />
          ) : (
            <p>Loading…</p>
          )}
        </section>
      )}
    </div>
  )
}

export default ApplicationDetail

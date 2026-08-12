import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Application, ApplicationStatus } from '../types'
import StatusSelect from './StatusSelect'

interface ApplicationListProps {
  applications: Application[]
  statusFilter: ApplicationStatus | null
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: ApplicationStatus) => void
  onDelete: (id: string, label: string) => void
}

function formatDate(dateAdded: string) {
  const date = new Date(`${dateAdded}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function matches(app: Application, query: string) {
  const haystack = [app.company, app.role, ...(app.keywords ?? [])]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function ApplicationList({
  applications,
  statusFilter,
  onSelect,
  onStatusChange,
  onDelete,
}: ApplicationListProps) {
  const [query, setQuery] = useState('')

  const sorted = useMemo(
    () =>
      [...applications].sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)),
    [applications],
  )

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return sorted.filter((app) => {
      if (statusFilter && app.status !== statusFilter) return false
      if (normalized && !matches(app, normalized)) return false
      return true
    })
  }, [sorted, query, statusFilter])

  if (applications.length === 0) {
    return (
      <div className="empty-state">
        <h2>No applications yet</h2>
        <p>
          Ask Claude Code to tailor your resume for a job posting — new
          applications will show up here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="application-list-wrap">
      <input
        type="search"
        className="application-search"
        placeholder="Search by company, role, or keyword…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search applications"
      />

      {filtered.length === 0 ? (
        <p className="detail-hint">No applications match this search.</p>
      ) : (
        <ul className="application-list">
          {filtered.map((app) => (
            <li key={app.id}>
              <div
                className="application-row"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(app.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect(app.id)
                }}
              >
                <span className="application-role">{app.role}</span>
                <span className="application-company">{app.company}</span>
                <span className="application-date">
                  {formatDate(app.dateAdded)}
                </span>
                <StatusSelect
                  id={app.id}
                  status={app.status}
                  onChange={onStatusChange}
                />
                <button
                  type="button"
                  className="delete-button"
                  aria-label={`Delete ${app.role} at ${app.company}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(app.id, `${app.role} at ${app.company}`)
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ApplicationList

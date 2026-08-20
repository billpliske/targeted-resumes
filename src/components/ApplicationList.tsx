import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  FIT_RATING_ORDER,
  type Application,
  type ApplicationStatus,
  type SortOrder,
} from '../types'
import StatusSelect from './StatusSelect'
import FitBadge from './FitBadge'
import Tooltip from './Tooltip'

interface ApplicationListProps {
  applications: Application[]
  statusFilter: ApplicationStatus | null
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: ApplicationStatus) => void
  onDelete: (id: string, label: string) => void
}

function formatDate(dateAdded: string) {
  const date = new Date(dateAdded)
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

function sortApplications(applications: Application[], order: SortOrder) {
  const list = [...applications]
  const filledRank = (app: Application) => (app.status === 'filled' ? 1 : 0)

  if (order === 'fit') {
    list.sort((a, b) => {
      const filledDiff = filledRank(a) - filledRank(b)
      if (filledDiff !== 0) return filledDiff
      const rank = (app: Application) =>
        app.fitRating ? FIT_RATING_ORDER[app.fitRating] : 99
      const diff = rank(a) - rank(b)
      return diff !== 0 ? diff : b.dateAdded.localeCompare(a.dateAdded)
    })
    return list
  }
  list.sort((a, b) => {
    const filledDiff = filledRank(a) - filledRank(b)
    return filledDiff !== 0 ? filledDiff : b.dateAdded.localeCompare(a.dateAdded)
  })
  return list
}

function ApplicationList({
  applications,
  statusFilter,
  onSelect,
  onStatusChange,
  onDelete,
}: ApplicationListProps) {
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('date')

  const sorted = useMemo(
    () => sortApplications(applications, sortOrder),
    [applications, sortOrder],
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
      <div className="application-list-controls">
        <input
          type="search"
          className="application-search"
          placeholder="Search by company, role, or keyword…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search applications"
        />
        <select
          className="sort-select"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          aria-label="Sort applications"
        >
          <option value="date">Sort: Date added</option>
          <option value="fit">Sort: Fit rating</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="detail-hint">No applications match this search.</p>
      ) : (
        <ul className="application-list">
          {filtered.map((app) => (
            <li key={app.id}>
              <div
                className={`application-row ${app.status === 'filled' ? 'application-row--filled' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(app.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onSelect(app.id)
                }}
              >
                <span className="application-role-wrap">
                  <span className="application-role">{app.role}</span>
                  {app.fitRating && <FitBadge rating={app.fitRating} />}
                  {!app.tailored && (
                    <span className="screened-only-badge">Screened only</span>
                  )}
                </span>
                <span className="application-company" title={app.company}>
                  {app.company}
                </span>
                <span className="application-date">
                  {formatDate(app.dateAdded)}
                </span>
                <StatusSelect
                  id={app.id}
                  status={app.status}
                  onChange={onStatusChange}
                />
                <Tooltip label="Permanently deletes this application's resume, cover letter, and job posting files">
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
                </Tooltip>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ApplicationList

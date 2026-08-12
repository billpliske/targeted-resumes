import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from '../types'

interface StatusSummaryProps {
  applications: Application[]
  activeFilter: ApplicationStatus | null
  onFilterChange: (status: ApplicationStatus | null) => void
}

function StatusSummary({
  applications,
  activeFilter,
  onFilterChange,
}: StatusSummaryProps) {
  if (applications.length === 0) return null

  const counts = APPLICATION_STATUSES.map((s) => ({
    ...s,
    count: applications.filter((app) => app.status === s.value).length,
  }))

  return (
    <div className="status-summary">
      <button
        type="button"
        className={`status-tile status-tile-all ${activeFilter === null ? 'active' : ''}`}
        onClick={() => onFilterChange(null)}
      >
        <span className="status-tile-count">{applications.length}</span>
        <span className="status-tile-label">Total</span>
      </button>
      {counts.map((s) => (
        <button
          key={s.value}
          type="button"
          className={`status-tile status-${s.value} ${activeFilter === s.value ? 'active' : ''}`}
          onClick={() =>
            onFilterChange(activeFilter === s.value ? null : s.value)
          }
        >
          <span className="status-tile-count">{s.count}</span>
          <span className="status-tile-label">{s.label}</span>
        </button>
      ))}
    </div>
  )
}

export default StatusSummary

import { APPLICATION_STATUSES, type ApplicationStatus } from '../types'

interface StatusSelectProps {
  id: string
  status: ApplicationStatus
  onChange: (id: string, status: ApplicationStatus) => void
}

function StatusSelect({ id, status, onChange }: StatusSelectProps) {
  return (
    <select
      className={`status-select status-${status}`}
      value={status}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(id, e.target.value as ApplicationStatus)}
      aria-label="Application status"
    >
      {APPLICATION_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  )
}

export default StatusSelect

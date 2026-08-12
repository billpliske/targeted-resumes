import { useEffect, useState } from 'react'
import type { Application, ApplicationStatus } from './types'
import ApplicationList from './components/ApplicationList'
import ApplicationDetail from './components/ApplicationDetail'
import AddApplication from './components/AddApplication'
import StatusSummary from './components/StatusSummary'
import './App.css'

function App() {
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | null>(
    null,
  )

  useEffect(() => {
    fetch('/applications-manifest.json')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Application[]) => setApplications(data))
      .catch(() => setApplications([]))
  }, [])

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    const previous = applications
    setApplications((apps) =>
      apps.map((app) => (app.id === id ? { ...app, status } : app)),
    )

    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error('Request failed')
    } catch {
      setApplications(previous)
      alert(
        "Couldn't save that status change. Make sure `npm run dev` is running, then try again.",
      )
    }
  }

  async function handleDelete(id: string, label: string) {
    const confirmed = window.confirm(
      `Delete "${label}"? This permanently removes its resume, cover letter, and job posting files from disk. This can't be undone.`,
    )
    if (!confirmed) return

    try {
      const res = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Request failed')
      setApplications((apps) => apps.filter((app) => app.id !== id))
      setSelectedId((current) => (current === id ? null : current))
    } catch {
      alert(
        "Couldn't delete that application. Make sure `npm run dev` is running, then try again.",
      )
    }
  }

  const selected = applications.find((app) => app.id === selectedId) ?? null

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Resume Targeter</h1>
        <p>Tailored resumes and cover letters, organized by application.</p>
      </header>

      <main>
        {selected ? (
          <ApplicationDetail
            application={selected}
            onBack={() => setSelectedId(null)}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        ) : (
          <>
            <AddApplication />
            <StatusSummary
              applications={applications}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
            />
            <ApplicationList
              applications={applications}
              statusFilter={statusFilter}
              onSelect={(id) => setSelectedId(id)}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          </>
        )}
      </main>
    </div>
  )
}

export default App

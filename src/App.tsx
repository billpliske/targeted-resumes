import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { Application, ApplicationStatus } from './types'
import ApplicationList from './components/ApplicationList'
import ApplicationDetail from './components/ApplicationDetail'
import AddApplication from './components/AddApplication'
import StatusSummary from './components/StatusSummary'
import './App.css'

interface CheckProgress {
  current: number
  total: number
}

interface CheckListingResponse {
  outcome: 'broken' | 'filled' | 'inconclusive'
}

function App() {
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | null>(
    null,
  )
  const [checkProgress, setCheckProgress] = useState<CheckProgress | null>(
    null,
  )
  const [checkSummary, setCheckSummary] = useState<string | null>(null)

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

  async function handleCheckListings() {
    const eligible = applications.filter(
      (app) => app.jobUrl && app.status !== 'filled',
    )
    if (eligible.length === 0) {
      setCheckSummary('Nothing to check — no open applications have a job URL.')
      setTimeout(() => setCheckSummary(null), 5000)
      return
    }

    let filledCount = 0
    let brokenCount = 0
    let inconclusiveCount = 0

    for (let i = 0; i < eligible.length; i++) {
      const app = eligible[i]
      setCheckProgress({ current: i + 1, total: eligible.length })

      try {
        const res = await fetch('/api/check-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: app.id }),
        })
        if (!res.ok) throw new Error('Request failed')
        const data: CheckListingResponse = await res.json()

        if (data.outcome === 'filled' || data.outcome === 'broken') {
          if (data.outcome === 'filled') filledCount++
          else brokenCount++
          setApplications((apps) =>
            apps.map((a) =>
              a.id === app.id ? { ...a, status: 'filled' } : a,
            ),
          )
        } else {
          inconclusiveCount++
        }
      } catch {
        inconclusiveCount++
      }
    }

    setCheckProgress(null)

    const markedCount = filledCount + brokenCount
    const listingWord = `listing${eligible.length === 1 ? '' : 's'}`

    let summary: string
    if (markedCount === 0) {
      summary = `Checked ${eligible.length} ${listingWord} — couldn't confirm a status for any of them, so nothing changed.`
    } else {
      const detail =
        filledCount > 0 && brokenCount > 0
          ? `${filledCount} closed, ${brokenCount} broken link${brokenCount === 1 ? '' : 's'}`
          : filledCount > 0
            ? `${filledCount} closed posting${filledCount === 1 ? '' : 's'}`
            : `${brokenCount} broken link${brokenCount === 1 ? '' : 's'}`
      summary = `Checked ${eligible.length} ${listingWord} — marked ${markedCount} Filled (${detail})`
      if (inconclusiveCount > 0) {
        summary += `; couldn't confirm the rest (${inconclusiveCount})`
      }
      summary += '.'
    }
    setCheckSummary(summary)
    setTimeout(() => setCheckSummary(null), 10000)
  }

  const selected = applications.find((app) => app.id === selectedId) ?? null

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Targeted Resumes</h1>
          <p>Tailored resumes and cover letters, organized by application.</p>
        </div>
        {!selected && applications.length > 0 && (
          <div className="check-listings">
            <button
              type="button"
              className="check-listings-button"
              onClick={handleCheckListings}
              disabled={checkProgress !== null}
            >
              <RefreshCw
                size={16}
                className={checkProgress ? 'spin' : undefined}
              />
              {checkProgress
                ? `Checking ${checkProgress.current} of ${checkProgress.total}…`
                : 'Check listings'}
            </button>
            {checkSummary && (
              <p className="check-listings-summary">{checkSummary}</p>
            )}
          </div>
        )}
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
          <div className="home-layout">
            <AddApplication />
            <div className="home-main">
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
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App

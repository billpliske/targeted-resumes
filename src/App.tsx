import { useEffect, useState } from 'react'
import { KeyRound, LogOut, RefreshCw, Settings as SettingsIcon, UploadCloud } from 'lucide-react'
import type { Application, ApplicationStatus } from './types'
import ApplicationList from './components/ApplicationList'
import ApplicationDetail from './components/ApplicationDetail'
import AddApplication from './components/AddApplication'
import StatusSummary from './components/StatusSummary'
import Settings from './components/Settings'
import Tooltip from './components/Tooltip'
import Login from './components/Login'
import ChangePassword from './components/ChangePassword'
import { getSignedInEmail, logout } from './lib/auth'
import { isCloudMode, storage } from './lib/storage'
import './App.css'

interface CheckProgress {
  current: number
  total: number
}

// Simple major.minor.patch comparison — deliberately not a blind
// inequality check. A local version can legitimately be *ahead* of
// what's pushed to GitHub (e.g. bumped locally but not yet committed),
// and showing "update available" in that case would be a false signal.
function isNewerVersion(remote: string, local: string): boolean {
  const toParts = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0)
  const [remoteMajor, remoteMinor, remotePatch] = toParts(remote)
  const [localMajor, localMinor, localPatch] = toParts(local)
  if (remoteMajor !== localMajor) return remoteMajor > localMajor
  if (remoteMinor !== localMinor) return remoteMinor > localMinor
  return remotePatch > localPatch
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [repoUrl, setRepoUrl] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(!isCloudMode)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncSummary, setSyncSummary] = useState<string | null>(null)

  useEffect(() => {
    if (!isCloudMode) return
    getSignedInEmail().then((email) => {
      setSignedInEmail(email)
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    fetch('/api/latest-version')
      .then((res) => (res.ok ? res.json() : { latestVersion: null }))
      .then((data: { latestVersion: string | null; repoUrl?: string }) => {
        setLatestVersion(data.latestVersion)
        setRepoUrl(data.repoUrl ?? null)
      })
      .catch(() => setLatestVersion(null))
  }, [])

  useEffect(() => {
    if (isCloudMode && !signedInEmail) return
    storage
      .listApplications()
      .then((data) => setApplications(data))
      .catch(() => setApplications([]))
    if (storage.supportsSync) {
      storage.getPendingSyncCount().then(setPendingSyncCount)
    }
  }, [signedInEmail])

  async function handleSync() {
    setSyncing(true)
    setSyncSummary(null)
    try {
      const result = await storage.syncFromLocal()
      if (result.added > 0) {
        storage.listApplications().then(setApplications)
      }
      const failedNote =
        result.failed.length > 0
          ? ` — ${result.failed.length} failed (${result.failed.map((f) => f.id).join(', ')})`
          : ''
      setSyncSummary(
        result.added === 0 && result.failed.length === 0
          ? 'Nothing new to sync.'
          : `Synced ${result.added} application${result.added === 1 ? '' : 's'}${failedNote}.`,
      )
      setPendingSyncCount(await storage.getPendingSyncCount())
    } catch {
      setSyncSummary("Couldn't sync. Please try again.")
    }
    setSyncing(false)
    setTimeout(() => setSyncSummary(null), 8000)
  }

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    const previous = applications
    setApplications((apps) =>
      apps.map((app) => (app.id === id ? { ...app, status } : app)),
    )

    try {
      await storage.updateStatus(id, status)
    } catch {
      setApplications(previous)
      alert("Couldn't save that status change. Please try again.")
    }
  }

  async function handleDelete(id: string, label: string) {
    const confirmed = window.confirm(
      `Delete "${label}"? This permanently removes its resume, cover letter, and job posting files. This can't be undone.`,
    )
    if (!confirmed) return

    try {
      await storage.deleteApplication(id)
      setApplications((apps) => apps.filter((app) => app.id !== id))
      setSelectedId((current) => (current === id ? null : current))
    } catch {
      alert("Couldn't delete that application. Please try again.")
    }
  }

  async function handleSignOut() {
    await logout()
    setSignedInEmail(null)
    setApplications([])
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
        const data = await storage.checkListing(app.id)

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

  if (isCloudMode && !authChecked) return null
  if (isCloudMode && !signedInEmail) {
    return <Login onSignedIn={() => getSignedInEmail().then(setSignedInEmail)} />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>
            Targeted Resumes <span className="app-version">v{__APP_VERSION__}</span>
            {latestVersion && repoUrl && isNewerVersion(latestVersion, __APP_VERSION__) && (
              <Tooltip label={`v${latestVersion} is available — pull the latest and restart npm run dev to update (click to view on GitHub)`}>
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="update-available"
                >
                  Update available
                </a>
              </Tooltip>
            )}
          </h1>
          <p>Tailored resumes and cover letters, organized by application.</p>
        </div>
        <div className="header-actions">
          <Tooltip label="Settings — your name, PDF filenames, resume source, and personal project repos">
            <button
              type="button"
              className="settings-button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <SettingsIcon size={18} />
            </button>
          </Tooltip>
          {!selected && storage.supportsSync && (
            <div className="check-listings">
              <Tooltip label="Pushes applications created locally by Claude Code up to the cloud so they show up on your other devices">
                <button
                  type="button"
                  className="check-listings-button"
                  onClick={handleSync}
                  disabled={syncing || pendingSyncCount === 0}
                >
                  <UploadCloud size={16} />
                  {syncing
                    ? 'Syncing…'
                    : pendingSyncCount > 0
                      ? `Sync now (${pendingSyncCount})`
                      : 'Up to date'}
                </button>
              </Tooltip>
              {syncSummary && <p className="check-listings-summary">{syncSummary}</p>}
            </div>
          )}
          {!selected && applications.length > 0 && storage.supportsListingCheck && (
            <div className="check-listings">
              <Tooltip label="Checks every application's job URL for signs it's closed or removed (a dead link, or wording like 'no longer accepting applications') and marks matches as Filled">
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
              </Tooltip>
              {checkSummary && (
                <p className="check-listings-summary">{checkSummary}</p>
              )}
            </div>
          )}
          {isCloudMode && (
            <Tooltip label="Change password">
              <button
                type="button"
                className="settings-button"
                onClick={() => setChangePasswordOpen(true)}
                aria-label="Change password"
              >
                <KeyRound size={18} />
              </button>
            </Tooltip>
          )}
          {isCloudMode && (
            <Tooltip label={`Signed in as ${signedInEmail} — sign out`}>
              <button
                type="button"
                className="settings-button"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </button>
            </Tooltip>
          )}
        </div>
      </header>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {changePasswordOpen && (
        <ChangePassword onClose={() => setChangePasswordOpen(false)} />
      )}

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

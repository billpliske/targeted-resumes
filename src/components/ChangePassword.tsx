import { useState } from 'react'
import { changePassword } from '../lib/auth'

interface ChangePasswordProps {
  onClose: () => void
}

function ChangePassword({ onClose }: ChangePasswordProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await changePassword(oldPassword, newPassword)
    setBusy(false)
    if (result.status === 'ok') setDone(true)
    else setError(result.message)
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Change password</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="settings-body">
          {done ? (
            <p className="detail-hint">Password changed.</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="settings-field">
                <label htmlFor="cp-old">Current password</label>
                <input
                  id="cp-old"
                  type="password"
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
              </div>
              <div className="settings-field">
                <label htmlFor="cp-new">New password</label>
                <input
                  id="cp-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <p className="settings-hint">
                  8+ characters, with at least one uppercase, lowercase, number, and symbol.
                </p>
              </div>
              {error && <p className="settings-error">{error}</p>}
              <button type="submit" className="settings-save" disabled={busy}>
                {busy ? 'Saving…' : 'Change password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChangePassword

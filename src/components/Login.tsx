import { useState } from 'react'
import { completeNewPassword, login } from '../lib/auth'

interface LoginProps {
  onSignedIn: () => void
}

function Login({ onSignedIn }: LoginProps) {
  const [step, setStep] = useState<'credentials' | 'newPassword'>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await login(email, password)
    setBusy(false)
    if (result.status === 'signedIn') onSignedIn()
    else if (result.status === 'newPasswordRequired') setStep('newPassword')
    else setError(result.message)
  }

  async function handleNewPasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await completeNewPassword(newPassword)
    setBusy(false)
    if (result.status === 'signedIn') onSignedIn()
    else if (result.status === 'error') setError(result.message)
  }

  return (
    <div className="login-shell">
      <div className="login-panel">
        <h1>Targeted Resumes</h1>
        {step === 'credentials' ? (
          <form onSubmit={handleCredentialsSubmit}>
            <div className="settings-field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="settings-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="settings-error">{error}</p>}
            <button type="submit" className="settings-save" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleNewPasswordSubmit}>
            <p className="detail-hint">Set a new password to finish signing in.</p>
            <div className="settings-field">
              <label htmlFor="login-new-password">New password</label>
              <input
                id="login-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="settings-error">{error}</p>}
            <button type="submit" className="settings-save" disabled={busy}>
              {busy ? 'Saving…' : 'Set password and sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default Login

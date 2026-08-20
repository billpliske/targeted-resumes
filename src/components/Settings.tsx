import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { storage } from '../lib/storage'
import type { SettingsData } from '../lib/storage'
import Tooltip from './Tooltip'

interface SettingsProps {
  onClose: () => void
}

const EMPTY_SETTINGS: SettingsData = {
  name: '',
  resumeFilename: '',
  coverLetterFilename: '',
  personalProjectRepos: [],
  manualProjects: [],
}

function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData>(EMPTY_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [hasResume, setHasResume] = useState(false)
  const [hasCoverLetterTemplate, setHasCoverLetterTemplate] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [newProjectDetails, setNewProjectDetails] = useState('')
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const coverLetterInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    storage
      .getSettings()
      .then((data) => {
        setSettings({
          name: data.name,
          resumeFilename: data.resumeFilename,
          coverLetterFilename: data.coverLetterFilename,
          personalProjectRepos: data.personalProjectRepos ?? [],
          manualProjects: data.manualProjects ?? [],
        })
        setHasResume(data.hasResume)
        setHasCoverLetterTemplate(data.hasCoverLetterTemplate)
      })
      .catch(() => setSettings(EMPTY_SETTINGS))
      .finally(() => setLoaded(true))
  }, [])

  async function handleSave() {
    setSaveState('saving')
    try {
      await storage.saveSettings(settings)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setSaveState('error')
    }
  }

  function handleAddRepo() {
    const url = newRepoUrl.trim()
    if (!url || settings.personalProjectRepos.includes(url)) {
      setNewRepoUrl('')
      return
    }
    setSettings({
      ...settings,
      personalProjectRepos: [...settings.personalProjectRepos, url],
    })
    setNewRepoUrl('')
  }

  function handleRemoveRepo(url: string) {
    setSettings({
      ...settings,
      personalProjectRepos: settings.personalProjectRepos.filter((repo) => repo !== url),
    })
  }

  function handleAddManualProject() {
    const name = newProjectName.trim()
    const description = newProjectDescription.trim()
    const details = newProjectDetails.trim()
    if (!name || !details) return
    setSettings({
      ...settings,
      manualProjects: [...settings.manualProjects, { name, description, details }],
    })
    setNewProjectName('')
    setNewProjectDescription('')
    setNewProjectDetails('')
  }

  function handleRemoveManualProject(index: number) {
    setSettings({
      ...settings,
      manualProjects: settings.manualProjects.filter((_, i) => i !== index),
    })
  }

  async function handleResumeUpload(file: File) {
    setUploadError(null)
    try {
      await storage.uploadResume(file)
      setHasResume(true)
    } catch {
      setUploadError("Couldn't upload the resume. Please try again.")
    }
  }

  async function handleCoverLetterUpload(file: File) {
    setUploadError(null)
    try {
      await storage.uploadCoverLetterTemplate(file)
      setHasCoverLetterTemplate(true)
    } catch {
      setUploadError("Couldn't upload the cover letter template. Please try again.")
    }
  }

  const namePlaceholder = 'Your Name'
  const resumePlaceholder = settings.name
    ? `${settings.name} Resume.pdf`
    : `${namePlaceholder} Resume.pdf`
  const coverLetterPlaceholder = settings.name
    ? `${settings.name} Cover Letter.pdf`
    : `${namePlaceholder} Cover Letter.pdf`

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="settings-body">
        {!loaded ? (
          <p className="detail-hint">Loading…</p>
        ) : (
          <>
            <div className="settings-field">
              <label htmlFor="settings-name">Your name</label>
              <input
                id="settings-name"
                type="text"
                placeholder={namePlaceholder}
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              />
            </div>

            <div className="settings-field">
              <label htmlFor="settings-resume-filename">Resume PDF filename</label>
              <input
                id="settings-resume-filename"
                type="text"
                placeholder={resumePlaceholder}
                value={settings.resumeFilename}
                onChange={(e) => setSettings({ ...settings, resumeFilename: e.target.value })}
              />
            </div>

            <div className="settings-field">
              <label htmlFor="settings-cover-letter-filename">Cover letter PDF filename</label>
              <input
                id="settings-cover-letter-filename"
                type="text"
                placeholder={coverLetterPlaceholder}
                value={settings.coverLetterFilename}
                onChange={(e) => setSettings({ ...settings, coverLetterFilename: e.target.value })}
              />
            </div>

            <hr className="settings-divider" />

            <div className="settings-field">
              <label htmlFor="settings-resume-upload">
                Resume source (markdown) — {hasResume ? 'on file' : 'not uploaded yet'}
              </label>
              <input
                id="settings-resume-upload"
                ref={resumeInputRef}
                type="file"
                accept=".md,text/markdown"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleResumeUpload(file)
                }}
              />
              <p className="settings-hint">
                This becomes the canonical source the tailoring skill adapts for every application. Replaces the
                current file if you already have one.
              </p>
            </div>

            <div className="settings-field">
              <label htmlFor="settings-cover-letter-upload">
                Cover letter template (markdown, optional) —{' '}
                {hasCoverLetterTemplate ? 'on file' : 'not uploaded yet'}
              </label>
              <input
                id="settings-cover-letter-upload"
                ref={coverLetterInputRef}
                type="file"
                accept=".md,text/markdown"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleCoverLetterUpload(file)
                }}
              />
              <p className="settings-hint">
                A cover letter is drafted fresh for every application, not reused verbatim — this is just an
                optional voice/format reference.
              </p>
            </div>

            {uploadError && <p className="settings-error">{uploadError}</p>}

            <hr className="settings-divider" />

            <div className="settings-field">
              <label htmlFor="settings-repo-add">Personal project repos (optional)</label>
              {settings.personalProjectRepos.length > 0 && (
                <ul className="settings-repo-list">
                  {settings.personalProjectRepos.map((repo) => (
                    <li key={repo}>
                      <span className="settings-repo-url">{repo}</span>
                      <Tooltip label="Stops this repo being synced — doesn't touch the remote repo itself">
                        <button
                          type="button"
                          className="settings-repo-remove"
                          onClick={() => handleRemoveRepo(repo)}
                          aria-label={`Remove ${repo}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              )}
              <div className="settings-repo-add">
                <input
                  id="settings-repo-add"
                  type="text"
                  placeholder="https://github.com/you/your-project"
                  value={newRepoUrl}
                  onChange={(e) => setNewRepoUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddRepo()
                    }
                  }}
                />
                <button type="button" onClick={handleAddRepo}>
                  Add
                </button>
              </div>
              <p className="settings-hint">
                Public repo URLs (GitHub, GitLab, Bitbucket, or any other git host) to check for real,
                verifiable skills/tools when tailoring — a portfolio site, a side project, etc. After adding
                or removing one here, click Save below, then ask Claude Code to sync your personal projects;
                it reads the actual code, it doesn't guess.
              </p>
            </div>

            <hr className="settings-divider" />

            <div className="settings-field">
              <label htmlFor="settings-manual-project-name">
                Other personal projects — no repo (optional)
              </label>
              {settings.manualProjects.length > 0 && (
                <ul className="settings-repo-list">
                  {settings.manualProjects.map((project, index) => (
                    <li key={`${project.name}-${index}`}>
                      <span className="settings-repo-url">
                        {project.name}
                        {project.description ? ` — ${project.description}` : ''}
                      </span>
                      <Tooltip label="Stops this project appearing in your resume's Personal Projects section next sync">
                        <button
                          type="button"
                          className="settings-repo-remove"
                          onClick={() => handleRemoveManualProject(index)}
                          aria-label={`Remove ${project.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              )}
              <div className="settings-manual-project-add">
                <input
                  id="settings-manual-project-name"
                  type="text"
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="One-line description (e.g. what it is, who it was for)"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                />
                <textarea
                  placeholder="What you actually did — technologies used, specific work, in your own words. This is worded into resume bullets, not fact-checked, so be accurate."
                  value={newProjectDetails}
                  onChange={(e) => setNewProjectDetails(e.target.value)}
                  rows={4}
                />
                <button type="button" onClick={handleAddManualProject}>
                  Add project
                </button>
              </div>
              <p className="settings-hint">
                For a project with no linkable repo — Claude can't read code it can't access, so this is
                worded from what <em>you</em> tell it, not verified against source the way repos above are.
                After adding or removing one here, click Save below, then ask Claude Code to sync your
                personal projects; it writes these directly into your resume's Personal Projects section
                (a deliberate, narrow exception — nothing else about your resume gets auto-edited).
              </p>
            </div>
          </>
        )}
        </div>

        {loaded && (
          <div className="settings-footer">
            <button type="button" className="settings-save" onClick={handleSave} disabled={saveState === 'saving'}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save'}
            </button>
            {saveState === 'error' && (
              <p className="settings-error">Couldn't save. Please try again.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Settings

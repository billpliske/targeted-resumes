import { useState, type FormEvent } from 'react'

function buildPrompt(text: string, url: string) {
  const lines = ['Tailor my resume for this job posting using the add-application skill.']
  if (url) {
    lines.push('', `Job URL: ${url}`)
  }
  lines.push('', 'Job posting text:', text)
  return lines.join('\n')
}

function AddApplication() {
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return

    const prompt = buildPrompt(text.trim(), url.trim())

    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 4000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <form className="add-application" onSubmit={handleSubmit}>
      <label htmlFor="job-text">Add a new application</label>
      <textarea
        id="job-text"
        className="add-application-textarea"
        placeholder="Paste the full job posting text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        required
      />
      <div className="add-application-row">
        <input
          id="job-url"
          type="url"
          placeholder="Job URL (optional — saved as a reference link)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit">Copy prompt for Claude</button>
      </div>
      <p className="add-application-hint">
        {copied
          ? 'Copied — paste it into a Claude Code chat in this repo to generate the tailored resume.'
          : "This copies a ready-to-paste message to your clipboard. Generation happens in a Claude Code chat, not in the browser — paste it there and it'll show up here when it's done."}
      </p>
    </form>
  )
}

export default AddApplication

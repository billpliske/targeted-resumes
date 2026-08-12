import { useState, type FormEvent } from 'react'

function buildPrompt(text: string, url: string) {
  const lines = ['Check how well this job posting fits my skills using the check-fit skill.']
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

  function handleClear() {
    setText('')
    setUrl('')
    setCopied(false)
  }

  return (
    <form className="add-application" onSubmit={handleSubmit}>
      <label htmlFor="job-text">Screen a job posting</label>
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
        <button type="button" className="secondary" onClick={handleClear}>
          Clear
        </button>
        <button type="submit">Copy prompt for Claude</button>
      </div>
      <p className="add-application-hint">
        {copied
          ? 'Copied — paste it into a Claude Code chat to get a fit rating without generating a full resume yet.'
          : "This copies a ready-to-paste check-fit message to your clipboard — paste it into a Claude Code chat to get a rating and summary saved to the dashboard. To fully tailor a resume and cover letter for one you decide to pursue, just ask Claude directly in chat rather than through this box."}
      </p>
    </form>
  )
}

export default AddApplication

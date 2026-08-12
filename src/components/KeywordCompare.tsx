import { Fragment } from 'react'

interface KeywordCompareProps {
  keywords: string[]
  originalText: string
  tailoredText: string
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripHtmlBreaks(text: string) {
  return text.replace(/<br\s*\/?>/gi, '\n').replace(/\n{3,}/g, '\n\n')
}

function buildKeywordPattern(keywords: string[]) {
  const sorted = [...keywords].sort((a, b) => b.length - a.length)
  const alternation = sorted.map(escapeRegExp).join('|')
  return new RegExp(`(${alternation})`, 'gi')
}

function countMatches(text: string, keyword: string) {
  const pattern = new RegExp(escapeRegExp(keyword), 'gi')
  return (text.match(pattern) ?? []).length
}

function HighlightedText({
  text,
  pattern,
}: {
  text: string
  pattern: RegExp
}) {
  const parts = text.split(pattern)
  return (
    <pre className="keyword-pane-text">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i}>{part}</mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </pre>
  )
}

function KeywordCompare({
  keywords,
  originalText,
  tailoredText,
}: KeywordCompareProps) {
  if (keywords.length === 0) {
    return null
  }

  const pattern = buildKeywordPattern(keywords)
  const original = stripHtmlBreaks(originalText)
  const tailored = stripHtmlBreaks(tailoredText)

  return (
    <div className="keyword-compare">
      <ul className="keyword-legend">
        {keywords.map((keyword) => {
          const before = countMatches(original, keyword)
          const after = countMatches(tailored, keyword)
          return (
            <li key={keyword} className={after > before ? 'increased' : ''}>
              <span className="keyword-term">{keyword}</span>
              <span className="keyword-counts">
                {before} &rarr; {after}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="keyword-panes">
        <div className="keyword-pane">
          <h3>Original resume</h3>
          <HighlightedText text={original} pattern={pattern} />
        </div>
        <div className="keyword-pane">
          <h3>Tailored for this job</h3>
          <HighlightedText text={tailored} pattern={pattern} />
        </div>
      </div>
    </div>
  )
}

export default KeywordCompare

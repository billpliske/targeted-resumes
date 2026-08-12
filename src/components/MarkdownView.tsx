import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface MarkdownViewProps {
  content: string
}

function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="markdown-view">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownView

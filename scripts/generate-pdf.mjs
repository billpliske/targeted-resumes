import { mdToPdf } from 'md-to-pdf'
import path from 'node:path'

const [inputPath, outputPath] = process.argv.slice(2)

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/generate-pdf.mjs <input.md> <output.pdf>')
  process.exit(1)
}

const root = path.resolve(import.meta.dirname, '..')
const themePath = path.join(root, 'scripts', 'pdf', 'theme.css')

const pdf = await mdToPdf(
  { path: path.resolve(inputPath) },
  {
    dest: path.resolve(outputPath),
    stylesheet: [themePath],
    page_media_type: 'print',
    pdf_options: {
      format: 'Letter',
      margin: { top: '0.6in', bottom: '0.6in', left: '0.75in', right: '0.75in' },
      printBackground: true,
    },
  },
)

if (!pdf) {
  console.error('PDF generation failed')
  process.exit(1)
}

console.log(`Wrote ${path.relative(root, outputPath)}`)

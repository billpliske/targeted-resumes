import { readFileSync, writeFileSync, globSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const applicationsDir = path.join(root, 'public', 'applications')
const manifestPath = path.join(root, 'public', 'applications-manifest.json')

export function buildManifest() {
  const metaFiles = existsSync(applicationsDir)
    ? globSync('*/meta.json', { cwd: applicationsDir })
    : []

  const applications = metaFiles.map((relativePath) => {
    const raw = readFileSync(path.join(applicationsDir, relativePath), 'utf-8')
    return JSON.parse(raw)
  })

  applications.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))

  writeFileSync(manifestPath, JSON.stringify(applications, null, 2) + '\n')

  return applications
}

const isMain = process.argv[1] === path.resolve(import.meta.dirname, 'build-manifest.mjs')

if (isMain) {
  const applications = buildManifest()
  console.log(`Wrote ${applications.length} application(s) to ${path.relative(root, manifestPath)}`)
}

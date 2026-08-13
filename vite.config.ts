import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { execFile } from 'node:child_process'
// @ts-expect-error -- plain JS script, no type declarations
import { buildManifest } from './scripts/build-manifest.mjs'

const VALID_STATUSES = [
  'not_applied',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'filled',
]

// Signals a job posting is closed, gathered by inspecting the real
// server-rendered HTML of closed listings on LinkedIn and other boards.
const CLOSED_LISTING_SIGNALS = [
  'closed-job__flavor--closed', // LinkedIn's server-rendered closed-listing marker
  'no longer accepting applications',
  'position has been filled',
  'this position has been filled',
  'job is no longer available',
  'posting has expired',
  'no longer active',
  'closed to applications',
  'this job posting is no longer active',
  'we are no longer accepting',
  'requisition has been closed',
  'this job has expired',
  'job listing is no longer active',
]

const CHECK_LISTING_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type ListingOutcome = 'broken' | 'filled' | 'inconclusive'

async function classifyListing(
  url: string,
): Promise<{ outcome: ListingOutcome; httpStatus?: number }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  let response: Response
  try {
    response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': CHECK_LISTING_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    })
  } catch {
    return { outcome: 'broken' }
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 404 || response.status === 410) {
    return { outcome: 'broken', httpStatus: response.status }
  }
  if (!response.ok) {
    // Some WordPress-based career sites (e.g. Veeva's) throw a fatal error
    // instead of a clean 404 when a job posting no longer exists. Only
    // matched on a real 5xx to avoid misreading a transient block (403) as
    // a dead listing.
    if (response.status >= 500) {
      const errorHtml = (await response.text()).toLowerCase()
      if (errorHtml.includes('there has been a critical error on this website')) {
        return { outcome: 'broken', httpStatus: response.status }
      }
    }
    return { outcome: 'inconclusive', httpStatus: response.status }
  }

  // Greenhouse redirects closed/removed postings to the org's root board
  // with an error flag instead of returning a 404.
  if (
    response.url.includes('greenhouse.io') &&
    response.url.includes('error=true')
  ) {
    return { outcome: 'filled', httpStatus: response.status }
  }

  const html = await response.text()
  const lowerHtml = html.toLowerCase()

  if (CLOSED_LISTING_SIGNALS.some((signal) => lowerHtml.includes(signal))) {
    return { outcome: 'filled', httpStatus: response.status }
  }

  // Ashby only embeds the schema.org JobPosting JSON-LD block server-side
  // when the job ID actually resolves to a live listing — confirmed absent
  // for a garbage/removed job ID across 3 real orgs (GC AI, Kong, Deepgram).
  if (
    response.url.includes('ashbyhq.com') &&
    !html.includes('"@type":"JobPosting"')
  ) {
    return { outcome: 'filled', httpStatus: response.status }
  }

  return { outcome: 'inconclusive', httpStatus: response.status }
}

const applicationsDir = path.resolve('public', 'applications')

function resolveApplicationDir(id: unknown): string | null {
  if (typeof id !== 'string' || !id) return null
  const dir = path.resolve(applicationsDir, id)
  if (dir !== applicationsDir && !dir.startsWith(applicationsDir + path.sep)) {
    return null
  }
  return dir
}

function readJsonBody(
  req: import('node:http').IncomingMessage,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  })
}

function readRawBody(
  req: import('node:http').IncomingMessage,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

const settingsPath = path.resolve('public', 'settings.json')

interface Settings {
  name: string
  resumeFilename: string
  coverLetterFilename: string
  personalProjectRepos: string[]
}

function readSettings(): Settings {
  if (!existsSync(settingsPath)) {
    return { name: '', resumeFilename: '', coverLetterFilename: '', personalProjectRepos: [] }
  }
  const parsed = JSON.parse(readFileSync(settingsPath, 'utf-8'))
  // personalProjectRepos didn't exist in earlier settings.json files
  return { personalProjectRepos: [], ...parsed }
}

function statusApiPlugin(): Plugin {
  return {
    name: 'status-api',
    configureServer(server) {
      server.middlewares.use('/api/status', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        readJsonBody(req)
          .then(({ id, status }) => {
            const dir = resolveApplicationDir(id)
            if (
              !dir ||
              typeof status !== 'string' ||
              !VALID_STATUSES.includes(status)
            ) {
              res.statusCode = 400
              res.end('Invalid request')
              return
            }

            const metaPath = path.join(dir, 'meta.json')
            if (!existsSync(metaPath)) {
              res.statusCode = 404
              res.end('Application not found')
              return
            }

            const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
            meta.status = status
            writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
            buildManifest()

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          })
          .catch(() => {
            res.statusCode = 500
            res.end('Server error')
          })
      })
    },
  }
}

function deleteApiPlugin(): Plugin {
  return {
    name: 'delete-api',
    configureServer(server) {
      server.middlewares.use('/api/delete', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        readJsonBody(req)
          .then(({ id }) => {
            const dir = resolveApplicationDir(id)
            if (!dir || dir === applicationsDir) {
              res.statusCode = 400
              res.end('Invalid request')
              return
            }

            if (!existsSync(dir)) {
              res.statusCode = 404
              res.end('Application not found')
              return
            }

            rmSync(dir, { recursive: true, force: true })
            buildManifest()

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          })
          .catch(() => {
            res.statusCode = 500
            res.end('Server error')
          })
      })
    },
  }
}

function revealFilePlugin(): Plugin {
  return {
    name: 'reveal-file-api',
    configureServer(server) {
      server.middlewares.use('/api/reveal-file', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        readJsonBody(req)
          .then(({ id, file }) => {
            const dir = resolveApplicationDir(id)
            if (!dir || (file !== 'resume' && file !== 'coverLetter')) {
              res.statusCode = 400
              res.end('Invalid request')
              return
            }

            const metaPath = path.join(dir, 'meta.json')
            if (!existsSync(metaPath)) {
              res.statusCode = 404
              res.end('Application not found')
              return
            }

            const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
            const filename = file === 'resume' ? meta.resumePdf : meta.coverLetterPdf
            const filePath =
              typeof filename === 'string' && filename
                ? path.join(dir, filename)
                : null

            if (!filePath || !existsSync(filePath)) {
              res.statusCode = 404
              res.end('File not found')
              return
            }

            let command: string
            let args: string[]
            if (process.platform === 'darwin') {
              command = 'open'
              args = ['-R', filePath]
            } else if (process.platform === 'win32') {
              command = 'explorer'
              args = [`/select,${filePath}`]
            } else {
              // No universal "select this file" command on Linux — best
              // effort is opening the containing folder.
              command = 'xdg-open'
              args = [dir]
            }

            execFile(command, args, (err) => {
              // explorer.exe on Windows commonly exits non-zero even on
              // success, so only treat "command not found" as a real
              // failure, not a non-zero exit.
              if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
                res.statusCode = 500
                res.end('Could not open the file manager')
                return
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            })
          })
          .catch(() => {
            res.statusCode = 500
            res.end('Server error')
          })
      })
    },
  }
}

function checkListingPlugin(): Plugin {
  return {
    name: 'check-listing-api',
    configureServer(server) {
      server.middlewares.use('/api/check-listing', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        readJsonBody(req)
          .then(async ({ id }) => {
            const dir = resolveApplicationDir(id)
            if (!dir) {
              res.statusCode = 400
              res.end('Invalid request')
              return
            }

            const metaPath = path.join(dir, 'meta.json')
            if (!existsSync(metaPath)) {
              res.statusCode = 404
              res.end('Application not found')
              return
            }

            const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
            if (typeof meta.jobUrl !== 'string' || !meta.jobUrl) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ outcome: 'inconclusive' }))
              return
            }

            const { outcome, httpStatus } = await classifyListing(
              meta.jobUrl,
            )

            if (outcome === 'broken' || outcome === 'filled') {
              meta.status = 'filled'
              writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
              buildManifest()
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ outcome, httpStatus }))
          })
          .catch(() => {
            res.statusCode = 500
            res.end('Server error')
          })
      })
    },
  }
}

function settingsApiPlugin(): Plugin {
  return {
    name: 'settings-api',
    configureServer(server) {
      server.middlewares.use('/api/settings', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ...readSettings(),
              // Computed server-side via existsSync rather than the client
              // fetching these paths directly — Vite's dev server SPA
              // fallback returns 200 for any unmatched path, so a plain
              // fetch can't tell a missing file from index.html.
              hasResume: existsSync(
                path.resolve('public', 'original-resume.md'),
              ),
              hasCoverLetterTemplate: existsSync(
                path.resolve('public', 'cover-letter-template.md'),
              ),
            }),
          )
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        readJsonBody(req)
          .then(({ name, resumeFilename, coverLetterFilename, personalProjectRepos }) => {
            if (
              typeof name !== 'string' ||
              typeof resumeFilename !== 'string' ||
              typeof coverLetterFilename !== 'string' ||
              !Array.isArray(personalProjectRepos) ||
              !personalProjectRepos.every((repo) => typeof repo === 'string')
            ) {
              res.statusCode = 400
              res.end('Invalid request')
              return
            }

            const settings: Settings = {
              name,
              resumeFilename,
              coverLetterFilename,
              personalProjectRepos,
            }
            writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          })
          .catch(() => {
            res.statusCode = 500
            res.end('Server error')
          })
      })
    },
  }
}

// Writes a POSTed markdown body to a fixed file under public/. Used for the
// resume and cover-letter-template uploads — both are plain markdown, no
// parsing, so the raw request body is the file content as-is.
function uploadTextFilePlugin(routePath: string, targetFile: string): Plugin {
  const targetPath = path.resolve('public', targetFile)
  return {
    name: `upload-api${routePath}`,
    configureServer(server) {
      server.middlewares.use(routePath, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        readRawBody(req)
          .then((text) => {
            if (!text.trim()) {
              res.statusCode = 400
              res.end('Empty file')
              return
            }
            writeFileSync(targetPath, text)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          })
          .catch(() => {
            res.statusCode = 500
            res.end('Server error')
          })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    statusApiPlugin(),
    deleteApiPlugin(),
    revealFilePlugin(),
    checkListingPlugin(),
    settingsApiPlugin(),
    uploadTextFilePlugin('/api/upload-resume', 'original-resume.md'),
    uploadTextFilePlugin(
      '/api/upload-cover-letter-template',
      'cover-letter-template.md',
    ),
  ],
})

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, statSync, readdirSync } from 'node:fs'
import { execFile, execFileSync } from 'node:child_process'
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
  'closed to applications',
  'this job posting is no longer active',
  'we are no longer accepting',
  'requisition has been closed',
  'this job has expired',
  'job listing is no longer active',
]

// Strips <script>/<style> blocks, comments, and tags, leaving just the
// text a person actually sees on the page. Exists because a real false
// positive slipped through: 'no longer active' coincidentally appeared
// inside a giant window.i18n = {...} translation-string blob in a
// <script> tag on a State Farm posting — unrelated boilerplate for some
// other widget, not anything describing the job itself. Only used for
// the CLOSED_LISTING_SIGNALS check below; the Ashby JobPosting schema
// check further down deliberately still reads raw HTML, since that
// schema.org JSON-LD block legitimately lives inside a <script> tag.
function extractVisibleText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
}

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
  const visibleText = extractVisibleText(html).toLowerCase()

  if (CLOSED_LISTING_SIGNALS.some((signal) => visibleText.includes(signal))) {
    return { outcome: 'filled', httpStatus: response.status }
  }

  // Ashby only embeds the schema.org JobPosting JSON-LD block server-side
  // when the job ID actually resolves to a live listing — confirmed absent
  // for a garbage/removed job ID across 3 real orgs (GC AI, Kong, Deepgram).
  // That's only true for the canonical jobs.ashbyhq.com/<org>/<id> board
  // pages, though. The ?ashby_jid=<id> query-param embed style — used both
  // on ashbyhq.com's own generic careers page and on companies' custom
  // domains embedding an Ashby widget — is client-rendered and never
  // includes the schema block server-side, live or closed, so applying
  // this check there produces a false "filled" every time.
  let isAshbyOrgBoard: boolean
  try {
    const parsedUrl = new URL(response.url)
    isAshbyOrgBoard =
      parsedUrl.hostname === 'jobs.ashbyhq.com' &&
      !parsedUrl.searchParams.has('ashby_jid')
  } catch {
    isAshbyOrgBoard = false
  }

  if (isAshbyOrgBoard && !html.includes('"@type":"JobPosting"')) {
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

interface ManualProject {
  name: string
  description: string
  details: string
}

interface Settings {
  name: string
  resumeFilename: string
  coverLetterFilename: string
  personalProjectRepos: string[]
  manualProjects: ManualProject[]
}

function readSettings(): Settings {
  if (!existsSync(settingsPath)) {
    return {
      name: '',
      resumeFilename: '',
      coverLetterFilename: '',
      personalProjectRepos: [],
      manualProjects: [],
    }
  }
  const parsed = JSON.parse(readFileSync(settingsPath, 'utf-8'))
  // personalProjectRepos/manualProjects didn't exist in earlier settings.json files
  return { personalProjectRepos: [], manualProjects: [], ...parsed }
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

// Bare filename only — no path separators or ".." segments — since this
// writes wherever it's told inside the application's own directory.
function isSafeFilename(filename: unknown): filename is string {
  return (
    typeof filename === 'string' &&
    filename.length > 0 &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    filename !== '..'
  )
}

// Cloud mode's "Sync now" button uses this to write files it already
// fetched (client-side, via the user's own logged-in session) down to
// local disk — the dev server itself never talks to AWS.
function writeApplicationFilesPlugin(): Plugin {
  return {
    name: 'write-application-files-api',
    configureServer(server) {
      server.middlewares.use('/api/write-application-files', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        readJsonBody(req)
          .then(({ id, files }) => {
            const dir = resolveApplicationDir(id)
            if (!dir || dir === applicationsDir || !Array.isArray(files)) {
              res.statusCode = 400
              res.end('Invalid request')
              return
            }

            for (const file of files) {
              if (
                typeof file !== 'object' ||
                file === null ||
                !isSafeFilename((file as Record<string, unknown>).filename) ||
                typeof (file as Record<string, unknown>).contentBase64 !== 'string'
              ) {
                res.statusCode = 400
                res.end('Invalid file entry')
                return
              }
            }

            mkdirSync(dir, { recursive: true })
            for (const file of files as { filename: string; contentBase64: string }[]) {
              writeFileSync(path.join(dir, file.filename), Buffer.from(file.contentBase64, 'base64'))
            }
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

// Lets cloud-mode sync tell which side of a same-id conflict is actually
// newer — a local meta.json's mtime naturally advances whenever Claude Code
// (running locally) edits it, which is the only local-side signal available
// without asking every skill invocation to also stamp a timestamp field.
function applicationMtimesPlugin(): Plugin {
  return {
    name: 'application-mtimes-api',
    configureServer(server) {
      server.middlewares.use('/api/application-mtimes', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        const mtimes: Record<string, string> = {}
        if (existsSync(applicationsDir)) {
          for (const id of readdirSync(applicationsDir)) {
            const metaPath = path.join(applicationsDir, id, 'meta.json')
            if (existsSync(metaPath)) {
              mtimes[id] = statSync(metaPath).mtime.toISOString()
            }
          }
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(mtimes))
      })
    },
  }
}

// Nautilus (GNOME) and Dolphin (KDE) both have a documented `--select`
// flag for highlighting a specific file, covering the two most common
// Linux desktops. No other file manager (Nemo, Thunar, PCManFM, ...) has
// a verified equivalent, so those fall back to opening the containing
// folder via xdg-open instead of guessing a flag that might not exist.
const LINUX_SELECT_CAPABLE_FILE_MANAGERS = ['nautilus', 'dolphin']

function detectLinuxFileManager(): string | null {
  for (const binary of LINUX_SELECT_CAPABLE_FILE_MANAGERS) {
    try {
      execFileSync('which', [binary], { stdio: 'ignore' })
      return binary
    } catch {
      // not found on PATH, try the next one
    }
  }
  return null
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
              const linuxFileManager = detectLinuxFileManager()
              if (linuxFileManager) {
                command = linuxFileManager
                args = ['--select', filePath]
              } else {
                // No verified "select this file" flag for whatever's
                // installed — best effort is opening the containing folder.
                command = 'xdg-open'
                args = [dir]
              }
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
          .then(({ name, resumeFilename, coverLetterFilename, personalProjectRepos, manualProjects }) => {
            const isValidManualProject = (p: unknown): p is ManualProject =>
              typeof p === 'object' &&
              p !== null &&
              typeof (p as ManualProject).name === 'string' &&
              typeof (p as ManualProject).description === 'string' &&
              typeof (p as ManualProject).details === 'string'

            if (
              typeof name !== 'string' ||
              typeof resumeFilename !== 'string' ||
              typeof coverLetterFilename !== 'string' ||
              !Array.isArray(personalProjectRepos) ||
              !personalProjectRepos.every((repo) => typeof repo === 'string') ||
              !Array.isArray(manualProjects) ||
              !manualProjects.every(isValidManualProject)
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
              manualProjects,
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

// Lets the client (cloud-mode sync) ask "does this machine already have
// these local files" without the SPA-fallback ambiguity a plain fetch has
// (see the /api/settings comment above) — existsSync is the reliable check.
function localFilesStatusPlugin(): Plugin {
  return {
    name: 'local-files-status-api',
    configureServer(server) {
      server.middlewares.use('/api/local-files-status', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            hasOriginalResume: existsSync(path.resolve('public', 'original-resume.md')),
            hasCoverLetterTemplate: existsSync(path.resolve('public', 'cover-letter-template.md')),
            hasSettings: existsSync(settingsPath),
          }),
        )
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

const appVersion = JSON.parse(readFileSync('package.json', 'utf-8')).version

// Which repo the "update available" check compares against. Hardcoded
// rather than read from the local git remote: a forker's clone of their
// own fork would otherwise compare against their own repo (meaningless —
// just tells them if they have unpushed local changes) instead of the
// upstream project they actually forked. If you're maintaining your own
// fork and want your own users notified of your updates, change this to
// your repo instead.
const UPSTREAM_REPO = 'billpliske/targeted-resumes'

function latestVersionPlugin(): Plugin {
  return {
    name: 'latest-version-api',
    configureServer(server) {
      server.middlewares.use('/api/latest-version', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        fetch(
          `https://raw.githubusercontent.com/${UPSTREAM_REPO}/main/package.json`,
          { signal: controller.signal },
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((pkg) => {
            const version = (pkg as { version?: string } | null)?.version ?? null
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                latestVersion: version,
                repoUrl: `https://github.com/${UPSTREAM_REPO}`,
              }),
            )
          })
          // Soft-fail always — no internet, GitHub down, whatever. This
          // is a nice-to-have nudge, never something that should surface
          // as an error to the user.
          .catch(() => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ latestVersion: null }))
          })
          .finally(() => clearTimeout(timeout))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5190,
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    statusApiPlugin(),
    deleteApiPlugin(),
    writeApplicationFilesPlugin(),
    applicationMtimesPlugin(),
    revealFilePlugin(),
    checkListingPlugin(),
    settingsApiPlugin(),
    localFilesStatusPlugin(),
    latestVersionPlugin(),
    uploadTextFilePlugin('/api/upload-resume', 'original-resume.md'),
    uploadTextFilePlugin(
      '/api/upload-cover-letter-template',
      'cover-letter-template.md',
    ),
  ],
})

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
// @ts-expect-error -- plain JS script, no type declarations
import { buildManifest } from './scripts/build-manifest.mjs'

const VALID_STATUSES = [
  'not_applied',
  'applied',
  'interviewing',
  'offer',
  'rejected',
]

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), statusApiPlugin(), deleteApiPlugin()],
})

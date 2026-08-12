// Serves dist/ as a static SPA, proxies /sanfer/* to upstream API, and handles authentication
import express from 'express'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'
import bodyParser from 'body-parser'
import {
  initializePool,
  initializeDatabase,
  loginHandler,
  logoutHandler,
  meHandler,
} from './auth-server.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(__dirname, 'dist')
const PORT = parseInt(process.env.PORT ?? '4174')
const UPSTREAM = 'https://serv.aux-rolplay.com'
const CACHE_TTL = 5 * 60 * 1000

const app = express()
const apiCache = new Map()
const staticCache = new Map()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

const SKIP_GZIP = new Set(['.png', '.ico', '.woff', '.woff2'])

function acceptsGzip(req) {
  return (req.headers['accept-encoding'] ?? '').includes('gzip')
}

function send(req, res, payload, gz) {
  if (gz && acceptsGzip(req)) {
    res.setHeader('Content-Encoding', 'gzip')
    res.setHeader('Vary', 'Accept-Encoding')
    res.end(gz)
  } else {
    res.end(payload)
  }
}

// Middleware
app.use(bodyParser.json())

// ─── Auth endpoints ───────────────────────────────────────────────────────
app.post('/api/auth/login', loginHandler)
app.post('/api/auth/logout', logoutHandler)
app.get('/api/auth/me', meHandler)

// ─── API proxy with cache ─────────────────────────────────────────────────
app.get('/sanfer/*', async (req, res) => {
  const key = req.url
  const cached = apiCache.get(key)

  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-Cache', 'HIT')
    send(req, res, cached.body, cached.gz)
    return
  }

  try {
    const upstream = await fetch(`${UPSTREAM}${req.url}`, {
      headers: { Accept: 'application/json' },
    })
    if (!upstream.ok) {
      res.writeHead(upstream.status)
      res.end(await upstream.text())
      return
    }
    const body = await upstream.text()
    const gz = gzipSync(body)
    apiCache.set(key, { body, gz, ts: Date.now() })
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-Cache', 'MISS')
    send(req, res, body, gz)
  } catch (err) {
    res.writeHead(502)
    res.end(String(err))
  }
})

// ─── Static file serving ──────────────────────────────────────────────────
app.get('*', async (req, res) => {
  let filePath = join(DIST, req.path)
  const ext = extname(filePath)

  if (!ext) filePath = join(DIST, 'index.html')

  try {
    let entry = staticCache.get(filePath)
    if (!entry) {
      const data = await readFile(filePath)
      const e = extname(filePath)
      entry = { data, gz: SKIP_GZIP.has(e) ? null : gzipSync(data) }
      staticCache.set(filePath, entry)
    }
    const mime = MIME[extname(filePath)] ?? 'application/octet-stream'
    res.setHeader('Content-Type', mime)
    if ((ext === '.js' || ext === '.css') && req.path.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
    send(req, res, entry.data, entry.gz)
  } catch {
    try {
      const html = await readFile(join(DIST, 'index.html'))
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(html)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
})

// Initialize database and start server
async function start() {
  try {
    initializePool()
    await initializeDatabase()
    console.log('[auth-db] Database ready')
  } catch (err) {
    console.warn('[auth-db] Database initialization failed (will retry on first request):', err.message)
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sanfer dashboard running on port ${PORT}`)
  })
}

start()

// Serves dist/ as a static SPA, proxies /m8/bridge/* to the upstream API behind
// an auth check, and handles authentication
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
  signupHandler,
  logoutHandler,
  meHandler,
  requireAuth,
} from './auth-server.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(__dirname, 'dist')
const PORT = parseInt(process.env.PORT ?? '4174')
const CACHE_TTL = 5 * 60 * 1000
const DASHBOARD_NAME = process.env.DASHBOARD_NAME ?? 'M8'

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

// Rate limiting for auth endpoints
const authAttempts = new Map()
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress
}
function rateLimitAuth(req, res, next) {
  const ip = getClientIp(req)
  const now = Date.now()
  const windowMs = 60 * 1000
  const maxAttempts = 10
  const key = `${ip}:${req.path}`
  const attempts = authAttempts.get(key) || []
  const recentAttempts = attempts.filter((t) => now - t < windowMs)
  if (recentAttempts.length >= maxAttempts) {
    return res.status(429).json({ message: 'Too many requests. Try again later.' })
  }
  authAttempts.set(key, [...recentAttempts, now])
  next()
}

// Middleware
app.use(bodyParser.json())
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})

// ─── Auth endpoints ───────────────────────────────────────────────────────
app.post('/api/auth/login', rateLimitAuth, loginHandler)
app.post('/api/auth/signup', rateLimitAuth, signupHandler)
app.post('/api/auth/logout', logoutHandler)
app.get('/api/auth/me', meHandler)

// ─── Upstream API proxy ───────────────────────────────────────────────────
// Mirrors the proxy table in vite.config.ts. Vite's proxy only applies to the
// dev server, so without this the built server has no route for these paths
// and every data request falls through to the SPA fallback below.
const PROXIES = [
  {
    prefix: '/m8/bridge',
    target: 'https://rolplay.app',
    rewrite: (p) => p.replace(/^\/m8\/bridge/, '/ajax'),
  },
]

function matchProxy(pathname) {
  return PROXIES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  )
}

async function proxyRequest(req, res, route) {
  const search = req.originalUrl.slice(req.path.length)
  const target = `${route.target}${route.rewrite(req.path)}${search}`
  const isGet = req.method === 'GET'
  // These endpoints carry their query in the POST body, so the body is part
  // of the cache identity — keying on the URL alone would collide.
  const payload = isGet ? '' : JSON.stringify(req.body ?? {})
  const key = `${req.method} ${target} ${payload}`

  const cached = apiCache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-Cache', 'HIT')
    send(req, res, cached.body, cached.gz)
    return
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: isGet
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: isGet ? undefined : payload,
    })
    const body = await upstream.text()
    if (!upstream.ok) {
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' })
      res.end(body)
      return
    }
    const gz = gzipSync(body)
    apiCache.set(key, { body, gz, ts: Date.now() })
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-Cache', 'MISS')
    send(req, res, body, gz)
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ message: 'Upstream request failed', detail: String(err) }))
  }
}

// Dashboard data requires a token issued by this dashboard, so the numbers
// are not readable by skipping the login screen.
app.use((req, res, next) => {
  const route = matchProxy(req.path)
  if (!route) return next()
  requireAuth(req, res, () => proxyRequest(req, res, route))
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
    } else if (mime.startsWith('text/html')) {
      // index.html names the hashed bundles, so a cached copy pins the browser
      // to the previous deployment's assets — a shipped change the user never
      // sees. The assets above are immutable and content-hashed, so only this
      // document has to be revalidated.
      res.setHeader('Cache-Control', 'no-store, must-revalidate')
    }
    send(req, res, entry.data, entry.gz)
  } catch {
    try {
      const html = await readFile(join(DIST, 'index.html'))
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store, must-revalidate')
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
    console.log(`${DASHBOARD_NAME} dashboard running on port ${PORT}`)
  })
}

start()

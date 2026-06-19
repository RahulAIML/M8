// Serves dist/ as a static SPA and proxies /m8/bridge/* to rolplay.app/ajax/*
// with an in-memory cache keyed on the SQL body so repeated queries are instant.
// All responses are gzipped when the client supports it.
import { createServer } from 'http'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

const __dirname  = fileURLToPath(new URL('.', import.meta.url))
const DIST       = join(__dirname, 'dist')
const PORT       = parseInt(process.env.PORT ?? '4175')
const UPSTREAM   = 'https://rolplay.app/ajax'
const CACHE_TTL  = 5 * 60 * 1000  // 5 min — matches React Query staleTime

const apiCache    = new Map()  // sql → { body: string, gz: Buffer, ts: number }
const staticCache = new Map()  // filePath → { data: Buffer, gz: Buffer | null }

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript',
  '.css':   'text/css',
  '.json':  'application/json',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.ico':   'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end',  () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost`)

  // ── M8 bridge proxy ──────────────────────────────────────────────────────────
  // /m8/bridge/remote-access.php  →  https://rolplay.app/ajax/remote-access.php
  if (url.pathname.startsWith('/m8/bridge/')) {
    const upstreamPath = url.pathname.replace(/^\/m8\/bridge/, '')
    const upstreamUrl  = `${UPSTREAM}${upstreamPath}`

    // Only POST is used (remote-access.php requires it)
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end('Method Not Allowed')
      return
    }

    let bodyText
    try { bodyText = await readBody(req) } catch { bodyText = '{}' }

    // Cache keyed on SQL content so identical queries are instant
    const cached = apiCache.get(bodyText)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Cache', 'HIT')
      send(req, res, cached.body, cached.gz)
      return
    }

    try {
      const upstream = await fetch(upstreamUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body:    bodyText,
      })
      if (!upstream.ok) {
        res.writeHead(upstream.status)
        res.end(await upstream.text())
        return
      }
      const body = await upstream.text()
      const gz   = gzipSync(body)
      apiCache.set(bodyText, { body, gz, ts: Date.now() })
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Cache', 'MISS')
      send(req, res, body, gz)
    } catch (err) {
      res.writeHead(502)
      res.end(String(err))
    }
    return
  }

  // ── Static file serving ──────────────────────────────────────────────────────
  let filePath = join(DIST, url.pathname)
  const ext    = extname(filePath)

  if (!ext) filePath = join(DIST, 'index.html')

  try {
    let entry = staticCache.get(filePath)
    if (!entry) {
      const data = await readFile(filePath)
      const e    = extname(filePath)
      entry = { data, gz: SKIP_GZIP.has(e) ? null : gzipSync(data) }
      staticCache.set(filePath, entry)
    }
    const mime = MIME[extname(filePath)] ?? 'application/octet-stream'
    res.setHeader('Content-Type', mime)
    if ((ext === '.js' || ext === '.css') && url.pathname.startsWith('/assets/')) {
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
}).listen(PORT, '0.0.0.0', () => {
  console.log(`M8 dashboard running on port ${PORT}`)
})

// Serves dist/ as a static SPA and proxies /sanfer/* to the upstream API
// with an in-memory cache so repeated requests within CACHE_TTL are instant.
import { createServer } from 'http'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST      = join(__dirname, 'dist')
const PORT      = parseInt(process.env.PORT ?? '4174')
const UPSTREAM  = 'https://serv.aux-rolplay.com'
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes — matches React Query staleTime

const cache = new Map()           // cacheKey → { body: string, ts: number }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost`)

  // ── API proxy with cache ───────────────────────────────────────────────────
  if (url.pathname.startsWith('/sanfer/')) {
    const key    = url.pathname + url.search
    const cached = cache.get(key)

    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Cache', 'HIT')
      res.end(cached.body)
      return
    }

    try {
      const upstream = await fetch(`${UPSTREAM}${req.url}`, {
        headers: { 'Accept': 'application/json' },
      })
      if (!upstream.ok) {
        res.writeHead(upstream.status)
        res.end(await upstream.text())
        return
      }
      const body = await upstream.text()
      cache.set(key, { body, ts: Date.now() })
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Cache', 'MISS')
      res.end(body)
    } catch (err) {
      res.writeHead(502)
      res.end(String(err))
    }
    return
  }

  // ── Static file serving ────────────────────────────────────────────────────
  let filePath = join(DIST, url.pathname)
  const ext    = extname(filePath)

  // For extensionless paths (SPA routes), serve index.html
  if (!ext) filePath = join(DIST, 'index.html')

  try {
    const data = await readFile(filePath)
    const mime = MIME[extname(filePath)] ?? 'application/octet-stream'
    res.setHeader('Content-Type', mime)
    // Hashed asset files are immutable — cache them for 1 year in the browser
    if ((ext === '.js' || ext === '.css') && url.pathname.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
    res.end(data)
  } catch {
    // Fallback: any unknown route → SPA index.html
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
  console.log(`Sanfer dashboard running on port ${PORT}`)
})

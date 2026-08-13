import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'

let pool = null

// All dashboards share one database, so every user row and every token is
// scoped to one dashboard — a Sanfer account must not open Apotex.
const DASHBOARD = process.env.DASHBOARD_NAME ?? 'M8'

// Password strength validation (mirrors frontend validation)
function validatePasswordStrength(password) {
  const errors = []
  if (password.length < 8) errors.push('Password must be at least 8 characters')
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number')
  if (!/[^a-zA-Z0-9]/.test(password)) errors.push('Password must contain a special character')
  return { valid: errors.length === 0, errors }
}

export function initializePool() {
  if (pool) return pool

  const dbUrl = process.env.DATABASE_URL || process.env.AUTH_DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL or AUTH_DATABASE_URL environment variable is required')
  }

  pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    // A serverless deployment runs many short-lived instances, each with its
    // own pool, so a large per-instance ceiling would exhaust the database's
    // connection limit. A long-lived server keeps the bigger pool.
    max: process.env.VERCEL ? 2 : 10,
    idleTimeoutMillis: 30000,
  })

  pool.on('error', (err) => {
    console.error('[auth-db] Unexpected pool error:', err.message)
  })

  return pool
}

export async function initializeDatabase() {
  const p = initializePool()
  const client = await p.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        dashboard VARCHAR(50) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT users_email_dashboard_key UNIQUE (email, dashboard)
      )
    `)

    // Migrate tables created before users were scoped per dashboard: the old
    // schema had a bare UNIQUE(email), which would let one signup block that
    // address on every other dashboard.
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard VARCHAR(50)`)
    await client.query(`UPDATE users SET dashboard = $1 WHERE dashboard IS NULL`, [DASHBOARD])
    await client.query(`ALTER TABLE users ALTER COLUMN dashboard SET NOT NULL`)
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key`)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_email_dashboard_key'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_email_dashboard_key UNIQUE (email, dashboard);
        END IF;
      END $$
    `)
    console.log(`[auth-db] Database initialized for dashboard "${DASHBOARD}"`)

    // Seed this dashboard's admin account
    const adminEmail = 'buddhadeb@rolplay.ca'
    const adminPassword = 'Rolplay@2026Admin'
    const existingAdmin = await client.query(
      'SELECT id FROM users WHERE email = $1 AND dashboard = $2',
      [adminEmail.toLowerCase(), DASHBOARD]
    )
    if (existingAdmin.rows.length === 0) {
      const hash = await hashPassword(adminPassword)
      await client.query(
        `INSERT INTO users (email, dashboard, password_hash, full_name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [adminEmail.toLowerCase(), DASHBOARD, hash, 'Rolplay Admin', 'admin']
      )
      console.log(`[auth-db] Admin account created for "${DASHBOARD}"`)
    }
  } finally {
    client.release()
  }
}

// Serverless platforms have no boot step to run initializeDatabase(), so each
// function instance ensures the schema once and reuses the result. The promise
// is cached rather than a boolean so concurrent first requests wait on one
// migration instead of racing each other.
let readyPromise = null

export function ensureDatabaseReady() {
  if (!readyPromise) {
    readyPromise = initializeDatabase().catch((err) => {
      // Let the next request retry rather than caching a transient failure
      // (a cold database, a paused instance) for the life of the process.
      readyPromise = null
      throw err
    })
  }
  return readyPromise
}

export async function hashPassword(password) {
  return bcryptjs.hash(password, 10)
}

export async function verifyPassword(password, hash) {
  return bcryptjs.compare(password, hash)
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    const isDev = process.env.NODE_ENV !== 'production'
    if (isDev) {
      console.warn('[auth] JWT_SECRET not set, using development default (UNSAFE)')
      return 'dev-secret-change-in-production'
    }
    throw new Error('JWT_SECRET environment variable is required in production')
  }
  return secret
}

export function signToken(user) {
  const secret = getJwtSecret()
  const payload = {
    user_id: user.id,
    email: user.email,
    dashboard: DASHBOARD,
  }
  return jwt.sign(payload, secret, { expiresIn: '8h' })
}

export function verifyToken(token) {
  const secret = getJwtSecret()
  try {
    const claims = jwt.verify(token, secret)
    // The dashboards share a JWT_SECRET, so a signature alone does not prove
    // the token was issued for this dashboard.
    if (claims.dashboard !== DASHBOARD) return null
    return claims
  } catch {
    return null
  }
}

export async function findUserByEmail(email) {
  const p = initializePool()
  const result = await p.query(
    'SELECT id, email, password_hash, full_name, role, created_at FROM users WHERE email = $1 AND dashboard = $2 AND is_active = TRUE LIMIT 1',
    [email.toLowerCase(), DASHBOARD]
  )
  return result.rows[0] || null
}

export async function getUserPasswordHash(email) {
  const p = initializePool()
  const result = await p.query(
    'SELECT password_hash FROM users WHERE email = $1 AND dashboard = $2 LIMIT 1',
    [email.toLowerCase(), DASHBOARD]
  )
  return result.rows[0]?.password_hash || null
}

export async function createUser(email, passwordHash, fullName = '', role = 'user') {
  const p = initializePool()
  const result = await p.query(
    `INSERT INTO users (email, dashboard, password_hash, full_name, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, email, full_name, role, created_at`,
    [email.toLowerCase(), DASHBOARD, passwordHash, fullName, role]
  )
  return result.rows[0]
}

export async function loginHandler(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const passwordHash = await getUserPasswordHash(email)
    if (!passwordHash) {
      return res.status(500).json({ message: 'Account data is incomplete' })
    }

    const passwordValid = await verifyPassword(password, passwordHash)
    if (!passwordValid) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const token = signToken(user)
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        created_at: user.created_at,
      },
    })
  } catch (error) {
    console.error('[/api/auth/login] Error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

export async function logoutHandler(req, res) {
  // In a simple setup, logout is client-side (token removal from localStorage)
  return res.json({ message: 'Logged out' })
}

export async function signupHandler(req, res) {
  try {
    const { email, password, full_name } = req.body

    if (!email || !password || !full_name) {
      return res.status(400).json({ message: 'Email, password, and full name are required' })
    }

    const strength = validatePasswordStrength(password)
    if (!strength.valid) {
      return res.status(400).json({ message: strength.errors[0] })
    }

    const existing = await findUserByEmail(email)
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' })
    }

    const passwordHash = await hashPassword(password)
    const user = await createUser(email, passwordHash, full_name, 'user')

    const token = signToken(user)
    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        created_at: user.created_at,
      },
    })
  } catch (error) {
    console.error('[/api/auth/signup] Error:', error)
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Email already registered' })
    }
    return res.status(500).json({ message: 'Internal server error' })
  }
}

// Gate for the upstream data proxy: the dashboard's data must not be
// reachable without a token issued by this dashboard.
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  const claims = verifyToken(authHeader.slice(7))
  if (!claims) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  req.user = claims
  next()
}

export async function meHandler(req, res) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' })
    }

    const token = authHeader.slice(7)
    const claims = verifyToken(token)
    if (!claims) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const user = await findUserByEmail(claims.email)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        created_at: user.created_at,
      },
    })
  } catch (error) {
    console.error('[/api/auth/me] Error:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}

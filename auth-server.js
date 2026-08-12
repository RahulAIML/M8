import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'

// PostgreSQL connection pool
let pool = null

export function initializePool() {
  if (pool) return pool

  const dbUrl = process.env.DATABASE_URL || process.env.AUTH_DATABASE_URL
  if (!dbUrl) {
    throw new Error('DATABASE_URL or AUTH_DATABASE_URL environment variable is required')
  }

  pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10,
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
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('[auth-db] Database initialized')
  } finally {
    client.release()
  }
}

export async function hashPassword(password) {
  return bcryptjs.hash(password, 10)
}

export async function verifyPassword(password, hash) {
  return bcryptjs.compare(password, hash)
}

export function signToken(user) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production'
  const payload = {
    user_id: user.id,
    email: user.email,
  }
  return jwt.sign(payload, secret, { expiresIn: '8h' })
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production'
  try {
    return jwt.verify(token, secret)
  } catch {
    return null
  }
}

export async function findUserByEmail(email) {
  const p = initializePool()
  const result = await p.query(
    'SELECT id, email, password_hash, full_name, role, created_at FROM users WHERE email = $1 AND is_active = TRUE LIMIT 1',
    [email.toLowerCase()]
  )
  return result.rows[0] || null
}

export async function getUserPasswordHash(email) {
  const p = initializePool()
  const result = await p.query(
    'SELECT password_hash FROM users WHERE email = $1 LIMIT 1',
    [email.toLowerCase()]
  )
  return result.rows[0]?.password_hash || null
}

export async function createUser(email, passwordHash, fullName = '', role = 'user') {
  const p = initializePool()
  const result = await p.query(
    `INSERT INTO users (email, password_hash, full_name, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     RETURNING id, email, full_name, role, created_at`,
    [email.toLowerCase(), passwordHash, fullName, role]
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

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
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

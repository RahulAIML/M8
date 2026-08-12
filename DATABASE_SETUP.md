# Database Setup Guide - Sanfer Dashboard

This guide explains how to set up PostgreSQL for authentication on the Sanfer Dashboard.

## Quick Start

### 1. Create PostgreSQL Database

You can use any of these PostgreSQL providers:
- **Render** (Recommended for Heroku-like deployment): https://render.com
- **Neon**: https://neon.tech
- **Supabase**: https://supabase.com
- **Railway**: https://railway.app
- **Local PostgreSQL**: `psql -U postgres`

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your database details:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
DATABASE_URL=postgresql://user:password@host:5432/sanfer_auth
JWT_SECRET=<generate-a-random-string>
```

To generate a strong JWT secret:
```bash
openssl rand -base64 32
```

### 3. Start the Application

The database tables will be created automatically on first run:

```bash
npm install
npm run build
npm start
```

Or for development:
```bash
npm run dev
```

## Database Schema

The application creates a single `users` table:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Creating the First User

You can seed the database with an initial admin user by running this SQL:

```sql
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'admin@example.com',
  '$2a$10$Nxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  'Admin User',
  'admin',
  TRUE
);
```

**Note**: The `password_hash` must be a bcrypt hash. To generate one, you can:

1. Use an online bcrypt generator (search "bcrypt online generator")
2. Or generate locally in Node.js:
   ```javascript
   import bcryptjs from 'bcryptjs'
   const hash = await bcryptjs.hash('your-password', 10)
   console.log(hash)
   ```

## Authentication Flow

1. User enters email/password on `/login` page
2. Frontend sends POST `/api/auth/login` with credentials
3. Server validates password against bcrypt hash
4. Server returns JWT token and user info
5. Frontend stores token in localStorage
6. All subsequent requests include token for validation

## Security Considerations

- Passwords are hashed using bcryptjs with salt factor 10
- JWT tokens expire after 8 hours
- Tokens are stored in browser localStorage (SPA standard)
- Use HTTPS in production
- Change `JWT_SECRET` to a strong random value
- Never commit `.env.local` to git (only `.env.local.example`)

## Troubleshooting

### "DATABASE_URL is not configured"
- Make sure `.env.local` exists in the project root
- Check that `DATABASE_URL` is set correctly
- Verify the PostgreSQL server is running and accessible

### "FATAL: password authentication failed"
- Check your database username and password
- Verify the database host is correct
- Test connection: `psql <DATABASE_URL>`

### "relation users does not exist"
- The database tables will be created automatically on first run
- If this persists, the database initialization failed
- Check server logs for more details

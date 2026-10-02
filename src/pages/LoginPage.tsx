import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthContext } from '../components/AuthProvider'
import { validateEmail } from '../lib/password'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error } = useAuthContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldError, setFieldError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError('')

    if (!email || !password) {
      setFieldError('Email and password are required')
      return
    }

    if (!validateEmail(email)) {
      setFieldError('Please enter a valid email address')
      return
    }

    try {
      await login({ email, password })
      navigate('/')
    } catch {
      // error is set by useAuth hook
    }
  }

  const displayError = fieldError || error

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(160deg, #f0f4f8 0%, #e8eef6 100%)' }}
    >
      <div className="w-full" style={{ maxWidth: 420 }}>

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              overflow: 'hidden',
              margin: '0 auto 16px',
              boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
            }}
          >
            <img
              src="/logo_rolplay.png"
              alt="RolPlay"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            <span style={{ color: '#dc2626' }}>Rol</span>Play
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Sales Intelligence Platform
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
            padding: '32px 32px 28px',
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
              Welcome
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '6px 0 0' }}>
              Sign in to your account to continue
            </p>
          </div>

          {/* Error */}
          {displayError && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '11px 14px',
                borderRadius: 10,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                marginBottom: 20,
              }}
            >
              <AlertCircle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.5 }}>{displayError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="you@company.com"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: 44,
                  padding: '0 14px',
                  borderRadius: 9,
                  border: '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#dc2626'
                  e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'
                  e.target.style.background = '#fff'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0'
                  e.target.style.boxShadow = 'none'
                  e.target.style.background = '#f8fafc'
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 7 }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    height: 44,
                    padding: '0 46px 0 14px',
                    borderRadius: 9,
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#dc2626'
                    e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'
                    e.target.style.background = '#fff'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0'
                    e.target.style.boxShadow = 'none'
                    e.target.style.background = '#f8fafc'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                  style={{
                    position: 'absolute',
                    right: 13,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#475569')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#94a3b8')}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: 46,
                borderRadius: 9,
                border: 'none',
                background: isLoading
                  ? 'rgba(220,38,38,0.5)'
                  : 'linear-gradient(135deg, #b91c1c 0%, #dc2626 60%, #ef4444 100%)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'opacity 0.15s',
                marginTop: 4,
              }}
              onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.opacity = '0.9' }}
              onMouseLeave={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 20, lineHeight: 1.6 }}>
            Access is granted by the administrator. If you have no account, or lost your password, ask the dashboard administrator for one.
          </p>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b', marginTop: 20 }}>
          Don't have an account?{' '}
          <Link
            to="/signup"
            style={{ color: '#dc2626', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none')}
          >
            Sign up
          </Link>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

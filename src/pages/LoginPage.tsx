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
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background: 'linear-gradient(160deg, #060d1a 0%, #0a1628 50%, #0d1f3c 100%)',
      }}
    >
      <div className="w-full" style={{ maxWidth: 420 }}>

        {/* Logo */}
        <div className="flex justify-center" style={{ marginBottom: 32 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <img
              src="/logo_rolplay.png"
              alt="RolPlay"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 20,
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.06) inset',
            padding: '36px 36px 28px',
          }}
        >
          {/* Heading */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2, letterSpacing: '-0.3px' }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '8px 0 0', lineHeight: 1.5 }}>
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
                padding: '12px 14px',
                borderRadius: 10,
                background: 'rgba(220,38,38,0.12)',
                border: '1px solid rgba(220,38,38,0.3)',
                marginBottom: 22,
              }}
            >
              <AlertCircle size={15} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: '#f87171', lineHeight: 1.5 }}>{displayError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}
              >
                Email address
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
                  height: 48,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1.5px solid rgba(255,255,255,0.1)',
                  background: 'rgba(15,28,60,0.6)',
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(220,38,38,0.7)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.15)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}
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
                    height: 48,
                    padding: '0 46px 0 14px',
                    borderRadius: 10,
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    background: 'rgba(15,28,60,0.6)',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(220,38,38,0.7)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.15)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#94a3b8')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#64748b')}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 10,
                border: 'none',
                background: isLoading
                  ? 'rgba(185,28,28,0.5)'
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
                letterSpacing: '0.2px',
              }}
              onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
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

          {/* Footer */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: '1px solid rgba(255,255,255,0.07)',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 8px' }}>
              Don't have an account?{' '}
              <Link
                to="/signup"
                style={{ color: '#f87171', fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none')}
              >
                Sign up
              </Link>
            </p>
            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
              Protected dashboard. Please use your company credentials.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px rgba(15,28,60,0.95) inset !important;
          -webkit-text-fill-color: #fff !important;
          caret-color: #fff;
        }
      `}</style>
    </div>
  )
}

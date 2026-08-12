/**
 * Attaches the auth token to dashboard data requests.
 *
 * The server refuses these paths without a token, and the calls are spread
 * across the query client, prefetches and several api modules — so the header
 * is applied here once rather than at each call site. Absolute URLs (the AI
 * providers) are left untouched.
 */
const API_PREFIXES = ['/m8/bridge']
const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

function isDashboardRequest(url: string): boolean {
  if (/^[a-z]+:\/\//i.test(url)) return false
  return API_PREFIXES.some((p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`))
}

// Installed on import rather than via an exported call: App's module-level
// prefetches run as soon as it is imported, so the patch has to be in place
// before that import is evaluated.
const original = window.fetch.bind(window)
{

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (!isDashboardRequest(url)) return original(input, init)

    const token = localStorage.getItem(TOKEN_KEY)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const res = await original(input, { ...init, headers })

    // An expired or revoked token should return the user to the login screen
    // rather than leaving the dashboard showing empty panels.
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    return res
  }
}

export interface AuthUser {
  id: number
  email: string
  full_name: string
  role: 'user' | 'admin'
  created_at: string
}

export interface JwtClaims {
  user_id: number
  email: string
  iat: number
  exp: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

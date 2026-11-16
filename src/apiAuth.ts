import { useCallback, useEffect, useRef, useState } from 'react'
import { API_ENABLED, ApiError, apiRequest } from './api'
import type { ApiAuth, ApiMe } from './api'
import { MIN_PASSWORD_LENGTH, normalizeSchoolEmail } from './auth'
import type { AuthResult, StudentAccount } from './auth'

type AuthRole = 'student' | 'professor'
type StorageKind = 'sessionStorage' | 'localStorage'
type AuthState = {
  student: StudentAccount | null
  token: string | null
  loading: boolean
  error: string | null
}

export type EmailVerification = { code: string; agreed: boolean }

const storageKinds: StorageKind[] = ['sessionStorage', 'localStorage']
const loggedOut: AuthState = { student: null, token: null, loading: false, error: null }
const schoolEmailMessage = '@knu.ac.kr 학교 이메일을 입력해 주세요.'
const authErrors = {
  INVALID_EMAIL_DOMAIN: schoolEmailMessage,
  EMAIL_TAKEN: '이미 가입한 이메일이에요. 로그인해 주세요.',
  INVALID_CREDENTIALS: '학교 이메일이나 비밀번호가 맞지 않아요.',
  INVALID_CODE: '인증번호 6자리를 다시 확인해 주세요.',
  CODE_EXPIRED: '인증 시간이 지났어요. 인증번호를 다시 받아 주세요.',
  WEAK_PASSWORD: `비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`,
  AGREEMENT_REQUIRED: '익명 운영 정책에 동의해 주세요.',
}

function readToken(key: string) {
  for (const kind of storageKinds) {
    try {
      const token = window[kind].getItem(key)
      if (token) return token
    } catch {
      // Try the other store if this one is blocked.
    }
  }
  return null
}

function storeToken(key: string, token: string, remember: boolean) {
  const selected = remember ? 'localStorage' : 'sessionStorage'
  for (const kind of storageKinds) {
    try {
      if (kind === selected) window[kind].setItem(key, token)
      else window[kind].removeItem(key)
    } catch {
      // Keep the authenticated session in memory when storage is blocked.
    }
  }
}

function removeToken(key: string, expectedToken?: string) {
  for (const kind of storageKinds) {
    try {
      if (!expectedToken || window[kind].getItem(key) === expectedToken) window[kind].removeItem(key)
    } catch {
      // Clearing the in-memory session still signs out the current view.
    }
  }
}

function authError(error: unknown, fallback: string) {
  if (error instanceof ApiError && Object.hasOwn(authErrors, error.code)) {
    return authErrors[error.code as keyof typeof authErrors]
  }
  return fallback
}

export function useApiAuth(role: AuthRole) {
  const key = `babo3:api-auth:v1:${role}`
  const expectedRole = role === 'student' ? 'STUDENT' : 'PROFESSOR'
  const [state, setState] = useState<AuthState>(() => ({
    ...loggedOut,
    loading: API_ENABLED && Boolean(readToken(key)),
  }))
  const revision = useRef(0)
  const pendingRestore = useRef<AbortController | null>(null)

  const restore = useCallback(async () => {
    const currentRevision = ++revision.current
    pendingRestore.current?.abort()
    if (!API_ENABLED) return

    const token = readToken(key)
    if (!token) {
      setState(loggedOut)
      return
    }

    const controller = new AbortController()
    pendingRestore.current = controller
    setState({ ...loggedOut, loading: true })
    try {
      const profile = await apiRequest<ApiMe>('/me', { token, signal: controller.signal })
      if (revision.current !== currentRevision) return
      if (profile.role !== expectedRole) {
        removeToken(key, token)
        setState(loggedOut)
        return
      }
      setState({ ...loggedOut, token, student: { email: profile.email, displayName: profile.name } })
    } catch (error) {
      if (revision.current !== currentRevision) return
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        removeToken(key, token)
        setState(loggedOut)
        return
      }
      setState({ ...loggedOut, error: '로그인 정보를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.' })
    } finally {
      if (pendingRestore.current === controller) pendingRestore.current = null
    }
  }, [expectedRole, key])

  useEffect(() => {
    if (!API_ENABLED) return
    void restore()
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) void restore()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      ++revision.current
      pendingRestore.current?.abort()
      window.removeEventListener('storage', onStorage)
    }
  }, [key, restore])

  async function authenticate(
    path: '/auth/login' | '/auth/signup',
    body: { email: string; password: string; code?: string; agreed?: boolean },
    remember: boolean,
  ): Promise<AuthResult> {
    const currentRevision = ++revision.current
    pendingRestore.current?.abort()

    try {
      const response = await apiRequest<ApiAuth>(path, { method: 'POST', body })
      if (revision.current !== currentRevision) return {}
      if (typeof response?.access_token !== 'string' || !response.access_token || typeof response.name !== 'string') {
        return { error: '인증 서버의 응답을 확인할 수 없어요. 다시 시도해 주세요.' }
      }
      if (response.role !== expectedRole) {
        const screen = response.role === 'PROFESSOR' ? '교수' : '학생'
        return { error: `${screen} 화면에서 로그인해 주세요.` }
      }

      const student = { email: body.email, displayName: response.name }
      const token = response.access_token
      storeToken(key, token, remember)
      setState({ ...loggedOut, student, token })
      return { student }
    } catch (error) {
      if (revision.current !== currentRevision) return {}
      return { error: authError(error, '인증 서버에 연결하지 못했어요. 다시 시도해 주세요.') }
    }
  }

  async function requestEmailCode(input: string): Promise<AuthResult> {
    if (role !== 'student') return { error: '학교 이메일 인증은 학생 가입 화면에서 진행해 주세요.' }
    const email = normalizeSchoolEmail(input)
    if (!email) return { error: schoolEmailMessage }

    try {
      await apiRequest<void>('/auth/email-code', { method: 'POST', body: { email } })
      return {}
    } catch (error) {
      return { error: authError(error, '인증번호를 보내지 못했어요. 다시 시도해 주세요.') }
    }
  }

  async function signUp(input: string, password: string, verification?: EmailVerification): Promise<AuthResult> {
    if (role !== 'student') return { error: '교수 계정은 이미 등록된 학교 이메일로 로그인해 주세요.' }
    const email = normalizeSchoolEmail(input)
    if (!email) return { error: schoolEmailMessage }
    if (!verification || !/^\d{6}$/.test(verification.code)) return { error: authErrors.INVALID_CODE }
    if (!verification.agreed) return { error: authErrors.AGREEMENT_REQUIRED }
    if (password.length < MIN_PASSWORD_LENGTH) return { error: authErrors.WEAK_PASSWORD }

    return authenticate('/auth/signup', { email, password, code: verification.code, agreed: verification.agreed }, false)
  }

  async function signIn(input: string, password: string, remember: boolean): Promise<AuthResult> {
    const email = normalizeSchoolEmail(input)
    if (!email) return { error: schoolEmailMessage }
    if (!password) return { error: '비밀번호를 입력해 주세요.' }
    return authenticate('/auth/login', { email, password }, remember)
  }

  function signOut() {
    ++revision.current
    pendingRestore.current?.abort()
    removeToken(key)
    setState(loggedOut)
  }

  return { ...state, signIn, signUp, requestEmailCode, signOut, retry: () => void restore() }
}

import { useEffect, useState } from 'react'

export type StudentAccount = { email: string; displayName: string }
export type AuthResult = { student?: StudentAccount; error?: string }

export const DEMO_STUDENT_EMAIL = 'yesung@knu.ac.kr'
export const DEMO_PROFESSOR_EMAIL = 'jihwan@knu.ac.kr'
export const DEMO_STUDENT_PASSWORD = 'demo1234'
export const DEMO_PROFESSOR_PASSWORD = 'demo1234'
export const MIN_PASSWORD_LENGTH = 8

const demoStudent: StudentAccount = { email: DEMO_STUDENT_EMAIL, displayName: '예성' }
const demoProfessor: StudentAccount = { email: DEMO_PROFESSOR_EMAIL, displayName: '서지환' }
const accountPrefix = 'babo3:auth:account:v1:'
const sessionKeys = {
  student: 'babo3:auth:session:v1',
  professor: 'babo3:auth:professor-session:v1',
}
const mockAccounts = new Map<string, StoredAccount>()

type AuthRole = keyof typeof sessionKeys
type StorageKind = 'localStorage' | 'sessionStorage'
type StoredAccount = { student: StudentAccount; salt: string; digest: string }

export function normalizeSchoolEmail(input: string) {
  const email = input.trim().toLowerCase()
  return /^[a-z0-9._%+'-]+@knu\.ac\.kr$/.test(email) ? email : null
}

function readStorage(kind: StorageKind, key: string) {
  try {
    return window[kind].getItem(key)
  } catch {
    return null
  }
}

function writeStorage(kind: StorageKind, key: string, value: string | null) {
  try {
    if (value === null) window[kind].removeItem(key)
    else window[kind].setItem(key, value)
  } catch {
    // The current tab can still use the mock accounts in memory.
  }
}

function findAccount(email: string): StoredAccount | undefined {
  const saved = readStorage('localStorage', accountPrefix + email)
  if (saved) {
    try {
      const account: Partial<StoredAccount> | null = JSON.parse(saved)
      if (
        account?.student?.email === email &&
        typeof account.student.displayName === 'string' &&
        typeof account.salt === 'string' &&
        typeof account.digest === 'string'
      ) {
        return { student: account.student, salt: account.salt, digest: account.digest }
      }
    } catch {
      // Ignore an invalid record and check the in-memory account.
    }
  }
  return mockAccounts.get(email)
}

function readAccount(role: AuthRole): StudentAccount | null {
  const sessionKey = sessionKeys[role]
  const email = readStorage('sessionStorage', sessionKey) ?? readStorage('localStorage', sessionKey)
  if (!email) return null
  if (role === 'professor') return email === DEMO_PROFESSOR_EMAIL ? demoProfessor : null
  return email === DEMO_STUDENT_EMAIL ? demoStudent : findAccount(email)?.student ?? null
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function passwordDigest(password: string, salt: string) {
  const credentials = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', credentials)
  return toHex(new Uint8Array(digest))
}

function useAccountSession(role: AuthRole) {
  const sessionKey = sessionKeys[role]
  const [student, setStudent] = useState<StudentAccount | null>(() => readAccount(role))

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === sessionKey || event.key === null) setStudent(readAccount(role))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [role, sessionKey])

  function startSession(account: StudentAccount, remember: boolean) {
    writeStorage('sessionStorage', sessionKey, remember ? null : account.email)
    writeStorage('localStorage', sessionKey, remember ? account.email : null)
    setStudent(account)
    return { student: account }
  }

  function signOut() {
    writeStorage('sessionStorage', sessionKey, null)
    writeStorage('localStorage', sessionKey, null)
    setStudent(null)
  }

  return { student, startSession, signOut }
}

export function useStudentAuth() {
  const { student, startSession, signOut } = useAccountSession('student')

  async function signIn(input: string, password: string, remember: boolean): Promise<AuthResult> {
    const email = normalizeSchoolEmail(input)
    if (!email) return { error: '@knu.ac.kr 학교 이메일을 입력해 주세요.' }
    const invalidCredentials = { error: '학교 이메일이나 비밀번호가 맞지 않아요.' }

    if (email === DEMO_STUDENT_EMAIL) {
      return password === DEMO_STUDENT_PASSWORD ? startSession(demoStudent, remember) : invalidCredentials
    }

    const account = findAccount(email)
    if (!account) return invalidCredentials

    try {
      const digest = await passwordDigest(password, account.salt)
      return digest === account.digest ? startSession(account.student, remember) : invalidCredentials
    } catch {
      return { error: '이 브라우저에서 테스트 비밀번호를 확인할 수 없어요.' }
    }
  }

  async function signUp(input: string, password: string): Promise<AuthResult> {
    const email = normalizeSchoolEmail(input)
    if (!email) return { error: '@knu.ac.kr 학교 이메일을 입력해 주세요.' }
    if (password.length < MIN_PASSWORD_LENGTH) return { error: `비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.` }
    const existingAccount = { error: '이미 가입한 이메일이에요. 로그인해 주세요.' }

    if (email === DEMO_PROFESSOR_EMAIL) return { error: '교수 계정에 사용되는 학교 이메일이에요.' }
    if (email === DEMO_STUDENT_EMAIL || findAccount(email)) return existingAccount

    try {
      const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
      const digest = await passwordDigest(password, salt)
      const saveAccount = () => {
        if (findAccount(email)) return existingAccount
        const account = { email, displayName: email.slice(0, email.lastIndexOf('@')) }
        const record = { student: account, salt, digest }
        mockAccounts.set(email, record)
        writeStorage('localStorage', accountPrefix + email, JSON.stringify(record))
        return startSession(account, false)
      }
      return navigator.locks ? await navigator.locks.request(accountPrefix + email, saveAccount) : saveAccount()
    } catch {
      return { error: '이 브라우저에서 테스트 계정을 만들 수 없어요.' }
    }
  }

  return { student, signIn, signUp, signOut }
}

export function useProfessorAuth() {
  const { student, startSession, signOut } = useAccountSession('professor')

  async function signIn(input: string, password: string, remember: boolean): Promise<AuthResult> {
    const email = normalizeSchoolEmail(input)
    if (!email) return { error: '@knu.ac.kr 학교 이메일을 입력해 주세요.' }
    if (email !== DEMO_PROFESSOR_EMAIL || password !== DEMO_PROFESSOR_PASSWORD) {
      return { error: '교수 이메일이나 비밀번호가 맞지 않아요.' }
    }
    return startSession(demoProfessor, remember)
  }

  return { student, signIn, signOut }
}

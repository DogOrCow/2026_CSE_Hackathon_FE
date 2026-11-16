import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from './Icon'
import {
  DEMO_PROFESSOR_EMAIL,
  DEMO_PROFESSOR_PASSWORD,
  DEMO_STUDENT_EMAIL,
  DEMO_STUDENT_PASSWORD,
  MIN_PASSWORD_LENGTH,
  normalizeSchoolEmail,
} from './auth'
import type { AuthResult } from './auth'
import './auth.css'

type AuthView = 'login' | 'signup'
type AuthScreenProps = {
  view: AuthView
  role?: 'student' | 'professor'
  open: (view: AuthView) => void
  signIn: (email: string, password: string, remember: boolean) => Promise<AuthResult>
  signUp?: (email: string, password: string) => Promise<AuthResult>
}

type Challenge = { email: string; code: string; expiresAt: number }
type ErrorField = 'email' | 'code' | 'password' | 'policy' | 'form'
type FieldError = { field: ErrorField; message: string }

const codeDuration = 5 * 60 * 1000
const schoolEmailPrompt = '@knu.ac.kr 학교 이메일을 입력해 주세요.'

function makeCode(previousCode?: string) {
  const number = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000
  const code = String(number)
  return code === previousCode ? String(number === 999999 ? 100000 : number + 1) : code
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function AuthScreen(props: AuthScreenProps) {
  return <AuthForm key={`${props.role ?? 'student'}:${props.view}`} {...props} />
}

function AuthForm({ view, role = 'student', open, signIn, signUp }: AuthScreenProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const errorId = `${baseId}-error`
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(false)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [now, setNow] = useState(Date.now)
  const [error, setError] = useState<FieldError | null>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const submitButton = useRef<HTMLButtonElement>(null)
  const isProfessor = role === 'professor'
  const isSignup = !isProfessor && view === 'signup'
  const demoEmail = isProfessor ? DEMO_PROFESSOR_EMAIL : DEMO_STUDENT_EMAIL
  const title = isProfessor ? '교수 로그인' : isSignup ? '학교 이메일로 가입' : '학교 이메일로 로그인'
  const intro = isProfessor
    ? '교수 계정으로 수업 중 올라온 질문을 확인하세요.'
    : isSignup ? '테스트용 학교 이메일로 가입해 보세요.' : '학교 이메일로 수업 질문창에 입장하세요.'
  const secondsLeft = challenge ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000)) : 0

  useEffect(() => {
    if (!challenge) return
    codeInput.current?.focus()
    const timer = window.setInterval(() => {
      const currentTime = Date.now()
      setNow(currentTime)
      if (currentTime >= challenge.expiresAt) window.clearInterval(timer)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [challenge])

  function fieldError(field: ErrorField) {
    return error?.field === field && <p className="auth-error" id={errorId} role="alert">{error.message}</p>
  }

  function errorProps(field: ErrorField) {
    const invalid = error?.field === field
    return { 'aria-invalid': invalid || undefined, 'aria-describedby': invalid ? errorId : undefined }
  }

  function changeEmail(value: string) {
    setEmail(value)
    if (challenge && normalizeSchoolEmail(value) !== challenge.email) {
      setChallenge(null)
      setCode('')
    }
    if (error?.field === 'email' || error?.field === 'code' || error?.field === 'form') setError(null)
  }

  function issueCode() {
    const address = normalizeSchoolEmail(email)
    if (!address) {
      setError({ field: 'email', message: schoolEmailPrompt })
      emailInput.current?.focus()
      return
    }

    const currentTime = Date.now()
    setChallenge({ email: address, code: makeCode(challenge?.code), expiresAt: currentTime + codeDuration })
    setNow(currentTime)
    setCode('')
    setError(null)
  }

  function fillDemoAccount() {
    setEmail(demoEmail)
    setPassword(isProfessor ? DEMO_PROFESSOR_PASSWORD : DEMO_STUDENT_PASSWORD)
    setError(null)
    submitButton.current?.focus()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const address = normalizeSchoolEmail(email)
    if (!address) {
      setError({ field: 'email', message: schoolEmailPrompt })
      emailInput.current?.focus()
      return
    }

    if (isSignup) {
      if (!challenge || challenge.email !== address) {
        setError({ field: 'email', message: '학교 이메일의 인증번호를 먼저 받아 주세요.' })
        return
      }
      if (Date.now() >= challenge.expiresAt) {
        setError({ field: 'code', message: '인증 시간이 지났어요. 인증번호를 다시 받아 주세요.' })
        return
      }
      if (challenge.code !== code) {
        setError({ field: 'code', message: '인증번호 6자리를 다시 확인해 주세요.' })
        codeInput.current?.focus()
        return
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError({ field: 'password', message: `비밀번호를 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.` })
        return
      }
      if (!consent) {
        setError({ field: 'policy', message: '익명 운영 정책에 동의해 주세요.' })
        return
      }
    } else if (!password) {
      setError({ field: 'password', message: '비밀번호를 입력해 주세요.' })
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = isSignup ? await signUp?.(address, password) : await signIn(address, password, remember)
      if (!result) {
        setError({ field: 'form', message: '지금은 가입을 진행할 수 없어요.' })
        return
      }
      if (result.error) setError({ field: 'form', message: result.error })
    } catch {
      setError({ field: 'form', message: '잠시 후 다시 시도해 주세요.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth-screen" aria-labelledby={titleId}>
      <div className="auth-card">
        <header className="auth-heading">
          <span className="auth-heading-icon"><Icon name="lock" size={20} /></span>
          <h1 id={titleId}>{title}</h1>
          <p>{intro}</p>
        </header>

        <form className="auth-form" aria-busy={busy} onSubmit={submit} noValidate>
          <div className="auth-field">
            <label htmlFor={`${baseId}-email`}>학교 이메일</label>
            <div className="auth-email-row">
              <input
                autoComplete="username"
                disabled={busy}
                id={`${baseId}-email`}
                name="email"
                onChange={(event) => changeEmail(event.target.value)}
                placeholder="student@knu.ac.kr"
                ref={emailInput}
                required
                spellCheck={false}
                type="email"
                value={email}
                {...errorProps('email')}
              />
              {isSignup && (
                <button className="auth-secondary" disabled={busy} onClick={issueCode} type="button">
                  {challenge ? '재전송' : '인증번호 보내기'}
                </button>
              )}
            </div>
            {fieldError('email')}
          </div>

          {isSignup && challenge && (
            <div className="auth-field auth-verification">
              <label htmlFor={`${baseId}-code`}>인증번호</label>
              <div className="auth-code-row">
                <input
                  autoComplete="off"
                  disabled={busy}
                  id={`${baseId}-code`}
                  inputMode="numeric"
                  name="verification-code"
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                    if (error?.field === 'code') setError(null)
                  }}
                  placeholder="숫자 6자리"
                  ref={codeInput}
                  required
                  type="text"
                  value={code}
                  {...errorProps('code')}
                />
                <span className="auth-timer" role="timer" aria-label="인증번호 유효 시간">
                  {formatTime(secondsLeft)}
                </span>
              </div>
              <p className="auth-verification-notice" role="status">
                {secondsLeft > 0 ? <>모의 인증번호 <strong>{challenge.code}</strong></> : '인증 시간이 지났어요. 인증번호를 다시 보내 주세요.'}
              </p>
              {fieldError('code')}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor={`${baseId}-password`}>비밀번호</label>
            <input
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              disabled={busy}
              id={`${baseId}-password`}
              name="password"
              onChange={(event) => {
                setPassword(event.target.value)
                if (error?.field === 'password' || error?.field === 'form') setError(null)
              }}
              placeholder={isSignup ? `${MIN_PASSWORD_LENGTH}자 이상인 테스트 비밀번호` : '비밀번호 입력'}
              required
              type="password"
              value={password}
              {...errorProps('password')}
            />
            {fieldError('password')}
          </div>

          {isSignup ? (
            <div className="auth-policy">
              <label>
                <input
                  checked={consent}
                  disabled={busy}
                  onChange={(event) => {
                    setConsent(event.target.checked)
                    if (error?.field === 'policy') setError(null)
                  }}
                  required
                  type="checkbox"
                  {...errorProps('policy')}
                />
                익명 운영 정책에 동의해요
              </label>
              <p>질문은 학생과 교수에게 익명으로 표시돼요. 운영 정책 위반 시 운영진이 작성자를 확인할 수 있어요.</p>
              {fieldError('policy')}
            </div>
          ) : (
            <label className="auth-remember">
              <input checked={remember} disabled={busy} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
              로그인 상태 유지
            </label>
          )}

          {fieldError('form')}
          <button className="auth-primary" disabled={busy} ref={submitButton} type="submit">
            {isSignup ? (busy ? '가입 중…' : '가입하기') : (busy ? '로그인 중…' : '로그인')}
          </button>
        </form>

        {isSignup ? (
          <p className="auth-test-hint">인증번호는 이 화면에 표시돼요. 실제 메일은 발송되지 않아요.</p>
        ) : (
          <div className="auth-demo">
            <div>
              <strong>{isProfessor ? '교수 테스트 계정' : '학생 테스트 계정'}</strong>
              <span>{demoEmail}</span>
            </div>
            <button className="auth-secondary" disabled={busy} onClick={fillDemoAccount} type="button">계정 입력</button>
          </div>
        )}

        {!isProfessor && (
          <footer className="auth-footer">
            <span>{isSignup ? '이미 계정이 있나요?' : '계정이 없나요?'}</span>
            <button className="auth-link" disabled={busy} onClick={() => open(isSignup ? 'login' : 'signup')} type="button">
              {isSignup ? '로그인' : '회원가입'}
            </button>
          </footer>
        )}
      </div>
    </section>
  )
}

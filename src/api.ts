import type { Course, CourseDraft, CourseSession } from './courses'
import type { Question } from './state'

export type ApiRole = 'STUDENT' | 'PROFESSOR'
export type ApiAuth = { access_token: string; role: ApiRole; name: string }
export type ApiMe = { email: string; name: string; role: ApiRole }

export type ApiCourse = {
  id: number
  name: string
  code?: string | null
  professor_name: string | null
  semester?: string
  schedule_text: string
  is_live: boolean
  next_class_at: string | null
  live_question_count: number
}

export type ApiArchiveQuestion = {
  id: number
  content: string
  created_at: string
  vote_count: number
}

export type ApiQuestion = ApiArchiveQuestion & {
  voted: boolean
  mine: boolean
  answered: boolean
}

export type ApiArchiveSession = {
  id: number
  date: string
  week: number
  question_count: number
}

export type ApiLiveSession = {
  id: number
  date: string
  week: number
  starts_at: string
  ends_at: string
}

export type ApiLive = { session: ApiLiveSession; questions: ApiQuestion[] }
export type ApiVote = { vote_count: number; voted: boolean }
export type ApiAnswer = { answered: boolean }

type ApiOptions = {
  method?: string
  token?: string
  body?: unknown
  signal?: AbortSignal
}

type ApiId = number | string
type ApiErrorBody = { code?: unknown; message?: unknown; reason?: unknown }

const env = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env
const configuredBase = env?.VITE_API_BASE_URL?.trim() ?? ''
export const API_ENABLED = configuredBase.length > 0

const normalizedBase = configuredBase.replace(/\/+$/, '')
const apiBase = normalizedBase.endsWith('/api') ? normalizedBase : `${normalizedBase}/api`

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly reason?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function endpoint(path: string) {
  if (!API_ENABLED) throw new ApiError(0, 'API_DISABLED', '서버 주소가 설정되지 않았어요.')
  const absolutePath = `/${path.replace(/^\/+/, '')}`
  const route = absolutePath.replace(/^\/api(?=\/|$)/, '')
  return `${apiBase}${route}`
}

function connectionError(error: unknown, signal?: AbortSignal): never {
  signal?.throwIfAborted()
  if (error instanceof Error && error.name === 'AbortError') throw error
  throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.')
}

async function fetchResponse(path: string, options: ApiOptions, accept: string) {
  const url = endpoint(path)
  const headers = new Headers({ Accept: accept })
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')

  const body = options.body === undefined ? undefined : JSON.stringify(options.body)
  try {
    return await fetch(url, {
      method: options.method ?? 'GET',
      body,
      headers,
      signal: options.signal,
      credentials: 'omit',
    })
  } catch (error) {
    connectionError(error, options.signal)
  }
}

async function assertOk(response: Response, signal?: AbortSignal) {
  if (response.ok) return

  let errorBody: ApiErrorBody | null = null
  try {
    errorBody = await response.json()
  } catch (error) {
    signal?.throwIfAborted()
    if (error instanceof Error && error.name === 'AbortError') throw error
  }

  const status = response.status
  const code = typeof errorBody?.code === 'string' ? errorBody.code : status >= 500 ? 'SERVER_ERROR' : 'HTTP_ERROR'
  const message = typeof errorBody?.message === 'string'
    ? errorBody.message
    : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
  const reason = typeof errorBody?.reason === 'string' ? errorBody.reason : undefined
  throw new ApiError(status, code, message, reason)
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetchResponse(path, options, 'application/json')
  await assertOk(response, options.signal)
  if (response.status === 204) return undefined as T

  try {
    return await response.json() as T
  } catch (error) {
    if (!(error instanceof SyntaxError)) connectionError(error, options.signal)
    throw new ApiError(response.status, 'INVALID_RESPONSE', '서버에서 올바른 응답을 받지 못했어요.')
  }
}

function coursePath(courseId: ApiId) {
  return `/courses/${encodeURIComponent(String(courseId))}`
}

function questionPath(questionId: ApiId) {
  return `/questions/${encodeURIComponent(String(questionId))}`
}

export function getCourses(token: string, signal?: AbortSignal) {
  return apiRequest<ApiCourse[]>('/courses', { token, signal })
}

export function enrollCourse(code: string, token: string, signal?: AbortSignal) {
  return apiRequest<ApiCourse>('/courses/enroll', {
    method: 'POST',
    body: { code: code.trim().toUpperCase() },
    token,
    signal,
  })
}

export function createProfessorCourse(draft: CourseDraft, token: string, signal?: AbortSignal) {
  const semester = draft.semester.trim().replace(/^(\d{4})년\s*([12])학기$/, '$1-$2')
  return apiRequest<ApiCourse>('/courses', {
    method: 'POST',
    token,
    signal,
    body: {
      name: draft.name.trim(),
      code: draft.code.trim().toUpperCase(),
      semester,
      schedules: draft.days.map((day) => ({
        day_of_week: day,
        start_time: draft.startsAt,
        end_time: draft.endsAt,
      })),
    },
  })
}

export function getLiveCourse(courseId: ApiId, token: string, signal?: AbortSignal) {
  return apiRequest<ApiLive>(`${coursePath(courseId)}/live`, { token, signal })
}

export function submitApiQuestion(courseId: ApiId, content: string, token: string, signal?: AbortSignal) {
  return apiRequest<ApiQuestion>(`${coursePath(courseId)}/questions`, {
    method: 'POST',
    body: { content },
    token,
    signal,
  })
}

export function setQuestionVote(questionId: ApiId, voted: boolean, token: string, signal?: AbortSignal) {
  return apiRequest<ApiVote>(`${questionPath(questionId)}/vote`, {
    method: voted ? 'PUT' : 'DELETE',
    token,
    signal,
  })
}

export function setQuestionAnswered(questionId: ApiId, answered: boolean, token: string, signal?: AbortSignal) {
  return apiRequest<ApiAnswer>(`${questionPath(questionId)}/answered`, {
    method: answered ? 'PUT' : 'DELETE',
    token,
    signal,
  })
}

export function getArchivedSessions(courseId: ApiId, token: string, signal?: AbortSignal) {
  return apiRequest<ApiArchiveSession[]>(`${coursePath(courseId)}/sessions`, { token, signal })
}

export function getArchivedQuestions(sessionId: ApiId, token: string, signal?: AbortSignal) {
  return apiRequest<ApiArchiveQuestion[]>(`/sessions/${encodeURIComponent(String(sessionId))}/questions`, { token, signal })
}

const fullDate = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
const day = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' })
const clock = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export function mapApiCourse(course: ApiCourse, sessions: CourseSession[] = []): Course & {
  isLive: boolean
  liveQuestionCount: number
} {
  const next = course.next_class_at ? new Date(course.next_class_at) : null
  return {
    id: String(course.id),
    code: course.code ?? '',
    name: course.name,
    instructor: course.professor_name ? `${course.professor_name} 교수` : '담당 교수 미정',
    semester: course.semester,
    schedule: course.schedule_text,
    nextClass: next ? `다음 수업 ${day.format(next)} ${clock.format(next)}` : '',
    sessions,
    isLive: course.is_live,
    liveQuestionCount: course.live_question_count,
  }
}

export function mapApiQuestion(question: ApiQuestion | ApiArchiveQuestion): Question {
  return {
    id: String(question.id),
    text: question.content,
    time: clock.format(new Date(question.created_at)),
    reactionCount: question.vote_count,
    answered: 'answered' in question && question.answered,
    mine: 'mine' in question && question.mine,
    reacted: 'voted' in question && question.voted,
  }
}

function mapSession(
  session: ApiLiveSession | ApiArchiveSession,
  questions: Question[],
): CourseSession {
  const date = new Date(`${session.date}T00:00:00+09:00`)
  return {
    id: String(session.id),
    date: fullDate.format(date),
    shortDate: `${session.date.slice(5).replace('-', '.')} ${day.format(date)}`,
    week: `${session.week}주차`,
    start: 'starts_at' in session ? clock.format(new Date(session.starts_at)) : '',
    questions,
  }
}

export function mapApiLiveSession(session: ApiLiveSession, questions: Question[] = []): CourseSession & { end: string } {
  return {
    ...mapSession(session, questions),
    live: true,
    end: clock.format(new Date(session.ends_at)),
  }
}

export function mapApiArchiveSession(session: ApiArchiveSession, questions: Question[] = []): CourseSession & {
  questionCount: number
} {
  return { ...mapSession(session, questions), questionCount: session.question_count }
}

export async function readCourseStream(
  courseId: string,
  token: string,
  signal: AbortSignal,
  onEvent: (eventName: string) => void,
  onOpen?: () => void,
) {
  const response = await fetchResponse(`${coursePath(courseId)}/stream`, { token, signal }, 'text/event-stream')
  await assertOk(response, signal)
  const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  if (!response.body || contentType !== 'text/event-stream') {
    throw new ApiError(response.status, 'INVALID_STREAM', '실시간 질문 스트림을 열 수 없어요.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let line = ''
  let afterCarriageReturn = false
  let eventName = ''
  let hasData = false

  function readLine(value: string) {
    if (!value) {
      // The server may send a named session.ended event without a data field.
      if (eventName || hasData) {
        signal.throwIfAborted()
        onEvent(eventName || 'message')
      }
      eventName = ''
      hasData = false
      return
    }
    if (value.startsWith(':')) return

    const separator = value.indexOf(':')
    const field = separator < 0 ? value : value.slice(0, separator)
    const content = separator < 0 ? '' : value.slice(separator + 1).replace(/^ /, '')
    if (field === 'event') eventName = content
    if (field === 'data') hasData = true
  }

  function readText(text: string) {
    for (const character of text) {
      if (afterCarriageReturn) {
        afterCarriageReturn = false
        if (character === '\n') continue
      }
      if (character === '\n' || character === '\r') {
        readLine(line)
        line = ''
        afterCarriageReturn = character === '\r'
      } else {
        line += character
      }
    }
  }

  const cancelReader = () => { void reader.cancel(signal.reason).catch(() => {}) }
  signal.addEventListener('abort', cancelReader, { once: true })
  try {
    signal.throwIfAborted()
    onOpen?.()
    for (;;) {
      signal.throwIfAborted()
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch (error) {
        connectionError(error, signal)
      }
      signal.throwIfAborted()
      if (chunk.done) {
        readText(decoder.decode())
        return
      }
      readText(decoder.decode(chunk.value, { stream: true }))
    }
  } finally {
    signal.removeEventListener('abort', cancelReader)
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

import { useMemo, useSyncExternalStore } from 'react'
import { DEMO_STUDENT_EMAIL } from './auth'

export interface Question {
  id: string
  text: string
  time: string
  reactionCount: number
  answered: boolean
  mine: boolean
  reacted: boolean
}

export interface ClassroomState {
  questions: Question[]
  ended: boolean
}

type StoredQuestion = Question & { authorEmail?: string; reactedBy?: string[] }
type StoredClassroom = Omit<ClassroomState, 'questions'> & { questions: StoredQuestion[] }

export type SubmitResult =
  | { status: 'posted'; questionId: string }
  | { status: 'rejected'; message: string }
  | { status: 'closed' }
  | { status: 'invalid'; message: string }

export const QUESTION_LIMIT = 200

export function questionLength(text: string) {
  return Array.from(text).length
}

export const SESSION = {
  courseId: 'database',
  sessionId: 'week-11',
  courseName: '데이터베이스',
  instructor: '서지환 교수',
  week: '11주차',
  date: '11월 17일 화요일',
  start: '10:30',
  end: '11:45',
  demoTime: '11:17',
}

function isClassInSession(advancedToEnd: boolean) {
  const time = advancedToEnd ? SESSION.end : SESSION.demoTime
  return time >= SESSION.start && time < SESSION.end
}

type SeedQuestion = Pick<Question, 'text' | 'time' | 'reactionCount'> &
  Partial<Pick<Question, 'answered' | 'mine' | 'reacted'>>

const seedQuestions: SeedQuestion[] = [
  {
    text: '함수 종속이 정확히 뭔가요?',
    time: '10:41',
    reactionCount: 9,
    answered: true,
  },
  {
    text: '후보키랑 슈퍼키 차이를 한 번 더 설명해주세요.',
    time: '10:47',
    reactionCount: 6,
    answered: true,
  },
  {
    text: '3정규형이랑 BCNF 차이가 아직 헷갈려요. 예시 하나만 더 들어주실 수 있나요?',
    time: '10:52',
    reactionCount: 12,
    reacted: true,
  },
  {
    text: '무손실 분해인지는 어떻게 확인하나요?',
    time: '10:58',
    reactionCount: 3,
  },
  {
    text: '방금 분해 예제 한 번만 다시 보여주세요.',
    time: '11:08',
    reactionCount: 8,
    mine: true,
  },
  {
    text: '이번 Lab 과제에 인덱스도 포함되나요?',
    time: '11:15',
    reactionCount: 5,
  },
  {
    text: '정규화를 일부러 안 하는 경우도 있나요?',
    time: '11:17',
    reactionCount: 1,
  },
]

const storageKey = `babo3:classroom:${SESSION.courseId}:${SESSION.sessionId}:v1`
const initialState: StoredClassroom = {
  ended: false,
  questions: seedQuestions.map((question, index) => ({
    id: `question-${index + 1}`,
    answered: false,
    mine: false,
    reacted: false,
    ...question,
  })),
}

let state = initialState
// Retain in-memory changes when storage is unavailable or its value has not changed.
let lastStorageValue: string | null | undefined
const listeners = new Set<() => void>()

function isQuestion(value: unknown): value is StoredQuestion {
  if (!value || typeof value !== 'object') return false
  const question = value as Partial<StoredQuestion>
  return (
    typeof question.id === 'string' &&
    typeof question.text === 'string' &&
    typeof question.time === 'string' &&
    typeof question.reactionCount === 'number' &&
    Number.isInteger(question.reactionCount) &&
    question.reactionCount >= 0 &&
    typeof question.answered === 'boolean' &&
    typeof question.mine === 'boolean' &&
    typeof question.reacted === 'boolean' &&
    (question.authorEmail === undefined || typeof question.authorEmail === 'string') &&
    (question.reactedBy === undefined || (
      Array.isArray(question.reactedBy) && question.reactedBy.every((email) => typeof email === 'string')
    ))
  )
}

function publish(next: StoredClassroom) {
  state = next
  for (const listener of listeners) listener()
}

function refresh() {
  if (typeof window === 'undefined') return

  let raw: string | null
  try {
    raw = window.localStorage.getItem(storageKey)
  } catch {
    return
  }

  if (raw === lastStorageValue) return
  lastStorageValue = raw
  if (raw === null) return

  let snapshot: Partial<StoredClassroom> | null
  try {
    snapshot = JSON.parse(raw)
  } catch {
    return
  }

  if (
    typeof snapshot?.ended === 'boolean' &&
    Array.isArray(snapshot.questions) &&
    snapshot.questions.every(isQuestion)
  ) {
    publish({ ended: snapshot.ended, questions: snapshot.questions })
  }
}

function save(next: StoredClassroom) {
  if (typeof window !== 'undefined') {
    try {
      const raw = JSON.stringify(next)
      window.localStorage.setItem(storageKey, raw)
      lastStorageValue = raw
    } catch {
      // The current tab can keep using the classroom while storage is unavailable.
    }
  }
  publish(next)
}

function onStorage(event: StorageEvent) {
  if (event.key === storageKey || event.key === null) refresh()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
    refresh()
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

async function transact<Result>(operation: () => Result): Promise<Result> {
  const update = () => {
    refresh()
    return operation()
  }

  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (!locks) return update()

  let acquired = false
  try {
    return await locks.request(storageKey, () => {
      acquired = true
      return update()
    })
  } catch (error) {
    if (acquired) throw error
    return update()
  }
}

function clockMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function nextQuestionTime(questions: Question[]) {
  const classStart = clockMinutes(SESSION.start)
  const classEnd = clockMinutes(SESSION.end)
  // Older mock entries can use a device time outside this fixture's schedule.
  const classTimes = questions.map(({ time }) => clockMinutes(time)).filter((time) => time >= classStart && time < classEnd)
  const previous = classTimes.reduce((latest, time) => Math.max(latest, time), clockMinutes(SESSION.demoTime))
  const nextMinute = Math.min(previous + 1, classEnd - 1)
  const clockHour = String(Math.floor(nextMinute / 60)).padStart(2, '0')
  const clockMinute = String(nextMinute % 60).padStart(2, '0')
  return `${clockHour}:${clockMinute}`
}

function isMine(question: StoredQuestion, email: string | null) {
  const author = question.authorEmail ?? (question.mine ? DEMO_STUDENT_EMAIL : null)
  return email !== null && email === author
}

function reactingStudents(question: StoredQuestion) {
  return question.reactedBy ?? (question.reacted ? [DEMO_STUDENT_EMAIL] : [])
}

async function reviewQuestion(text: string): Promise<string | null> {
  await new Promise((resolve) => setTimeout(resolve, 280))
  return text.replace(/\s+/g, ' ') === '오늘 수업 언제 끝나요 배고픈데'
    ? '수업과 관련 없는 글로 보여. 수업 내용 질문으로 고쳐서 다시 올려줘.'
    : null
}

async function submitQuestion(text: string, email: string | null): Promise<SubmitResult> {
  if (!isClassInSession(state.ended)) return { status: 'closed' }
  if (!email) return { status: 'invalid', message: '질문을 올리려면 먼저 로그인해줘.' }

  const trimmed = text.trim()
  if (!trimmed) return { status: 'invalid', message: '질문을 입력해줘.' }
  if (questionLength(text) > QUESTION_LIMIT) {
    return { status: 'invalid', message: `질문은 ${QUESTION_LIMIT}자까지 쓸 수 있어.` }
  }

  const rejection = await reviewQuestion(trimmed)
  return transact<SubmitResult>(() => {
    if (!isClassInSession(state.ended)) return { status: 'closed' }
    if (rejection) return { status: 'rejected', message: rejection }

    const questionId =
      globalThis.crypto?.randomUUID?.() ??
      `question-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const question: StoredQuestion = {
      id: questionId,
      text: trimmed,
      time: nextQuestionTime(state.questions),
      reactionCount: 0,
      answered: false,
      authorEmail: email,
      mine: false,
      reacted: false,
    }
    save({ ...state, questions: [...state.questions, question] })
    return { status: 'posted', questionId }
  })
}

function toggleReaction(id: string, email: string | null): Promise<void> {
  return transact(() => {
    if (!isClassInSession(state.ended) || !email) return
    const question = state.questions.find((entry) => entry.id === id)
    if (!question || question.answered || isMine(question, email)) return

    const reactedBy = reactingStudents(question)
    const reacted = reactedBy.includes(email)
    const updated = {
      ...question,
      reactionCount: Math.max(0, question.reactionCount + (reacted ? -1 : 1)),
      reactedBy: reacted ? reactedBy.filter((student) => student !== email) : [...reactedBy, email],
    }
    save({
      ...state,
      questions: state.questions.map((entry) => (entry.id === id ? updated : entry)),
    })
  })
}

function toggleAnswered(id: string): Promise<void> {
  return transact(() => {
    if (!isClassInSession(state.ended)) return
    const question = state.questions.find((entry) => entry.id === id)
    if (!question) return

    const updated = { ...question, answered: !question.answered }
    save({
      ...state,
      questions: state.questions.map((entry) => (entry.id === id ? updated : entry)),
    })
  })
}

function endSession(): Promise<void> {
  return transact(() => {
    if (isClassInSession(state.ended)) save({ ...state, ended: true })
  })
}

const getSnapshot = () => state
const getServerSnapshot = () => initialState
refresh()

export function useClassroom(studentEmail: string | null) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const visibleState = useMemo<ClassroomState>(() => ({
    ended: !isClassInSession(snapshot.ended),
    questions: snapshot.questions.map((question) => ({
      id: question.id,
      text: question.text,
      time: question.time,
      reactionCount: question.reactionCount,
      answered: question.answered,
      mine: isMine(question, studentEmail),
      reacted: studentEmail !== null && reactingStudents(question).includes(studentEmail),
    })),
  }), [snapshot, studentEmail])

  return {
    state: visibleState,
    submitQuestion: (text: string) => submitQuestion(text, studentEmail),
    toggleReaction: (id: string) => toggleReaction(id, studentEmail),
    toggleAnswered,
    endSession,
  }
}

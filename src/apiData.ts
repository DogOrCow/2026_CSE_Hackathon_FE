import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError, getLiveCourse, mapApiLiveSession, mapApiQuestion, readCourseStream,
  setQuestionAnswered, setQuestionVote, submitApiQuestion,
} from './api'
import type { CourseSession } from './courses'
import type { Question, SubmitResult } from './state'

function resourceKey(token: string | null, id: string | undefined) {
  return token && id ? `${token}:${id}` : null
}

type Snapshot<T> = { key: string | null; data: T | null; loading: boolean; error: Error | null }
const requestError = (error: unknown) => error instanceof Error ? error : new Error('서버 요청을 완료하지 못했어요.')

export function useApiResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => setRevision((revision) => revision + 1), [])
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ key: null, data: null, loading: false, error: null })
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    setSnapshot((previous) => ({
      key, data: previous.key === key ? previous.data : null, loading: true, error: null,
    }))
    void loadRef.current(controller.signal).then((data) => {
      if (!controller.signal.aborted) setSnapshot({ key, data, loading: false, error: null })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setSnapshot((previous) => ({
        key, data: previous.key === key ? previous.data : null, loading: false, error: requestError(error),
      }))
    })
    return () => controller.abort()
  }, [key, revision])

  function updateData(update: (data: T | null) => T) {
    if (key) setSnapshot((previous) => previous.key === key
      ? { ...previous, data: update(previous.data) }
      : previous)
  }

  const current = key && snapshot.key === key ? snapshot : { key, data: null, loading: Boolean(key), error: null }
  return { ...current, retry, updateData }
}

type Room = {
  key: string | null
  session: CourseSession | null
  questions: Question[]
  ended: boolean
  loading: boolean
  error: Error | null
  reconnecting: boolean
  actionError: string | null
}

function emptyRoom(key: string | null): Room {
  return { key, session: null, questions: [], ended: false, loading: Boolean(key), error: null, reconnecting: false, actionError: null }
}

function isErrorCode(error: unknown, code: string) {
  return error instanceof ApiError && error.code === code
}

export function useApiRoom(token: string | null, courseId: string | undefined) {
  const key = resourceKey(token, courseId)
  const [room, setRoom] = useState<Room>(() => emptyRoom(null))
  const [revision, setRevision] = useState(0)
  const commands = useRef<{
    key: string
    signal: AbortSignal
    refresh: () => Promise<void>
    close: () => void
    update: (changes: Partial<Room>) => void
  }>(null)

  useEffect(() => {
    if (!token || !courseId || !key) return
    const controller = new AbortController()
    const { signal } = controller
    let terminal = false
    let needsRefresh = false
    let refreshTask: Promise<void> | null = null
    let retryTimer: number | undefined
    let resume: (() => void) | undefined
    setRoom((previous) => previous.key === key
      ? { ...previous, loading: !previous.session, error: null, reconnecting: false, actionError: null }
      : emptyRoom(key))

    function update(changes: Partial<Room>) {
      if (!signal.aborted) setRoom((previous) => ({ ...(previous.key === key ? previous : emptyRoom(key)), ...changes }))
    }

    function close() {
      terminal = true
      update({ ended: true, loading: false, error: null, reconnecting: false, actionError: null })
      controller.abort()
    }

    function stopFor(error: unknown, source: 'snapshot' | 'stream') {
      if (isErrorCode(error, 'NOT_IN_CLASS')) {
        close()
        return true
      }
      if (error instanceof ApiError &&
        (error.status === 401 || error.status === 403 || (error.status === 404 && source === 'snapshot'))) {
        terminal = true
        update({ loading: false, error, reconnecting: false })
        controller.abort()
        return true
      }
      return false
    }

    function refresh() {
      if (terminal || signal.aborted) return Promise.resolve()
      needsRefresh = true
      if (refreshTask) return refreshTask
      refreshTask = (async () => {
        while (needsRefresh && !terminal && !signal.aborted) {
          needsRefresh = false
          try {
            const result = await getLiveCourse(courseId!, token!, signal)
            if (terminal || signal.aborted) return
            const questions = result.questions.map(mapApiQuestion)
            update({ session: mapApiLiveSession(result.session), questions, loading: false, error: null })
          } catch (error) {
            if (terminal || signal.aborted || stopFor(error, 'snapshot')) return
            update({ loading: false, error: requestError(error) })
          }
        }
      })().finally(() => {
        refreshTask = null
        if (needsRefresh && !terminal && !signal.aborted) void refresh()
      })
      return refreshTask
    }

    commands.current = { key, signal, refresh, close, update }

    async function watch() {
      let delay = 800
      await refresh()
      while (!terminal && !signal.aborted) {
        try {
          await readCourseStream(courseId!, token!, signal, (event) => {
            if (event === 'session.ended') close()
            else if (event.startsWith('question.')) void refresh()
          }, () => {
            delay = 800
            update({ reconnecting: false })
            void refresh()
          })
        } catch (error) {
          if (terminal || signal.aborted || stopFor(error, 'stream')) return
        }
        if (terminal || signal.aborted) return
        update({ reconnecting: true })
        await new Promise<void>((resolve) => {
          resume = resolve
          retryTimer = window.setTimeout(resolve, delay)
        })
        resume = undefined
        delay = Math.min(delay * 2, 5000)
        await refresh()
      }
    }

    void watch()
    return () => {
      controller.abort()
      window.clearTimeout(retryTimer)
      resume?.()
      if (commands.current?.signal === signal) commands.current = null
    }
  }, [token, courseId, key, revision])

  const current = key && room.key === key ? room : emptyRoom(key)

  async function submitQuestion(text: string): Promise<SubmitResult> {
    const actions = commands.current
    if (!token || !courseId || actions?.key !== key || actions.signal.aborted || current.ended) return { status: 'closed' }
    try {
      const question = await submitApiQuestion(courseId, text, token, actions.signal)
      await actions.refresh()
      return { status: 'posted', questionId: String(question.id) }
    } catch (error) {
      if (isErrorCode(error, 'NOT_IN_CLASS')) {
        actions.close()
        return { status: 'closed' }
      }
      if (error instanceof ApiError) {
        if (error.code === 'QUESTION_HELD') return { status: 'rejected', message: error.message }
        if (error.code === 'INVALID_LENGTH' || error.code === 'VALIDATION_ERROR') return { status: 'invalid', message: error.message }
        if (error.status === 401) actions.update({ error })
      }
      throw error
    }
  }

  async function changeQuestion(id: string, kind: 'vote' | 'answer') {
    const actions = commands.current
    const question = current.questions.find((item) => item.id === id)
    if (!token || !question || actions?.key !== key || actions.signal.aborted || current.ended) return
    actions.update({ actionError: null })
    try {
      if (kind === 'vote') await setQuestionVote(id, !question.reacted, token, actions.signal)
      else await setQuestionAnswered(id, !question.answered, token, actions.signal)
      await actions.refresh()
    } catch (error) {
      if (actions.signal.aborted) return
      if (isErrorCode(error, 'NOT_IN_CLASS')) actions.close()
      else if (error instanceof ApiError && error.status === 401) actions.update({ error })
      else {
        actions.update({ actionError: error instanceof ApiError ? error.message : '변경 내용을 저장하지 못했어요. 다시 시도해 주세요.' })
        await actions.refresh()
      }
    }
  }

  return {
    ...current,
    retry: () => setRevision((revision) => revision + 1),
    submitQuestion,
    toggleReaction: (id: string) => changeQuestion(id, 'vote'),
    toggleAnswered: (id: string) => changeQuestion(id, 'answer'),
  }
}

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { AuthScreen } from './AuthScreen'
import {
  API_ENABLED, ApiError, createProfessorCourse, enrollCourse, getArchivedQuestions, getArchivedSessions, getCourses, getLiveCourse,
  mapApiArchiveSession, mapApiCourse, mapApiQuestion,
} from './api'
import { useApiAuth } from './apiAuth'
import { useApiResource, useApiRoom } from './apiData'
import { useProfessorAuth, useStudentAuth } from './auth'
import { CourseArchive } from './CourseArchive'
import { CourseDialog } from './CourseDialog'
import { CourseIndex } from './CourseIndex'
import { useEnrollments, useMockCatalog } from './courses'
import type { Course, CourseDraft, CourseSession } from './courses'
import { Icon } from './Icon'
import { InstructorLive } from './InstructorLive'
import { SessionHistory } from './SessionHistory'
import { ClosedSessionBar, QuestionComposer, StudentFeed } from './StudentLive'
import { SESSION, useClassroom } from './state'

type Role = 'student' | 'professor'
type View = 'home' | 'login' | 'signup' | 'courses' | 'live' | 'history'

interface Route {
  role: Role
  view: View
  courseId?: string
  sessionId?: string
}

const roles = [
  { id: 'student', label: '학생 화면' },
  { id: 'professor', label: '교수 화면' },
] as const

function homeRoute(role: Role): Route {
  return { role, view: role === 'professor' ? 'home' : 'courses' }
}

function readRoute(): Route {
  const query = new URLSearchParams(window.location.search)
  const role = query.get('role') === 'professor' ? 'professor' : 'student'
  const view = query.get('view')
  if (view === 'login' || view === 'courses' || (view === 'signup' && role === 'student')) {
    return { role, view }
  }
  const courseId = query.get('course')
  if (courseId && (view === 'live' || view === 'history')) {
    return { role, view, courseId, sessionId: query.get('session') ?? undefined }
  }
  return homeRoute(role)
}

function routeHref({ role, view, courseId, sessionId }: Route) {
  const query = new URLSearchParams()
  if (role === 'professor') query.set('role', role)
  if (view !== homeRoute(role).view) query.set('view', view)
  if (courseId) query.set('course', courseId)
  if (sessionId) query.set('session', sessionId)
  return query.size > 0 ? `?${query}` : window.location.pathname
}

function courseRoute(role: Role, course: Course, view: 'live' | 'history', session?: CourseSession): Route {
  return { role, view, courseId: course.id, sessionId: session?.id }
}

function CourseBanner({ course, session, status }: {
  course: Course
  session?: CourseSession
  status?: 'live' | 'ended'
}) {
  return (
    <header className="course-banner">
      <div className="course-heading">
        <span className="course-icon"><Icon name={course.id.startsWith('database') ? 'database' : 'book'} size={25} /></span>
        <div>
          <h1>{course.name}</h1>
          <p className="course-meta">
            {session && <><span>{session.week}</span><span className="course-dot" aria-hidden="true">·</span></>}
            <span>{course.instructor}</span><span className="course-dot" aria-hidden="true">·</span>
            <span>{session?.date ?? course.schedule}</span>
          </p>
        </div>
      </div>
      {status && (
        <span className={`session-status${status === 'ended' ? ' session-status--ended' : ''}`} role="status">
          {status === 'ended' ? <Icon name="check" size={13} /> : <span className="live-dot" aria-hidden="true" />}
          {status === 'ended' ? '수업 종료' : '수업 중'}
        </span>
      )}
    </header>
  )
}

function AccountMenu({ displayName, onSignOut }: { displayName: string; onSignOut: () => void }) {
  const details = useRef<HTMLDetailsElement>(null)

  function closeOnEscape(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== 'Escape' || !details.current?.open) return
    details.current.open = false
    details.current.querySelector('summary')?.focus()
  }

  return (
    <details className="account-menu" ref={details} onKeyDown={closeOnEscape}>
      <summary className="account-trigger" aria-label={`${displayName} 계정 메뉴`}>
        <Icon name="student" size={17} />
        <span>{displayName}</span>
      </summary>
      <div className="account-panel">
        <button type="button" onClick={onSignOut}>로그아웃</button>
      </div>
    </details>
  )
}

function ApiStatus({ message, onRetry, error = false }: {
  message: string
  onRetry?: () => void
  error?: boolean
}) {
  return (
    <div className="api-status">
      <p role={error ? 'alert' : 'status'}>{message}</p>
      {onRetry && <button className="history-link" type="button" onClick={onRetry}>다시 시도</button>}
    </div>
  )
}

function useComposerViewport(shell: { current: HTMLDivElement | null }, enabled: boolean) {
  useEffect(() => {
    const viewport = window.visualViewport
    const appShell = shell.current
    if (!viewport || !appShell || !enabled) return
    let frame = 0

    const updateHeight = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (viewport.scale === 1 && document.activeElement?.id === 'question-input') {
          appShell.style.setProperty('--app-height', `${viewport.height}px`)
        } else {
          appShell.style.removeProperty('--app-height')
        }
      })
    }

    viewport.addEventListener('resize', updateHeight)
    document.addEventListener('focusin', updateHeight)
    document.addEventListener('focusout', updateHeight)
    return () => {
      window.cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', updateHeight)
      document.removeEventListener('focusin', updateHeight)
      document.removeEventListener('focusout', updateHeight)
      appShell.style.removeProperty('--app-height')
    }
  }, [shell, enabled])
}

export function App() {
  const [route, setRoute] = useState<Route>(readRoute)
  const [newestQuestion, setNewestQuestion] = useState<string | null>(null)
  const [courseDialogOpen, setCourseDialogOpen] = useState(false)
  const [addedCourseId, setAddedCourseId] = useState<string>()
  const shell = useRef<HTMLDivElement>(null)
  const scrollArea = useRef<HTMLElement>(null)
  const mockStudent = useStudentAuth()
  const mockProfessor = useProfessorAuth()
  const apiStudent = useApiAuth('student')
  const apiProfessor = useApiAuth('professor')
  const isStudent = route.role === 'student'
  const apiAuth = isStudent ? apiStudent : apiProfessor
  const auth = API_ENABLED ? apiAuth : isStudent ? mockStudent : mockProfessor
  const token = API_ENABLED ? apiAuth.token : null
  const studentEmail = API_ENABLED ? null : mockStudent.student?.email ?? null
  const mockCatalog = useMockCatalog()
  const { courseIds, enroll } = useEnrollments(studentEmail)
  const mockClassroom = useClassroom(isStudent ? studentEmail : null)
  const remoteCourses = useApiResource<Course[]>(token, async (signal) => (await getCourses(token!, signal)).map((course) => mapApiCourse(course)))
  const courses = API_ENABLED ? remoteCourses.data ?? [] : mockCatalog.courses.filter((course) => (
    isStudent ? courseIds.includes(course.id) : course.instructor === SESSION.instructor
  ))
  const scheduledCourse = courses.find((course) => API_ENABLED
    ? course.isLive
    : course.id === SESSION.courseId && !mockClassroom.state.ended
  )
  const liveCourseId = scheduledCourse?.id ?? null
  const professorInClass = !isStudent && (route.view === 'home' || route.view === 'login') && Boolean(liveCourseId)
  const activeCourse = professorInClass ? scheduledCourse : courses.find((course) => course.id === route.courseId)
  const authView = auth.student ? null : isStudent && route.view === 'signup' ? 'signup' : 'login'
  const wantsLive = !authView && (route.view === 'live' || professorInClass)
  const apiRoom = useApiRoom(token, wantsLive ? activeCourse?.id : undefined)
  const liveSession = API_ENABLED ? apiRoom.session ?? undefined : activeCourse?.sessions.find((session) => session.live)
  const classroom = API_ENABLED ? apiRoom : mockClassroom
  const state = API_ENABLED ? apiRoom : mockClassroom.state
  const isLive = Boolean(activeCourse && wantsLive && (API_ENABLED || liveSession) &&
    (!route.sessionId || !liveSession || route.sessionId === liveSession.id))
  const isHistory = Boolean(!authView && activeCourse && !isLive && (route.view === 'history' || wantsLive))
  const liveQuestions = isLive ? state.questions.slice().reverse() : []
  const visibleView = authView ?? (isLive ? 'live' : isHistory ? 'history' : 'courses')
  const viewKey = `${route.role}:${visibleView}:${activeCourse?.id ?? ''}:${auth.student?.email ?? ''}`

  const archiveCourseId = isHistory ? activeCourse?.id : undefined
  const archiveIsLive = activeCourse?.isLive === true
  const remoteSessions = useApiResource(token && archiveCourseId ? `${token}:${archiveCourseId}:${archiveIsLive}` : null, async (signal) => {
    const sessions = await getArchivedSessions(archiveCourseId!, token!, signal)
    let openSession: number | undefined
    if (archiveIsLive && sessions.length > 0) {
      try {
        openSession = (await getLiveCourse(archiveCourseId!, token!, signal)).session.id
      } catch (error) {
        signal.throwIfAborted()
        if (!(error instanceof ApiError) || error.code !== 'NOT_IN_CLASS') throw error
      }
    }
    return sessions.filter((session) => session.id !== openSession).map((session) => mapApiArchiveSession(session))
  })
  const historySessions = API_ENABLED ? remoteSessions.data ?? [] : isHistory && activeCourse
    ? activeCourse.sessions.filter((session) => !session.live || state.ended).map((session) => (
      session.live ? { ...session, questions: state.questions } : session
    ))
    : []
  const selectedSession = historySessions.find((session) => session.id === route.sessionId) ?? historySessions[0] ?? null
  const remoteHistory = useApiResource(token && selectedSession ? `${token}:${selectedSession.id}` : null, async (signal) => (
    (await getArchivedQuestions(selectedSession!.id, token!, signal)).map(mapApiQuestion)
  ))
  const archiveRoute = activeCourse ? {
    ...courseRoute(route.role, activeCourse, 'history', state.ended ? liveSession : undefined),
    sessionId: state.ended ? liveSession?.id ?? route.sessionId : undefined,
  } : null
  const coursesRoute: Route = { role: route.role, view: 'courses' }
  const roomReady = !API_ENABLED || Boolean(apiRoom.session) || apiRoom.ended

  useComposerViewport(shell, isStudent && isLive && roomReady && !state.ended)

  useEffect(() => {
    const update = () => setRoute(readRoute())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  useEffect(() => {
    if (!auth.student || !professorInClass || !activeCourse || (!API_ENABLED && !liveSession)) return
    const currentClass = courseRoute('professor', activeCourse, 'live', liveSession)
    window.history.replaceState(null, '', routeHref(currentClass))
    setRoute(currentClass)
  }, [auth.student, professorInClass, activeCourse, liveSession])

  useEffect(() => {
    if (!API_ENABLED || !isLive || !liveSession || route.sessionId || !activeCourse) return
    const currentClass = courseRoute(route.role, activeCourse, 'live', liveSession)
    window.history.replaceState(null, '', routeHref(currentClass))
    setRoute(currentClass)
  }, [activeCourse, isLive, liveSession, route.role, route.sessionId])

  const retryCourses = remoteCourses.retry
  useEffect(() => {
    if (!token) return
    const timer = window.setInterval(retryCourses, 30000)
    window.addEventListener('focus', retryCourses)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', retryCourses)
    }
  }, [token, retryCourses])

  useEffect(() => {
    if (token && apiRoom.ended) retryCourses()
  }, [token, apiRoom.ended, retryCourses])

  const unauthorized = [remoteCourses.error, apiRoom.error, remoteSessions.error, remoteHistory.error]
    .some((error) => error instanceof ApiError && error.status === 401)
  useEffect(() => {
    if (token && unauthorized) auth.signOut()
  }, [token, unauthorized, auth])

  useEffect(() => {
    if (scrollArea.current) scrollArea.current.scrollTop = 0
    setNewestQuestion(null)
    setCourseDialogOpen(false)
    setAddedCourseId(undefined)
  }, [viewKey])

  useEffect(() => {
    document.title = `익명실명 — ${activeCourse?.name ?? (authView === 'signup' ? '가입' : authView ? '로그인' : isStudent ? '내 과목' : '내 강의')}`
  }, [activeCourse, authView, isStudent])

  function navigate(next: Route, replace = false) {
    const href = routeHref(next)
    if (href === routeHref(route)) return
    if (replace) window.history.replaceState(null, '', href)
    else window.history.pushState(null, '', href)
    setRoute(next)
    if (next.view !== route.view || next.courseId !== route.courseId) {
      window.requestAnimationFrame(() => scrollArea.current?.focus({ preventScroll: true }))
    }
  }

  function follow(next: Route) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigate(next)
    }
  }

  function openCourse(course: Course) {
    const current = course.sessions.find((session) => session.live)
    if (API_ENABLED ? course.isLive : current && !state.ended) navigate(courseRoute(route.role, course, 'live', current))
    else navigate(courseRoute(route.role, course, 'history', course.sessions[0]))
  }

  function rememberAddedCourse(course: Course) {
    if (API_ENABLED) {
      remoteCourses.updateData((current) => [...(current ?? []).filter((entry) => entry.id !== course.id), course])
      retryCourses()
    }
    setAddedCourseId(course.id)
  }

  async function joinCourse(code: string) {
    if (API_ENABLED) {
      if (!token) return '다시 로그인한 뒤 과목 코드를 입력해 주세요.'
      try {
        const course = mapApiCourse(await enrollCourse(code, token))
        rememberAddedCourse(course)
        return null
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          auth.signOut()
          return null
        }
        if (error instanceof ApiError && error.code === 'ALREADY_ENROLLED') retryCourses()
        return error instanceof ApiError ? error.message : '과목에 입장하지 못했어요. 다시 시도해 주세요.'
      }
    }
    const course = mockCatalog.findByCode(code)
    if (!course) return '없는 코드예요. 교수님이 알려준 코드를 다시 확인해주세요.'
    if (courseIds.includes(course.id)) return '이미 추가한 과목이에요. 과목 목록에서 확인해 주세요.'
    enroll(course.id)
    rememberAddedCourse(course)
    return null
  }

  async function addCourse(draft: CourseDraft) {
    if (isStudent || !auth.student) return '교수 계정으로 로그인한 뒤 강의를 추가해 주세요.'
    if (!API_ENABLED) {
      const result = await mockCatalog.createCourse(draft, auth.student.displayName)
      if ('error' in result) return result.error
      rememberAddedCourse(result.course)
      return null
    }

    if (!token) return '다시 로그인한 뒤 강의를 추가해 주세요.'
    try {
      rememberAddedCourse(mapApiCourse(await createProfessorCourse(draft, token)))
      return null
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          auth.signOut()
          return null
        }
        if (error.status === 404 || error.status === 405) return '연결된 서버가 강의 추가를 지원하지 않아요.'
        return error.message
      }
      return '강의를 추가하지 못했어요. 잠시 후 다시 시도해 주세요.'
    }
  }

  function finishAuth() {
    if (routeHref(readRoute()) !== routeHref(route)) return
    if (route.view === 'login' || route.view === 'signup') {
      navigate(homeRoute(route.role), true)
    }
  }

  function signOut() {
    auth.signOut()
    navigate({ role: route.role, view: 'login' }, true)
  }

  const indexCourses = API_ENABLED ? courses : courses.map((course) => course.id === liveCourseId ? ({
    ...course,
    sessions: course.sessions.map((session) => session.live ? { ...session, questions: state.questions } : session),
  }) : course)

  return (
    <div className="app-shell" ref={shell}>
      <header className="site-header">
        <div className="site-header-inner">
          <a className="brand" href={routeHref(coursesRoute)} onClick={follow(coursesRoute)}>
            <span className="brand-mark"><Icon name="brand" size={23} /></span>
            익명실명
          </a>
          <div className="site-header-controls">
            <nav className="role-nav" aria-label="수업 화면 선택">
              {roles.map(({ id, label }) => (
                <a
                  key={id}
                  className="role-link"
                  href={routeHref(homeRoute(id))}
                  onClick={follow(homeRoute(id))}
                  aria-current={route.role === id ? 'page' : undefined}
                >
                  <Icon name={id} size={16} />{label}
                </a>
              ))}
            </nav>
            {auth.student && <AccountMenu key={viewKey} displayName={auth.student.displayName} onSignOut={signOut} />}
          </div>
        </div>
      </header>

      <main ref={scrollArea} className="page-scroll" tabIndex={-1}>
        {API_ENABLED && (apiAuth.loading || apiAuth.error) ? (
          <div className="page-content">
            <ApiStatus message={apiAuth.error ?? '로그인 상태를 확인하고 있어요.'} error={Boolean(apiAuth.error)}
              onRetry={apiAuth.error ? apiAuth.retry : undefined} />
          </div>
        ) : authView ? (
          <AuthScreen
            key={viewKey}
            role={route.role}
            view={authView}
            open={(view) => navigate({ role: route.role, view })}
            requestEmailCode={API_ENABLED ? apiStudent.requestEmailCode : undefined}
            signIn={async (...args) => {
              const result = await auth.signIn(...args)
              if (result.student) finishAuth()
              return result
            }}
            signUp={isStudent ? async (email, password, verification) => {
              const result = API_ENABLED
                ? await apiStudent.signUp(email, password, verification)
                : await mockStudent.signUp(email, password)
              if (result.student) finishAuth()
              return result
            } : undefined}
          />
        ) : (
          <div className="page-content" key={viewKey}>
            {activeCourse && (isHistory || isLive) ? (
              <>
                <div className="course-navigation">
                  <a className="page-back" href={routeHref(coursesRoute)} onClick={follow(coursesRoute)}>
                    <Icon name="chevron-left" size={17} />{isStudent ? '내 과목' : '내 강의'}
                  </a>
                  {isLive && archiveRoute && (
                    <a className="page-back course-navigation-history" href={routeHref(archiveRoute)} onClick={follow(archiveRoute)}>
                      <Icon name="archive" size={16} />지난 질문
                    </a>
                  )}
                </div>
                <CourseBanner
                  course={activeCourse}
                  session={isLive ? liveSession : undefined}
                  status={isLive && roomReady ? state.ended ? 'ended' : 'live' : undefined}
                />
                {isHistory ? (
                  <>
                    {API_ENABLED && remoteSessions.error && <ApiStatus message={remoteSessions.error.message} error onRetry={remoteSessions.retry} />}
                    {API_ENABLED && remoteSessions.loading && !remoteSessions.data ? (
                      <ApiStatus message="차시 목록을 불러오고 있어요." />
                    ) : (!API_ENABLED || remoteSessions.data) && (
                      <CourseArchive
                        course={activeCourse}
                        sessions={historySessions.slice().reverse()}
                        selected={selectedSession}
                        liveAvailable={API_ENABLED ? Boolean(activeCourse.isLive) : activeCourse.id === liveCourseId}
                        onSelect={(session) => navigate(courseRoute(route.role, activeCourse, 'history', session))}
                        onOpenLive={() => navigate(courseRoute(route.role, activeCourse, 'live', liveSession))}
                      />
                    )}
                    {selectedSession && (API_ENABLED ? (
                      remoteHistory.error ? <ApiStatus message={remoteHistory.error.message} error onRetry={remoteHistory.retry} />
                        : remoteHistory.loading ? <ApiStatus message="질문 기록을 불러오고 있어요." />
                        : remoteHistory.data && <SessionHistory key={selectedSession.id} session={{ ...selectedSession, questions: remoteHistory.data }} showAnswered={false} />
                    ) : <SessionHistory key={selectedSession.id} session={selectedSession} />)}
                  </>
                ) : (
                  <>
                    {API_ENABLED && apiRoom.error && <ApiStatus message={apiRoom.error.message} error onRetry={apiRoom.retry} />}
                    {API_ENABLED && apiRoom.actionError && <ApiStatus message={apiRoom.actionError} error />}
                    {API_ENABLED && apiRoom.reconnecting && !apiRoom.error && <ApiStatus message="실시간 연결을 다시 시도하고 있어요." />}
                    {API_ENABLED && apiRoom.loading && !roomReady && <ApiStatus message="질문창을 불러오고 있어요." />}
                    {roomReady && (isStudent ? (
                      <StudentFeed questions={liveQuestions} ended={state.ended} newestQuestion={newestQuestion} onReact={classroom.toggleReaction} />
                    ) : (
                      <InstructorLive
                        questions={liveQuestions}
                        ended={state.ended}
                        onToggleAnswered={classroom.toggleAnswered}
                        onEnd={API_ENABLED ? undefined : () => void mockClassroom.endSession()}
                        onHistory={() => archiveRoute && navigate(archiveRoute)}
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              <>
                {API_ENABLED && remoteCourses.error && <ApiStatus message={remoteCourses.error.message} error onRetry={retryCourses} />}
                {API_ENABLED && remoteCourses.loading && !remoteCourses.data ? (
                  <ApiStatus message={isStudent ? '과목을 불러오고 있어요.' : '강의를 불러오고 있어요.'} />
                ) : (!API_ENABLED || remoteCourses.data) && (
                  <CourseIndex
                    role={route.role}
                    courses={indexCourses}
                    liveCourseId={liveCourseId}
                    addedCourseId={courseDialogOpen ? undefined : addedCourseId}
                    onAdd={() => {
                      setAddedCourseId(undefined)
                      setCourseDialogOpen(true)
                    }}
                    onOpen={openCourse}
                  />
                )}
              </>
            )}
          </div>
        )}
      </main>

      {isStudent && isLive && roomReady && (
        state.ended && archiveRoute ? (
          <ClosedSessionBar href={routeHref(archiveRoute)} onHistory={follow(archiveRoute)} />
        ) : (
          <QuestionComposer key={viewKey} onSubmit={classroom.submitQuestion} onPosted={setNewestQuestion} />
        )
      )}
      <CourseDialog
        key={route.role}
        role={route.role}
        open={courseDialogOpen && visibleView === 'courses' && Boolean(auth.student)}
        onClose={() => setCourseDialogOpen(false)}
        onJoin={isStudent ? joinCourse : undefined}
        onCreate={isStudent ? undefined : addCourse}
      />
      <div className="sr-only" role="status">
        {newestQuestion ? `질문을 등록했어요. 수업 질문 ${state.questions.length}개.` : ''}
      </div>
    </div>
  )
}

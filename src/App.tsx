import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { AuthScreen } from './AuthScreen'
import { useProfessorAuth, useStudentAuth } from './auth'
import { CourseArchive } from './CourseArchive'
import { CourseIndex } from './CourseIndex'
import { COURSES, findCourseByCode, useEnrollments } from './courses'
import type { Course, CourseSession } from './courses'
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
  const shell = useRef<HTMLDivElement>(null)
  const scrollArea = useRef<HTMLElement>(null)
  const studentAuth = useStudentAuth()
  const professorAuth = useProfessorAuth()
  const isStudent = route.role === 'student'
  const auth = isStudent ? studentAuth : professorAuth
  const studentEmail = studentAuth.student?.email ?? null
  const { courseIds, enroll } = useEnrollments(studentEmail)
  const { state, submitQuestion, toggleReaction, toggleAnswered, endSession } = useClassroom(isStudent ? studentEmail : null)
  const courses = COURSES.filter((course) => isStudent ? courseIds.includes(course.id) : course.instructor === SESSION.instructor)
  const scheduledCourse = courses.find((course) => course.id === SESSION.courseId)
  const liveCourseId = !state.ended && scheduledCourse ? scheduledCourse.id : null
  const professorInClass = !isStudent && (route.view === 'home' || route.view === 'login') && Boolean(liveCourseId)
  const activeCourse = professorInClass ? scheduledCourse : courses.find((course) => course.id === route.courseId)
  const liveSession = activeCourse?.sessions.find((session) => session.live)
  const hasClassPage = Boolean(activeCourse && (route.view === 'live' || route.view === 'history' || professorInClass))
  const authView = auth.student ? null : isStudent && route.view === 'signup' ? 'signup' : 'login'
  const requestsLive = route.view === 'live' && (!route.sessionId || route.sessionId === liveSession?.id)
  const isLive = !authView && hasClassPage && Boolean(liveSession && (requestsLive || professorInClass))
  const isHistory = !authView && hasClassPage && !isLive
  const liveQuestions = isLive ? state.questions.slice().reverse() : []
  const visibleView = authView ?? (isLive ? 'live' : isHistory ? 'history' : 'courses')
  const viewKey = `${route.role}:${visibleView}:${activeCourse?.id ?? ''}:${auth.student?.email ?? ''}`

  const historySessions = isHistory && activeCourse
    ? activeCourse.sessions.filter((session) => !session.live || state.ended).map((session) => (
      session.live ? { ...session, questions: state.questions } : session
    ))
    : []
  const selectedSession = historySessions.find((session) => session.id === route.sessionId) ?? historySessions[0] ?? null
  const archiveRoute = activeCourse ? courseRoute(route.role, activeCourse, 'history', state.ended ? liveSession : undefined) : null
  const coursesRoute: Route = { role: route.role, view: 'courses' }

  useComposerViewport(shell, isStudent && isLive && !state.ended)

  useEffect(() => {
    const update = () => setRoute(readRoute())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  useEffect(() => {
    if (!auth.student || !professorInClass || !activeCourse || !liveSession) return
    const currentClass = courseRoute('professor', activeCourse, 'live', liveSession)
    window.history.replaceState(null, '', routeHref(currentClass))
    setRoute(currentClass)
  }, [auth.student, professorInClass, activeCourse, liveSession])

  useEffect(() => {
    if (scrollArea.current) scrollArea.current.scrollTop = 0
    setNewestQuestion(null)
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
    if (current && !state.ended) navigate(courseRoute(route.role, course, 'live', current))
    else navigate(courseRoute(route.role, course, 'history', course.sessions[0]))
  }

  function joinCourse(code: string) {
    const course = findCourseByCode(code)
    if (!course) return '없는 코드예요. 교수님이 알려준 코드를 다시 확인해주세요.'
    enroll(course.id)
    openCourse(course)
    return null
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

  const indexCourses = courses.map((course) => course.id === liveCourseId ? ({
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
        {authView ? (
          <AuthScreen
            key={viewKey}
            role={route.role}
            view={authView}
            open={(view) => navigate({ role: route.role, view })}
            signIn={async (...args) => {
              const result = await auth.signIn(...args)
              if (result.student) finishAuth()
              return result
            }}
            signUp={isStudent ? async (...args) => {
              const result = await studentAuth.signUp(...args)
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
                  status={isLive ? state.ended ? 'ended' : 'live' : undefined}
                />
                {isHistory ? (
                  <>
                    <CourseArchive
                      course={activeCourse}
                      sessions={[...historySessions].reverse()}
                      selected={selectedSession}
                      liveAvailable={activeCourse.id === liveCourseId}
                      onSelect={(session) => navigate(courseRoute(route.role, activeCourse, 'history', session))}
                      onOpenLive={() => navigate(courseRoute(route.role, activeCourse, 'live', liveSession))}
                    />
                    {selectedSession && <SessionHistory key={selectedSession.id} session={selectedSession} />}
                  </>
                ) : isStudent ? (
                  <StudentFeed questions={liveQuestions} ended={state.ended} newestQuestion={newestQuestion} onReact={toggleReaction} />
                ) : (
                  <InstructorLive
                    questions={liveQuestions}
                    ended={state.ended}
                    onToggleAnswered={toggleAnswered}
                    onEnd={() => void endSession()}
                    onHistory={() => archiveRoute && navigate(archiveRoute)}
                  />
                )}
              </>
            ) : (
              <CourseIndex role={route.role} courses={indexCourses} liveCourseId={liveCourseId} onOpen={openCourse} onJoin={isStudent ? joinCourse : undefined} />
            )}
          </div>
        )}
      </main>

      {isStudent && isLive && (
        state.ended && archiveRoute ? (
          <ClosedSessionBar href={routeHref(archiveRoute)} onHistory={follow(archiveRoute)} />
        ) : (
          <QuestionComposer key={viewKey} onSubmit={submitQuestion} onPosted={setNewestQuestion} />
        )
      )}
      <div className="sr-only" role="status">
        {newestQuestion ? `질문을 등록했어요. 수업 질문 ${state.questions.length}개.` : ''}
      </div>
    </div>
  )
}

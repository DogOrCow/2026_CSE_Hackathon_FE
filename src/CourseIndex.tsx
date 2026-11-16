import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Course } from './courses'
import { Icon } from './Icon'
import './courses.css'

type CourseIndexProps = {
  role: 'student' | 'professor'
  courses: Course[]
  liveCourseId: string | null
  onJoin?: (code: string) => string | null | Promise<string | null>
  onOpen: (course: Course) => void
}

function CourseCodeForm({ onJoin }: { onJoin: NonNullable<CourseIndexProps['onJoin']> }) {
  const fieldId = useId()
  const feedbackId = useId()
  const input = useRef<HTMLInputElement>(null)
  const pending = useRef(false)
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<{ message: string; attempt: number } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    const normalizedCode = code.trim().toUpperCase()
    let message: string | null = !normalizedCode
      ? '과목 코드를 입력해 주세요.'
      : /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(normalizedCode)
        ? null
        : '과목 코드는 영문, 숫자, 하이픈으로 입력해 주세요.'

    if (!message) {
      pending.current = true
      setJoining(true)
      setError(null)
      try {
        message = await onJoin(normalizedCode)
      } catch {
        message = '지금은 과목에 입장할 수 없어요. 다시 시도해 주세요.'
      } finally {
        pending.current = false
        setJoining(false)
      }
    }

    if (message) {
      setError((previous) => ({ message, attempt: (previous?.attempt ?? 0) + 1 }))
      input.current?.focus()
    } else {
      setCode('')
      setError(null)
    }
  }

  return (
    <form className="course-code-form" onSubmit={(event) => void handleSubmit(event)}>
      <label htmlFor={fieldId}>과목 코드로 들어가기</label>
      <div className="course-code-controls">
        <input
          id={fieldId}
          ref={input}
          type="text"
          value={code}
          placeholder="예: COMP0322"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          readOnly={joining}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? feedbackId : undefined}
          onChange={(event) => {
            setCode(event.target.value)
            setError(null)
          }}
        />
        <button type="submit" className="course-code-submit" disabled={joining}>{joining ? '입장 중' : '입장'}</button>
      </div>
      <div id={feedbackId} aria-live="polite" aria-atomic="true">
        {error && (
          <p className="course-code-error" key={error.attempt}>
            <Icon name="alert" size={15} />
            {error.message}
          </p>
        )}
      </div>
    </form>
  )
}

export function CourseIndex({ role, courses, liveCourseId, onJoin, onOpen }: CourseIndexProps) {
  const liveTitle = useId()
  const pastTitle = useId()
  const isStudent = role === 'student'
  const liveCourses = courses.filter((course) => course.isLive ?? course.id === liveCourseId)
  const otherCourses = courses.filter((course) => !(course.isLive ?? course.id === liveCourseId))

  return (
    <div className="course-index">
      <h1>내 {isStudent ? '과목' : '강의'}</h1>
      {isStudent && onJoin && <CourseCodeForm onJoin={onJoin} />}

      {liveCourses.length > 0 && (
        <section className="course-index-section" aria-labelledby={liveTitle}>
          <h2 id={liveTitle}>지금 수업 중</h2>
          <div className="course-live-list">
            {liveCourses.map((liveCourse) => {
              const questionCount = liveCourse.liveQuestionCount ?? liveCourse.sessions.find((session) => session.live)?.questions.length
              return (
                <button key={liveCourse.id} type="button" className="course-live-card" onClick={() => onOpen(liveCourse)}>
                  <span className="course-index-card-info">
                    <span className="course-index-card-heading">
                      <span className="course-index-card-name">{liveCourse.name}</span>
                      <span className="course-index-live-status"><i aria-hidden="true" />수업 중</span>
                    </span>
                    <span className="course-index-meta">
                      {isStudent ? liveCourse.instructor : `코드 ${liveCourse.code}`}
                      {liveCourse.schedule && ` · ${liveCourse.schedule}`}
                      {questionCount !== undefined && ` · 질문 ${questionCount}개`}
                    </span>
                  </span>
                  <span className="course-index-live-cta">
                    {isStudent ? '질문창 들어가기' : '질문 보기'}
                    <Icon name="chevron-right" size={15} />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {otherCourses.length > 0 && (
        <section className="course-index-section" aria-labelledby={pastTitle}>
          <h2 id={pastTitle}>{isStudent ? '들어갔던 과목' : '2026년 2학기'}</h2>
          <ul className="course-index-list" role="list">
            {otherCourses.map((course) => (
              <li key={course.id}>
                <button type="button" className="course-index-row" onClick={() => onOpen(course)}>
                  <span className="course-index-card-info">
                    <span className="course-index-card-name">{course.name}</span>
                    <span className="course-index-meta">
                      {isStudent ? course.instructor : `코드 ${course.code}`}
                      {course.schedule && ` · ${course.schedule}`}
                    </span>
                  </span>
                  <span className="course-index-row-end">
                    {course.nextClass && <span className="course-index-meta">{course.nextClass}</span>}
                    <Icon name="chevron-right" size={17} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {courses.length === 0 && (
        <section className="course-index-empty">
          <span className="course-index-empty-icon"><Icon name="archive" size={23} /></span>
          <h2>{isStudent ? '아직 들어간 과목이 없어요' : '아직 등록된 강의가 없어요'}</h2>
          {isStudent && <p>교수님이 알려준 과목 코드를 입력해 주세요.</p>}
        </section>
      )}
    </div>
  )
}

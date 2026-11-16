import { useEffect, useId, useRef } from 'react'
import type { Course } from './courses'
import { Icon } from './Icon'
import './courses.css'

type CourseIndexProps = {
  role: 'student' | 'professor'
  courses: Course[]
  liveCourseId: string | null
  addedCourseId?: string
  onAdd: () => void
  onOpen: (course: Course) => void
}

function displaySemester(semester?: string) {
  const parts = semester?.match(/^(\d{4})-([12])$/)
  return parts ? `${parts[1]}년 ${parts[2]}학기` : semester ?? '2026년 2학기'
}

export function CourseIndex({ role, courses, liveCourseId, addedCourseId, onAdd, onOpen }: CourseIndexProps) {
  const liveTitle = useId()
  const pastTitle = useId()
  const addedButton = useRef<HTMLButtonElement>(null)
  const isStudent = role === 'student'
  const liveCourses = courses.filter((course) => course.isLive ?? course.id === liveCourseId)
  const courseGroups = new Map<string, Course[]>()
  for (const course of courses) {
    if (course.isLive ?? course.id === liveCourseId) continue
    const heading = isStudent ? '등록한 과목' : displaySemester(course.semester)
    const group = courseGroups.get(heading) ?? []
    group.push(course)
    courseGroups.set(heading, group)
  }

  useEffect(() => {
    if (!addedCourseId) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frame = window.requestAnimationFrame(() => {
      addedButton.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'instant' : 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [addedCourseId])

  return (
    <div className="course-index">
      <header className="course-index-toolbar">
        <h1>내 {isStudent ? '과목' : '강의'}</h1>
        <button type="button" className="course-add-trigger" aria-haspopup="dialog" onClick={onAdd}>
          <span className="course-add-icon"><Icon name="plus" size={16} /></span>
          {isStudent ? '과목 추가' : '강의 추가'}
        </button>
      </header>

      {liveCourses.length > 0 && (
        <section className="course-index-section" aria-labelledby={liveTitle}>
          <h2 id={liveTitle}>지금 수업 중</h2>
          <div className="course-live-list">
            {liveCourses.map((course, index) => {
              const questionCount = course.liveQuestionCount ?? course.sessions.find((session) => session.live)?.questions.length
              const isAdded = course.id === addedCourseId
              return (
                <div className="course-list-enter" key={course.id} style={{ animationDelay: `${Math.min(index, 5) * 52}ms` }}>
                  <button
                    type="button"
                    className={`course-live-card${isAdded ? ' course-card-added' : ''}`}
                    ref={isAdded ? addedButton : undefined}
                    onClick={() => onOpen(course)}
                  >
                    <span className="course-index-card-info">
                      <span className="course-index-card-heading">
                        <span className="course-index-card-name">{course.name}</span>
                        <span className="course-index-live-status"><i aria-hidden="true" />수업 중</span>
                      </span>
                      <span className="course-index-meta">
                        {isStudent ? course.instructor : `코드 ${course.code}`}
                        {course.schedule && ` · ${course.schedule}`}
                        {questionCount !== undefined && ` · 질문 ${questionCount}개`}
                      </span>
                    </span>
                    <span className="course-index-live-cta">
                      {isStudent ? '질문창 들어가기' : '질문 보기'}
                      <Icon name="chevron-right" size={15} />
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {[...courseGroups].map(([heading, group], groupIndex) => (
        <section className="course-index-section" aria-labelledby={`${pastTitle}-${groupIndex}`} key={heading}>
          <h2 id={`${pastTitle}-${groupIndex}`}>{heading}</h2>
          <ul className="course-index-list" role="list">
            {group.map((course, index) => {
              const isAdded = course.id === addedCourseId
              return (
                <li className="course-list-enter" key={course.id} style={{ animationDelay: `${Math.min(index, 5) * 52 + 48}ms` }}>
                  <button
                    type="button"
                    className={`course-index-row${isAdded ? ' course-card-added' : ''}`}
                    ref={isAdded ? addedButton : undefined}
                    onClick={() => onOpen(course)}
                  >
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
              )
            })}
          </ul>
        </section>
      ))}

      {courses.length === 0 && (
        <section className="course-index-empty">
          <span className="course-index-empty-icon"><Icon name="archive" size={23} /></span>
          <h2>{isStudent ? '아직 추가한 과목이 없어요' : '아직 등록된 강의가 없어요'}</h2>
          <p>{isStudent ? '교수님이 안내한 코드로 과목을 추가해 보세요.' : '강의명과 시간표를 등록하면 학생이 과목 코드로 참여할 수 있어요.'}</p>
        </section>
      )}
    </div>
  )
}

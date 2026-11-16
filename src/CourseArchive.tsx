import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import type { Course, CourseSession } from './courses'
import { Icon } from './Icon'
import './courses.css'

type CourseArchiveProps = {
  course: Course
  sessions: CourseSession[]
  selected: CourseSession | null
  liveAvailable: boolean
  onSelect: (session: CourseSession) => void
  onOpenLive: () => void
}

export function CourseArchive({ course, sessions, selected, liveAvailable, onSelect, onOpenLive }: CourseArchiveProps) {
  const controls = useRef<HTMLDivElement>(null)
  const sectionTitle = useId()
  const selectedIndex = sessions.findIndex((session) => session.id === selected?.id)
  const previous = sessions[selectedIndex - 1]
  const next = sessions[selectedIndex + 1]

  useEffect(() => {
    const viewport = controls.current
    const activeDate = viewport?.querySelector('[aria-current="date"]')
    if (!viewport || !activeDate) return
    const viewportBounds = viewport.getBoundingClientRect()
    const dateBounds = activeDate.getBoundingClientRect()
    const gutter = 5
    const leftOffset = dateBounds.left - viewportBounds.left - gutter
    const rightOffset = dateBounds.right - viewportBounds.right + gutter

    if (leftOffset < 0 || rightOffset > 0) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      viewport.scrollBy({ left: leftOffset < 0 ? leftOffset : rightOffset, behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }, [selected?.id, course.id])

  function moveDateFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let targetIndex: number
    switch (event.key) {
      case 'ArrowLeft': targetIndex = Math.max(0, index - 1); break
      case 'ArrowRight': targetIndex = Math.min(sessions.length - 1, index + 1); break
      case 'Home': targetIndex = 0; break
      case 'End': targetIndex = sessions.length - 1; break
      default: return
    }

    event.preventDefault()
    const target = controls.current?.querySelectorAll('button')[targetIndex]
    target?.focus({ preventScroll: true })
    onSelect(sessions[targetIndex])
  }

  return (
    <section className="course-archive" aria-labelledby={sectionTitle}>
      <header className="course-archive-heading">
        <h2 id={sectionTitle}>차시 선택</h2>
        {liveAvailable && (
          <button type="button" className="course-archive-live" onClick={onOpenLive}>
            <span className="course-index-live-status"><i aria-hidden="true" />수업 중</span>
            질문창으로
            <Icon name="chevron-right" size={15} />
          </button>
        )}
      </header>

      {sessions.length > 0 ? (
        <div className="course-archive-navigation">
          <button
            type="button"
            className="course-archive-arrow"
            aria-label="이전 날짜"
            aria-disabled={!previous}
            onClick={() => { if (previous) onSelect(previous) }}
          >
            <Icon name="chevron-left" size={18} />
          </button>
          <div className="course-archive-dates" aria-label={`${course.name} 수업 날짜`} role="group" ref={controls}>
            {sessions.map((session, index) => (
              <button
                key={session.id}
                type="button"
                className="course-archive-date"
                aria-label={session.date}
                aria-current={session.id === selected?.id ? 'date' : undefined}
                onClick={() => onSelect(session)}
                onKeyDown={(event) => moveDateFocus(event, index)}
              >
                {session.shortDate}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="course-archive-arrow"
            aria-label="다음 날짜"
            aria-disabled={!next}
            onClick={() => { if (next) onSelect(next) }}
          >
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
      ) : (
        <p className="course-archive-empty">아직 지난 수업이 없어요.</p>
      )}
    </section>
  )
}

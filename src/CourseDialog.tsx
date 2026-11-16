import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent, PointerEvent } from 'react'
import type { CourseDraft } from './courses'
import { Icon } from './Icon'
import './course-dialog.css'

type CourseDialogProps = {
  role: 'student' | 'professor'
  open: boolean
  onClose: () => void
  onJoin?: (code: string) => string | null | Promise<string | null>
  onCreate?: (draft: CourseDraft) => string | null | Promise<string | null>
}

type Field = keyof CourseDraft
type TextField = Exclude<Field, 'days'>
type Issue = { field?: Field; message: string }
type Status = 'idle' | 'pending' | 'success'

const initialDraft: CourseDraft = {
  name: '', code: '', semester: '2026년 2학기', days: [], startsAt: '', endsAt: '',
}
const weekdays = ['월', '화', '수', '목', '금', '토', '일']
const courseCodePattern = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
const exitDuration = 180
const successDuration = 270

function validate(draft: CourseDraft, isStudent: boolean): Issue | null {
  if (!isStudent && !draft.name) return { field: 'name', message: '강의명을 입력해 주세요.' }
  if (!draft.code) return { field: 'code', message: '과목 코드를 입력해 주세요.' }
  if (!courseCodePattern.test(draft.code)) return { field: 'code', message: '과목 코드는 영문, 숫자, 하이픈으로 입력해 주세요.' }
  if (isStudent) return null
  if (!draft.semester) return { field: 'semester', message: '학기를 입력해 주세요.' }
  if (!draft.days.length) return { field: 'days', message: '수업하는 요일을 선택해 주세요.' }
  if (!timePattern.test(draft.startsAt)) return { field: 'startsAt', message: '시작 시간을 입력해 주세요.' }
  if (!timePattern.test(draft.endsAt)) return { field: 'endsAt', message: '종료 시간을 입력해 주세요.' }
  if (draft.endsAt <= draft.startsAt) return { field: 'endsAt', message: '종료 시간은 시작 시간보다 늦어야 해요.' }
  return null
}

function outsidePanel(event: PointerEvent<HTMLDialogElement> | MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false
  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
  return event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function CourseDialog({ role, open, onClose, onJoin, onCreate }: CourseDialogProps) {
  const baseId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const requestVersion = useRef(0)
  const submitting = useRef(false)
  const backdropPointerDown = useRef(false)
  const onCloseRef = useRef(onClose)
  const [draft, setDraft] = useState(initialDraft)
  const [issue, setIssue] = useState<Issue | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const isStudent = role === 'student'
  const available = Boolean(isStudent ? onJoin : onCreate)
  const locked = status !== 'idle'
  const issueId = `${baseId}-feedback`
  const title = isStudent ? '과목 추가' : '강의 추가'

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      delete dialog.dataset.closing
      if (!dialog.open) {
        setDraft(initialDraft)
        setIssue(null)
        setStatus('idle')
        submitting.current = false
        dialog.showModal()
        const field = isStudent ? 'code' : 'name'
        dialog.querySelector<HTMLInputElement>(`input[name="${field}"]`)?.focus({ preventScroll: true })
      }
      return
    }

    ++requestVersion.current
    if (!dialog.open) return

    if (reducedMotion()) {
      dialog.close()
      return
    }

    dialog.dataset.closing = 'true'
    const timer = window.setTimeout(() => {
      dialog.close()
      delete dialog.dataset.closing
    }, exitDuration)
    return () => window.clearTimeout(timer)
  }, [isStudent, open])

  useEffect(() => {
    if (!open || status !== 'success') return
    if (reducedMotion()) {
      onCloseRef.current()
      return
    }
    const timer = window.setTimeout(() => onCloseRef.current(), successDuration)
    return () => window.clearTimeout(timer)
  }, [open, status])

  useEffect(() => {
    if (open && issue?.field) {
      dialogRef.current?.querySelector<HTMLInputElement>(`input[name="${issue.field}"]`)?.focus()
    }
  }, [issue, open])

  function dismiss() {
    if (!open) return
    ++requestVersion.current
    onClose()
  }

  function updateField(field: TextField, value: string) {
    const nextValue = field === 'code' ? value.replace(/[a-z]/g, (letter) => letter.toUpperCase()) : value
    setDraft((previous) => ({ ...previous, [field]: nextValue }))
    if (issue?.field === field || !issue?.field) setIssue(null)
  }

  function toggleDay(day: number) {
    setDraft((previous) => ({
      ...previous,
      days: previous.days.includes(day)
        ? previous.days.filter((entry) => entry !== day)
        : [...previous.days, day].sort((left, right) => left - right),
    }))
    if (issue?.field === 'days' || !issue?.field) setIssue(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!open || !available || submitting.current) return

    const normalized = { ...draft, name: draft.name.trim(), code: draft.code.trim(), semester: draft.semester.trim() }
    const validationIssue = validate(normalized, isStudent)
    if (validationIssue) {
      setIssue(validationIssue)
      return
    }

    const attempt = ++requestVersion.current
    submitting.current = true
    setIssue(null)
    setStatus('pending')

    let message: string | null | undefined
    try {
      message = isStudent ? await onJoin?.(normalized.code) : await onCreate?.(normalized)
    } catch {
      message = isStudent
        ? '과목을 추가하지 못했어요. 다시 시도해 주세요.'
        : '강의를 추가하지 못했어요. 다시 시도해 주세요.'
    }

    if (attempt !== requestVersion.current) return
    if (message) {
      submitting.current = false
      setStatus('idle')
      setIssue({ field: isStudent ? 'code' : undefined, message })
    } else {
      setStatus('success')
    }
  }

  function fieldError(field?: Field) {
    return issue && issue.field === field && (
      <p className="course-dialog-error" id={issueId} role="alert">
        <Icon name="alert" size={15} />{issue.message}
      </p>
    )
  }

  function inputProps(field: Field) {
    const invalid = issue?.field === field
    return {
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? issueId : undefined,
    }
  }

  function textField(field: TextField, label: string, placeholder?: string) {
    return (
      <div className="course-dialog-field">
        <label htmlFor={`${baseId}-${field}`}>{label}</label>
        <input
          id={`${baseId}-${field}`}
          type={field === 'startsAt' || field === 'endsAt' ? 'time' : 'text'}
          name={field}
          placeholder={placeholder}
          value={draft[field]}
          autoComplete="off"
          autoCapitalize={field === 'code' ? 'characters' : undefined}
          spellCheck={field === 'code' ? false : undefined}
          readOnly={locked}
          required
          onChange={(event) => updateField(field, event.target.value)}
          {...inputProps(field)}
        />
        {fieldError(field)}
      </div>
    )
  }

  const submitText = isStudent ? '과목 추가' : '강의 추가'
  const successText = isStudent ? '과목을 추가했어요' : '강의를 추가했어요'
  return (
    <dialog
      ref={dialogRef}
      className="course-dialog"
      data-role={role}
      aria-labelledby={`${baseId}-title`}
      aria-describedby={`${baseId}-description`}
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      onPointerDown={(event) => { backdropPointerDown.current = outsidePanel(event) }}
      onClick={(event) => {
        if (backdropPointerDown.current && outsidePanel(event)) dismiss()
        backdropPointerDown.current = false
      }}
    >
      <header className="course-dialog-heading">
        <div>
          <h2 id={`${baseId}-title`}>{title}</h2>
          <p id={`${baseId}-description`}>
            {isStudent ? '교수님이 알려준 과목 코드를 입력해 주세요.' : '학생에게 공유할 과목 코드와 수업 시간을 설정하세요.'}
          </p>
        </div>
        <button className="course-dialog-close" type="button" aria-label="닫기" onClick={dismiss}>
          <Icon name="plus" size={21} />
        </button>
      </header>

      {available && (
        <form className="course-dialog-form" onSubmit={submit} noValidate>
          <div className="course-dialog-fields" aria-busy={status === 'pending'}>
            {!isStudent && textField('name', '강의명', '예: 데이터베이스')}
            {textField('code', '과목 코드', isStudent ? '예: COMP0322' : '예: COMP0401')}
            {!isStudent && (
              <>
                {textField('semester', '학기')}
                <fieldset className="course-dialog-field course-dialog-weekdays" aria-describedby={issue?.field === 'days' ? issueId : undefined}>
                  <legend>수업 요일</legend>
                  <div className="course-dialog-weekday-grid">
                    {weekdays.map((day, index) => (
                      <label className="course-dialog-day" key={day}>
                        <input
                          name="days"
                          type="checkbox"
                          aria-label={`${day}요일`}
                          checked={draft.days.includes(index)}
                          disabled={locked}
                          onChange={() => toggleDay(index)}
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                  {fieldError('days')}
                </fieldset>
                <div className="course-dialog-times">
                  {textField('startsAt', '시작 시간')}
                  {textField('endsAt', '종료 시간')}
                </div>
              </>
            )}
          </div>
          {fieldError()}
          <footer className="course-dialog-actions">
            <button className="course-dialog-cancel" type="button" onClick={dismiss}>취소</button>
            <button className="course-dialog-submit" data-status={status} type="submit" disabled={locked}>
              {status === 'pending' && <span className="course-dialog-spinner" aria-hidden="true" />}
              {status === 'success' && <Icon name="check" size={17} />}
              {status === 'idle' ? submitText : status === 'pending' ? `${submitText} 중…` : '완료'}
            </button>
          </footer>
          <div className="sr-only" role="status">{status === 'success' ? successText : status === 'pending' ? `${submitText} 중` : ''}</div>
        </form>
      )}
    </dialog>
  )
}

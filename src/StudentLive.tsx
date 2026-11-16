import { useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { Icon } from './Icon'
import { QUESTION_LIMIT, questionLength } from './state'
import type { Question, SubmitResult } from './state'

interface StudentFeedProps {
  questions: Question[]
  ended: boolean
  newestQuestion: string | null
  onReact: (id: string) => Promise<void>
}

function Reaction({ question, onReact }: { question: Question; onReact: StudentFeedProps['onReact'] }) {
  const [busy, setBusy] = useState(false)
  const [changed, setChanged] = useState(false)

  async function react() {
    if (busy) return
    setChanged(false)
    setBusy(true)
    try {
      await onReact(question.id)
      setChanged(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      className={`reaction-button${changed ? ' reaction-button--changed' : ''}`}
      type="button"
      aria-pressed={question.reacted}
      aria-label={`나도 궁금, ${question.reactionCount}명`}
      aria-disabled={busy}
      onClick={() => void react()}
      onAnimationEnd={() => setChanged(false)}
    >
      <Icon name={question.reacted ? 'check' : 'plus'} size={15} />
      나도 궁금 <span className="reaction-count">{question.reactionCount}</span>
    </button>
  )
}

export function StudentFeed({ questions, ended, newestQuestion, onReact }: StudentFeedProps) {
  const newestCard = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    if (!newestQuestion) return
    const frame = window.requestAnimationFrame(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      newestCard.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'instant' : 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [newestQuestion])

  return (
    <section aria-labelledby="student-questions">
      <div className="section-head">
        <h2 id="student-questions">
          수업 질문<span className="question-total" aria-label={`${questions.length}개`}>{questions.length}</span>
        </h2>
        {questions.length > 0 && <span className="list-order"><Icon name="clock" size={14} />최신순</span>}
      </div>
      {questions.length > 0 ? (
        <ol className="question-feed" role="list" aria-label="질문 목록">
          {questions.map((question) => {
            const isNew = question.id === newestQuestion
            return (
              <li
                className={`question-card${isNew ? ' question-card--fresh' : ''}`}
                key={question.id}
                ref={isNew ? newestCard : undefined}
              >
                <div>
                  <div className="question-heading">
                    <time className="question-time" dateTime={question.time}>{question.time}</time>
                    {question.answered && (
                      <span className="question-tag"><Icon name="check" size={12} />교수님이 답변함</span>
                    )}
                    {question.mine && <span className="question-tag question-tag--mine">내가 쓴 질문</span>}
                  </div>
                  <p className="question-text">{question.text}</p>
                </div>
                {ended || question.answered || question.mine ? (
                  <span className="reaction-summary">
                    <Icon name="heart" size={14} />{question.reactionCount}명이 궁금해함
                  </span>
                ) : (
                  <Reaction question={question} onReact={onReact} />
                )}
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="empty-feed">
          <Icon name="message" size={25} />
          <h3>아직 질문이 없어요</h3>
          {!ended && <p>수업 내용에서 궁금한 점을 가장 먼저 올려보세요.</p>}
        </div>
      )}
    </section>
  )
}

interface ComposerProps {
  onSubmit: (text: string) => Promise<SubmitResult>
  onPosted: (id: string) => void
}

export function QuestionComposer({ onSubmit, onPosted }: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null)
  const [wasRejected, setWasRejected] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const pending = useRef(false)
  const length = questionLength(draft)
  const overLimit = length > QUESTION_LIMIT
  const message = feedback ?? (overLimit ? {
    title: '글자 수를 줄여주세요',
    message: `질문은 ${QUESTION_LIMIT}자까지 등록할 수 있어요.`,
  } : null)

  useEffect(() => {
    const input = field.current
    if (!input) return
    input.style.height = ''
    input.style.height = `${Math.min(112, input.scrollHeight + 2)}px`
  }, [draft])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || !draft.trim() || overLimit) return
    pending.current = true
    setSending(true)
    setFeedback(null)
    try {
      const result = await onSubmit(draft)
      if (result.status === 'posted') {
        setDraft('')
        setWasRejected(false)
        onPosted(result.questionId)
      } else if (result.status === 'rejected') {
        setWasRejected(true)
        setFeedback({ title: '질문이 등록되지 않았어요', message: result.message })
        field.current?.focus({ preventScroll: true })
      } else if (result.status === 'invalid') {
        setFeedback({ title: '질문을 확인해주세요', message: result.message })
      } else {
        setFeedback({ title: '수업이 종료됐어요', message: '지난 질문에서 수업 내용을 볼 수 있어요.' })
      }
    } catch {
      setFeedback({ title: '질문을 등록하지 못했어요', message: '작성한 내용을 확인하고 다시 시도해주세요.' })
    } finally {
      pending.current = false
      setSending(false)
    }
  }

  return (
    <footer className="composer-bar">
      <form className="composer-inner" onSubmit={(event) => void submit(event)}>
        {message && (
          <div className="composer-feedback" id="question-feedback" role="alert">
            <Icon name="alert" size={17} />
            <div><strong>{message.title}</strong>{message.message}</div>
          </div>
        )}
        <label className="composer-label" htmlFor="question-input">질문 입력</label>
        <div className="composer-controls">
          <textarea
            className="question-input"
            id="question-input"
            ref={field}
            rows={1}
            placeholder="궁금한 점을 익명으로 물어보세요"
            value={draft}
            onChange={(event) => {
              setDraft(event.currentTarget.value)
              setFeedback(null)
            }}
            aria-describedby={message ? 'question-feedback question-note question-counter' : 'question-note question-counter'}
            aria-invalid={Boolean(message)}
            readOnly={sending}
          />
          <button className="submit-button" disabled={!draft.trim() || overLimit || sending} type="submit">
            <Icon name="send" size={16} />{sending ? '검토 중' : wasRejected ? '다시 등록' : '등록'}
          </button>
        </div>
        <div className="composer-meta">
          <span className="composer-note" id="question-note">
            <Icon name="lock" size={13} />
            {wasRejected ? '이 글은 다른 사람에게 보이지 않아요' : '이름 없이 익명으로 올라가요'}
          </span>
          <span className={`composer-counter${overLimit ? ' composer-counter--over' : ''}`} id="question-counter">
            <span className="sr-only">글자 수 </span>{length}/{QUESTION_LIMIT}
          </span>
        </div>
      </form>
    </footer>
  )
}

export function ClosedSessionBar({ href, onHistory }: { href: string; onHistory: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return (
    <footer className="composer-bar closed-bar">
      <div className="composer-inner">
        <div className="closed-message" role="status">
          <span className="closed-icon"><Icon name="archive" size={19} /></span>
          <div>
            <strong>수업이 끝났어요</strong>
            <p>오늘 나온 질문은 지난 질문에서 볼 수 있어요.</p>
          </div>
        </div>
        <a className="history-link" href={href} onClick={onHistory}>
          지난 질문 보기 <Icon name="chevron-right" size={15} />
        </a>
      </div>
    </footer>
  )
}

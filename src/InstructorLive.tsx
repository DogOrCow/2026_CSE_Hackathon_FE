import { useId, useRef } from 'react';
import { Icon } from './Icon';
import { SESSION, type Question } from './state';
import './instructor.css';

type InstructorLiveProps = {
  questions: Question[];
  ended: boolean;
  onToggleAnswered: (id: string) => Promise<void>;
  onEnd?: () => void;
  onHistory: () => void;
};

export function InstructorLive({
  questions,
  ended,
  onToggleAnswered,
  onEnd,
  onHistory,
}: InstructorLiveProps) {
  const questionListTitle = useId();
  const confirmationTitle = useId();
  const confirmationDescription = useId();
  const confirmation = useRef<HTMLDialogElement>(null);
  const pendingAnswers = useRef(new Set<string>());
  const unansweredCount = questions.filter((question) => !question.answered).length;

  async function toggleAnswered(id: string) {
    if (pendingAnswers.current.has(id)) return;
    pendingAnswers.current.add(id);

    try {
      await onToggleAnswered(id);
    } finally {
      pendingAnswers.current.delete(id);
    }
  }

  function endSession() {
    confirmation.current?.close();
    onEnd?.();
  }

  return (
    <div className="instructor-screen">
      <section className="instructor-overview" aria-label="질문 현황">
        <dl className="instructor-metrics" aria-live="polite">
          <div className="instructor-metric">
            <dt>질문 수</dt>
            <dd>{questions.length}<span>개</span></dd>
          </div>
          <div className="instructor-metric instructor-metric--open">
            <dt>미답변</dt>
            <dd>{unansweredCount}<span>개</span></dd>
          </div>
        </dl>

        {ended ? (
          <button className="instructor-button instructor-button--primary" onClick={onHistory} type="button">
            <Icon name="archive" size={17} />
            수업 기록
          </button>
        ) : onEnd && (
          <button
            className="instructor-button instructor-button--end"
            onClick={() => confirmation.current?.showModal()}
            type="button"
          >
            <Icon name="clock" size={16} />
            종료 시각 시연
          </button>
        )}
      </section>

      <section className="instructor-questions" aria-labelledby={questionListTitle}>
        <div className="instructor-section-heading">
          <h2 id={questionListTitle}>받은 질문</h2>
          {questions.length > 0 && <span className="list-order"><Icon name="clock" size={14} />최신순</span>}
        </div>

        {questions.length > 0 ? (
          <ul className="instructor-question-list" role="list">
            {questions.map((question) => (
              <li
                className="instructor-question"
                data-answered={question.answered}
                key={question.id}
              >
                <div className="instructor-question-main">
                  <div className="instructor-question-meta">
                    <time dateTime={question.time}>{question.time}</time>
                    <span className="instructor-question-status" data-answered={question.answered}>
                      {question.answered && <Icon name="check" size={13} />}
                      {question.answered ? '답변 완료' : '미답변'}
                    </span>
                    <span><Icon name="heart" size={14} />공감 {question.reactionCount}</span>
                  </div>
                  <p className="instructor-question-text">{question.text}</p>
                </div>
                {!ended && (
                  <button
                    className={`instructor-button ${question.answered ? 'instructor-button--quiet' : 'instructor-button--answer'}`}
                    aria-label={`${question.answered ? '되돌리기' : '답변 완료'} — ${question.text}`}
                    onClick={() => void toggleAnswered(question.id)}
                    type="button"
                  >
                    <Icon name={question.answered ? 'undo' : 'check'} size={16} />
                    {question.answered ? '되돌리기' : '답변 완료'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="instructor-empty" role="status">
            <Icon name="message" size={22} />
            <p>아직 받은 질문이 없어요.</p>
          </div>
        )}
      </section>

      {onEnd && <dialog
        aria-labelledby={confirmationTitle}
        aria-describedby={confirmationDescription}
        className="instructor-confirmation"
        ref={confirmation}
      >
        <div className="instructor-confirmation-icon"><Icon name="stop" size={22} /></div>
        <h2 id={confirmationTitle}>종료 시각으로 이동할까요?</h2>
        <p id={confirmationDescription}>시연 시간을 {SESSION.end}로 옮기면 질문 등록과 공감이 마감되고, 받은 질문은 차시 기록에서 확인할 수 있어요.</p>
        <div className="instructor-confirmation-actions">
          <button className="instructor-button instructor-button--quiet" onClick={() => confirmation.current?.close()} type="button">취소</button>
          <button className="instructor-button instructor-button--confirm" onClick={endSession} type="button">이동</button>
        </div>
      </dialog>}
    </div>
  );
}

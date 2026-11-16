import { useId } from 'react';
import { Icon } from './Icon';
import type { CourseSession } from './courses';
import './instructor.css';

type SessionHistoryProps = {
  session: CourseSession;
};

export function SessionHistory({ session }: SessionHistoryProps) {
  const { questions } = session;
  const sectionTitle = useId();
  const answeredCount = questions.filter((question) => question.answered).length;

  return (
    <section className="history-screen" aria-labelledby={sectionTitle}>
      <header className="history-heading">
        <div>
          <span className="history-week">{session.week}</span>
          <h2 id={sectionTitle}>{session.date}</h2>
        </div>
        <dl className="history-metrics">
          <div><dt>질문</dt><dd>{questions.length}개</dd></div>
          <div><dt>답변 완료</dt><dd>{answeredCount}개</dd></div>
        </dl>
      </header>

      {questions.length ? (
        <ol className="history-question-list" aria-label="수업 질문 기록" role="list">
          {questions.map((question) => (
            <li key={question.id} className="history-question">
              <div className="history-question-header">
                <span className="instructor-question-status" data-answered={question.answered}>
                  {question.answered && <Icon name="check" size={13} />}
                  {question.answered ? '답변 완료' : '미답변'}
                </span>
                <span className="history-question-time"><Icon name="clock" size={14} />{question.time}</span>
              </div>
              <p className="instructor-question-text">{question.text}</p>
              <div className="instructor-question-meta">
                <span><Icon name="heart" size={14} />공감 {question.reactionCount}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="instructor-empty">
          <Icon name="message" size={22} />
          <p>이 수업에 기록된 질문이 없어요.</p>
        </div>
      )}
    </section>
  );
}

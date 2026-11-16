import { useCallback, useSyncExternalStore } from 'react'
import { SESSION, type Question } from './state'

export type CourseSession = {
  id: string
  date: string
  shortDate: string
  week: string
  start: string
  end?: string
  questions: Question[]
  live?: boolean
}

export type Course = {
  id: string
  code: string
  name: string
  instructor: string
  schedule: string
  nextClass: string
  sessions: CourseSession[]
  isLive?: boolean
  liveQuestionCount?: number
  semester?: string
}

export type CourseDraft = {
  name: string
  code: string
  semester: string
  days: number[]
  startsAt: string
  endsAt: string
}

type ExampleQuestion = [time: string, text: string, reactionCount: number]
type ExampleSession = [date: string, week: number, questions: ExampleQuestion[]]

const fullDate = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'UTC',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
const shortDay = new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', weekday: 'short' })

function pastSessions(courseId: string, start: string, examples: ExampleSession[]): CourseSession[] {
  return examples.map(([isoDate, week, examples]) => {
    const id = `${courseId}-${isoDate}`
    const date = new Date(`${isoDate}T00:00:00Z`)
    return {
      id,
      date: fullDate.format(date),
      shortDate: `${isoDate.slice(5).replace('-', '.')} ${shortDay.format(date)}`,
      week: `${week}주차`,
      start,
      questions: examples.map(([time, text, reactionCount], index) => ({
        id: `${id}-q${index + 1}`,
        text,
        time,
        reactionCount,
        answered: false,
        mine: false,
        reacted: false,
      })),
    }
  })
}

export const COURSES: Course[] = [
  {
    id: SESSION.courseId,
    code: 'COMP0322',
    name: SESSION.courseName,
    instructor: SESSION.instructor,
    schedule: '화·목 10:30',
    nextClass: '다음 수업 목 10:30',
    sessions: [
      {
        id: SESSION.sessionId,
        date: SESSION.date,
        shortDate: '11.17 화',
        week: SESSION.week,
        start: SESSION.start,
        questions: [],
        live: true,
      },
      ...pastSessions(SESSION.courseId, SESSION.start, [
        ['2026-11-12', 10, [
          ['10:44', '팬텀 리드가 실제로 문제 되는 예가 궁금해요.', 10],
          ['10:58', '트랜잭션 격리 수준 네 개를 표로 한 번 정리해주실 수 있나요?', 14],
          ['11:12', '락을 거는 순서는 누가 정하나요?', 6],
          ['11:36', '중간고사 이후 범위만 기말에 나오나요?', 3],
        ]],
        ['2026-11-10', 10, [
          ['10:37', '트랜잭션 시작 시점의 데이터를 읽는다는 게 무슨 뜻인가요?', 5],
          ['10:42', '갱신 손실이 생기는 순서를 다시 보여주실 수 있나요?', 7],
          ['10:48', '커밋에 실패하면 어디부터 되돌리나요?', 4],
          ['10:53', '공유 락과 배타 락은 동시에 걸 수 있나요?', 8],
          ['11:01', '동시성 제어가 없으면 어떤 문제가 생기나요?', 1],
          ['11:09', '락보다 버전으로 처리할 때 유리한 경우가 있나요?', 6],
          ['11:16', '예약 시스템의 중복 저장은 어떤 수준에서 막나요?', 3],
          ['11:25', '롤백과 저장점의 차이를 설명해주실 수 있나요?', 2],
          ['11:33', '오늘 실습에서 기본 격리 수준은 뭔가요?', 9],
        ]],
        ['2026-11-05', 9, [
          ['10:47', '집계 함수는 NULL을 어떻게 처리하나요?', 11],
          ['11:03', 'WHERE와 HAVING을 모두 쓰는 예시가 있나요?', 5],
          ['11:27', '뷰에서 원본 테이블의 값을 수정할 수 있나요?', 4],
        ]],
        ['2026-11-03', 9, [
          ['10:38', '내부 조인과 왼쪽 조인 결과의 차이가 궁금해요.', 9],
          ['10:44', '조인 조건 없이 두 테이블을 쓰면 어떻게 되나요?', 2],
          ['10:53', '같은 테이블을 두 번 조인하는 이유가 있나요?', 4],
          ['11:02', '테이블 별칭은 어느 범위까지 사용할 수 있나요?', 3],
          ['11:11', '서브쿼리로 바꿀 수 없는 조인도 있나요?', 2],
          ['11:22', '중복 행을 없애면 실습 결과가 달라지나요?', 6],
          ['11:31', '조인 순서가 결과 행 순서에 영향을 주나요?', 5],
        ]],
        ['2026-10-29', 8, [
          ['10:35', '재귀적으로 참조하는 외래 키 예시가 있나요?', 4],
          ['10:41', '외래 키를 삭제할 때 기존 행은 어떻게 되나요?', 6],
          ['10:46', '기본 키가 두 열인 테이블은 어떻게 참조하나요?', 5],
          ['10:52', '테이블마다 기본 키를 꼭 선언해야 하나요?', 3],
          ['10:55', 'UNIQUE 제약과 기본 키는 어떤 차이가 있나요?', 7],
          ['11:02', '기본값과 NULL 허용을 함께 쓸 수 있나요?', 2],
          ['11:09', '날짜에 시간대를 함께 저장하는 게 좋은가요?', 2],
          ['11:14', 'CHECK 제약으로 다른 행을 검사할 수 있나요?', 4],
          ['11:22', '자주 조회하는 열에는 어떤 인덱스를 만들면 되나요?', 8],
          ['11:29', '기존 테이블에 제약 조건을 뒤늦게 추가할 수 있나요?', 5],
          ['11:34', '다음 실습에서는 테이블부터 직접 만들어야 하나요?', 3],
        ]],
        ['2026-10-27', 8, [
          ['10:55', '다대다 관계를 테이블로 표현하는 예시를 다시 보여주실 수 있나요?', 8],
          ['11:24', '선택 관계와 필수 관계는 도식에서 어떻게 다르게 표시하나요?', 5],
        ]],
        ['2026-10-22', 7, [
          ['10:49', '릴레이션과 테이블을 같은 의미로 써도 괜찮나요?', 3],
        ]],
      ]),
    ],
  },
  {
    id: 'operating-systems',
    code: 'COMP0312',
    name: '운영체제',
    instructor: '남궁현 교수',
    schedule: '월·수 13:30',
    nextClass: '다음 수업 수 13:30',
    sessions: pastSessions('operating-systems', '13:30', [
      ['2026-11-16', 11, [
        ['13:45', '페이지 교체와 작업 집합은 어떤 관계가 있나요?', 4],
        ['14:16', '페이지 폴트가 잦으면 CPU 사용률이 왜 떨어지나요?', 8],
      ]],
      ['2026-11-11', 10, [
        ['13:58', '가상 주소를 물리 주소로 변환하는 순서를 보고 싶어요.', 10],
        ['14:25', 'TLB 미스와 페이지 폴트는 서로 독립적인가요?', 6],
      ]],
      ['2026-11-09', 10, [
        ['13:42', '데드락이랑 기아 상태는 어떻게 구분하나요?', 15],
        ['13:55', '세마포어 예제에서 wait 순서를 바꾸면 왜 문제가 되나요?', 11],
        ['14:03', '스핀락은 언제 쓰는 게 이득인가요?', 2],
        ['14:10', '은행원 알고리즘이 시험 범위에 들어가나요?', 7],
        ['14:21', '모니터와 세마포어 중에 실제로는 뭘 더 많이 쓰나요?', 4],
        ['14:33', '교착 상태 예방이랑 회피는 뭐가 다른가요?', 9],
      ]],
      ['2026-11-04', 9, [
        ['13:55', '뮤텍스를 해제하는 스레드는 항상 같은 스레드여야 하나요?', 4],
      ]],
      ['2026-11-02', 9, [
        ['14:05', '임계 영역의 진행 조건은 어떤 문제를 막나요?', 3],
      ]],
      ['2026-10-28', 8, [
        ['13:47', '라운드 로빈에서 시간 할당량은 어떻게 정하나요?', 5],
      ]],
      ['2026-10-26', 8, [
        ['14:12', '스케줄러가 바뀌면 문맥 교환 비용도 달라지나요?', 7],
      ]],
      ['2026-10-21', 7, [
        ['13:51', '사용자 수준 스레드가 커널 스레드보다 유리한 때가 궁금해요.', 2],
      ]],
    ]),
  },
  {
    id: 'algorithms',
    code: 'COMP0327',
    name: '알고리즘',
    instructor: '편도윤 교수',
    schedule: '화·목 15:00',
    nextClass: '오늘 15:00',
    sessions: pastSessions('algorithms', '15:00', [
      ['2026-11-12', 10, [
        ['15:24', '다익스트라 알고리즘에서 음수 가중치가 왜 문제인가요?', 6],
        ['15:51', '최단 경로가 두 개면 둘 다 구할 수 있나요?', 3],
      ]],
      ['2026-11-10', 10, [
        ['15:32', '위상 정렬 결과가 여러 개 나오는 경우가 있나요?', 4],
      ]],
      ['2026-11-05', 9, [
        ['15:46', 'BFS에서 방문 상태는 큐에 넣을 때 표시하나요?', 7],
      ]],
    ]),
  },
  {
    id: 'networks',
    code: 'COMP0412',
    name: '컴퓨터망',
    instructor: '옥채린 교수',
    schedule: '금 09:00',
    nextClass: '다음 수업 금 09:00',
    sessions: pastSessions('networks', '09:00', [
      ['2026-11-13', 10, [
        ['09:23', '혼잡 제어와 흐름 제어가 함께 작동하는 예시가 궁금해요.', 5],
        ['09:42', '패킷을 잃으면 재전송 시간은 어떻게 정해지나요?', 3],
      ]],
      ['2026-11-06', 9, [
        ['09:36', 'TCP 연결을 끝낼 때 메시지가 네 번 필요한 이유가 뭔가요?', 7],
      ]],
      ['2026-10-30', 8, [
        ['09:24', 'UDP를 써도 일부 데이터만 재전송할 수 있나요?', 4],
      ]],
    ]),
  },
  {
    id: 'database-section-2',
    code: 'COMP0322-2',
    name: '데이터베이스 002분반',
    instructor: SESSION.instructor,
    schedule: '화·목 15:00',
    nextClass: '오늘 15:00',
    sessions: pastSessions('database-section-2', '15:00', [
      ['2026-11-12', 10, [
        ['15:16', '반복 읽기와 팬텀 리드의 차이를 한 번 더 설명해주실 수 있나요?', 4],
        ['15:45', '트랜잭션마다 다른 격리 수준을 쓸 수 있나요?', 2],
      ]],
      ['2026-11-10', 10, [
        ['15:31', '커밋 전 긴 작업을 취소하면 이미 실행한 구문도 돌아가나요?', 6],
      ]],
    ]),
  },
  {
    id: 'database-design',
    code: 'COMP0411',
    name: '데이터베이스 설계',
    instructor: SESSION.instructor,
    schedule: '금 13:00',
    nextClass: '다음 수업 금 13:00',
    sessions: pastSessions('database-design', '13:00', [
      ['2026-11-13', 10, [
        ['13:18', '읽는 일이 많은 테이블은 어떤 기준으로 분리하나요?', 5],
      ]],
      ['2026-11-06', 9, [
        ['13:40', '이력 테이블에도 같은 후보 키를 써도 되나요?', 3],
      ]],
    ]),
  },
]

type CourseCreation = { course: Course } | { error: string }
type StoredCourse = { draft: CourseDraft; professorName: string }

const catalogPrefix = 'babo3:catalog:v1:course:'
const catalogChanged = 'babo3:catalog:changed'
const weekdays = ['월', '화', '수', '목', '금', '토', '일']
const demoDay = 1
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const temporaryCourses = new Map<string, Course>()
let storedCourses = new Map<string, { raw: string; course: Course }>()
let catalogSnapshot = COURSES

function validateDraft(draft: CourseDraft): string | null {
  const name = draft.name.trim()
  if (!name || name.length > 100) return '과목명은 1~100자로 입력해 주세요.'
  const code = draft.code.trim()
  if (code.length > 20 || !/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(code)) {
    return '과목 코드는 영문, 숫자, 하이픈을 사용해 1~20자로 입력해 주세요.'
  }
  const semester = draft.semester.trim()
  if (!semester || semester.length > 20) return '학기는 1~20자로 입력해 주세요.'
  if (!Array.isArray(draft.days) || !draft.days.length || draft.days.some((day) => !Number.isInteger(day) || day < 0 || day >= weekdays.length)) {
    return '수업 요일을 하나 이상 선택해 주세요.'
  }
  if (!timePattern.test(draft.startsAt) || !timePattern.test(draft.endsAt) || draft.startsAt >= draft.endsAt) {
    return '종료 시각은 시작 시각보다 늦어야 해요.'
  }
  return null
}

function toCourse({ draft, professorName }: StoredCourse): Course {
  const nextDay = Math.min(...draft.days.map((day) => {
    const offset = (day - demoDay + weekdays.length) % weekdays.length
    return offset === 0 && draft.startsAt <= SESSION.demoTime ? weekdays.length : offset
  }))
  const nextLabel = nextDay === 0 ? '오늘' : `다음 수업 ${weekdays[(demoDay + nextDay) % weekdays.length]}`

  return {
    id: `created-${draft.code.toLowerCase()}`,
    code: draft.code,
    name: draft.name,
    instructor: professorName.endsWith(' 교수') ? professorName : `${professorName} 교수`,
    schedule: `${draft.days.map((day) => weekdays[day]).join('·')} ${draft.startsAt}–${draft.endsAt}`,
    nextClass: `${nextLabel} ${draft.startsAt}`,
    semester: draft.semester,
    sessions: [],
    isLive: false,
  }
}

function decodeCourse(raw: string, storageKey: string): Course | undefined {
  try {
    const record = JSON.parse(raw) as StoredCourse
    if (
      typeof record?.professorName !== 'string' ||
      !record.professorName.trim() ||
      !record.draft ||
      validateDraft(record.draft) ||
      storageKey !== catalogPrefix + record.draft.code ||
      COURSES.some((course) => course.code === record.draft.code)
    ) return undefined
    return toCourse(record)
  } catch {
    return undefined
  }
}

function getCatalogSnapshot(): Course[] {
  if (typeof window === 'undefined') return COURSES
  try {
    const storage = window.localStorage
    const entries = new Map<string, { raw: string; course: Course }>()
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key?.startsWith(catalogPrefix)) continue
      const raw = storage.getItem(key)
      if (raw === null) continue
      const cached = storedCourses.get(key)
      const course = cached?.raw === raw ? cached.course : decodeCourse(raw, key)
      if (course) entries.set(key, { raw, course })
    }
    storedCourses = entries
  } catch {
    // Keep known courses available in this tab if browser storage is blocked.
  }

  const updates = new Map(temporaryCourses)
  for (const [key, { course }] of storedCourses) updates.set(key, course)
  const next = [...COURSES, ...updates.values()]
  if (next.length !== catalogSnapshot.length || next.some((course, index) => course !== catalogSnapshot[index])) {
    catalogSnapshot = next
  }
  return catalogSnapshot
}

function subscribeCatalog(listener: () => void) {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(catalogPrefix)) listener()
  }
  window.addEventListener(catalogChanged, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(catalogChanged, listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function findCourse(courseId: string): Course | undefined {
  return getCatalogSnapshot().find((course) => course.id === courseId)
}

export function findCourseByCode(code: string): Course | undefined {
  const normalized = code.trim().toUpperCase()
  return getCatalogSnapshot().find((course) => course.code === normalized)
}

async function createCourse(draft: CourseDraft, professorName: string): Promise<CourseCreation> {
  const error = validateDraft(draft)
  if (error) return { error }
  if (!professorName.trim()) return { error: '교수 정보를 확인해 주세요.' }

  const normalized = {
    ...draft,
    name: draft.name.trim(),
    code: draft.code.trim().toUpperCase(),
    semester: draft.semester.trim(),
    days: [...new Set(draft.days)].sort((a, b) => a - b),
  }
  const key = catalogPrefix + normalized.code

  function save(): CourseCreation {
    if (findCourseByCode(normalized.code)) return { error: '이미 사용 중인 과목 코드예요.' }
    const record = { draft: normalized, professorName: professorName.trim() }
    const course = toCourse(record)
    try {
      const raw = JSON.stringify(record)
      window.localStorage.setItem(key, raw)
      storedCourses.set(key, { raw, course })
      temporaryCourses.delete(key)
    } catch {
      // Preserve the change for the current tab if persistence is unavailable.
      temporaryCourses.set(key, course)
    }
    window.dispatchEvent(new Event(catalogChanged))
    return { course }
  }

  const locks = navigator.locks
  if (!locks) return save()
  let acquired = false
  try {
    return await locks.request(key, () => {
      acquired = true
      return save()
    })
  } catch (error) {
    if (acquired) throw error
    return save()
  }
}

export function useMockCatalog(): {
  courses: Course[]
  findByCode: (code: string) => Course | undefined
  createCourse: (draft: CourseDraft, professorName: string) => Promise<CourseCreation>
} {
  const courses = useSyncExternalStore(subscribeCatalog, getCatalogSnapshot, () => COURSES)
  return { courses, findByCode: findCourseByCode, createCourse }
}

const emptyEnrollments: string[] = []
const demoEnrollments = [SESSION.courseId, 'operating-systems', 'algorithms', 'networks']
const enrollmentSnapshots = new Map<string, string[]>()

function defaultCourseIds(email: string | null) {
  return email === 'yesung@knu.ac.kr' ? demoEnrollments : emptyEnrollments
}

function enrollmentPrefix(email: string) {
  return `babo3:enrollment:v1:${encodeURIComponent(email)}:`
}

function readEnrollments(email: string | null) {
  if (!email) return emptyEnrollments

  const current = enrollmentSnapshots.get(email) ?? defaultCourseIds(email)
  if (typeof window === 'undefined') return current

  try {
    const prefix = enrollmentPrefix(email)
    const storage = window.localStorage
    const enrolled = getCatalogSnapshot()
      .map((course) => course.id)
      .filter((id) => current.includes(id) || storage.getItem(`${prefix}${id}`) === '1')
    if (enrolled.length !== current.length) {
      enrollmentSnapshots.set(email, enrolled)
      return enrolled
    }
  } catch {
    // Keep this tab's memberships usable when storage cannot be read.
  }

  return current
}

export function useEnrollments(email: string | null): {
  courseIds: string[]
  enroll: (courseId: string) => void
} {
  const account = email?.trim().toLowerCase() || null
  const getSnapshot = useCallback(() => readEnrollments(account), [account])
  const getServerSnapshot = useCallback(() => defaultCourseIds(account), [account])
  const subscribe = useCallback((listener: () => void) => {
    if (!account || typeof window === 'undefined') return () => {}

    const prefix = enrollmentPrefix(account)
    const handleStorage = (event: StorageEvent) => {
      if (event.key?.startsWith(prefix)) listener()
    }
    const unsubscribeCatalog = subscribeCatalog(listener)
    window.addEventListener(prefix, listener)
    window.addEventListener('storage', handleStorage)
    return () => {
      unsubscribeCatalog()
      window.removeEventListener(prefix, listener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [account])
  const courseIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const enroll = useCallback((courseId: string) => {
    if (!account || !findCourse(courseId)) return

    const current = readEnrollments(account)
    const alreadyEnrolled = current.includes(courseId)
    if (!alreadyEnrolled) enrollmentSnapshots.set(account, [...current, courseId])
    if (typeof window === 'undefined') return

    const prefix = enrollmentPrefix(account)
    try {
      // Each course is independent so simultaneous enrollments in other tabs can merge.
      window.localStorage.setItem(`${prefix}${courseId}`, '1')
    } catch {
      // A storage failure still leaves the enrollment usable in this tab.
    }
    if (!alreadyEnrolled) window.dispatchEvent(new Event(prefix))
  }, [account])

  return { courseIds, enroll }
}

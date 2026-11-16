# 익명실명 프론트엔드

경북대 컴퓨터학부 수업용 익명 질문 앱입니다. React, TypeScript, Vite를 사용합니다.

## 빠른 실행

Git, Node.js, npm이 필요합니다. Node.js 22 이상을 권장합니다.

```sh
git clone https://github.com/DogOrCow/2026_CSE_Hackathon_FE.git
cd 2026_CSE_Hackathon_FE
npm ci
npm run dev
```

터미널에 표시된 `Local` 주소를 브라우저에서 엽니다. 기본 주소는 `http://localhost:5173/`입니다. `VITE_API_BASE_URL`이 비어 있으면 목업 데이터로 실행됩니다.

## 목업으로 체험하기

1. **학생 화면**에서 **계정 입력 → 로그인**을 누릅니다. **데이터베이스** 수업에 들어가 질문을 등록합니다.
2. 같은 브라우저의 새 탭에서 **교수 화면 → 계정 입력 → 로그인**을 누릅니다. 등록한 질문을 **답변 완료** 또는 **되돌리기**로 처리하면 학생 화면에도 반영됩니다.
3. 교수 화면의 **종료 시각 시연**을 실행한 뒤 **지난 질문**으로 같은 차시의 기록을 확인합니다.

빈 과목 목록부터 체험하려면 **회원가입**에서 화면에 표시된 모의 인증번호를 사용합니다. 가입 후 **과목 추가**에서 `COMP0322`를 등록하고 목록에서 데이터베이스 과목을 선택합니다.

교수는 **내 강의 → 강의 추가**에서 강의명, 과목 코드, 학기, 수업 요일과 시간을 등록합니다. 같은 브라우저의 학생 화면에서 새 과목 코드를 사용할 수 있습니다.

목업 데이터와 수업 종료 상태는 브라우저에 저장됩니다. 처음부터 다시 체험하려면 새 시크릿 세션에서 두 화면을 엽니다.

## 실제 API에 연결하기

1. 팀 FastAPI 서버를 실행하고 `/health` 응답을 확인합니다. [백엔드 실행 안내](https://github.com/DogOrCow/2026_CSE_Hackathon_BE#실행)
2. 프론트엔드 프로젝트 루트에서 환경 파일을 복사합니다.

   ```sh
   cp .env.example .env.local
   ```

3. `.env.local`의 `VITE_API_BASE_URL`에 팀 서버 주소를 입력합니다. 로컬에서 백엔드를 8000번 포트로 실행한다면 다음과 같이 설정합니다.

   ```dotenv
   VITE_API_BASE_URL=http://127.0.0.1:8000
   ```

4. 백엔드 `CORS_ORIGINS`에 프론트엔드 주소(예: `http://localhost:5173`)를 추가하고, 백엔드와 Vite를 다시 실행합니다. 학생은 학교 이메일로 가입하거나 로그인하고, 교수는 서버에 등록된 교수 계정으로 로그인합니다.

Railway가 로컬 브라우저 주소를 허용하지 않는 경우, 로컬 `.env.local`에서 Vite 프록시를 사용할 수 있습니다. 아래 설정으로 Vite를 다시 실행하면 개발 서버와 `npm run preview`가 프론트와 같은 주소의 `/api`를 팀 서버로 전달합니다.

```dotenv
VITE_API_BASE_URL=/api
API_PROXY_TARGET=https://api-production-f55f4175.up.railway.app
```

정적 프론트 배포에서 API에 직접 연결하려면 빌드 시 `VITE_API_BASE_URL`에 Railway 주소를 설정하고, Railway의 `CORS_ORIGINS`에 프론트 배포 주소를 추가합니다.

실제 인증 메일 발송에는 백엔드 SMTP 설정이 필요합니다. JWT 서명 키, SMTP 연결 정보, 판단 모델 키는 백엔드 환경변수에 설정합니다. 학교메일 인증은 `@knu.ac.kr` 메일을 받을 수 있는지 확인합니다. 실명과 재학 여부를 확인하려면 학교 시스템 연동이 필요합니다.

교수의 강의 추가를 사용하려면 서버에 교수 권한으로 동작하는 `POST /api/courses`가 있어야 합니다.

[백엔드 API 명세](https://github.com/DogOrCow/2026_CSE_Hackathon_BE/blob/main/docs/SPEC.md)

## 빌드와 미리보기

```sh
npm run build
npm run preview
```

빌드 결과는 `dist/`에 생성됩니다. API에 연결한 빌드가 필요하면 빌드할 때도 `VITE_API_BASE_URL`을 설정합니다.

# 익명실명 프론트엔드

경북대 컴퓨터학부 수업용 익명 질문 앱입니다. React, TypeScript, Vite를 사용합니다.

```sh
npm ci
npm run dev
npm run build
```

## 서버 연결

1. `.env.example`을 `.env.local`로 복사하고 `VITE_API_BASE_URL`에 팀 FastAPI 서버 주소를 설정합니다. 예를 들어 로컬 백엔드는 `http://127.0.0.1:8000`입니다.
2. 백엔드의 `CORS_ORIGINS`에 프론트엔드 주소를 추가한 뒤 Vite를 다시 시작합니다. 배포 빌드에도 같은 환경변수를 설정합니다.
3. 학생은 학교 이메일로 가입하거나 로그인합니다. 교수는 백엔드에 생성된 교수 계정으로 로그인합니다.

API 주소가 비어 있으면 브라우저 목업으로 실행합니다. 주소를 설정하면 이메일 코드 요청, 로그인, 과목 입장, 차시 조회와 실시간 질문이 팀 API를 사용합니다. JWT 서명 키, SMTP 계정과 앱 비밀번호, 판단 모델 키는 백엔드 환경변수에 설정합니다.

학교메일 인증은 `@knu.ac.kr` 주소로 보낸 코드를 서버에서 확인합니다. 이메일 수신은 확인할 수 있으며, 이름과 재학 상태에는 별도의 학교 인증이 필요합니다.

[백엔드 API 명세](https://github.com/DogOrCow/2026_CSE_Hackathon_BE/blob/main/docs/SPEC.md)

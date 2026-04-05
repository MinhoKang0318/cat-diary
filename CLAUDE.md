# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 로컬 개발 서버 실행 (nodemon, 자동 재시작)
npm run dev

# 프로덕션 서버 실행
npm start
```

테스트 프레임워크 없음. 로컬에서 직접 브라우저로 확인한다.

## Architecture

단일 Express 서버(`server.js`) + 정적 프론트엔드(`public/`)로 구성된 풀스택 앱.

**DB 이중화**: `DATABASE_URL` 환경변수 유무로 런타임에 DB를 결정한다.
- 로컬: Node.js 내장 `node:sqlite` (data/cat_health.db)
- 프로덕션(Vercel): `@neondatabase/serverless` (Neon PostgreSQL)

두 환경 모두 `db` 객체(`getMonth`, `getOne`, `upsert`, `remove`)로 추상화되어 라우트 코드는 동일하게 동작한다.

**API 엔드포인트**:
- `GET /api/records/:year/:month` — 월별 레코드 목록
- `GET /api/records/:date` — 단일 날짜 레코드
- `POST /api/records/:date` — 저장(upsert)
- `DELETE /api/records/:date` — 삭제

**프론트엔드(`public/app.js`)**:
- 프레임워크 없는 바닐라 JS
- `state` 객체로 앱 상태 관리, `monthCache`로 클라이언트 측 월별 캐시
- 날짜 클릭 시 API 호출 없이 캐시에서 로드
- 저장은 낙관적 업데이트(UI 먼저 반영, 백그라운드에서 서버 저장)

**배포**: Vercel 서버리스 (`vercel.json` — 모든 요청을 `server.js`로 라우팅)

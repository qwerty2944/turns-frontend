# Turns

보드게임 매칭 플랫폼. 첫 게임은 러브레터.

- 프론트: Next.js (App Router) + Phaser + React Query + Zustand + Axios — FSD 구조.
- 백엔드: **Colyseus 0.17** (`defineServer` + `@colyseus/tools`) + **Postgres** — Colyseus Cloud 표준 템플릿 기준.
- 인프라: 프론트는 Vercel, 백엔드는 Colyseus Cloud, DB는 Neon(또는 임의 Postgres).

## 구조

```
turns/
├── backend/                          # Colyseus 0.17, "type":"module"
│   ├── ecosystem.config.cjs          # PM2 (fork, NODE_ENV=production)
│   ├── tsconfig.json / tsconfig.build.json
│   └── src/
│       ├── index.ts                  # listen(app) — Cloud가 건드리지 말라는 한 줄
│       ├── app.config.ts             # defineServer({ rooms, beforeListen, express })
│       ├── shared/
│       │   ├── polyfill.ts           # Symbol.metadata (schema 4 디코레이터용)
│       │   ├── config/env.ts         # PORT, JWT_SECRET, DATABASE_URL
│       │   ├── db/index.ts           # postgres 클라이언트 + initSchema()
│       │   └── auth/{jwt,password}.ts
│       ├── entities/user/model.ts    # userRepo (async)
│       ├── features/
│       │   ├── auth/routes.ts        # /auth/signup, /auth/login, /auth/me
│       │   └── rooms/routes.ts       # /health, /games, /rooms
│       └── games/
│           ├── types.ts              # GameManifest
│           ├── registry.ts           # 새 게임 추가 지점
│           └── love-letter/{state,room,rules,index}.ts
├── frontend/                          # Next.js 16, FSD
│   └── src/{app,shared,entities,features,widgets,games}/
└── scripts/
    ├── generate-cards.mjs            # Gemini로 타로풍 카드 9장 생성
    ├── smoke-game.mjs                # 2인 매칭 기본
    └── smoke-play.mjs                # 매칭 → 라운드 1바퀴 (BGA 로그 출력)
```

## 실행 (로컬)

```sh
# 0) Postgres (macOS 예시)
brew install postgresql@16
brew services start postgresql@16
createdb turns

# 1) 카드 이미지 생성 (한 번만)
GEMINI_API_KEY=... node scripts/generate-cards.mjs

# 2) 백엔드
cd backend
npm install
DATABASE_URL=postgres://$USER@localhost:5432/turns \
JWT_SECRET=dev \
npm run dev          # tsx watch — http://localhost:2567

# 3) 프론트엔드
cd ../frontend
npm install
npm run dev          # http://localhost:3000
```

프론트 `.env.local`:

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:2567
NEXT_PUBLIC_COLYSEUS_URL=ws://localhost:2567
```

## 배포

### 백엔드 — Colyseus Cloud

1. Cloud 대시보드에서 새 앱 만들고 git 리모트 연결.
2. 환경변수 등록:
   - `JWT_SECRET` — 강한 랜덤값
   - `DATABASE_URL` — Neon/Supabase Postgres URL (`?sslmode=require` 권장)
   - `NPM_CONFIG_PRODUCTION=false` — `tsc`가 devDependency라 빌드시 필요
3. push → Cloud가 `npm install && npm run build && pm2 start ecosystem.config.cjs` 실행.
4. Cloud Starter 단일 인스턴스는 `presence`/`driver` 불필요 (자동 처리).

### DB — Neon (권장)

Vercel Marketplace에서 Neon 통합 → 연결 문자열을 Cloud의 `DATABASE_URL`로 복사.

### 프론트엔드 — Vercel

1. `frontend/` 를 root 디렉터리로 Vercel import.
2. 환경변수:
   - `NEXT_PUBLIC_BACKEND_URL=https://<app>.colyseus.cloud`
   - `NEXT_PUBLIC_COLYSEUS_URL=wss://<app>.colyseus.cloud`

## 게임 추가하기

각 게임은 슬라이스로 자급자족 — 한 폴더 추가하고 registry에 한 줄 추가하면 끝:

1. `backend/src/games/<id>/` 에 `state.ts`, `rules.ts`, `room.ts`, `index.ts`(manifest export)
2. `backend/src/games/registry.ts` 의 `GAME_REGISTRY` 에 manifest push
3. `frontend/src/games/<id>/` 에 `model/`, `scene/`, `ui/`, `index.ts`(manifest)
4. `frontend/src/entities/game/model/registry.ts` 에 manifest push

다른 게임이 등장하면 로비 게임 셀렉터에 자동 노출, 라우팅(`/play?game=<id>`)도 자동.

## 액션 로그

서버는 모든 행동(입장/턴/카드 사용/대상/추측/엿보기/탈락/라운드결과)을 `LogEntry`로 구조화해서 state에 동기화합니다. 프론트의 `ActionLog` 패널이 카드 미니어처와 함께 BGA 스타일로 표시.

# ILTA — 일타 · 할일 처치 RPG

할 일이 퀘스트가 되는 픽셀 RPG 투두 앱. 몬스터를 처치하고 세상을 밝히자.

**배포**: https://sbp37.github.io/ilta/ (GitHub Pages, `main` 푸시 시 자동 배포)

## 게임 규칙

- 할 일을 등록하면 난이도(잡몹/정예/보스)와 분류(공부·집안일·회사·건강·기타)에 따라 몬스터가 배정된다
- 처치하면 XP·골드·전리품을 얻고, 전리품은 모을수록 패시브 효과가 쌓인다
- 미루면(도망·마감 넘김·방치) 몬스터가 광폭화하고, 반복 설정(매일/평일/주 1회)도 가능
- 주간 보스 레이드 → 4주마다 챕터 보스(시즌제), 업적 20종, 펫·직업·장비·테마 수집
- 매일 "오늘의 일격" 지정, 하루 마무리 회고, 연속 처치 스트릭 + 휴식일 부적

## 개발

```bash
npm ci          # 의존성 설치 (Node 20+)
npm run dev     # 개발 서버 (Vite)
npm test        # 단위 테스트 (vitest)
npm run test:e2e # E2E 테스트 (Playwright, 브라우저 설치 필요: npx playwright install)
npm run lint    # ESLint
npm run format  # Prettier 전체 포맷
npm run build   # 타입체크 + 프로덕션 빌드
```

## 구조

- `src/game.ts` — 순수 게임 로직 (레벨·밸런스·분류·반복·챕터·업적 규칙)
- `src/store.ts` — `useGame()` 상태 훅 (localStorage 저장/마이그레이션 포함)
- `src/components/` — 화면 컴포넌트
- `public/sw.js` — 서비스 워커 (오프라인 캐시, PWA)
- `tests/` — vitest 단위 테스트 + `tests/e2e/` Playwright 스펙

데이터는 `localStorage`에 저장되며, 설정에서 JSON보내기/복원 가능.

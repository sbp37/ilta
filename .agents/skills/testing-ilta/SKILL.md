---
name: testing-ilta
description: How to set up and end-to-end test the ILTA pixel-RPG todo app (React+Vite, localStorage save)
---

# Testing ILTA (픽셀 RPG 투두 앱)

## Environment
- Node is NOT on PATH — export `~/.nvm/versions/node/v24.19.0/bin` first.
- Dev server: `npm run dev` → http://localhost:5173/ilta/ (base path `/ilta/` matters).
- Prod preview: `npm run build && npm run preview -- --port 4173` → http://localhost:4173/ilta/. Playwright e2e (`npx playwright test`) targets :4173 with `reuseExistingServer`.
- GUI browser: "Google Chrome for Testing" is on the desktop; maximize with `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.

## Seeding game state
Save lives in localStorage key `quest-do-save-v1` (GameState JSON). Seed via `browser_console` then reload — same pattern as `tests/e2e/helpers.ts#enterGame`. Always also set `quest-do-muted=1` and `ilta-install-dismissed=1` to avoid sound + install-banner noise. Useful fields: `pool`, `active`, `done`, `xp`, `gold`, `raid` (RaidState), `strike: {id, day}` where `day` uses **0-based month** (`Y-M-D`, e.g. Sep 19 → `2026-8-19`).

## Gotchas learned
- `type` action does NOT enter Korean (Hangul) text into inputs — use ASCII titles for UI-entered tasks; Korean titles via localStorage seeding work fine.
- Random "야생 몬스터 습격" modal may appear ~2.5s after game start (45% when pool non-empty); dismiss via "무시한다".
- 아침 의식 ritual modal appears on title screen only when no strike is set and pool has awake tasks; skip via "안 고르고 시작".
- Toast queue shows one toast at a time (~3-5s each) — screenshot fast or wait for later toasts.
- **Time-of-day test hazard**: achievements `nightOwl` (0–5시, +40G) and `earlyBird` (5–8시, +40G) auto-claim when seeded `done` entries land in those hours — breaks e2e gold assertions and can confuse manual gold math. When seeding `done`/`completedAt`, pick hours outside 0–8 or pre-fill `achieved`.
- Store callbacks return success via a flag set inside the `setState` updater (`let ok=false; setState(...ok=true...); return ok`) — when React defers the update the flag stays false even though state changes (observed: "지금 잡기" accepts the quest but shows "슬롯이 가득 찼습니다!"). Reproduced on dev and prod builds.
- Playwright runs: `npx playwright install chromium` needed first; raw `chromium.launch()` may hang without `--no-sandbox --disable-dev-shm-usage` on this box (and headless runs proved flaky anyway — prefer the GUI Chrome for visual evidence).

## Crash/error-boundary testing
- Save data can't crash the app once `sanitize()` runs (store.ts) — to exercise the 💥 recovery screen, simulate a storage failure instead: `Storage.prototype.setItem = () => { throw new Error('QuotaExceededError') }` via browser_console, then do any UI action that changes state — the save-write `useEffect` throws and React routes it to the ErrorBoundary. The stub is page-lifetime only; 새로고침 clears it and reloads normally.
- File inputs (settings 📂 불러오기) open a GTK dialog — use Ctrl+L then type the absolute path and Enter. Prepare test files under /tmp or ~/Downloads beforehand.

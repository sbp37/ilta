import { Locator, Page, expect } from '@playwright/test'
import type { GameState } from '../../src/game'

export const DAY = 86400000

/** 세이브를 심고 타이틀 화면을 지나 게임 안으로 들어간다. */
export async function enterGame(page: Page, save: Partial<GameState> = {}) {
  await page.goto('./')
  await page.evaluate((s) => {
    const base = {
      pool: [],
      active: [],
      done: [],
      xp: 0,
      gold: 0,
      loot: {},
      rewards: [],
      purchases: [],
      petFood: 0,
      heroName: '테스터',
      version: 2,
    }
    localStorage.setItem('quest-do-save-v1', JSON.stringify({ ...base, ...s }))
    localStorage.setItem('quest-do-muted', '1')
    localStorage.setItem('ilta-install-dismissed', '1')
  }, save)
  await page.reload()
  await expect(page.locator('.header')).toBeVisible()
}

export const toast = (page: Page) => page.locator('.toast')

/** 수집함 항목의 ··· 더보기를 연다 — 액션 버튼이 접혀 있을 때만 토글한다. */
export async function poolMore(item: Locator) {
  if ((await item.locator('.pool-act').count()) === 0) {
    await item.locator('.more-toggle').click()
  }
}

export async function gold(page: Page): Promise<number> {
  const text = (await page.locator('.gold-display').textContent()) ?? ''
  return Number(text.replace(/\D/g, ''))
}

/** 오늘 기준 n일 전 날짜의 완료 기록 하나. 낮 12시로 고정해 실행 시각(새벽 등)에 안 흔들리게 한다. */
export function doneDaysAgo(days: number, id = `d${days}`) {
  const d = new Date(Date.now() - days * DAY)
  d.setHours(12, 0, 0, 0)
  const at = d.getTime()
  return {
    id,
    title: `${days}일 전에 잡은 몹`,
    difficulty: 'slime' as const,
    minutes: 15,
    energy: 'low' as const,
    monster: 'slime',
    createdAt: at,
    completedAt: at,
    xp: 10,
  }
}

export function poolTask(over: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    title: '수집함 몹',
    difficulty: 'slime',
    minutes: 15,
    energy: 'low',
    monster: 'slime',
    createdAt: Date.now(),
    ...over,
  }
}

export function activeTask(over: Record<string, unknown> = {}) {
  const now = Date.now()
  return { ...poolTask({ id: 'a1', title: '슬롯 몹', ...over }), acceptedAt: now }
}

import { Page, expect } from '@playwright/test'
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
  await page.getByRole('button', { name: /모험 계속하기/ }).click()
  // 아침 의식(오늘의 일격 고르기)이 뜨면 건너뛴다
  await page
    .getByRole('button', { name: '안 고르고 시작' })
    .click({ timeout: 1500 })
    .catch(() => {})
  // 야생 몬스터 습격이 뜨면 닫는다 (세션당 확률 발생)
  await page
    .locator('.encounter-modal .btn-ghost')
    .click({ timeout: 3500 })
    .catch(() => {})
  await expect(page.locator('.header')).toBeVisible()
}

export const toast = (page: Page) => page.locator('.toast')

export async function gold(page: Page): Promise<number> {
  const text = (await page.locator('.gold-display').textContent()) ?? ''
  return Number(text.replace(/\D/g, ''))
}

/** 오늘 기준 n일 전 날짜의 완료 기록 하나. */
export function doneDaysAgo(days: number, id = `d${days}`) {
  const at = Date.now() - days * DAY
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

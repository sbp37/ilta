import { expect, test } from '@playwright/test'
import { activeTask, enterGame, poolTask } from './helpers'
import { localDate } from '../../src/game'
import { tomorrowDate } from '../../src/organization'

test('집중 중인 작업은 복귀 계획에서 이동되지 않는다', async ({ page }) => {
  await enterGame(page, { active: [activeTask(), activeTask({ id: 'b', title: '다른 작업' })] })
  await page.locator('.quest-card').first().getByRole('button', { name: '5분만', exact: true }).click()
  await page.getByRole('button', { name: '최소화', exact: true }).click()
  await page.getByRole('button', { name: '오늘 다시 고르기' }).click()
  await expect(page.getByLabel('슬롯 몹 배치')).toBeDisabled()
  await page.getByRole('button', { name: '집중 중인 일만 오늘에' }).click()
  await page.getByRole('button', { name: '이대로 시작' }).click()
  await expect(page.locator('.quest-card')).toHaveCount(1)
  await expect(page.locator('.timer-dock')).toBeVisible()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(saved.active[0].id).toBe('a1')
  expect(saved.pool[0].id).toBe('b')
})

test('200개 할 일을 한꺼번에 보관하고 복원한다', async ({ page }) => {
  await enterGame(page, {
    pool: Array.from({ length: 200 }, (_, index) => poolTask({ id: `q${index}`, title: `작업 ${index}` })),
  })
  await page.locator('.tab', { hasText: '수집함' }).click()
  await page.getByRole('button', { name: '여러 개 정리' }).click()
  await page.getByLabel('보이는 할 일 모두 선택').check()
  await page.getByRole('button', { name: '보관하기', exact: true }).click()
  await page.getByRole('tab', { name: '보관함 200' }).click()
  await expect(page.locator('.pool-item')).toHaveCount(200)
  await page.getByLabel('보이는 할 일 모두 선택').check()
  await page.locator('.bulk-toolbar').getByRole('button', { name: '수집함으로 복원' }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(saved.pool).toHaveLength(200)
  expect(saved.archived).toHaveLength(0)
})

test('여러 개 보관·복원과 되돌리기가 진행 내용을 보존한다', async ({ page }) => {
  await enterGame(page, {
    pool: [
      poolTask({ id: 'a', title: '보고서', subs: [{ id: 's', title: '초안', done: true, rewarded: true }] }),
      poolTask({ id: 'b', title: '운동' }),
    ],
  })
  await page.locator('.tab', { hasText: '수집함' }).click()
  await page.getByRole('button', { name: '여러 개 정리' }).click()
  await page.getByLabel('보이는 할 일 모두 선택').check()
  await page.getByRole('button', { name: '보관하기', exact: true }).click()
  await expect(page.locator('.pool-item')).toHaveCount(0)
  await page.locator('.toast-btn', { hasText: '되돌리기' }).click()
  await expect(page.locator('.pool-item')).toHaveCount(2)
  await page.getByLabel('보고서 선택').check()
  await page.getByRole('button', { name: '보관하기', exact: true }).click()
  await page.getByRole('tab', { name: '보관함 1' }).click()
  await expect(page.locator('.pool-item')).toContainText('보고서')
  await page.getByRole('button', { name: '수집함으로 복원', exact: true }).last().click()
  await page.reload()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(saved.archived).toHaveLength(0)
  expect(saved.pool.find((t: { id: string }) => t.id === 'a').subs[0].rewarded).toBe(true)
})

test('필터 밖 항목은 일괄 변경하지 않고 마감을 함께 미룬다', async ({ page }) => {
  await enterGame(page, {
    pool: [poolTask({ id: 'a', title: '보고서', due: localDate() }), poolTask({ id: 'b', title: '운동' })],
  })
  await page.locator('.tab', { hasText: '수집함' }).click()
  await page.getByRole('button', { name: '여러 개 정리' }).click()
  await page.getByLabel('보이는 할 일 모두 선택').check()
  await page.getByRole('searchbox', { name: '할 일 검색' }).fill('보고서')
  await page.getByLabel('선택한 할 일 분류').selectOption('work')
  await page.getByRole('button', { name: '분류 변경', exact: true }).click()
  await page.getByLabel('보고서 선택').check()
  await page.getByRole('button', { name: '마감도 함께 미루기' }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(saved.pool[0].due).toBe(tomorrowDate())
  expect(saved.pool[0].category).toBe('work')
  expect(saved.pool[1].category).toBeUndefined()
  expect(saved.pool[1].availableAt).toBeUndefined()
})

test('복귀 안내에서 오늘만 다시 선택하고 나머지를 보관한다', async ({ page }) => {
  await enterGame(page, {
    lastVisitedAt: Date.now() - 4 * 86400000,
    active: [activeTask()],
    pool: [poolTask()],
  })
  await expect(page.locator('.return-banner')).toBeVisible()
  await page.getByRole('button', { name: '다시 고르기', exact: true }).click()
  await page.getByLabel('슬롯 몹 배치').selectOption('archive')
  await page.getByLabel('수집함 몹 배치').selectOption('today')
  await page.getByRole('button', { name: '이대로 시작' }).click()
  await expect(page.locator('.quest-card')).toHaveCount(1)
  await expect(page.locator('.quest-card')).toContainText('수집함 몹')
  await expect(page.locator('.return-banner')).toHaveCount(0)
  await page.locator('.toast-btn', { hasText: '되돌리기' }).click()
  await expect(page.locator('.quest-card')).toContainText('슬롯 몹')
})

test('최소 목표는 권장 목표와 별도로 저장되고 보상을 중복 지급하지 않는다', async ({ page }) => {
  await enterGame(page)
  await page.locator('.settings-btn').click()
  await page.getByLabel('최소 목표', { exact: true }).fill('2')
  await page.getByLabel('하루 목표', { exact: true }).fill('5')
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.locator('.minimum-goal')).toContainText('최소 목표 0/2')
  await expect(page.locator('.goal-label')).toContainText('0/5')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).gold)).toBe(0)
})

test('정리 화면은 좁은 화면에서 넘치지 않고 키보드로 닫힌다', async ({ page }) => {
  await enterGame(page, {
    pool: [poolTask({ title: '아주긴제목으로작성한할일을화면너비에맞춰확인하기테스트' })],
  })
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    await page.getByRole('button', { name: '오늘 다시 고르기' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1')
    await page.screenshot({ path: `output/playwright/return-${width}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    await page.locator('.tab', { hasText: '수집함' }).click()
    await page.getByRole('button', { name: '여러 개 정리' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `output/playwright/bulk-${width}.png`, animations: 'disabled' })
    await page.locator('.tab', { hasText: '퀘스트' }).click()
  }
})

test('첫 설치 직후 오프라인에서 재실행해도 앱과 저장이 유지된다', async ({ page, context, browserName }) => {
  test.skip(
    browserName === 'webkit',
    'WebKit setOffline navigation fails even with a minimal static-response service worker. Real server-disconnection coverage is in offline.spec.ts.',
  )
  await enterGame(page, { active: [activeTask()] })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.quest-card')).toContainText('슬롯 몹')
  await page.getByRole('button', { name: '+ 여기에 할 일 적기', exact: true }).first().click()
  await page.locator('.slot-input').fill('오프라인 기록')
  await page.locator('.slot-input').press('Enter')
  await page.reload()
  await expect(page.locator('.quest-card', { hasText: '오프라인 기록' })).toHaveCount(1)
  await context.setOffline(false)
})

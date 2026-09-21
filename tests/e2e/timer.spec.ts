import { expect, test } from '@playwright/test'
import { activeTask, enterGame, toast } from './helpers'

test('타이머는 앱을 닫았다 열어도 이어서 흐른다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.locator('.quest-card').getByRole('button', { name: '5분만' }).click()
  await expect(page.locator('.timer-clock')).toContainText(/04:5\d/)

  await page.waitForTimeout(1200)
  await page.reload()
  await expect(page.locator('.timer-clock')).toBeVisible()
  await expect(page.locator('.timer-clock')).toContainText(/04:5[0-8]/)
})

test('화면 밖에서 시간이 다 가면 돌아올 때 정산된다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.locator('.quest-card').getByRole('button', { name: '5분만' }).click()
  await expect(page.locator('.timer-clock')).toBeVisible()

  // 시작 시각을 과거로 밀어 "앱이 꺼져 있는 동안 끝난" 상황을 만든다
  await page.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('ilta-timer') ?? '{}')
    t.startedAt = Date.now() - 400_000
    localStorage.setItem('ilta-timer', JSON.stringify(t))
  })
  await page.reload()
  await expect(page.locator('.timer-clock')).toHaveText('00:00')
  await expect(toast(page)).toContainText('5분 시작 성공')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(saved.active).toHaveLength(1)
  expect(saved.done).toHaveLength(0)
  expect(saved.focusSessions).toHaveLength(1)
  await page.reload()
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).focusSessions.length),
  ).toBe(1)
})

test('일반 집중 종료는 사용자 확인 후에만 할 일을 완료한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.getByRole('button', { name: '집중', exact: true }).click()
  await page.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('ilta-timer')!)
    t.startedAt = Date.now() - 1000_000
    localStorage.setItem('ilta-timer', JSON.stringify(t))
  })
  await page.reload()
  await expect(page.getByText('집중을 마쳤어요', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).done.length)).toBe(0)
  await page.getByRole('button', { name: '5분 더 집중' }).click()
  await expect(page.locator('.timer-clock')).toContainText(/0[45]:[0-5]\d/)
  await page.getByRole('button', { name: '할 일 완료', exact: true }).click()
  await expect(page.locator('.timer-modal')).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).done.length)).toBe(1)
})

test('일시정지·최소화·새로고침 후에도 시간과 작업을 보존한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.getByRole('button', { name: '5분만', exact: true }).click()
  await page.getByRole('button', { name: /일시정지/ }).click()
  const paused = await page.locator('.timer-clock').innerText()
  await page.getByRole('button', { name: '최소화', exact: true }).click()
  await expect(page.locator('.timer-dock')).toContainText('일시정지')
  await page.reload()
  await expect(page.locator('.timer-clock')).toHaveText(paused)
  await page.getByRole('button', { name: /다시 시작/ }).click()
  await expect(page.getByText('5분만 시작', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '집중 종료', exact: true }).click()
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).active[0].retreats ?? 0),
  ).toBe(0)
})

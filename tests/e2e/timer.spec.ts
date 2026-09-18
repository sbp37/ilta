import { expect, test } from '@playwright/test'
import { activeTask, enterGame, toast } from './helpers'

test('타이머는 앱을 닫았다 열어도 이어서 흐른다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.locator('.quest-card').getByRole('button', { name: '5분만' }).click()
  await expect(page.locator('.timer-clock')).toContainText(/04:5\d/)

  await page.waitForTimeout(1200)
  await page.reload()
  await page.getByRole('button', { name: /모험 계속하기/ }).click()
  await page
    .getByRole('button', { name: '안 고르고 시작' })
    .click({ timeout: 1500 })
    .catch(() => {})
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
  await page.getByRole('button', { name: /모험 계속하기/ }).click()
  await page
    .getByRole('button', { name: '안 고르고 시작' })
    .click({ timeout: 1500 })
    .catch(() => {})

  await expect(page.locator('.timer-clock')).toHaveCount(0)
  await expect(toast(page)).toContainText('5분 시작 성공')
})

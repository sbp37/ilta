import { expect, test } from '@playwright/test'
import { activeTask, enterGame, gold, poolTask, toast } from './helpers'

test('빈 슬롯에 바로 적으면 퀘스트가 된다', async ({ page }) => {
  await enterGame(page)
  await page.getByRole('button', { name: '+ 여기에 할 일 적기' }).first().click()
  await page.locator('.slot-input').fill('테스트 몬스터')
  await page.locator('.slot-input').press('Enter')
  await page.locator('.slot-input').press('Escape')
  await expect(page.locator('.quest-card', { hasText: '테스트 몬스터' })).toHaveCount(1)
})

test('처치한 퀘스트를 되돌리면 XP·골드까지 원상복구된다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()], gold: 200 })
  await page.locator('.quest-card').getByRole('button', { name: '처치 완료!' }).click()
  await expect(toast(page)).toContainText('처치 완료')
  await expect(page.locator('.quest-card')).toHaveCount(0)

  await page.locator('.toast-btn', { hasText: '되돌리기' }).click()
  await expect(page.locator('.quest-card', { hasText: '슬롯 몹' })).toHaveCount(1)
  expect(await gold(page)).toBe(200)
})

test('퀘스트 카드에서 제목과 난이도를 고칠 수 있다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.locator('.quest-card .edit-link').click()
  await expect(page.locator('.edit-modal')).toBeVisible()

  await page.locator('.edit-modal .edit-head input').fill('수정된 몬스터')
  await page.locator('.edit-modal .chip-diff', { hasText: '보스' }).click()
  await page.locator('.edit-modal').getByRole('button', { name: '저장' }).click()

  const card = page.locator('.quest-card', { hasText: '수정된 몬스터' })
  await expect(card).toHaveCount(1)
  await expect(card.locator('.quest-meta')).toContainText('보스')
})

test('수집함에서 삭제해도 되돌릴 수 있고, 반복도 켤 수 있다', async ({ page }) => {
  await enterGame(page, { pool: [poolTask({ title: '지울 몹' })] })
  await page.locator('.tab', { hasText: '수집함' }).click()

  await page.locator('.pool-item', { hasText: '지울 몹' }).locator('.act-del').click()
  await expect(page.locator('.pool-item', { hasText: '지울 몹' })).toHaveCount(0)
  await page.locator('.toast-btn', { hasText: '되돌리기' }).click()
  await expect(page.locator('.pool-item', { hasText: '지울 몹' })).toHaveCount(1)

  await page.locator('.pool-item').getByRole('button', { name: '수정' }).click()
  await page.locator('.edit-modal .chip', { hasText: '매일' }).click()
  await page.locator('.edit-modal').getByRole('button', { name: '저장' }).click()
  await expect(page.locator('.pool-item .repeat-tag')).toContainText('매일')
})

test('수집함 버튼은 글자 라벨이고 켜진 상태가 보인다', async ({ page }) => {
  await enterGame(page, { pool: [poolTask()] })
  await page.locator('.tab', { hasText: '수집함' }).click()

  for (const label of ['수정', '일격', '급해', '반복', '삭제']) {
    await expect(page.locator('.pool-act', { hasText: label })).toHaveCount(1)
  }
  const urgent = page.locator('.pool-act', { hasText: '급해' })
  await expect(urgent).not.toHaveClass(/act-on/)
  await urgent.click()
  await expect(urgent).toHaveClass(/act-on/)
})

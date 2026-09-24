import { expect, test } from '@playwright/test'
import { activeTask, doneDaysAgo, enterGame } from './helpers'
import { ACHIEVEMENTS, raidFor } from '../../src/game'

test('주민 의뢰를 처치하면 보상·보스·마을이 함께 진행되고 되돌릴 수 있다', async ({ page }) => {
  const raid = { ...raidFor(undefined), hp: 1 }
  await enterGame(page, {
    active: [activeTask({ title: '책상 정리하기' })],
    raid,
    achieved: ACHIEVEMENTS.map((a) => a.id),
    reducedMotion: true,
  })
  const quest = page.locator('.quest-card')
  await expect(quest.locator('.quest-title')).toHaveText('책상 정리하기')
  await expect(quest.locator('.resident-request')).toContainText('여관 주인 보리')
  await expect(quest.locator('.quest-top > .pixel-sprite')).toBeVisible()
  // Keep the five-second undo toast alive while checking the second screen.
  await page.clock.install()
  await quest.getByRole('button', { name: '처치 완료!' }).click()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await expect(page.locator('.toast')).toContainText('보리 여관 · 작은 보금자리')
  await expect(page.locator('.raid-details > summary')).toContainText('처치 완료')
  await page.getByRole('button', { name: '모험일지', exact: true }).click()
  await page.getByRole('button', { name: '마을', exact: true }).click()
  await expect(page.getByLabel('우리 마을')).toContainText('함께 해낸 일 1')
  await expect(page.getByLabel('보스 격퇴 기념 1회')).toBeVisible()
  await expect(page.getByRole('button', { name: /보리 여관.*작은 보금자리.*완료 1개/ })).toBeVisible()
  await page.locator('.toast-btn', { hasText: '되돌리기' }).click()
  await expect(page.getByLabel('우리 마을')).toContainText('함께 해낸 일 0')
  await expect(page.getByLabel('보스 격퇴 기념 0회')).toBeVisible()
  await page
    .getByRole('navigation', { name: '주 메뉴' })
    .getByRole('button', { name: /^퀘스트/ })
    .click()
  await expect(page.locator('.quest-card')).toHaveCount(1)
  await expect(page.locator('.raid-details > summary')).toContainText('HP 1/')
})

test('직접 입력·분류 수정·완료·새로고침에 주민과 성장 기록이 연결된다', async ({ page }) => {
  await enterGame(page)
  await page.getByRole('button', { name: '+ 여기에 할 일 적기', exact: true }).click()
  await page.getByRole('textbox', { name: '새 할 일' }).fill('그림 그리기')
  await page.getByRole('textbox', { name: '새 할 일' }).press('Enter')
  await page.getByRole('textbox', { name: '새 할 일' }).press('Escape')
  await expect(page.locator('.resident-request')).toContainText('라라')
  await page.locator('.quest-card .edit-link').click()
  await page.locator('.edit-modal').getByRole('button', { name: '공부', exact: true }).click()
  await page.locator('.edit-modal').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.locator('.resident-request')).toContainText('모아')
  await page.getByRole('button', { name: '처치 완료!', exact: true }).click()
  await expect(page.locator('.quest-card')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: '마을 산책', exact: true }).click()
  await expect(page.locator('.village-memories')).toContainText('그림 그리기')
  await expect(page.getByRole('button', { name: /별빛 서재.*작은 보금자리.*완료 1개/ })).toBeVisible()
})

for (const width of [320, 360, 390, 430, 1440]) {
  test(`${width}px 마을의 성장·주민 선택·기념물과 메뉴가 보인다`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 960 })
    const titles = ['공부', '보고서', '산책', '청소', '그림', '심부름']
    const counts = [15, 5, 1, 0, 5, 1]
    await enterGame(page, {
      achieved: ACHIEVEMENTS.map((a) => a.id),
      reducedMotion: true,
      done: titles.flatMap((title, r) =>
        Array.from({ length: counts[r] }, (_, i) => ({ ...doneDaysAgo(40 + i, `${r}-${i}`), title })),
      ),
      raidKills: 2,
      active: [activeTask({ title: '내가 쓴 아주 긴 공부 제목도 원래 모습 그대로 잘 보여야 한다' })],
    })
    await page.screenshot({ path: `output/playwright/village-quest-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: '마을 산책', exact: true }).click()
    await expect(page.locator('.village-place')).toHaveCount(6)
    await expect(page.getByLabel('보스 격퇴 기념 2회')).toBeVisible()
    for (const name of ['모아', '두리', '초롱', '보리', '라라', '루루']) {
      const button = page
        .locator('.village-place')
        .filter({ has: page.locator(`[aria-hidden]`) })
        .filter({ hasText: name === '모아' ? '별빛' : name })
      await button.click()
      await expect(page.locator('.resident-visit h4')).toContainText(name)
      await expect(button).toHaveAttribute('aria-pressed', 'true')
    }
    await page.getByRole('button', { name: /별빛 서재.*꽃 핀 거리/ }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `output/playwright/village-grown-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: '완료·회고', exact: true }).click()
    await expect(page.locator('.journal-records')).toBeVisible()
    expect(errors).toEqual([])
  })
}

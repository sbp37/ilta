import { expect, test } from '@playwright/test'
import { enterGame, poolTask } from './helpers'

// 좁은 화면에서 글자가 세로로 쪼개지거나 가로 스크롤이 생기지 않아야 한다
for (const width of [320, 390]) {
  test(`${width}px 화면에서 레이아웃이 깨지지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await enterGame(page, {
      pool: [
        poolTask({
          id: 'p1',
          title: '분기 보고서 초안 쓰기',
          difficulty: 'elite',
          minutes: 60,
          cost: '야근 확정',
          retreats: 2,
        }),
      ],
      gold: 500,
      loot: { potion: 2 },
      items: { calm: 1 },
    })

    const noOverflow = async (where: string) => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      expect(over, `${where} 에서 가로 스크롤이 생김`).toBe(false)
    }

    await noOverflow('퀘스트')

    await page.locator('.tab', { hasText: '수집함' }).click()
    // 제목이 0폭으로 밀리지 않아야 한다
    const titleWidth = await page.locator('.pool-item-title').evaluate((e) => e.getBoundingClientRect().width)
    expect(titleWidth).toBeGreaterThan(120)
    await noOverflow('수집함')

    await page.locator('.tab', { hasText: '상점' }).click()
    // 소모품 설명이 버튼에 밀려 0폭이 되지 않아야 한다
    const descWidth = await page
      .locator('.freeze-card .gear-desc')
      .first()
      .evaluate((e) => e.getBoundingClientRect().width)
    expect(descWidth).toBeGreaterThan(100)
    await noOverflow('상점')

    await page.locator('.tab', { hasText: '모험일지' }).click()
    await noOverflow('모험일지')
  })
}

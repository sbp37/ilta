import { expect, test } from '@playwright/test'
import { doneDaysAgo, enterGame } from './helpers'

test('긴 기록은 나눠 표시하고 전체 이력에서 검색하며 예전 집중과 회고를 찾는다', async ({ page }) => {
  const done = Array.from({ length: 90 }, (_, i) => ({ ...doneDaysAgo(i + 1, `d${i}`), title: `완료 ${i}` }))
  await enterGame(page, {
    done,
    focusSessions: Array.from({ length: 12 }, (_, i) => ({
      id: `focus-${i}`,
      questId: 'q',
      title: `집중기록 ${i}`,
      seconds: i === 0 ? 15 : 300,
      endedAt: Date.now() - (i + 1) * 86400000,
    })),
    reviews: { '2026-0-1': { win: '오래된 회고도 검색', obstacle: '어려운 문제', next: '다음 행동' } },
  })
  await page.locator('.tab', { hasText: '모험일지' }).click()
  await expect(page.locator('.journal-record')).toHaveCount(40)
  await page.getByRole('button', { name: /기록 더 보기/ }).click()
  await expect(page.locator('.journal-record')).toHaveCount(80)
  await page.getByRole('searchbox', { name: '기록 검색' }).fill('완료 89')
  await expect(page.locator('.journal-record')).toHaveCount(1)
  await expect(page.locator('.journal-record')).toContainText('완료 89')
  await page.getByRole('searchbox', { name: '기록 검색' }).fill('')
  await expect(page.locator('.journal-record')).toHaveCount(40)
  await page.getByRole('combobox', { name: '기록 종류' }).selectOption('focus')
  await expect(page.locator('.journal-record')).toHaveCount(12)
  await expect(page.locator('.journal-record').first()).toContainText('1분 미만 집중')
  await page.getByRole('combobox', { name: '기록 종류' }).selectOption('review')
  await expect(page.locator('.journal-record')).toContainText('오래된 회고도 검색')
  await page.getByRole('combobox', { name: '기록 기간' }).selectOption('custom')
  await page.getByLabel('기록 시작일').fill('2026-01-02')
  await expect(page.locator('.journal-record')).toHaveCount(0)
  await page.getByRole('button', { name: '필터 초기화' }).click()
  await expect(page.locator('.journal-record')).toHaveCount(40)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).done.length)).toBe(
    90,
  )
})

for (const width of [320, 360, 390, 430, 1440]) {
  test(`기록 검색 ${width}px 긴 내용과 기간 입력 레이아웃`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await enterGame(page, { done: [{ ...doneDaysAgo(0), title: 'LongUnbrokenTaskTitle'.repeat(15) }] })
    await page.locator('.tab', { hasText: '모험일지' }).click()
    await page.getByRole('combobox', { name: '기록 기간' }).selectOption('custom')
    const dimensions = await page
      .locator('.journal-records')
      .evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }))
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1)
    for (const control of await page.locator('.journal-filters input, .journal-filters select').all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await expect(page.locator('.journal-record')).toHaveCount(1)
    await page.getByLabel('기록 시작일').fill('2026-09-24')
    await page.getByLabel('기록 종료일').fill('2026-09-23')
    await expect(page.getByRole('alert')).toContainText('종료일은 시작일보다 빠를 수 없어요')
  })
}

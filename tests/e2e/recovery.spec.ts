import { expect, Page, test } from '@playwright/test'
import { activeTask, enterGame, poolTask } from './helpers'

async function openData(page: Page) {
  await page.getByRole('button', { name: '⚙', exact: true }).click()
  await page.getByRole('button', { name: '저장·복구', exact: true }).click()
}

async function importFile(page: Page, data: unknown, name = 'backup.json') {
  await page.locator('input[type=file]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  })
}

const imported = () => ({
  version: 2,
  heroName: '다른 기록',
  pool: [poolTask({ id: 'imported', title: '불러온 할 일' })],
  active: [],
  done: [],
  xp: 0,
})

test('파일 내용을 비교하고 취소하거나 복구하며 복구 직전 기록으로 다시 돌아온다', async ({ page }) => {
  await enterGame(page, { active: [activeTask({ title: '원래 하던 일' })] })
  await openData(page)
  await importFile(page, { app: 'ilta', data: imported() })
  const preview = page.getByRole('region', { name: '복구 미리보기' })
  await expect(preview).toContainText('다른 기록')
  await expect(preview.getByRole('row', { name: '오늘 1 0' })).toBeVisible()
  await preview.getByRole('button', { name: '취소', exact: true }).click()
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).active[0].title),
  ).toBe('원래 하던 일')
  await importFile(page, imported())
  await preview.getByRole('button', { name: '복구', exact: true }).click()
  await expect(page.locator('.modal')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.header')).toBeVisible()
  await openData(page)
  const checkpoint = page.getByRole('button', { name: /복구 직전 기록 .* 미리보기/ }).first()
  await checkpoint.click()
  await expect(preview.getByRole('row', { name: '오늘 0 1' })).toBeVisible()
  await preview.getByRole('button', { name: '복구', exact: true }).click()
  await expect(page.locator('.quest-card')).toContainText('원래 하던 일')
})

test('손상 파일과 미래 버전을 거부하고 제외되는 항목은 명시적으로 확인한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await openData(page)
  await importFile(page, { pool: [] })
  await expect(page.locator('.save-error')).toContainText('일타 저장 파일')
  await expect(page.getByRole('region', { name: '복구 미리보기' })).toHaveCount(0)
  await importFile(page, { ...imported(), version: 999 })
  await expect(page.locator('.save-error')).toContainText('새로운 버전')
  await importFile(page, { ...imported(), pool: [null, poolTask()] })
  await expect(page.getByRole('button', { name: '복구', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: /손상된 할 일 1개/ }).check()
  await expect(page.getByRole('button', { name: '복구', exact: true })).toBeEnabled()
})

test('백업 용량 실패 시 복구를 취소하고 원래 기록을 유지한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask({ title: '반드시 보존' })] })
  await openData(page)
  await importFile(page, imported())
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ilta-save-history') throw new Error('QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '복구', exact: true }).click()
  await expect(page.locator('.save-error')).toContainText('현재 기록은 유지')
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).active[0].title),
  ).toBe('반드시 보존')
})

test('미리보기 이후 다른 창의 변경을 덮어쓰지 않는다', async ({ page, context }) => {
  await enterGame(page, { active: [activeTask()] })
  await openData(page)
  await importFile(page, imported())
  const other = await context.newPage()
  await other.goto('./')
  await other.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('quest-do-save-v1')!)
    save.heroName = '다른 창의 새 기록'
    localStorage.setItem('quest-do-save-v1', JSON.stringify(save))
  })
  await page.getByRole('button', { name: '복구', exact: true }).click()
  await expect(page.locator('.save-error')).toContainText('미리보기 이후 기록이 변경')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).heroName)).toBe(
    '다른 창의 새 기록',
  )
  await importFile(page, imported())
  await page.getByRole('button', { name: '복구', exact: true }).click()
  await expect(page.locator('.save-error')).toContainText('다른 창의 최신 기록')
  await other.close()
})

test('복구 본문 저장이 실패해도 성공으로 알리지 않고 기존 내용을 유지한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask({ title: '유지할 기록' })] })
  await openData(page)
  await importFile(page, imported())
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'quest-do-save-v1') throw new Error('QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '복구', exact: true }).click()
  await expect(page.locator('.save-error')).toContainText('복구 내용을 저장하지 못했어요')
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).active[0].title),
  ).toBe('유지할 기록')
  await expect(page.getByRole('dialog', { name: '설정' })).toBeVisible()
})

test('기본 저장과 직전 백업이 손상되어도 이력에서 복구한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask({ title: '이력에 남은 할 일' })] })
  await page.evaluate(() => {
    localStorage.setItem(
      'ilta-save-history',
      JSON.stringify([
        { at: Date.now(), kind: 'before-restore', raw: localStorage.getItem('quest-do-save-v1')! },
      ]),
    )
    localStorage.setItem('quest-do-save-v1', '{broken')
    localStorage.setItem('ilta-save-backup', '{broken')
  })
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('백업 이력으로 복구')
  await expect(page.locator('.quest-card')).toContainText('이력에 남은 할 일')
  expect(await page.evaluate(() => localStorage.getItem('quest-do-save-v1'))).toBe('{broken')
})

for (const width of [320, 360, 390, 430, 1440]) {
  test(`복구 미리보기 ${width}px 긴 이름과 파일명에 가로 넘침이 없다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await enterGame(page)
    await openData(page)
    await importFile(
      page,
      { ...imported(), heroName: '매우긴이름'.repeat(20) },
      `${'longfilename'.repeat(10)}.json`,
    )
    await expect(page.getByRole('heading', { name: '복구 미리보기' })).toBeFocused()
    const sizes = await page
      .locator('.modal')
      .evaluate((el) => ({ scroll: el.scrollWidth, width: el.clientWidth }))
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1)
    for (const button of await page.locator('.restore-confirm button').all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await expect(page.getByRole('button', { name: '복구', exact: true })).toBeEnabled()
  })
}

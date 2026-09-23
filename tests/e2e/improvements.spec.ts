import { expect, test } from '@playwright/test'
import { activeTask, enterGame, poolTask } from './helpers'

test('완료 되돌리기는 그 뒤에 추가한 할 일을 보존한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.getByRole('button', { name: '처치 완료!', exact: true }).click()
  await expect(page.locator('.toast-btn', { hasText: '되돌리기' })).toBeVisible()
  await page.getByRole('button', { name: '+ 여기에 할 일 적기', exact: true }).first().click()
  await page.locator('.slot-input').fill('새로 추가한 B')
  await page.locator('.slot-input').press('Enter')
  await page.keyboard.press('Escape')
  await page.locator('.toast-btn', { hasText: '되돌리기' }).click()
  await expect(page.locator('.quest-card')).toHaveCount(2)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(saved.active.map((q: { title: string }) => q.title)).toContain('새로 추가한 B')
  expect(saved.xp).toBe(0)
  expect(saved.gold).toBe(0)
})

test('이전 완료 토스트가 다음 완료를 취소하지 않는다', async ({ page }) => {
  await enterGame(page, { active: [activeTask(), activeTask({ id: 'b', title: '다음 작업' })] })
  await page.locator('.quest-card').first().getByRole('button', { name: '처치 완료!' }).click()
  await expect(page.locator('.toast-btn', { hasText: '되돌리기' })).toBeVisible()
  await page.locator('.quest-card').first().getByRole('button', { name: '처치 완료!' }).click()
  await expect(page.locator('.quest-card')).toHaveCount(0)
  await page.locator('.toast-btn', { hasText: '되돌리기' }).click()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!).done.length)).toBe(2)
})

test('하위 단계 보상은 재체크·새로고침에도 한 번만 지급한다', async ({ page }) => {
  await enterGame(page, {
    heroClass: 'mage',
    xp: 500,
    gold: 100,
    active: [
      activeTask({
        subs: [
          { id: 's1', title: '첫 단계' },
          { id: 's2', title: '둘째 단계' },
        ],
      }),
    ],
  })
  const first = page.getByRole('checkbox', { name: /첫 단계/ })
  await first.click()
  await first.click()
  await first.click()
  await page.reload()
  await first.click()
  await first.click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(saved.xp).toBe(503)
  expect(saved.gold).toBe(103)
  await page.getByRole('checkbox', { name: /둘째 단계/ }).click()
  await expect(page.locator('.quest-card')).toHaveCount(1)
})

test('검색·분류·정렬 후 원하는 작업을 바로 시작한다', async ({ page }) => {
  await enterGame(page, {
    pool: [
      poolTask({ id: 'a', title: '보고서 정리', category: 'work' }),
      poolTask({ id: 'b', title: '책 읽기', category: 'study' }),
    ],
  })
  await page.locator('.tab', { hasText: '수집함' }).click()
  await page.getByRole('searchbox', { name: '할 일 검색' }).fill('보고서')
  await page.locator('.filter-options summary').click()
  await page.getByLabel('분류 필터').selectOption('work')
  await page.getByLabel('정렬', { exact: true }).selectOption('due')
  await expect(page.locator('.pool-item')).toHaveCount(1)
  await page.getByRole('button', { name: '바로 시작', exact: true }).click()
  await expect(page.locator('.quest-card')).toContainText('보고서 정리')
})

test('하루 목표와 회고가 저장되고 내일 일격은 오늘 기록을 보존한다', async ({ page }) => {
  const d = new Date()
  const today = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  await enterGame(page, { active: [activeTask()], pool: [poolTask()], strike: { id: 'a1', day: today } })
  await page.locator('.settings-btn').click()
  await page.getByRole('spinbutton', { name: '하루 목표' }).fill('1')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '처치 완료!', exact: true }).click()
  await expect(page.locator('.daily-goal')).toContainText('달성!')
  await page.locator('.review-btn').click()
  await page.getByLabel('오늘 잘한 일').fill('어려운 일부터 시작했다')
  await page.getByRole('button', { name: '수집함 몹', exact: true }).click()
  await page.reload()
  await expect(page.locator('.strike-banner')).toContainText('일격 달성!')
  await page.locator('.tab', { hasText: '모험일지' }).click()
  await expect(page.locator('.journal-records')).toContainText('어려운 일부터 시작했다')
})

test('저장 실패가 앱을 멈추지 않고 기록 내보내기를 제공한다', async ({ page }) => {
  await enterGame(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'quest-do-save-v1') throw new Error('QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '+ 여기에 할 일 적기', exact: true }).first().click()
  await page.locator('.slot-input').fill('저장 실패에도 남는 기록')
  await page.locator('.slot-input').press('Enter')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alert')).toContainText('기기에 저장하지 못했어요')
  await expect(page.locator('.quest-card')).toContainText('저장 실패에도 남는 기록')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '현재 기록 내보내기' }).click()
  expect((await download).suggestedFilename()).toContain('ilta-save')
})

test('손상된 기본 저장은 이전 자동 백업에서 복구한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.evaluate(() => {
    localStorage.setItem('ilta-save-backup', localStorage.getItem('quest-do-save-v1')!)
    localStorage.setItem('quest-do-save-v1', '{broken')
  })
  await page.reload()
  await expect(page.locator('.quest-card')).toContainText('슬롯 몹')
  await expect(page.getByRole('alert')).toContainText('자동 백업으로 복구')
  expect(await page.evaluate(() => localStorage.getItem('quest-do-save-v1'))).toBe('{broken')
})

test('설정 모달은 키보드 포커스를 유지하고 Escape로 닫힌다', async ({ page }) => {
  await enterGame(page)
  await page.locator('.settings-btn').click()
  const dialog = page.getByRole('dialog', { name: '설정' })
  await expect(dialog).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.settings-btn')).toBeFocused()
})

test('다른 창의 저장 변경을 감지하고 덮어쓰지 않는다', async ({ page, context }) => {
  await enterGame(page, { active: [activeTask()] })
  const other = await context.newPage()
  await other.goto('./')
  await expect(other.locator('.header')).toBeVisible()
  await expect(page.locator('.save-warning')).toHaveCount(0)
  await other.getByRole('button', { name: '+ 여기에 할 일 적기', exact: true }).first().click()
  await other.locator('.slot-input').fill('다른 창에서 추가')
  await other.locator('.slot-input').press('Enter')
  await other.keyboard.press('Escape')
  await expect(page.getByRole('alert')).toContainText('다른 창')
  await page.getByRole('button', { name: '+ 여기에 할 일 적기', exact: true }).first().click()
  await page.locator('.slot-input').fill('충돌 중 로컬 입력')
  await page.locator('.slot-input').press('Enter')
  await page.keyboard.press('Escape')
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(persisted.active.map((q: { title: string }) => q.title)).toContain('다른 창에서 추가')
  expect(persisted.active.map((q: { title: string }) => q.title)).not.toContain('충돌 중 로컬 입력')
  await expect(page.locator('.quest-card', { hasText: '충돌 중 로컬 입력' })).toHaveCount(1)
  await other.close()
})

test('처음에는 기본 이름으로 시작하고 이후 꾸미기에서 변경한다', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '모험 시작', exact: true }).click()
  await expect(page.locator('.hero-name')).toContainText('모험가')
  await expect(page.locator('.draw-btn')).toHaveCount(0)
  await page.locator('.hero-btn').click()
  await page.getByLabel('용사 이름').fill('새 용사')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.reload()
  await expect(page.locator('.hero-name')).toContainText('새 용사')
  await expect(page.getByRole('button', { name: /모험 계속하기/ })).toHaveCount(0)
})

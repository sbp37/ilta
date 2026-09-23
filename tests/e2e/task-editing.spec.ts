import { expect, test } from '@playwright/test'
import { activeTask, enterGame, poolTask } from './helpers'

test('키보드로 접힌 선택 항목을 열고 저장한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.locator('.edit-link').click()
  await page.getByLabel('마감일', { exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('.cost-settings summary')).toBeFocused()
  await page.keyboard.press('Enter')
  const cost = page.getByPlaceholder('예: 야근 확정, 상사에게 혼남…')
  await expect(cost).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(cost).toBeFocused()
  await cost.fill('마감 넘김')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.reload()
  await page.locator('.edit-link').click()
  await expect(cost).toBeVisible()
  await expect(cost).toHaveValue('마감 넘김')
})

test('탭을 왕복해도 오늘·수집함의 입력 초안과 분류·난이도가 남는다', async ({ page }) => {
  await enterGame(page)
  await page.getByRole('button', { name: '+ 여기에 할 일 적기' }).click()
  await page.getByLabel('새 할 일', { exact: true }).fill('오늘 입력 중')
  await page.locator('.tab', { hasText: '수집함' }).click()
  await page.getByPlaceholder('할 일 입력 → Enter로 계속 추가').fill('수집함 입력 중')
  await page.getByRole('button', { name: '공부', exact: true }).click()
  await page.getByRole('button', { name: /보스 \+60/ }).click()
  await page.locator('.tab', { hasText: '퀘스트' }).click()
  await expect(page.getByLabel('새 할 일', { exact: true })).toHaveValue('오늘 입력 중')
  await expect(page.locator('.quest-card')).toHaveCount(0)
  await page.locator('.tab', { hasText: '수집함' }).click()
  await expect(page.getByPlaceholder('할 일 입력 → Enter로 계속 추가')).toHaveValue('수집함 입력 중')
  await expect(page.getByRole('button', { name: '공부', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: /보스 \+60/ })).toHaveAttribute('aria-pressed', 'true')
})

test('빠른 입력은 포커스가 빠져도 등록하지 않고 추가·취소를 명확히 구분한다', async ({ page }) => {
  await enterGame(page)
  await expect(page.getByRole('button', { name: '+ 여기에 할 일 적기' })).toHaveCount(1)
  await page.getByRole('button', { name: '+ 여기에 할 일 적기' }).click()
  await page.getByLabel('새 할 일', { exact: true }).fill('아직 작성 중')
  await page.locator('.game-title').click()
  await expect(page.locator('.quest-card')).toHaveCount(0)
  await expect(page.getByLabel('새 할 일', { exact: true })).toHaveValue('아직 작성 중')
  await page.locator('.slot-actions').getByRole('button', { name: '취소' }).click()
  await expect(page.locator('.quest-card')).toHaveCount(0)
  await page.getByRole('button', { name: '+ 여기에 할 일 적기' }).click()
  await page.getByLabel('새 할 일', { exact: true }).fill('버튼으로 등록')
  await page.locator('.slot-actions').getByRole('button', { name: '추가' }).click()
  await expect(page.locator('.quest-card')).toContainText('버튼으로 등록')
  await expect(page.getByLabel('새 할 일', { exact: true })).toBeFocused()
  await page.reload()
  await expect(page.locator('.quest-card')).toHaveCount(1)
})

test('슬롯이 꽉 차도 입력을 이어서 수집함에 보관한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask(), activeTask({ id: 'b' }), activeTask({ id: 'c' })] })
  await page.getByRole('button', { name: '+ 수집함에 할 일 적기' }).click()
  await page.getByLabel('새 할 일', { exact: true }).fill('나중에 할 일')
  await page.locator('.slot-input').press('Enter')
  await expect(page.locator('.quest-card')).toHaveCount(3)
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(save.pool.map((task: { title: string }) => task.title)).toEqual(['나중에 할 일'])
})

test('등록할 때 마감·반복·단계를 함께 저장하고 대기 입력을 비운다', async ({ page }) => {
  await enterGame(page)
  await page.locator('.tab', { hasText: '수집함' }).click()
  const quickInput = page.getByPlaceholder('할 일 입력 → Enter로 계속 추가')
  await quickInput.fill('주간 보고서')
  await page.getByRole('button', { name: '상세 입력' }).click()
  const dialog = page.getByRole('dialog', { name: '할 일 추가' })
  await expect(dialog.getByLabel('할 일 이름')).toHaveValue('주간 보고서')
  const preview = await dialog.locator('.edit-head .pixel-sprite').innerHTML()
  await dialog.getByLabel('할 일 이름').fill('주간 보고서 수정')
  expect(await dialog.locator('.edit-head .pixel-sprite').innerHTML()).toBe(preview)
  await dialog.getByLabel('할 일 이름').fill('주간 보고서')
  await dialog.getByLabel('마감일', { exact: true }).fill('2027-01-15')
  await dialog.getByRole('button', { name: '주 1회', exact: true }).click()
  await dialog.getByLabel('새 단계', { exact: true }).fill('자료 수집')
  await dialog.getByRole('button', { name: '단계 추가', exact: true }).click()
  await dialog.getByLabel('새 단계', { exact: true }).fill('초안 쓰기')
  await dialog.getByRole('button', { name: '추가', exact: true }).click()
  await expect(quickInput).toHaveValue('')
  await expect(page.locator('.pool-item')).toHaveCount(1)
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(save.pool[0]).toMatchObject({ title: '주간 보고서', due: '2027-01-15', repeat: 'weekly' })
  expect(save.pool[0].subs.map((s: { title: string }) => s.title)).toEqual(['자료 수집', '초안 쓰기'])
})

test('단계 수정·삭제는 보상과 체크를 보존하며 전체 수정을 되돌릴 수 있다', async ({ page }) => {
  await enterGame(page, {
    heroClass: 'mage',
    xp: 500,
    gold: 100,
    active: [
      activeTask({
        subs: [
          { id: 's1', title: '완료한 단계', done: true, rewarded: true },
          { id: 's2', title: '뺄 단계' },
        ],
      }),
    ],
  })
  await page.locator('.edit-link').click()
  await page.getByLabel('단계 1', { exact: true }).fill('고친 단계')
  await page.getByRole('button', { name: '단계 2 삭제' }).click()
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /고친 단계/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /뺄 단계/ })).toHaveCount(0)
  await page.getByRole('button', { name: '되돌리기', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /완료한 단계/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /뺄 단계/ })).toHaveCount(1)
  await page.locator('.edit-link').click()
  await page.getByLabel('단계 1', { exact: true }).fill('이름만 수정')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.reload()
  const checked = page.getByRole('checkbox', { name: /이름만 수정/ })
  await checked.click()
  await checked.click()
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(save.xp).toBe(500)
  expect(save.gold).toBe(100)
})

test('수정 중 Escape나 배경 클릭으로 내용을 잃지 않고 명시적으로 버릴 수 있다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.locator('.edit-link').click()
  await page.getByLabel('할 일 이름').fill('저장하지 않은 제목')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alert')).toContainText('변경을 버릴까요')
  await expect(page.locator('.edit-discard')).toBeFocused()
  await page.getByRole('button', { name: '계속 편집' }).click()
  await expect(page.getByLabel('할 일 이름')).toHaveValue('저장하지 않은 제목')
  await page.locator('.modal-backdrop').click({ position: { x: 2, y: 2 } })
  await page.getByRole('button', { name: '변경 버리기' }).click()
  await expect(page.locator('.quest-card')).toContainText('슬롯 몹')
  await expect(page.locator('.edit-link')).toBeFocused()
})

test('빈 단계는 오류로 안내하고 입력 중인 새 단계는 저장 때 함께 반영한다', async ({ page }) => {
  await enterGame(page, { pool: [poolTask({ subs: [{ id: 's1', title: '초안' }] })] })
  await page.locator('.tab', { hasText: '수집함' }).click()
  await page.locator('.more-toggle').click()
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await page.getByLabel('단계 1', { exact: true }).fill('  ')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('빈 단계')
  await page.getByLabel('단계 1', { exact: true }).fill('완성')
  await page.getByLabel('새 단계', { exact: true }).fill('검토')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.getByRole('button', { name: '바로 시작', exact: true }).click()
  await expect(page.getByRole('checkbox')).toHaveCount(2)
  await expect(page.getByRole('checkbox', { name: /검토/ })).toBeVisible()
})

test('나중에 하기로 이동할 때 진행 중이던 집중 시간을 기록한다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.getByRole('button', { name: '집중', exact: true }).click()
  await page.evaluate(() => {
    const timer = JSON.parse(localStorage.getItem('ilta-timer')!)
    timer.startedAt = Date.now() - 125_000
    localStorage.setItem('ilta-timer', JSON.stringify(timer))
  })
  await page.reload()
  await page.getByRole('button', { name: '최소화', exact: true }).click()
  await page.locator('.quest-card .more-btn').click()
  await page.getByRole('button', { name: '나중에 하기', exact: true }).click()
  await expect(page.locator('.quest-card')).toHaveCount(0)
  await expect(page.locator('.timer-dock')).toHaveCount(0)
  await page.reload()
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1')!))
  expect(save.focusSessions).toHaveLength(1)
  expect(save.focusSessions[0].seconds).toBeGreaterThanOrEqual(125)
  expect(save.pool[0].id).toBe('a1')
  expect(save.done).toHaveLength(0)
})

for (const width of [360, 390, 430, 1440]) {
  test(`${width}px에서 할 일을 보스보다 먼저 보여주고 단계 편집이 넘치지 않는다`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 850 })
    await enterGame(page, {
      active: [
        activeTask({
          title: '긴 제목으로 오늘 해야 하는 가장 중요한 작업을 확인하기',
          difficulty: 'boss',
          subs: [{ id: 's', title: '한글과LongUnbrokenTaskTitleWithoutSpaces' }],
        }),
      ],
      raid: { key: 'x', hp: 275, max: 300 },
    })
    const quest = await page.locator('.quest-card').boundingBox()
    const raid = await page.locator('.raid-panel').boundingBox()
    expect(quest!.y).toBeLessThan(raid!.y)
    await page.screenshot({ path: `output/playwright/88-board-${width}.png`, animations: 'disabled' })
    await page.locator('.quest-card .edit-link').click()
    await page.getByLabel('단계 1', { exact: true }).fill('오타를 수정한 긴 하위 단계 이름')
    await page.getByLabel('새 단계', { exact: true }).fill('새로운 단계')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const selector of ['.step-editor-row .icon-btn', '.edit-footer .btn']) {
      const sizes = await page.locator(selector).evaluateAll((els) =>
        els.map((el) => {
          const { width, height } = el.getBoundingClientRect()
          return { width, height }
        }),
      )
      expect(sizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true)
    }
    await page.screenshot({ path: `output/playwright/88-edit-${width}.png`, animations: 'disabled' })
    await page.setViewportSize({ width, height: 420 })
    await page.getByRole('button', { name: '저장', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: /새로운 단계/ })).toHaveCount(1)
    const addButton = await page.locator('.sub-add .icon-btn').boundingBox()
    expect(addButton!.width).toBeGreaterThanOrEqual(44)
    expect(addButton!.height).toBeGreaterThanOrEqual(44)
    expect(errors).toEqual([])
  })
}

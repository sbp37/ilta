import { expect, test } from '@playwright/test'
import { activeTask, doneDaysAgo, enterGame, gold, poolMore, poolTask, toast } from './helpers'

test('소모품을 사고 XP 포션을 쓰면 다음 처치 XP가 1.5배가 된다', async ({ page }) => {
  // 크리티컬(15%)이 터지면 +15XP가 아니라 +23XP가 뜬다 — Math.random을 크리트 불가 값으로 고정
  await page.addInitScript(() => {
    let i = 0
    const vals = [0.9, 0.8, 0.7, 0.6]
    Math.random = () => vals[i++ % vals.length]
  })
  await enterGame(page, { active: [activeTask()], gold: 500 })
  await page.locator('.tab', { hasText: '상점' }).click()

  const potion = page.locator('.freeze-card', { hasText: 'XP 포션' })
  await potion.locator('.btn-gold').click()
  await expect(toast(page)).toContainText('XP 포션')
  expect(await gold(page)).toBe(460)

  await potion.getByRole('button', { name: '사용' }).click()
  await expect(page.locator('.boost-badge')).toBeVisible()

  await page.locator('.tab', { hasText: '퀘스트' }).click()
  await page.locator('.quest-card').getByRole('button', { name: '처치 완료!' }).click()
  await expect(toast(page)).toContainText('+15XP') // 잡몹 10XP × 1.5
  await expect(page.locator('.boost-badge')).toHaveCount(0)
})

test('진정의 향은 광폭한 몹만 진정시킨다', async ({ page }) => {
  await enterGame(page, {
    pool: [poolTask({ retreats: 2, title: '광폭 몹' })],
    items: { calm: 1 },
    gentle: false,
  })
  await page
    .locator('.encounter-modal .btn-ghost')
    .click({ timeout: 3500 })
    .catch(() => {})
  await page.locator('.tab', { hasText: '수집함' }).click()
  await expect(page.locator('.pool-item.pool-enraged')).toHaveCount(1)

  await poolMore(page.locator('.pool-item.pool-enraged'))
  await page.locator('.act-calm').click()
  await expect(page.locator('.pool-item.pool-enraged')).toHaveCount(0)
  await expect(page.locator('.act-calm')).toHaveCount(0)
})

test('무료 리롤을 다 쓰면 다시뽑기권으로 한 번 더 뽑는다', async ({ page }) => {
  await enterGame(page, {
    pool: [poolTask({ id: 'p1' }), poolTask({ id: 'p2', title: '수집함 몹2' })],
    items: { reroll: 1 },
  })
  await page.locator('.draw-btn').click()
  await expect(page.locator('.reveal-box')).toBeVisible()

  await page
    .locator('.modal')
    .getByRole('button', { name: /다시 뽑기 \(1회\)/ })
    .click()
  await expect(page.locator('.modal').getByRole('button', { name: /뽑기권 사용 \(1\)/ })).toBeVisible()
  await page
    .locator('.modal')
    .getByRole('button', { name: /뽑기권 사용 \(1\)/ })
    .click()
  await expect(page.locator('.modal').getByRole('button', { name: /다시 뽑기 \(0회\)/ })).toBeVisible()
})

test('휴식일 부적은 빈 날이 생기면 자동으로 쓰여 연속 기록을 지킨다', async ({ page }) => {
  // 그저께까지만 처치 → 어제가 빈 날.
  // achieved 를 미리 채워 업적 보상 골드가 계산에 섞이지 않게 한다
  await enterGame(page, { done: [doneDaysAgo(2)], gold: 100, achieved: ['first'] })
  await page.locator('.tab', { hasText: '상점' }).click()
  await page.locator('.freeze-card', { hasText: '휴식일 부적' }).locator('.btn-gold').click()
  await expect(page.locator('.freeze-badge')).toContainText('1')
  expect(await gold(page)).toBe(40)

  await page.reload()

  await expect(toast(page)).toContainText('휴식일 부적')
  await expect(page.locator('.streak-badge')).toContainText('2일')
  await expect(page.locator('.freeze-badge')).toHaveCount(0)
})

test('레벨이 오르면 골드와 해금을 알려주고 슬롯이 늘어난다', async ({ page }) => {
  // 750XP = 7레벨, 잡몹 하나 더 잡으면 8레벨
  await enterGame(page, { active: [activeTask()], xp: 750 })
  await expect(page.locator('.empty-slot')).toHaveCount(2) // 3슬롯 중 1개 사용

  await page.locator('.quest-card').getByRole('button', { name: '처치 완료!' }).click()
  await expect(toast(page)).toContainText('LEVEL UP! Lv.8')
  await expect(toast(page)).toContainText('+80G')
  await expect(toast(page)).toContainText('슬롯 4개')
  await expect(page.locator('.empty-slot')).toHaveCount(4)
})

test('잠긴 장비와 테마는 해금 레벨을 알려준다', async ({ page }) => {
  await enterGame(page, { gold: 500 })
  await page.locator('.tab', { hasText: '상점' }).click()
  await expect(page.locator('.gear-card.gear-locked')).toHaveCount(3)

  await page.locator('.settings-btn').click()
  await expect(page.locator('.chip-locked')).toHaveCount(4)
  await page.locator('.chip-locked').first().click()
  await expect(toast(page)).toContainText('Lv.3')
})

test('빨간 포션 5개가 모이면 XP 포션으로 바뀐다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()], loot: { potion: 5 } })
  await page.locator('.quest-card').getByRole('button', { name: '처치 완료!' }).click()
  await expect(toast(page)).toContainText('XP 포션!')

  const items = await page.evaluate(() => JSON.parse(localStorage.getItem('quest-do-save-v1') ?? '{}').items)
  expect(items.xppotion).toBe(1)
})

test('모험일지 전리품 효과표가 전부 보인다', async ({ page }) => {
  await enterGame(page, { done: [doneDaysAgo(0)], loot: { potion: 2, gem: 1 } })
  await page.locator('.tab', { hasText: '모험일지' }).click()
  await page.getByRole('button', { name: '수집', exact: true }).click()
  await expect(page.locator('.loot-effect-row')).toHaveCount(6)
  await expect(page.locator('.loot-effect-row').first()).toContainText('x2')
  await expect(page.locator('.loot-row-locked').first()).toContainText('미획득')
})

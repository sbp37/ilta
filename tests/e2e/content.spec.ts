import { expect, test } from '@playwright/test'
import { activeTask, doneDaysAgo, enterGame, gold, poolMore, poolTask, toast } from './helpers'

test('분류를 고르면 전담 몬스터가 붙고 수집함에 분류가 보인다', async ({ page }) => {
  await enterGame(page)
  await page.locator('.tab', { hasText: '수집함' }).click()

  await page.locator('.quick-add-row .text-input').fill('영어 단어 외우기')
  await page.locator('.cat-chip', { hasText: '공부' }).click()
  await page.getByRole('button', { name: '넣기' }).click()

  const item = page.locator('.pool-item', { hasText: '영어 단어 외우기' })
  await expect(item).toHaveCount(1)
  await expect(item.locator('.quest-meta')).toContainText('공부')

  const monster = await page.evaluate(
    () => JSON.parse(localStorage.getItem('quest-do-save-v1') ?? '{}').pool[0].monster,
  )
  expect(monster).toBe('mushroom') // 공부 + 잡몹
})

test('반복 종류를 고르면 라벨이 바뀐다', async ({ page }) => {
  await enterGame(page, { pool: [poolTask()] })
  await page.locator('.tab', { hasText: '수집함' }).click()

  await poolMore(page.locator('.pool-item'))
  await page.locator('.pool-act', { hasText: '수정' }).click()
  await page.locator('.edit-modal .chip', { hasText: '평일만' }).click()
  await page.locator('.edit-modal').getByRole('button', { name: '저장' }).click()

  await expect(page.locator('.pool-item .repeat-tag')).toContainText('평일만')
})

test('반복 몹은 처치 후 대기 상태로 리스폰되고 뽑기에서 빠진다', async ({ page }) => {
  await enterGame(page, { active: [activeTask({ repeat: 'daily' })] })
  await page.locator('.quest-card').getByRole('button', { name: '처치 완료!' }).click()
  await expect(toast(page)).toContainText('처치 완료')

  await page.locator('.tab', { hasText: '수집함' }).click()
  const item = page.locator('.pool-item', { hasText: '슬롯 몹' })
  await expect(item).toHaveCount(1)
  await expect(item.locator('.sleep-line')).toContainText('다시 나타남')
  // 잠든 몹은 일격으로 지정할 수 없다
  await poolMore(item)
  await expect(item.locator('.pool-act', { hasText: '일격' })).toBeDisabled()

  // 뽑기에도 후보가 없다 — 잠든 몹은 랜덤 뽑기에서 빠진다
  await page.locator('.tab', { hasText: '퀘스트' }).click()
  await page.locator('.draw-btn').click()
  await expect(page.locator('.modal')).toContainText('깨어있는 몬스터가 없어요')
})

test('업적을 달성하면 골드와 함께 알려준다', async ({ page }) => {
  await enterGame(page, { active: [activeTask()] })
  await page.locator('.quest-card').getByRole('button', { name: '처치 완료!' }).click()
  // 처치 결과를 먼저 보여주고, 그 뒤에 업적 알림이 온다
  await expect(toast(page)).toContainText('처치 완료')
  await expect(toast(page)).toContainText('업적 달성', { timeout: 8000 })
  await expect(toast(page)).toContainText('첫 발걸음')

  // 처치 보상(크리티컬 여부에 따라 10~15G) + 업적 20G
  expect(await gold(page)).toBeGreaterThanOrEqual(30)
  const achieved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('quest-do-save-v1') ?? '{}').achieved,
  )
  expect(achieved).toContain('first')

  await page.locator('.tab', { hasText: '모험일지' }).click()
  await page.getByRole('button', { name: '수집', exact: true }).click()
  await expect(page.locator('.ach-row').first()).not.toHaveClass(/ach-locked/)
  await expect(page.locator('.ach-row').first()).toContainText('완료')
})

test('이미 받은 업적은 다시 주지 않는다', async ({ page }) => {
  // 시간대 업적도 미리 받은 걸로 심는다 — 새벽 실행 때 live 처치가 '새벽의 용사'를 따내면 골드 단언이 깨진다
  const preAchieved = ['first', 'nightOwl', 'earlyBird']
  await enterGame(page, {
    active: [activeTask()],
    done: [doneDaysAgo(3)],
    achieved: preAchieved,
    gold: 100,
  })
  await page.locator('.quest-card').getByRole('button', { name: '처치 완료!' }).click()
  await expect(toast(page)).toContainText('처치 완료')
  await expect(toast(page)).not.toContainText('업적 달성')
  // 업적 20G 가 다시 붙지 않았는지 (처치 보상만)
  expect(await gold(page)).toBeLessThan(130)
  const achieved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('quest-do-save-v1') ?? '{}').achieved,
  )
  expect(achieved).toEqual(preAchieved)
})

test('모험일지에 분류 통계와 챕터 진행이 보인다', async ({ page }) => {
  await enterGame(page, {
    done: [
      { ...doneDaysAgo(0, 'k1'), category: 'study' },
      { ...doneDaysAgo(0, 'k2'), category: 'study' },
      { ...doneDaysAgo(1, 'k3'), category: 'home' },
    ],
  })
  await page.locator('.tab', { hasText: '모험일지' }).click()
  await page.getByRole('button', { name: '통계', exact: true }).click()
  await expect(page.locator('.cat-seg')).toHaveCount(2)
  await expect(page.locator('.cat-legend')).toContainText('공부 2')
  await expect(page.locator('.cat-legend')).toContainText('집안일 1')
  await page.getByRole('button', { name: '수집', exact: true }).click()

  await expect(page.locator('.chapter-card')).toContainText('챕터')
  await expect(page.locator('.chapter-week')).toHaveCount(4)
  await expect(page.locator('.chapter-week.week-now')).toHaveCount(1)
})

test('퀘스트 탭 보스 패널에 챕터 정보가 보인다', async ({ page }) => {
  await enterGame(page, { raid: { key: 'x', hp: 100, max: 300 } })
  await expect(page.locator('.raid-panel')).toContainText('챕터')
  await expect(page.locator('.chapter-line')).toContainText('주차')
})

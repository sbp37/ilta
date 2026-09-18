import { beforeEach, describe, expect, it } from 'vitest'
import { migrate } from '../src/store'
import { GameState, SAVE_VERSION, levelOf } from '../src/game'

// 옛 세이브 흉내 — 버전 필드가 없던 시절
const oldSave = (xp: number): GameState =>
  ({
    pool: [],
    active: [],
    done: [],
    xp,
    gold: 50,
    loot: {},
    rewards: [],
    purchases: [],
    petFood: 0,
  }) as GameState

beforeEach(() => {
  // migrate 는 localStorage 를 쓰지 않지만, store 가 불릴 때 필요할 수 있어 준비
  if (typeof localStorage === 'undefined') {
    // @ts-expect-error 테스트용 최소 구현
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }
})

describe('저장 데이터 마이그레이션', () => {
  it('버전이 없는 세이브도 현재 버전으로 올라간다', () => {
    expect(migrate(oldSave(0)).version).toBe(SAVE_VERSION)
  })

  it('레벨 커브가 바뀌어도 기존 레벨은 내려가지 않는다', () => {
    // 옛 계산: floor(xp/100)+1
    for (const xp of [0, 99, 100, 500, 1000, 2500, 9999]) {
      const oldLevel = Math.floor(xp / 100) + 1
      const after = migrate(oldSave(xp))
      expect(levelOf(after.xp)).toBe(oldLevel)
      expect(after.xp).toBeGreaterThanOrEqual(xp) // XP를 깎지는 않는다
    }
  })

  it('이미 최신 버전이면 XP를 건드리지 않는다', () => {
    const cur = { ...oldSave(1000), version: SAVE_VERSION }
    expect(migrate(cur).xp).toBe(1000)
  })

  it('두 번 돌려도 결과가 같다', () => {
    const once = migrate(oldSave(1000))
    expect(migrate(once)).toEqual(once)
  })

  it('빠진 필드는 기본값으로 채워진다', () => {
    const s = migrate({ pool: [], active: [], done: [], xp: 0 } as unknown as GameState)
    expect(s.gold).toBe(0)
    expect(s.loot).toEqual({})
    expect(s.rewards).toEqual([])
    expect(s.petFood).toBe(0)
  })
})

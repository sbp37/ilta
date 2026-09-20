import { beforeEach, describe, expect, it } from 'vitest'
import { sanitize } from '../src/store'

beforeEach(() => {
  if (typeof localStorage === 'undefined') {
    // @ts-expect-error 테스트용 최소 구현
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }
})

const task = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  title: '할 일',
  difficulty: 'slime',
  minutes: 15,
  energy: 'low',
  createdAt: 1,
  ...over,
})

const save = (over: Record<string, unknown> = {}) => ({
  version: 2,
  pool: [],
  active: [],
  done: [],
  xp: 0,
  gold: 0,
  loot: {},
  rewards: [],
  purchases: [],
  petFood: 0,
  ...over,
})

describe('세이브 정제 (sanitize)', () => {
  it('객체가 아니면 빈 상태로 돌아간다', () => {
    expect(sanitize(null).pool).toEqual([])
    expect(sanitize('junk').pool).toEqual([])
    expect(sanitize(42).xp).toBe(0)
  })

  it('잘못된 category/difficulty/energy는 버리거나 기본값으로 — 렌더 크래시 방지', () => {
    const s = sanitize(save({ pool: [task({ category: '집안일' }), task({ id: 't2', category: 'home' })] }))
    expect(s.pool[0].category).toBeUndefined()
    expect(s.pool[1].category).toBe('home')

    const bad = sanitize(save({ pool: [task({ difficulty: 'hell', energy: 'zzz' })] }))
    expect(bad.pool[0].difficulty).toBe('slime')
    expect(bad.pool[0].energy).toBe('low')
  })

  it('스프라이트 없는 몬스터는 버린다', () => {
    const s = sanitize(save({ pool: [task({ monster: 'nonexistent' })] }))
    expect(s.pool[0].monster).toBeUndefined()
    expect(sanitize(save({ pool: [task({ monster: 'slime' })] })).pool[0].monster).toBe('slime')
  })

  it('title 없는 태스크는 항목째로 버린다', () => {
    const s = sanitize(save({ pool: [task(), { title: 5 }, null, task({ id: 't9' })] }))
    expect(s.pool.map((t) => t.id)).toEqual(['t1', 't9'])
  })

  it('깨진 숫자·배열 필드는 기본값으로 돌아간다', () => {
    const s = sanitize(save({ xp: NaN, gold: -5, loot: 'x', pool: 'nope' }) as never)
    expect(s.xp).toBe(0)
    expect(s.gold).toBe(0)
    expect(s.loot).toEqual({})
    expect(s.pool).toEqual([])
  })

  it('유효하지 않은 직업/테마는 버린다', () => {
    const s = sanitize(save({ heroClass: 'knight', theme: 'rainbow' }))
    expect(s.heroClass).toBeUndefined()
    expect(s.theme).toBeUndefined()
    const ok = sanitize(save({ heroClass: 'mage', theme: 'forest' }))
    expect(ok.heroClass).toBe('mage')
    expect(ok.theme).toBe('forest')
  })

  it('active/done 태스크는 필수 타임스탬프를 채운다', () => {
    const s = sanitize(save({ active: [task()], done: [task({ id: 't2' })] }))
    expect(s.active[0].acceptedAt).toBeGreaterThan(0)
    expect(s.done[0].completedAt).toBeGreaterThan(0)
  })
})

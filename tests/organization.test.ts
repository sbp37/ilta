import { describe, expect, it } from 'vitest'
import { GameState, Task, minimumGoalOf, monsterFor, todayKey } from '../src/game'
import { applyReturnPlan, organizeTasks, tomorrowDate } from '../src/organization'
import { revertChange } from '../src/undo'
import { sanitize } from '../src/store'

const now = new Date(2026, 8, 21, 12).getTime()
const task = (id: string): Task => ({
  id,
  title: id,
  createdAt: now,
  difficulty: 'slime',
  energy: 'low',
  minutes: 15,
  subs: [{ id: 'sub', title: 'step', done: true, rewarded: true }],
})
const state = (): GameState => ({
  pool: [task('a'), task('b')],
  active: [],
  done: [],
  xp: 0,
  gold: 100,
  loot: {},
  rewards: [],
  purchases: [],
  petFood: 0,
  strike: { id: 'a', day: todayKey(now) },
})

describe('task organization', () => {
  it('bulk categories use the same monster mapping as individual edits', () => {
    const after = organizeTasks(state(), ['a'], { type: 'category', category: 'work' }, now)
    expect(after.pool[0].monster).toBe(monsterFor('slime', 'work'))
    expect(after.pool[1].category).toBeUndefined()
  })
  it('archives reversibly without losing progress or changing rewards', () => {
    const before = state()
    const after = organizeTasks(before, ['a'], { type: 'archive' }, now)
    expect(after.pool.map((t) => t.id)).toEqual(['b'])
    expect(after.archived).toEqual([task('a')])
    expect(after.strike).toBeUndefined()
    expect(after.gold).toBe(100)
    const restored = organizeTasks(after, ['a'], { type: 'restore' }, now)
    expect(restored.pool[1].subs?.[0].rewarded).toBe(true)
    expect(sanitize(after).archived).toHaveLength(1)
  })
  it('undo preserves an independently added task', () => {
    const before = state()
    const after = organizeTasks(before, ['a'], { type: 'archive' }, now)
    const undone = revertChange(
      { ...after, pool: [...after.pool, task('c')] },
      { id: 'action', before, after },
    )
    expect(undone?.pool.map((t) => t.id)).toEqual(['a', 'b', 'c'])
    expect(undone?.archived).toEqual([])
  })
  it('moves deadline and availability together without resetting repetition or subtask reward', () => {
    const before = state()
    before.pool[0] = { ...before.pool[0], due: '2026-09-20', repeat: 'daily' }
    const after = organizeTasks(before, ['a'], { type: 'postpone', date: tomorrowDate(now) }, now)
    expect(after.pool[0]).toMatchObject({ due: '2026-09-22', repeat: 'daily', subs: before.pool[0].subs })
    expect(after.pool[0].availableAt).toBe(new Date(2026, 8, 22).getTime())
    expect(organizeTasks(before, ['a'], { type: 'postpone', date: 'invalid' }, now)).toBe(before)
  })
  it('applies a return plan atomically and preserves active progress', () => {
    const before = state()
    before.active = [{ ...task('c'), acceptedAt: now - 1000 }]
    const after = applyReturnPlan(before, { a: 'today', b: 'archive', c: 'tomorrow' }, now)!
    expect(after.active.map((t) => t.id)).toEqual(['a'])
    expect(after.pool[0].id).toBe('c')
    expect(after.pool[0].subs?.[0].done).toBe(true)
    expect(after.archived?.[0].id).toBe('b')
    expect(after.gold).toBe(before.gold)
  })
  it('refuses too many today tasks or a sleeping task', () => {
    const before = state()
    before.pool = ['a', 'b', 'c', 'd'].map(task)
    expect(
      applyReturnPlan(before, Object.fromEntries(before.pool.map((t) => [t.id, 'today'])), now),
    ).toBeNull()
    before.pool[0].availableAt = now + 86400000
    expect(applyReturnPlan(before, { a: 'today' }, now)).toBeNull()
  })
  it('bounds minimum goals and migrates old saves to one', () => {
    expect(minimumGoalOf({ ...state(), dailyGoal: 3, minimumGoal: 9 })).toBe(3)
    expect(sanitize(state()).minimumGoal).toBe(1)
  })
})

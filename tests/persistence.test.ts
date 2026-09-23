import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKUP_KEY,
  HISTORY_KEY,
  SAVE_KEY,
  checkpoint,
  preservePrevious,
  readHistory,
  readSave,
} from '../src/persistence'
import { inspectSave } from '../src/store'

const save = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ version: 2, pool: [], active: [], done: [], xp: 0, ...over })
const task = {
  id: 'task',
  title: 'Existing work',
  difficulty: 'slime',
  minutes: 15,
  energy: 'low',
  createdAt: 1,
}
let values: Map<string, string>
const day = (offset: number) => new Date(2026, 8, 23 + offset, 12).getTime()

beforeEach(() => {
  values = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('durable local backup history', () => {
  it('keeps the first snapshot of a local day across later edits', () => {
    checkpoint(save({ xp: 1 }), 'automatic', day(0))
    checkpoint(save({ xp: 2 }), 'automatic', day(0) + 1000)
    checkpoint(save({ xp: 3 }), 'automatic', day(1))
    expect(readHistory().map((s) => JSON.parse(s.raw).xp)).toEqual([3, 1])
  })

  it('keeps six daily snapshots and two replacement checkpoints independently', () => {
    checkpoint(save({ xp: 100 }), 'before-restore', day(0))
    checkpoint(save({ xp: 101 }), 'before-restore', day(1))
    for (let i = 0; i < 12; i++) checkpoint(save({ xp: i }), 'automatic', day(i))
    const history = readHistory()
    expect(history).toHaveLength(8)
    expect(history.filter((s) => s.kind === 'before-restore').map((s) => JSON.parse(s.raw).xp)).toEqual([
      101, 100,
    ])
    checkpoint(save({ xp: 102 }), 'before-restore', day(13))
    expect(
      readHistory()
        .filter((s) => s.kind === 'before-restore')
        .map((s) => JSON.parse(s.raw).xp),
    ).toEqual([102, 101])
  })

  it('deduplicates snapshots and enforces its serialized size budget', () => {
    checkpoint(save({ xp: 1 }), 'automatic', day(0))
    checkpoint(save({ xp: 1 }), 'before-restore', day(1))
    expect(readHistory()).toHaveLength(1)
    checkpoint(save({ xp: 1 }), 'automatic', day(2))
    expect(readHistory()[0].kind).toBe('before-restore')
    for (let i = 0; i < 8; i++)
      checkpoint(save({ xp: i, heroName: 'x'.repeat(180_000) }), 'automatic', day(i + 2))
    expect(values.get(HISTORY_KEY)!.length).toBeLessThanOrEqual(1_000_000)
    const previous = values.get(HISTORY_KEY)
    expect(checkpoint(save({ heroName: 'x'.repeat(1_000_000) }), 'before-restore')).toBe(false)
    expect(values.get(HISTORY_KEY)).toBe(previous)
  })

  it('ignores malformed history entries and recovers when both main and last backup are damaged', () => {
    values.set(
      HISTORY_KEY,
      JSON.stringify([null, {}, { at: day(0), kind: 'automatic', raw: save({ xp: 8 }) }]),
    )
    values.set(SAVE_KEY, '{broken')
    values.set(BACKUP_KEY, '{}')
    expect(readHistory()).toHaveLength(1)
    expect(readSave()).toEqual({
      raw: save({ xp: 8 }),
      warning: '백업 이력으로 복구했어요. 내용을 확인해 주세요.',
    })
    expect(values.get(SAVE_KEY)).toBe('{broken')
  })

  it('prioritizes valid main data, then the immediate backup', () => {
    checkpoint(save({ xp: 1 }), 'automatic')
    values.set(BACKUP_KEY, save({ xp: 2 }))
    values.set(SAVE_KEY, save({ xp: 3 }))
    expect(readSave().raw).toBe(save({ xp: 3 }))
    values.delete(SAVE_KEY)
    expect(readSave().raw).toBe(save({ xp: 2 }))
  })

  it('reports checkpoint failure without throwing or overwriting existing records', () => {
    const raw = save({ xp: 42 })
    values.set(SAVE_KEY, raw)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(checkpoint(raw, 'before-restore')).toBe(false)
    expect(() => preservePrevious(raw)).not.toThrow()
    expect(values.get(SAVE_KEY)).toBe(raw)
  })

  it('prunes older snapshots to fit the browser quota while retaining the new checkpoint', () => {
    checkpoint(save({ xp: 1 }), 'automatic', day(0))
    checkpoint(save({ xp: 2 }), 'automatic', day(1))
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (JSON.parse(value).length > 1) throw new Error('QuotaExceededError')
        values.set(key, value)
      },
    })
    expect(checkpoint(save({ xp: 3 }), 'before-restore', day(2))).toBe(true)
    expect(readHistory().map((s) => JSON.parse(s.raw).xp)).toEqual([3])
  })
})

describe('save import inspection', () => {
  it('accepts raw and exported saves without changing current storage', () => {
    const raw = save({ heroName: 'Local', pool: [task] })
    values.set(SAVE_KEY, raw)
    const inspected = inspectSave(
      JSON.stringify({ app: 'ilta', exportedAt: '2026-09-23', data: JSON.parse(raw) }),
    )
    expect(inspected.ok).toBe(true)
    if (!inspected.ok) return
    expect(inspected.state.pool[0]).toMatchObject(task)
    expect(inspected.omittedTasks).toBe(0)
    expect(inspectSave(inspected.raw).ok).toBe(true)
    expect(values.get(SAVE_KEY)).toBe(raw)
  })

  it('rejects broken, partial, foreign and future-version save files', () => {
    for (const raw of [
      '{',
      '{}',
      'null',
      '42',
      JSON.stringify({ pool: [] }),
      save({ version: 999 }),
      JSON.stringify({ app: 'other', data: JSON.parse(save()) }),
    ]) {
      expect(inspectSave(raw).ok).toBe(false)
    }
  })

  it('counts discarded tasks across all four task lists before confirmation', () => {
    const result = inspectSave(
      save({ pool: [task, null], active: [{ title: 4 }], done: [{ title: '' }], archived: [task, {}] }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.omittedTasks).toBe(4)
    expect(result.state.pool).toHaveLength(1)
    expect(result.state.archived).toHaveLength(1)
  })

  it('previews the migrated state rather than outdated XP or defaults', () => {
    const result = inspectSave(save({ version: 1, xp: 1000 }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.version).toBe(2)
    expect(result.state.xp).toBeGreaterThan(1000)
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { Category, DoneQuest, GameState, Task } from '../src/game'
import {
  RESIDENTS,
  growthStage,
  requestLine,
  residentFor,
  villageCompletion,
  villageOf,
} from '../src/village'
import { VILLAGE_SPRITES } from '../src/villageSprites'
import { sanitize } from '../src/store'
import { revertChange } from '../src/undo'

const task = (title: string, category?: Category): Task => ({
  id: title,
  title,
  category,
  difficulty: 'slime',
  minutes: 15,
  energy: 'low',
  createdAt: 1,
})
const done = (title: string, id = title): DoneQuest => ({ ...task(title), id, completedAt: 2, xp: 10 })
const state = (records: DoneQuest[] = []): GameState => ({
  pool: [],
  active: [],
  done: records,
  gold: 0,
  xp: 0,
  loot: {},
  rewards: [],
  purchases: [],
  petFood: 0,
})

describe('주민 의뢰', () => {
  it.each([
    ['시험 공부하기', 'librarian'],
    ['책상 정리하기', 'innkeeper'],
    ['보고서 쓰기', 'smith'],
    ['저녁 산책', 'herbalist'],
    ['그림 그리기', 'bard'],
    ['탁자 옮기기', 'courier'],
    ['Write a report', 'smith'],
    ['Read a book', 'librarian'],
    ['피아노 연습', 'bard'],
  ])('%s에 어울리는 주민을 연결한다', (title, id) => {
    expect(residentFor(task(title)).id).toBe(id)
  })
  it('직접 고른 분류가 제목 추정보다 우선하고 기타는 추정할 수 있다', () => {
    expect(residentFor(task('운동 관련 보고서', 'work')).id).toBe('smith')
    expect(residentFor(task('그림 그리기', 'etc')).id).toBe('bard')
  })
  it('같은 의뢰의 대사는 새로고침해도 같고 주민별로 여러 대사가 있다', () => {
    const quest = task('공부')
    expect(requestLine(quest)).toBe(requestLine({ ...quest }))
    for (const resident of RESIDENTS) expect(new Set(resident.requests).size).toBe(3)
    expect(
      new Set(Array.from({ length: 20 }, (_, id) => requestLine({ ...quest, id: String(id) }))).size,
    ).toBe(3)
  })
  it('입력한 할 일 제목과 분류를 바꾸지 않는다', () => {
    const quest = task('내가 쓴 긴 제목 그대로', 'home')
    const original = { ...quest }
    residentFor(quest)
    requestLine(quest)
    expect(quest).toEqual(original)
  })
})

describe('완료 기록으로 자라는 마을', () => {
  it.each([
    [0, 0],
    [1, 1],
    [4, 1],
    [5, 2],
    [14, 2],
    [15, 3],
    [1000, 3],
  ])('%i개 완료 시 성장 단계 %i', (count, stage) => {
    expect(growthStage(count)).toBe(stage)
  })
  it('담당 주민의 공간만 성장하며 의뢰 등록만으로 성장하지 않는다', () => {
    const save = state([done('공부'), done('독서'), done('산책')])
    save.pool.push(task('그림'))
    save.active.push({ ...task('청소'), acceptedAt: 1 })
    const village = villageOf(save)
    expect(village.places.map((p) => p.count)).toEqual([2, 0, 1, 0, 0, 0])
    expect(village.total).toBe(3)
  })
  it('기존 세이브, 내보내기·복원, 오랜 휴식에도 성장과 기념물이 유지된다', () => {
    const save = { ...state([done('공부'), done('취미 그림')]), raidKills: 3 }
    const restored = sanitize(JSON.parse(JSON.stringify(save)))
    expect(villageOf(restored)).toEqual(villageOf(save))
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2040-01-01'))
      expect(villageOf(restored)).toEqual(villageOf(save))
      expect(villageOf(restored).trophies).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })
  it('완료 되돌리기는 성장과 보스 기념물도 함께 되돌린다', () => {
    const before = state()
    const after = { ...before, done: [done('공부')], raidKills: 1 }
    const restored = revertChange(after, { id: '공부', before, after })!
    expect(villageOf(restored)).toEqual(villageOf(before))
  })
  it('성장 문구는 실제 경계에서만 나오고 반복 의뢰의 각 완료도 누적된다', () => {
    const history = Array.from({ length: 4 }, (_, i) => done('공부', String(i)))
    expect(villageCompletion(history, task('공부'))).toContain('문을 연 가게')
    expect(villageCompletion([], task('공부'))).toContain('작은 보금자리')
    expect(villageCompletion([done('공부')], task('공부'))).toBe('모아의 의뢰 완료')
  })
})

describe('주민과 마을 도트 자산', () => {
  it('주민마다 서로 다른 도트 그림이 있고 모든 행과 색상이 유효하다', () => {
    const portraits = RESIDENTS.map((r) => VILLAGE_SPRITES[`resident_${r.id}`])
    expect(new Set(portraits.map((sprite) => JSON.stringify(sprite.rows))).size).toBe(6)
    for (const [id, sprite] of Object.entries(VILLAGE_SPRITES)) {
      for (const row of sprite.rows) {
        expect(row.length, id).toBe(sprite.rows[0].length)
        for (const pixel of row)
          if (pixel !== '.') expect(sprite.palette[pixel], `${id}: ${pixel}`).toBeDefined()
      }
    }
  })
})

import { describe, expect, it } from 'vitest'
import { SPRITES } from '../src/sprites'
import {
  ACHIEVEMENTS,
  ALL_MONSTERS,
  CATEGORIES,
  CATEGORY_IDS,
  CHAPTER_WEEKS,
  Category,
  DoneQuest,
  GameState,
  MONSTERS,
  MONSTER_NAMES,
  Task,
  awake,
  bestDay,
  categoriesCleared,
  chapterOf,
  dexCount,
  earnedAchievements,
  enragedSet,
  filterDoable,
  isAvailable,
  monsterFor,
  newAchievements,
  nextAvailable,
  pickWeighted,
  raidFor,
  weekIndex,
} from '../src/game'

const DAY = 86400000
// 2026-09-18 = 금요일 12시
const FRI = new Date(2026, 8, 18, 12).getTime()

const task = (over: Partial<Task> & { id: string }): Task => ({
  title: '테스트',
  difficulty: 'slime',
  minutes: 15,
  energy: 'low',
  createdAt: FRI,
  ...over,
})

const base: GameState = {
  pool: [],
  active: [],
  done: [],
  xp: 0,
  gold: 0,
  loot: {},
  rewards: [],
  purchases: [],
  petFood: 0,
}

const done = (over: Partial<DoneQuest> & { id: string }): DoneQuest => ({
  ...task(over),
  completedAt: FRI,
  xp: 10,
  ...over,
})

describe('분류와 몬스터', () => {
  it('분류마다 난이도별 전담 몬스터가 하나씩 있다', () => {
    for (const c of CATEGORY_IDS) {
      const m = CATEGORIES[c].monsters
      expect(MONSTERS.slime).toContain(m.slime)
      expect(MONSTERS.elite).toContain(m.elite)
      expect(MONSTERS.boss).toContain(m.boss)
    }
  })

  it('같은 몬스터를 두 분류가 나눠 쓰지 않는다', () => {
    const used = CATEGORY_IDS.flatMap((c) => Object.values(CATEGORIES[c].monsters))
    expect(new Set(used).size).toBe(used.length)
  })

  it('분류를 고르면 몬스터가 정해지고, 안 고르면 난이도 풀에서 나온다', () => {
    expect(monsterFor('boss', 'study')).toBe('lich')
    expect(monsterFor('slime', 'etc')).toBe('bat')
    for (let i = 0; i < 20; i++) expect(MONSTERS.elite).toContain(monsterFor('elite'))
  })

  it('모든 몬스터에 스프라이트와 이름이 있다', () => {
    for (const m of ALL_MONSTERS) {
      expect(SPRITES[m], `${m} 스프라이트 없음`).toBeDefined()
      expect(MONSTER_NAMES[m], `${m} 이름 없음`).toBeDefined()
    }
  })

  it('스프라이트 행 길이가 모두 같다 (그리드가 밀리지 않게)', () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      const lens = new Set(sprite.rows.map((r) => r.length))
      expect(lens.size, `${name} 행 길이 불일치: ${[...lens]}`).toBe(1)
    }
  })

  it('분류별 처치 수를 센다', () => {
    const list = [
      done({ id: 'a', category: 'study' }),
      done({ id: 'b', category: 'home' }),
      done({ id: 'c' }),
    ]
    expect(categoriesCleared(list)).toBe(2)
  })
})

describe('반복과 대기', () => {
  it('매일 반복은 다음 날 0시에 다시 나타난다', () => {
    const at = nextAvailable('daily', FRI)
    const d = new Date(at)
    expect(d.getDate()).toBe(19)
    expect(d.getHours()).toBe(0)
  })

  it('평일 반복은 주말을 건너뛴다', () => {
    // 금요일에 처치 → 다음 월요일
    expect(new Date(nextAvailable('weekdays', FRI)).getDay()).toBe(1)
    // 월요일에 처치 → 화요일
    const mon = new Date(2026, 8, 21, 12).getTime()
    expect(new Date(nextAvailable('weekdays', mon)).getDate()).toBe(22)
  })

  it('주 1회 반복은 7일 뒤에 나타난다', () => {
    expect(new Date(nextAvailable('weekly', FRI)).getDate()).toBe(25)
  })

  it('대기 중인 몹은 뽑기·조건 필터·광폭에서 빠진다', () => {
    const sleeping = task({ id: 'sleep', availableAt: FRI + DAY })
    const ready = task({ id: 'ready' })
    expect(isAvailable(sleeping, FRI)).toBe(false)
    expect(isAvailable(ready, FRI)).toBe(true)
    expect(awake([sleeping, ready], FRI)).toEqual([ready])
    expect(filterDoable([sleeping, ready], 60, 'high', FRI)).toEqual([ready])
    expect(pickWeighted([sleeping], undefined, FRI)).toBeNull()
    expect(pickWeighted([sleeping, ready], undefined, FRI)?.id).toBe('ready')
  })

  it('대기 중인 몹은 오래 묵어도 광폭이 되지 않는다', () => {
    const old = task({ id: 'old', createdAt: FRI - 30 * DAY, availableAt: FRI + DAY })
    expect(enragedSet([old], FRI).size).toBe(0)
  })
})

describe('챕터', () => {
  it('4주가 한 챕터이고 마지막 주가 보스 주간', () => {
    const start = new Date(2026, 0, 5, 12).getTime() // 기준 월요일
    const weeks = Array.from({ length: CHAPTER_WEEKS }, (_, i) => chapterOf(start + i * 7 * DAY))
    expect(weeks.map((c) => c.week)).toEqual([1, 2, 3, 4])
    expect(weeks.map((c) => c.isFinal)).toEqual([false, false, false, true])
    expect(weeks.every((c) => c.index === 0)).toBe(true)
  })

  it('보스 주간은 HP와 보상이 더 크다', () => {
    const start = new Date(2026, 0, 5, 12).getTime()
    const wk1 = chapterOf(start)
    const wk4 = chapterOf(start + 3 * 7 * DAY)
    expect(wk4.maxHp).toBeGreaterThan(wk1.maxHp)
    expect(wk4.reward).toBeGreaterThan(wk1.reward)
  })

  it('5주차부터 다음 챕터로 넘어간다', () => {
    const start = new Date(2026, 0, 5, 12).getTime()
    const next = chapterOf(start + 4 * 7 * DAY)
    expect(next.index).toBe(1)
    expect(next.week).toBe(1)
    expect(next.key).toBe('C1')
  })

  it('한 주 안에서는 챕터 정보가 바뀌지 않는다', () => {
    const mon = new Date(2026, 8, 21, 0, 30).getTime()
    const sun = new Date(2026, 8, 27, 23, 30).getTime()
    expect(chapterOf(mon)).toEqual(chapterOf(sun))
    expect(weekIndex(mon)).toBe(weekIndex(sun))
  })

  it('챕터 보스는 스프라이트가 있는 몬스터다', () => {
    const start = new Date(2026, 0, 5, 12).getTime()
    for (let i = 0; i < 40; i++) {
      const c = chapterOf(start + i * 7 * DAY)
      expect(SPRITES[c.boss], `${c.boss} 없음`).toBeDefined()
    }
  })
})

describe('레이드 이월', () => {
  const start = new Date(2026, 0, 5, 12).getTime() // 1주차 월요일
  const week4 = start + 3 * 7 * DAY // 챕터 보스 주간
  const week5 = start + 4 * 7 * DAY // 다음 챕터 1주차

  it('같은 주면 기존 레이드를 이어간다', () => {
    const raid = raidFor(undefined, start)
    const next = raidFor({ ...raid, hp: 200 }, start + 2 * DAY)
    expect(next.hp).toBe(200)
  })

  it('일반 주간 보스는 주가 바뀌면 새 보스로 초기화된다', () => {
    const raid = raidFor(undefined, start)
    const next = raidFor({ ...raid, hp: 100 }, start + 7 * DAY)
    expect(next.hp).toBe(next.max)
    expect(next.isFinal).toBeUndefined()
  })

  it('챕터 보스 주간의 레이드는 정체를 저장한다', () => {
    const raid = raidFor(undefined, week4)
    expect(raid.isFinal).toBe(true)
    expect(raid.boss).toBe(chapterOf(week4).boss)
    expect(raid.reward).toBe(chapterOf(week4).reward)
    expect(raid.chapterKey).toBe(chapterOf(week4).key)
  })

  it('못 잡은 챕터 보스는 주가 넘어가도 남는다', () => {
    const raid = raidFor(undefined, week4)
    const carried = raidFor({ ...raid, hp: 250 }, week5)
    expect(carried.hp).toBe(250)
    expect(carried.isFinal).toBe(true)
    expect(carried.boss).toBe(chapterOf(week4).boss)
  })

  it('챕터 보스를 잡으면 다음 주에 새 보스가 나타난다', () => {
    const raid = raidFor(undefined, week4)
    const next = raidFor({ ...raid, hp: 0 }, week5)
    expect(next.isFinal).toBeUndefined()
    expect(next.hp).toBe(next.max)
  })
})

describe('업적', () => {
  it('업적 id 가 중복되지 않는다', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('빈 상태에서는 아무 업적도 달성되지 않는다', () => {
    expect(earnedAchievements(base, FRI)).toEqual([])
  })

  it('첫 처치로 첫 업적이 달성된다', () => {
    const s = { ...base, done: [done({ id: 'a' })] }
    expect(earnedAchievements(s, FRI)).toContain('first')
    expect(earnedAchievements(s, FRI)).not.toContain('kill10')
  })

  it('이미 받은 업적은 다시 주지 않는다', () => {
    const s = { ...base, done: [done({ id: 'a' })], achieved: ['first'] }
    expect(newAchievements(s, FRI).map((a) => a.id)).not.toContain('first')
  })

  it('도망친 몹을 처치하면 두려움 업적이 달성된다', () => {
    const s = { ...base, done: [done({ id: 'a', retreats: 3 })] }
    expect(earnedAchievements(s, FRI)).toContain('facedFear')
  })

  it('하루 최다 처치를 센다', () => {
    const list = [done({ id: 'a' }), done({ id: 'b' }), done({ id: 'c', completedAt: FRI - 3 * DAY })]
    expect(bestDay(list)).toBe(2)
    expect(bestDay([])).toBe(0)
  })

  it('도감 수집 수를 센다', () => {
    const list = [
      done({ id: 'a', monster: 'slime' }),
      done({ id: 'b', monster: 'slime' }),
      done({ id: 'c', monster: 'bat' }),
    ]
    expect(dexCount(list)).toBe(2)
  })

  it('분류를 모두 처치하면 균형 업적이 달성된다', () => {
    const list = CATEGORY_IDS.map((c, i) => done({ id: `c${i}`, category: c as Category }))
    expect(earnedAchievements({ ...base, done: list }, FRI)).toContain('allCategories')
  })

  it('업적 보상 골드는 모두 양수', () => {
    for (const a of ACHIEVEMENTS) expect(a.gold).toBeGreaterThan(0)
  })
})

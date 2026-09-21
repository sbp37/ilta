import { describe, expect, it } from 'vitest'
import {
  ENRAGE_CAP,
  LOOT_STACK_CAP,
  Task,
  DoneQuest,
  applyFreezes,
  enraged,
  enragedSet,
  levelOf,
  levelProgress,
  levelUpGold,
  lootBonus,
  petStage,
  petMood,
  slotsFor,
  streakDays,
  strikeRespawn,
  timerLeft,
  unlocksAt,
  raidBoss,
  weekKey,
  ALL_MONSTERS,
  xpAtLevel,
  xpFor,
  xpNeed,
} from '../src/game'

const DAY = 86400000
// 고정 기준 시각 (2026-09-18 12:00 로컬)
const NOW = new Date(2026, 8, 18, 12).getTime()
const ago = (days: number) => NOW - days * DAY
const dayKey = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

const task = (over: Partial<Task> & { id: string }): Task => ({
  title: '테스트',
  difficulty: 'slime',
  minutes: 15,
  energy: 'low',
  createdAt: NOW,
  ...over,
})

const doneAt = (days: number, id = `d${days}`): DoneQuest => ({
  ...task({ id }),
  completedAt: ago(days),
  xp: 10,
})

describe('레벨 커브', () => {
  it('5레벨까지는 레벨당 100XP', () => {
    expect(levelOf(0)).toBe(1)
    expect(levelOf(99)).toBe(1)
    expect(levelOf(100)).toBe(2)
    expect(levelOf(499)).toBe(5)
    expect(levelOf(500)).toBe(6)
  })

  it('5레벨 이후로 레벨당 20XP씩 더 필요', () => {
    expect(xpNeed(5)).toBe(100)
    expect(xpNeed(6)).toBe(120)
    expect(xpNeed(10)).toBe(200)
    expect(levelOf(500 + 119)).toBe(6)
    expect(levelOf(500 + 120)).toBe(7)
  })

  it('xpAtLevel 은 levelOf 와 앞뒤가 맞는다', () => {
    for (let lv = 1; lv <= 25; lv++) {
      const need = xpAtLevel(lv)
      expect(levelOf(need)).toBe(lv)
      if (lv > 1) expect(levelOf(need - 1)).toBe(lv - 1)
    }
  })

  it('진행도는 현재 레벨 기준으로 계산된다', () => {
    expect(levelProgress(510)).toEqual({ cur: 10, need: 120 })
    expect(levelProgress(0)).toEqual({ cur: 0, need: 100 })
  })

  it('레벨업 골드와 해금 표', () => {
    expect(levelUpGold(8)).toBe(80)
    expect(unlocksAt(8)).toHaveLength(1)
    expect(unlocksAt(7)).toHaveLength(0)
  })

  it('퀘스트 슬롯은 8레벨에 4개로 늘어난다', () => {
    expect(slotsFor(7)).toBe(3)
    expect(slotsFor(8)).toBe(4)
  })
})

describe('전리품 패시브', () => {
  it('개당 효과는 상한까지만 쌓인다', () => {
    const b = lootBonus({ gem: 9, star: 2, sword: 1, crown: 0 })
    expect(b.goldMult).toBeCloseTo(LOOT_STACK_CAP * 0.05)
    expect(b.critChance).toBeCloseTo(0.06)
    expect(b.critMult).toBe(0.25)
    expect(b.xpMult).toBe(0)
    expect(b.shieldChance).toBe(0)
  })

  it('없으면 보너스가 전부 0', () => {
    expect(lootBonus({})).toEqual({
      critChance: 0,
      critMult: 0,
      goldMult: 0,
      xpMult: 0,
      shieldChance: 0,
    })
  })
})

describe('광폭화', () => {
  it('마감 없는 몹은 7일 묵혀야 광폭', () => {
    expect(enraged(task({ id: 'a', createdAt: ago(3) }), NOW)).toBe(false)
    expect(enraged(task({ id: 'a', createdAt: ago(7) }), NOW)).toBe(true)
  })

  it('마감을 넘기거나 두 번 도망치면 즉시 광폭', () => {
    expect(enraged(task({ id: 'a', due: '2026-09-10' }), NOW)).toBe(true)
    expect(enraged(task({ id: 'a', retreats: 2 }), NOW)).toBe(true)
    expect(enraged(task({ id: 'a', retreats: 1 }), NOW)).toBe(false)
  })

  it('미래 마감이 있는 몹은 오래 묵혀도 광폭하지 않는다', () => {
    // 한 달 뒤 마감인데 일주일 넘게 수집함에 있었다고 광폭이면 억울하다
    expect(enraged(task({ id: 'a', createdAt: ago(10), due: '2026-10-20' }), NOW)).toBe(false)
    // 그래도 마감을 넘기면 광폭
    expect(enraged(task({ id: 'a', createdAt: ago(10), due: '2026-09-10' }), NOW)).toBe(true)
  })

  it('표시되는 광폭 몹은 심각한 순으로 상한까지만', () => {
    const pool = [
      task({ id: 'old8', createdAt: ago(8) }),
      task({ id: 'old9', createdAt: ago(9) }),
      task({ id: 'old10', createdAt: ago(10) }),
      task({ id: 'old11', createdAt: ago(11) }),
      task({ id: 'fresh', createdAt: ago(3) }),
      task({ id: 'fled', retreats: 2 }),
      task({ id: 'overdue', due: '2026-09-10' }),
    ]
    const set = enragedSet(pool, NOW)
    expect(set.size).toBe(ENRAGE_CAP)
    expect(set.has('overdue')).toBe(true)
    expect(set.has('fled')).toBe(true)
    expect(set.has('old11')).toBe(true)
    expect(set.has('fresh')).toBe(false)
  })
})

describe('연속 기록과 휴식일 부적', () => {
  it('빈 날이 없으면 그대로 이어진다', () => {
    expect(streakDays([doneAt(0), doneAt(1), doneAt(2)], NOW)).toBe(3)
  })

  it('빈 날에서 끊긴다', () => {
    expect(streakDays([doneAt(0), doneAt(2)], NOW)).toBe(1)
  })

  it('부적으로 덮은 날은 이어진 것으로 센다', () => {
    expect(streakDays([doneAt(0), doneAt(2)], NOW, [dayKey(ago(1))])).toBe(3)
  })

  it('어제가 비면 부적 하나를 쓴다', () => {
    const r = applyFreezes([doneAt(2)], 1, [], NOW)
    expect(r.consumed).toBe(1)
    expect(r.freezes).toBe(0)
    expect(r.used).toEqual([dayKey(ago(1))])
  })

  it('빈 날 수보다 부적이 적으면 아무것도 쓰지 않는다', () => {
    expect(applyFreezes([doneAt(3)], 1, [], NOW).consumed).toBe(0)
    expect(applyFreezes([doneAt(3)], 2, [], NOW).consumed).toBe(2)
  })

  it('빈 날이 없거나 기록이 없으면 쓰지 않는다', () => {
    expect(applyFreezes([doneAt(0)], 3, [], NOW).consumed).toBe(0)
    expect(applyFreezes([doneAt(1)], 3, [], NOW).consumed).toBe(0)
    expect(applyFreezes([], 3, [], NOW).consumed).toBe(0)
  })

  it('이미 덮은 날에는 다시 쓰지 않는다', () => {
    expect(applyFreezes([doneAt(2)], 1, [dayKey(ago(1))], NOW).consumed).toBe(0)
  })

  it('너무 오래 전에 끊긴 기록은 되살리지 않는다', () => {
    const r = applyFreezes([doneAt(30)], 3, [], NOW)
    expect(r.consumed).toBe(0)
    expect(r.freezes).toBe(3)
  })
})

describe('타이머', () => {
  it('남은 시간은 시작 시각으로 계산한다', () => {
    expect(timerLeft(NOW - 10_000, 300, NOW)).toBe(290)
  })

  it('지나간 타이머는 0으로 고정된다', () => {
    expect(timerLeft(NOW - 999_000, 300, NOW)).toBe(0)
  })
})

describe('기타 규칙', () => {
  it('콤보 보너스는 5마리까지', () => {
    expect(xpFor('slime', 0)).toBe(10)
    expect(xpFor('slime', 3)).toBe(16)
    expect(xpFor('slime', 9)).toBe(20)
  })

  it('펫은 먹인 끼니로 진화한다', () => {
    expect(petStage(0).sprite).toBe('egg')
    expect(petStage(2).sprite).toBe('babyslime')
    expect(petStage(6).sprite).toBe('slime')
    expect(petStage(15).next).toBeNull()
  })

  it('새벽에는 펫이 잔다', () => {
    const dawn = new Date(2026, 8, 18, 3).getTime()
    expect(petMood({ petFedAt: dawn }, dawn)).toBe('sleeping')
    expect(petMood({ petFedAt: NOW - 30 * 3600_000 }, NOW)).toBe('hungry')
    expect(petMood({ petFedAt: NOW - 3600_000 }, NOW)).toBe('full')
  })

  it('주차 키는 월요일 0시에만 바뀐다', () => {
    const fri = new Date(2026, 8, 18, 12).getTime() // 금
    const sat = new Date(2026, 8, 19, 12).getTime() // 토
    const sun = new Date(2026, 8, 20, 23, 59).getTime() // 일
    const mon = new Date(2026, 8, 21, 0, 1).getTime() // 월
    expect(weekKey(fri)).toBe(weekKey(sat))
    expect(weekKey(fri)).toBe(weekKey(sun))
    expect(weekKey(fri)).not.toBe(weekKey(mon))
    expect(weekKey(fri)).toBe('2026-W0914')
  })

  it('연말에도 주가 쪼개지지 않는다', () => {
    const dec31 = new Date(2025, 11, 31, 12).getTime() // 수
    const jan1 = new Date(2026, 0, 1, 12).getTime() // 목
    expect(weekKey(dec31)).toBe(weekKey(jan1))
  })

  it('주차 키로 고르는 보스는 항상 목록 안에 있다', () => {
    for (let i = 0; i < 60; i++) {
      const boss = raidBoss(weekKey(NOW + i * 7 * DAY))
      expect(ALL_MONSTERS).toContain(boss)
    }
  })
})

describe('일격 리스폰', () => {
  const strike = { id: 'mob1', day: dayKey(NOW) }
  const tomorrow = { id: 'mob1', day: dayKey(NOW + DAY) }

  it('오늘 일격을 잡으면 옛 id를 유지한다 (done에서 달성 표시)', () => {
    expect(strikeRespawn(strike, 'mob1', 'mob2', NOW)).toBe(strike)
  })

  it('내일로 예약한 일격이 리스폰하면 새 id를 따라간다', () => {
    expect(strikeRespawn(tomorrow, 'mob1', 'mob2', NOW)).toEqual({ id: 'mob2', day: tomorrow.day })
  })

  it('미래 예약인데 리스폰이 없으면 일격을 해제한다', () => {
    expect(strikeRespawn(tomorrow, 'mob1', undefined, NOW)).toBeUndefined()
  })

  it('다른 몹을 잡거나 일격이 없으면 그대로다', () => {
    expect(strikeRespawn(strike, 'other', 'mob2', NOW)).toBe(strike)
    expect(strikeRespawn(undefined, 'mob1', 'mob2', NOW)).toBeUndefined()
  })

  it('날짜 비교가 문자열이 아니라 실제 날짜 순서다', () => {
    // '2026-8-2'는 '2026-8-19'보다 문자열로는 크지만 날짜로는 과거
    const past = { id: 'mob1', day: '2026-8-2' }
    expect(strikeRespawn(past, 'mob1', 'mob2', NOW)).toBe(past)
  })
})

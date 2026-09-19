import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Achievement,
  ActiveQuest,
  CONSUMABLES,
  CRIT_CHANCE,
  CRIT_MULT,
  DoneQuest,
  FREEZE_COST,
  FREEZE_MAX,
  GEAR,
  GameState,
  HeroClass,
  ITEM_MAX,
  PET_FEED_COST,
  POTION_CONVERT,
  Repeat,
  SAVE_VERSION,
  Task,
  XP_BOOST_MULT,
  applyFreezes,
  chapterOf,
  goldFor,
  isAvailable,
  itemCount,
  levelOf,
  levelUpGold,
  lootBonus,
  lootById,
  monsterFor,
  newAchievements,
  nextAvailable,
  petStage,
  raidFor,
  rollLoot,
  sameDay,
  slotsFor,
  strikeRespawn,
  todayKey,
  uid,
  xpAtLevel,
  xpFor,
} from './game'

const KEY = 'quest-do-save-v1'

const empty: GameState = {
  version: SAVE_VERSION,
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

// 저장 데이터 마이그레이션. 오래된 세이브를 현재 스키마로 올린다.
export function migrate(saved: GameState): GameState {
  // 버전은 반드시 저장된 값에서 읽는다. empty 의 기본값을 먼저 펼치면
  // 버전 없던 옛 세이브가 최신으로 오인돼 마이그레이션이 건너뛰어진다.
  const from = saved.version ?? 1
  let s: GameState = { ...empty, ...saved, version: from }
  // v1 → v2: 레벨 커브가 "레벨당 100XP 고정"에서 "5레벨 이후 +20XP씩"으로
  // 바뀌면서 같은 XP의 레벨이 내려감. 기존 레벨을 유지하도록 XP를 채워준다.
  if (from < 2) {
    const oldLevel = Math.floor(s.xp / 100) + 1
    const need = xpAtLevel(oldLevel)
    if (s.xp < need) s = { ...s, xp: need }
    s = { ...s, version: 2 }
  }
  return { ...s, version: SAVE_VERSION }
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    return migrate(JSON.parse(raw) as GameState)
  } catch {
    return empty
  }
}

export interface CompleteResult {
  xp: number
  gold: number
  lootName?: string
  leveledUp: boolean
  combo: number
  crit: boolean
  raidKilled: boolean
  chapterCleared: boolean
  raidTitle: string // 처치한 보스의 칭호 (이월 챕터 보스면 지난 챕터 것)
  raidReward: number
  boosted: boolean // XP 포션이 적용됨
  potionsConverted: boolean // 빨간 포션이 모여 XP 포션으로 변함
  newLevel: number
  levelGold: number
}

export function useGame() {
  const [state, setState] = useState<GameState>(load)
  // 되돌리기용 스냅샷 — 처치/삭제 직전 상태를 통째로 보관
  const undoRef = useRef<GameState | null>(null)
  // 최신 상태 미러 — 업데이터 밖에서 결과를 미리 계산할 때 사용 (업데이터는 지연 실행될 수 있음)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  // 휴식일 부적 자동 소모: 앱 켤 때 + 하루 넘어갈 때 어제 빈 날이 있으면 지켜준다
  const checkFreezes = useCallback((): number => {
    const cur = stateRef.current
    const now = Date.now()
    const peek = applyFreezes(cur.done, cur.freezes ?? 0, cur.freezeUsed ?? [], now)
    if (peek.consumed === 0) return 0
    setState((s) => {
      const r = applyFreezes(s.done, s.freezes ?? 0, s.freezeUsed ?? [], now)
      if (r.consumed === 0) return s
      return { ...s, freezes: r.freezes, freezeUsed: r.used }
    })
    return peek.consumed
  }, [])

  const addTask = useCallback((t: Omit<Task, 'id' | 'createdAt'>) => {
    const monster = t.monster ?? monsterFor(t.difficulty, t.category)
    setState((s) => ({ ...s, pool: [...s.pool, { ...t, monster, id: uid(), createdAt: Date.now() }] }))
  }, [])

  const setHeroName = useCallback((name: string) => {
    setState((s) => ({ ...s, heroName: name }))
  }, [])

  const setHeroLook = useCallback((hair?: string, tunic?: string) => {
    setState((s) => ({ ...s, heroHair: hair, heroTunic: tunic }))
  }, [])

  const setHeroClass = useCallback((heroClass: HeroClass) => {
    setState((s) => ({ ...s, heroClass }))
  }, [])

  const setTheme = useCallback((theme: string) => {
    setState((s) => ({ ...s, theme }))
  }, [])

  const setNotif = useCallback((notif: boolean) => {
    setState((s) => ({ ...s, notif }))
  }, [])

  // 반복 순환: 꺼짐 → 매일 → 평일만 → 주 1회 → 꺼짐
  const REPEAT_CYCLE: (Repeat | undefined)[] = [undefined, 'daily', 'weekdays', 'weekly']
  const toggleRepeat = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      pool: s.pool.map((t) => {
        if (t.id !== id) return t
        const next = REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(t.repeat) + 1) % REPEAT_CYCLE.length]
        // 잠든 상태에서 주기를 바꾸면 남은 대기도 새 주기로 다시 계산한다
        const sleeping = t.availableAt !== undefined && t.availableAt > Date.now()
        const availableAt = next ? (sleeping ? nextAvailable(next) : t.availableAt) : undefined
        return { ...t, repeat: next, availableAt }
      }),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 보스 레이드: 큰 몬스터를 잡몹으로 쪼개기 (수집함/슬롯 둘 다 가능)
  const addSub = useCallback((id: string, title: string) => {
    const sub = { id: uid(), title }
    const attach = <T extends Task>(t: T): T =>
      t.id === id && (t.subs?.length ?? 0) < 8 ? { ...t, subs: [...(t.subs ?? []), sub] } : t
    setState((s) => ({ ...s, pool: s.pool.map(attach), active: s.active.map(attach) }))
  }, [])

  // 잡몹 하나 처치. 전부 처치하면 'cleared' (→ 보스 자동 사망)
  // 반환값은 setState 밖에서 stateRef 기준으로 계산 — 업데이터는 지연 실행될 수 있어
  // 그 안에서 세운 플래그는 호출자가 받기 전에 stale 해질 수 있다
  const toggleSub = useCallback((id: string, subId: string): 'sub' | 'cleared' | null => {
    const cur = stateRef.current
    const q0 = cur.active.find((t) => t.id === id)
    const sub0 = q0?.subs?.find((x) => x.id === subId)
    if (!q0 || !sub0) return null
    const res = !sub0.done && q0.subs!.every((x) => x.id === subId || x.done) ? 'cleared' : 'sub'
    setState((s) => {
      const q = s.active.find((t) => t.id === id)
      const sub = q?.subs?.find((x) => x.id === subId)
      if (!q || !sub) return s
      const subs = q.subs!.map((x) => (x.id === subId ? { ...x, done: !x.done } : x))
      // 마법사: 잡몹 처치(체크)할 때마다 소량 XP/골드
      const mageBonus = s.heroClass === 'mage' && !sub.done ? { xp: s.xp + 3, gold: s.gold + 3 } : {}
      return { ...s, ...mageBonus, active: s.active.map((t) => (t.id === id ? { ...t, subs } : t)) }
    })
    return res
  }, [])

  const removeTask = useCallback((id: string) => {
    setState((s) => {
      if (!s.pool.some((t) => t.id === id)) return s
      undoRef.current = s
      return { ...s, pool: s.pool.filter((t) => t.id !== id) }
    })
  }, [])

  // 할 일 편집 — 수집함/슬롯 어디 있든. 난이도가 바뀌면 몬스터도 새로 배정
  const updateTask = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<Task, 'title' | 'difficulty' | 'minutes' | 'energy' | 'due' | 'cost' | 'repeat' | 'category'>
      >,
    ) => {
      const apply = <T extends Task>(t: T): T => {
        const next = { ...t, ...patch }
        if (t.id !== id) return t
        const diffChanged = patch.difficulty !== undefined && patch.difficulty !== t.difficulty
        const catChanged = 'category' in patch && patch.category !== t.category
        if (diffChanged || catChanged) next.monster = monsterFor(next.difficulty, next.category)
        // 반복을 끄면 대기도 풀어준다
        if ('repeat' in patch) {
          if (!patch.repeat) next.availableAt = undefined
          // 잠든 상태에서 주기를 바꾸면 새 주기로 다시 잠든다
          else if (
            patch.repeat !== t.repeat &&
            next.availableAt !== undefined &&
            next.availableAt > Date.now()
          )
            next.availableAt = nextAvailable(patch.repeat)
        }
        return next
      }
      setState((s) => ({ ...s, pool: s.pool.map(apply), active: s.active.map(apply) }))
    },
    [],
  )

  // 마지막 처치/삭제 되돌리기. 스냅샷이 있으면 true
  const undo = useCallback((): boolean => {
    const snap = undoRef.current
    if (!snap) return false
    undoRef.current = null
    setState(snap)
    return true
  }, [])

  // 빈 슬롯에 바로 적기: 슬롯 비어있으면 active로, 아니면 pool로
  const quickAdd = useCallback((title: string): 'active' | 'pool' => {
    const cur = stateRef.current
    const where: 'active' | 'pool' = cur.active.length < slotsFor(levelOf(cur.xp)) ? 'active' : 'pool'
    const base: Task = {
      id: uid(),
      title,
      difficulty: 'slime',
      minutes: 15,
      energy: 'low',
      monster: monsterFor('slime'),
      createdAt: Date.now(),
    }
    setState((s) => {
      if (s.active.length < slotsFor(levelOf(s.xp))) {
        return { ...s, active: [...s.active, { ...base, acceptedAt: Date.now() }] }
      }
      return { ...s, pool: [...s.pool, base] }
    })
    return where
  }, [])

  // 수집함 순서 이동 (위 = 먼저 뽑힐 확률 높음)
  const move = useCallback((id: string, dir: -1 | 1) => {
    setState((s) => {
      const i = s.pool.findIndex((t) => t.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= s.pool.length) return s
      const pool = [...s.pool]
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
      return { ...s, pool }
    })
  }, [])

  const toggleUrgent = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      pool: s.pool.map((t) => (t.id === id ? { ...t, urgent: !t.urgent } : t)),
    }))
  }, [])

  // 수락: pool -> active (최대 3개). 성공 여부 반환
  const accept = useCallback((id: string): boolean => {
    const cur = stateRef.current
    const t0 = cur.pool.find((t) => t.id === id)
    if (!t0 || cur.active.length >= slotsFor(levelOf(cur.xp)) || !isAvailable(t0)) return false
    setState((s) => {
      const task = s.pool.find((t) => t.id === id)
      if (!task || s.active.length >= slotsFor(levelOf(s.xp)) || !isAvailable(task)) return s
      const quest: ActiveQuest = { ...task, acceptedAt: Date.now() }
      return { ...s, pool: s.pool.filter((t) => t.id !== id), active: [...s.active, quest] }
    })
    return true
  }, [])

  // 후퇴/도망: active -> pool, 도망 횟수 +1 (2번 도망치면 광폭화). 나무 방패가 있으면 50%는 기록 안 남음
  const abandon = useCallback((id: string): 'retreat' | 'shielded' => {
    const shielded = Math.random() < lootBonus(stateRef.current.loot).shieldChance
    setState((s) => {
      const q = s.active.find((t) => t.id === id)
      if (!q) return s
      const { acceptedAt: _a, ...task } = q
      const retreated = shielded ? task : { ...task, retreats: (task.retreats ?? 0) + 1 }
      return { ...s, active: s.active.filter((t) => t.id !== id), pool: [...s.pool, retreated] }
    })
    return shielded ? 'shielded' : 'retreat'
  }, [])

  const complete = useCallback((id: string): CompleteResult | null => {
    // 결과는 업데이터 밖에서 최신 상태(stateRef)로 계산 — 업데이터는 지연 실행될 수 있어
    // 그 안에서 세운 값은 호출자가 받기 전에 stale 해질 수 있다
    const cur = stateRef.current
    const q = cur.active.find((t) => t.id === id)
    if (!q) return null
    const now = Date.now()
    const doneToday = cur.done.filter((d) => sameDay(d.completedAt, now)).length
    const bonus = lootBonus(cur.loot)
    const crit = Math.random() < CRIT_CHANCE + bonus.critChance
    let xp = xpFor(q.difficulty, doneToday)
    if (cur.heroClass === 'warrior') xp += Math.min(doneToday, 5) * 2 // 전사: 콤보 보너스 2배
    xp = Math.round(xp * (crit ? CRIT_MULT + bonus.critMult : 1) * (1 + bonus.xpMult))
    const boosted = !!cur.xpBoost
    if (boosted) xp = Math.round(xp * XP_BOOST_MULT) // XP 포션
    let gold = goldFor(xp)
    if (cur.heroClass === 'rogue') gold = Math.round(gold * 1.25) // 도적: 골드 +25%
    gold = Math.round(gold * (1 + bonus.goldMult))
    const loot = rollLoot(q.difficulty)
    const prevLevel = levelOf(cur.xp)
    const nextLevel = levelOf(cur.xp + xp)
    // 레벨업 축하 골드 (여러 레벨 한 번에 오르면 합산)
    let levelGold = 0
    for (let l = prevLevel + 1; l <= nextLevel; l++) levelGold += levelUpGold(l)
    gold += levelGold
    // 빨간 포션이 5개 모이면 XP 포션으로
    const potionsConverted = (cur.loot.potion ?? 0) + (loot.id === 'potion' ? 1 : 0) >= POTION_CONVERT
    const doneQuest: DoneQuest = { ...q, completedAt: now, xp, lootId: loot.id }
    // 주간 보스 / 챕터 보스: 얻은 XP만큼 HP 감소.
    // 잡지 못한 챕터 보스는 주가 넘어가도 이월돼 계속 싸운다 (raidFor)
    const raid = raidFor(cur.raid, now)
    const raidHp = Math.max(0, raid.hp - xp)
    const raidKilled = raid.hp > 0 && raidHp === 0
    if (raidKilled) gold += raid.reward ?? chapterOf(now).reward
    const chapterCleared = raidKilled && !!raid.isFinal
    const result: CompleteResult = {
      xp,
      gold,
      lootName: lootById(loot.id)?.name,
      leveledUp: nextLevel > prevLevel,
      combo: doneToday + 1,
      crit,
      raidKilled,
      chapterCleared,
      raidTitle: raid.title ?? chapterOf(now).title,
      raidReward: raid.reward ?? chapterOf(now).reward,
      boosted,
      potionsConverted,
      newLevel: nextLevel,
      levelGold,
    }
    // 반복 몬스터는 수집함에 리스폰하되, 다음 차례까지 잠들어 있는다
    // (매일=내일, 평일만=다음 평일, 주 1회=다음 주)
    const respawn: Task[] = q.repeat
      ? [
          {
            id: uid(),
            title: q.title,
            difficulty: q.difficulty,
            minutes: q.minutes,
            energy: q.energy,
            due: q.due,
            urgent: q.urgent,
            monster: q.monster,
            cost: q.cost,
            category: q.category,
            repeat: q.repeat,
            availableAt: nextAvailable(q.repeat, now),
            subs: q.subs?.map((x) => ({ ...x, done: undefined })),
            createdAt: now,
          },
        ]
      : []
    setState((s) => {
      if (!s.active.some((t) => t.id === id)) return s // 이미 처리됨
      undoRef.current = s
      const lootNext = { ...s.loot, [loot.id]: (s.loot[loot.id] ?? 0) + 1 }
      const items = { ...(s.items ?? {}) }
      if (potionsConverted) {
        lootNext.potion = (lootNext.potion ?? 0) - POTION_CONVERT
        items.xppotion = (items.xppotion ?? 0) + 1
      }
      return {
        ...s,
        active: s.active.filter((t) => t.id !== id),
        pool: [...s.pool, ...respawn],
        done: [...s.done, doneQuest],
        xp: s.xp + xp,
        gold: s.gold + gold,
        loot: lootNext,
        items,
        xpBoost: false,
        strike: strikeRespawn(s.strike, id, respawn[0]?.id, now),
        raid: { ...raid, hp: raidHp },
        raidKills: (s.raidKills ?? 0) + (raidKilled ? 1 : 0),
        chapterClears: chapterCleared
          ? [...new Set([...(s.chapterClears ?? []), raid.chapterKey ?? chapterOf(now).key])]
          : s.chapterClears,
      }
    })
    return result
  }, [])

  const bonusXp = useCallback((amount: number) => {
    setState((s) => ({ ...s, xp: s.xp + amount, gold: s.gold + amount }))
  }, [])

  // ---------- 상점 ----------
  const addReward = useCallback((name: string, cost: number) => {
    setState((s) => ({
      ...s,
      rewards: [...s.rewards, { id: uid(), name, cost, createdAt: Date.now() }],
    }))
  }, [])

  const removeReward = useCallback((id: string) => {
    setState((s) => ({ ...s, rewards: s.rewards.filter((r) => r.id !== id) }))
  }, [])

  // 구매: 골드 부족하면 false
  const buyReward = useCallback((id: string): boolean => {
    const cur = stateRef.current
    if (!cur.rewards.some((x) => x.id === id && cur.gold >= x.cost)) return false
    setState((s) => {
      const r = s.rewards.find((x) => x.id === id)
      if (!r || s.gold < r.cost) return s
      return {
        ...s,
        gold: s.gold - r.cost,
        purchases: [...s.purchases, { id: uid(), name: r.name, cost: r.cost, at: Date.now() }],
      }
    })
    return true
  }, [])

  // ---------- 장비 상점 ----------
  // 구매하면 자동 장착 (즉시 보상감)
  const buyGear = useCallback((id: string): boolean => {
    const cur = stateRef.current
    const item0 = GEAR.find((g) => g.id === id)
    if (!item0 || cur.gold < item0.cost || (cur.gear ?? []).includes(id)) return false
    setState((s) => {
      const item = GEAR.find((g) => g.id === id)
      if (!item || s.gold < item.cost || (s.gear ?? []).includes(id)) return s
      return {
        ...s,
        gold: s.gold - item.cost,
        gear: [...(s.gear ?? []), id],
        equippedGear: [...(s.equippedGear ?? []), id],
      }
    })
    return true
  }, [])

  const toggleGear = useCallback((id: string) => {
    setState((s) => {
      const eq = s.equippedGear ?? []
      return { ...s, equippedGear: eq.includes(id) ? eq.filter((x) => x !== id) : [...eq, id] }
    })
  }, [])

  // 휴식일 부적 구매 — 최대 FREEZE_MAX개
  const buyFreeze = useCallback((): 'nogold' | 'full' | 'ok' => {
    const cur = stateRef.current
    if ((cur.freezes ?? 0) >= FREEZE_MAX) return 'full'
    if (cur.gold < FREEZE_COST) return 'nogold'
    setState((s) => {
      const have = s.freezes ?? 0
      if (have >= FREEZE_MAX || s.gold < FREEZE_COST) return s
      return { ...s, gold: s.gold - FREEZE_COST, freezes: have + 1 }
    })
    return 'ok'
  }, [])

  // ---------- 소모품 ----------
  const buyItem = useCallback((id: string): 'nogold' | 'full' | 'ok' => {
    const cur = stateRef.current
    const item = CONSUMABLES.find((c) => c.id === id)
    if (!item) return 'nogold'
    if (itemCount(cur, id) >= ITEM_MAX) return 'full'
    if (cur.gold < item.cost) return 'nogold'
    setState((s) => {
      if (s.gold < item.cost || itemCount(s, id) >= ITEM_MAX) return s
      return { ...s, gold: s.gold - item.cost, items: { ...(s.items ?? {}), [id]: itemCount(s, id) + 1 } }
    })
    return 'ok'
  }, [])

  // 보유 소모품 하나 소모. 없으면 false
  const consumeItem = useCallback((id: string): boolean => {
    if (itemCount(stateRef.current, id) <= 0) return false
    setState((s) => {
      const n = itemCount(s, id)
      if (n <= 0) return s
      return { ...s, items: { ...(s.items ?? {}), [id]: n - 1 } }
    })
    return true
  }, [])

  // XP 포션 사용 → 다음 처치 XP 1.5배
  const useXpPotion = useCallback((): 'none' | 'already' | 'ok' => {
    const cur = stateRef.current
    if (cur.xpBoost) return 'already'
    if (itemCount(cur, 'xppotion') <= 0) return 'none'
    setState((s) => {
      const n = itemCount(s, 'xppotion')
      if (s.xpBoost || n <= 0) return s
      return { ...s, xpBoost: true, items: { ...(s.items ?? {}), xppotion: n - 1 } }
    })
    return 'ok'
  }, [])

  // 진정의 향: 광폭 몹의 도망 기록·묵힌 날 초기화 (마감은 그대로)
  const applyCalm = useCallback((taskId: string): boolean => {
    if (itemCount(stateRef.current, 'calm') <= 0) return false
    setState((s) => {
      const n = itemCount(s, 'calm')
      if (n <= 0) return s
      const calm = <T extends Task>(t: T): T =>
        t.id === taskId ? { ...t, retreats: 0, createdAt: Date.now() } : t
      return {
        ...s,
        items: { ...(s.items ?? {}), calm: n - 1 },
        pool: s.pool.map(calm),
        active: s.active.map(calm),
      }
    })
    return true
  }, [])

  // ---------- 펫 / 오늘의 일격 ----------
  // 먹이 주기: 골드 10G 소비 → 끼니+1. 진화하면 'evolved'
  const feedPet = useCallback((): 'nogold' | 'fed' | 'evolved' => {
    const cur = stateRef.current
    if (cur.gold < PET_FEED_COST) return 'nogold'
    const res = petStage(cur.petFood + 1).name !== petStage(cur.petFood).name ? 'evolved' : 'fed'
    setState((s) => {
      if (s.gold < PET_FEED_COST) return s
      return { ...s, gold: s.gold - PET_FEED_COST, petFood: s.petFood + 1, petFedAt: Date.now() }
    })
    return res
  }, [])

  const setPetName = useCallback((name: string) => {
    setState((s) => ({ ...s, petName: name }))
  }, [])

  // 오늘의 일격 지정 (하루 1개). day를 넘기면 그 날짜용으로 예약
  const setStrike = useCallback((id: string, day?: string) => {
    setState((s) => ({ ...s, strike: { id, day: day ?? todayKey() } }))
  }, [])

  // ---------- 업적 ----------
  // 조건을 새로 만족한 업적을 받아 골드를 준다. 받은 목록을 돌려준다.
  const claimAchievements = useCallback((): Achievement[] => {
    const earned = newAchievements(stateRef.current)
    if (earned.length === 0) return []
    const ids = earned.map((a) => a.id)
    const bonus = earned.reduce((sum, a) => sum + a.gold, 0)
    setState((s) => {
      const have = new Set(s.achieved ?? [])
      const fresh = ids.filter((id) => !have.has(id))
      if (fresh.length === 0) return s
      return { ...s, achieved: [...(s.achieved ?? []), ...fresh], gold: s.gold + bonus }
    })
    return earned
  }, [])

  // ---------- 백업 / 복원 ----------
  const exportSave = useCallback(
    () =>
      JSON.stringify({
        app: 'ilta',
        exportedAt: new Date().toISOString(),
        data: state,
      }),
    [state],
  )

  const importSave = useCallback((text: string): boolean => {
    try {
      const parsed = JSON.parse(text)
      const data = (parsed?.data ?? parsed) as GameState
      if (!Array.isArray(data.pool) || !Array.isArray(data.done) || !Array.isArray(data.active)) return false
      setState(migrate(data))
      return true
    } catch {
      return false
    }
  }, [])

  return {
    state,
    addTask,
    removeTask,
    updateTask,
    undo,
    checkFreezes,
    setHeroName,
    setHeroLook,
    setHeroClass,
    setTheme,
    setNotif,
    quickAdd,
    move,
    toggleUrgent,
    toggleRepeat,
    addSub,
    toggleSub,
    accept,
    abandon,
    complete,
    bonusXp,
    addReward,
    removeReward,
    buyReward,
    buyGear,
    toggleGear,
    buyFreeze,
    buyItem,
    claimAchievements,
    consumeItem,
    useXpPotion,
    applyCalm,
    feedPet,
    setPetName,
    setStrike,
    exportSave,
    importSave,
  }
}

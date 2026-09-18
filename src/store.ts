import { useCallback, useEffect, useState } from 'react'
import {
  ActiveQuest,
  CRIT_CHANCE,
  CRIT_MULT,
  DoneQuest,
  GameState,
  MAX_ACTIVE,
  PET_FEED_COST,
  Task,
  goldFor,
  lootById,
  petStage,
  randomMonster,
  rollLoot,
  sameDay,
  todayKey,
  uid,
  xpFor,
} from './game'

const KEY = 'quest-do-save-v1'

const empty: GameState = {
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

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as GameState
    return { ...empty, ...parsed }
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
}

export function useGame() {
  const [state, setState] = useState<GameState>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  const addTask = useCallback((t: Omit<Task, 'id' | 'createdAt'>) => {
    const monster = t.monster ?? randomMonster(t.difficulty)
    setState((s) => ({ ...s, pool: [...s.pool, { ...t, monster, id: uid(), createdAt: Date.now() }] }))
  }, [])

  const setHeroName = useCallback((name: string) => {
    setState((s) => ({ ...s, heroName: name }))
  }, [])

  const setHeroLook = useCallback((hair?: string, tunic?: string) => {
    setState((s) => ({ ...s, heroHair: hair, heroTunic: tunic }))
  }, [])

  const setTheme = useCallback((theme: string) => {
    setState((s) => ({ ...s, theme }))
  }, [])

  const setNotif = useCallback((notif: boolean) => {
    setState((s) => ({ ...s, notif }))
  }, [])

  // 매일 반복 토글 — 처치해도 수집함에 다시 나타남
  const toggleRepeat = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      pool: s.pool.map((t) => (t.id === id ? { ...t, repeat: t.repeat ? undefined : 'daily' } : t)),
    }))
  }, [])

  // 보스 레이드: 큰 몬스터를 잡몹으로 쪼개기 (수집함/슬롯 둘 다 가능)
  const addSub = useCallback((id: string, title: string) => {
    const sub = { id: uid(), title }
    const attach = <T extends Task>(t: T): T =>
      t.id === id && (t.subs?.length ?? 0) < 8 ? { ...t, subs: [...(t.subs ?? []), sub] } : t
    setState((s) => ({ ...s, pool: s.pool.map(attach), active: s.active.map(attach) }))
  }, [])

  // 잡몹 하나 처치. 전부 처치하면 'cleared' (→ 보스 자동 사망)
  const toggleSub = useCallback((id: string, subId: string): 'sub' | 'cleared' | null => {
    let res: 'sub' | 'cleared' | null = null
    setState((s) => {
      const q = s.active.find((t) => t.id === id)
      const sub = q?.subs?.find((x) => x.id === subId)
      if (!q || !sub) return s
      const subs = q.subs!.map((x) => (x.id === subId ? { ...x, done: !x.done } : x))
      res = subs.length > 0 && subs.every((x) => x.done) ? 'cleared' : 'sub'
      return { ...s, active: s.active.map((t) => (t.id === id ? { ...t, subs } : t)) }
    })
    return res
  }, [])

  const removeTask = useCallback((id: string) => {
    setState((s) => ({ ...s, pool: s.pool.filter((t) => t.id !== id) }))
  }, [])

  // 빈 슬롯에 바로 적기: 슬롯 비어있으면 active로, 아니면 pool로
  const quickAdd = useCallback((title: string): 'active' | 'pool' => {
    let where: 'active' | 'pool' = 'pool'
    const base: Task = {
      id: uid(),
      title,
      difficulty: 'slime',
      minutes: 15,
      energy: 'low',
      monster: randomMonster('slime'),
      createdAt: Date.now(),
    }
    setState((s) => {
      if (s.active.length < MAX_ACTIVE) {
        where = 'active'
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
    let ok = false
    setState((s) => {
      const task = s.pool.find((t) => t.id === id)
      if (!task || s.active.length >= MAX_ACTIVE) return s
      ok = true
      const quest: ActiveQuest = { ...task, acceptedAt: Date.now() }
      return { ...s, pool: s.pool.filter((t) => t.id !== id), active: [...s.active, quest] }
    })
    return ok
  }, [])

  // 후퇴/도망: active -> pool, 도망 횟수 +1 (2번 도망치면 광폭화)
  const abandon = useCallback((id: string) => {
    setState((s) => {
      const q = s.active.find((t) => t.id === id)
      if (!q) return s
      const { acceptedAt: _a, ...task } = q
      const retreated = { ...task, retreats: (task.retreats ?? 0) + 1 }
      return { ...s, active: s.active.filter((t) => t.id !== id), pool: [...s.pool, retreated] }
    })
  }, [])

  const complete = useCallback((id: string): CompleteResult | null => {
    let result: CompleteResult | null = null
    setState((s) => {
      const q = s.active.find((t) => t.id === id)
      if (!q) return s
      const now = Date.now()
      const doneToday = s.done.filter((d) => sameDay(d.completedAt, now)).length
      const crit = Math.random() < CRIT_CHANCE
      const xp = Math.round(xpFor(q.difficulty, doneToday) * (crit ? CRIT_MULT : 1))
      const gold = goldFor(xp)
      const loot = rollLoot(q.difficulty)
      const prevLevel = Math.floor(s.xp / 100)
      const nextLevel = Math.floor((s.xp + xp) / 100)
      const doneQuest: DoneQuest = { ...q, completedAt: now, xp, lootId: loot.id }
      result = {
        xp,
        gold,
        lootName: lootById(loot.id)?.name,
        leveledUp: nextLevel > prevLevel,
        combo: doneToday + 1,
        crit,
      }
      // 반복 몬스터는 처치해도 수집함에 리스폰
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
              repeat: q.repeat,
              subs: q.subs?.map((x) => ({ ...x, done: undefined })),
              createdAt: now,
            },
          ]
        : []
      return {
        ...s,
        active: s.active.filter((t) => t.id !== id),
        pool: [...s.pool, ...respawn],
        done: [...s.done, doneQuest],
        xp: s.xp + xp,
        gold: s.gold + gold,
        loot: { ...s.loot, [loot.id]: (s.loot[loot.id] ?? 0) + 1 },
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
    let ok = false
    setState((s) => {
      const r = s.rewards.find((x) => x.id === id)
      if (!r || s.gold < r.cost) return s
      ok = true
      return {
        ...s,
        gold: s.gold - r.cost,
        purchases: [...s.purchases, { id: uid(), name: r.name, cost: r.cost, at: Date.now() }],
      }
    })
    return ok
  }, [])

  // ---------- 펫 / 오늘의 일격 ----------
  // 먹이 주기: 골드 10G 소비 → 끼니+1. 진화하면 'evolved'
  const feedPet = useCallback((): 'nogold' | 'fed' | 'evolved' => {
    let res: 'nogold' | 'fed' | 'evolved' = 'nogold'
    setState((s) => {
      if (s.gold < PET_FEED_COST) return s
      const before = petStage(s.petFood).name
      const food = s.petFood + 1
      res = petStage(food).name !== before ? 'evolved' : 'fed'
      return { ...s, gold: s.gold - PET_FEED_COST, petFood: food, petFedAt: Date.now() }
    })
    return res
  }, [])

  const setPetName = useCallback((name: string) => {
    setState((s) => ({ ...s, petName: name }))
  }, [])

  // 오늘의 일격 지정 (하루 1개)
  const setStrike = useCallback((id: string) => {
    setState((s) => ({ ...s, strike: { id, day: todayKey() } }))
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
      setState({ ...empty, ...data })
      return true
    } catch {
      return false
    }
  }, [])

  return {
    state,
    addTask,
    removeTask,
    setHeroName,
    setHeroLook,
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
    feedPet,
    setPetName,
    setStrike,
    exportSave,
    importSave,
  }
}

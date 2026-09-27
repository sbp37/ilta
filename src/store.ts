import { useCallback, useEffect, useRef, useState } from 'react'
import { TaskPatch, mergeSubtasks, validTaskDate } from './taskEditing'
import { empty, inspectSave, migrate, sanitize } from './saveData'
import { villageCompletion } from './village'
import { UndoChange, revertChange } from './undo'
import { SAVE_KEY, checkpoint, preservePrevious, readSave } from './persistence'
import { BulkAction, PlanChoice, applyReturnPlan, organizeTasks } from './organization'
import {
  Achievement,
  ActiveQuest,
  CONSUMABLES,
  CRIT_CHANCE,
  CRIT_MULT,
  DAILY_GOAL_BONUS,
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
  STARTER_BONUS_XP,
  STRIKE_BONUS,
  Task,
  XP_BOOST_MULT,
  applyFreezes,
  chapterOf,
  dailyGoalOf,
  minimumGoalOf,
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
  nextDue,
  petStage,
  raidFor,
  rollLoot,
  sameDay,
  slotsFor,
  strikeRespawn,
  todayKey,
  uid,
  xpFor,
} from './game'

const KEY = SAVE_KEY

// 세이브 검증·마이그레이션은 saveData.ts 로 분리. 기존 import 경로를 위해 다시 내보낸다.
export { inspectSave, migrate, sanitize } from './saveData'
export type { SaveInspection } from './saveData'

export type RestoreResult = { ok: true } | { ok: false; error: string }

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
  goalBonus: number
  strikeBonus: number
  achievements: Achievement[]
  village: string // 마을 주민 의뢰 문구 (성장 단계가 오르면 축하 문구)
}

// 반복 순환: 꺼짐 → 매일 → 평일만 → 주 1회 → 꺼짐
const REPEAT_CYCLE: (Repeat | undefined)[] = [undefined, 'daily', 'weekdays', 'weekly']

export function useGame() {
  const [loaded] = useState(readSave)
  const [state, setState] = useState<GameState>(() =>
    loaded.raw ? migrate(sanitize(JSON.parse(loaded.raw))) : empty,
  )
  const [storageWarning, setStorageWarning] = useState(loaded.warning)
  const [saveAttempt, setSaveAttempt] = useState(0)
  const storageBlocked = useRef(!!loaded.warning)
  const storageConflict = useRef(false)
  const lastSaved = useRef<string | null>(loaded.raw)
  // 해당 행동의 전후 차이만 되돌리기 위해 스냅샷을 함께 보관한다.
  const undoRef = useRef<UndoChange | null>(null)
  // 최신 상태 미러 — 렌더된 상태에 이번 틱에 접수된 전이까지 즉시 반영된다
  const stateRef = useRef(state)
  stateRef.current = state

  // 모든 상태 전이의 단일 진입점. fn을 최신 상태(stateRef)에 동기로 실행해 ref를 먼저
  // 갱신하고 결과를 setState로 넘긴다. React 업데이터는 지연 실행되지만 이 방식은
  // 같은 틱에 연속 호출된 액션도 서로의 결과를 보고 검증·계산하므로 반환값과 실제
  // 상태가 어긋나지 않는다 (업데이터 안에서 플래그를 세우는 패턴의 stale 문제 해결).
  const apply = useCallback((fn: (s: GameState) => GameState) => {
    const next = fn(stateRef.current)
    stateRef.current = next
    setState(next)
  }, [])

  useEffect(() => {
    if (storageBlocked.current) return
    try {
      const previous = localStorage.getItem(KEY)
      if (previous !== lastSaved.current) {
        storageBlocked.current = true
        storageConflict.current = true
        setStorageWarning('다른 창의 저장 내용이 변경됐어요. 현재 기록을 내보낸 뒤 최신 내용을 열어 주세요.')
        return
      }
      const raw = JSON.stringify(state)
      if (previous !== raw) {
        preservePrevious(previous)
        localStorage.setItem(KEY, raw)
      }
      lastSaved.current = raw
      setStorageWarning('')
    } catch {
      setStorageWarning('기기에 저장하지 못했어요. 화면의 기록은 유지 중입니다. 내보내기로 보관해 주세요.')
    }
  }, [state, saveAttempt])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if ((event.key === KEY || event.key === null) && event.newValue !== lastSaved.current) {
        storageBlocked.current = true
        storageConflict.current = true
        setStorageWarning('다른 창의 저장 내용이 변경됐어요. 현재 기록을 내보낸 뒤 최신 내용을 열어 주세요.')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const retrySave = useCallback(() => {
    if (storageBlocked.current) return false
    setSaveAttempt((n) => n + 1)
    return true
  }, [])

  // 휴식일 부적 자동 소모: 앱 켤 때 + 하루 넘어갈 때 어제 빈 날이 있으면 지켜준다
  const checkFreezes = useCallback((): number => {
    let consumed = 0
    apply((s) => {
      const r = applyFreezes(s.done, s.freezes ?? 0, s.freezeUsed ?? [], Date.now())
      const promote = s.tomorrowStrike?.day === todayKey()
      if (r.consumed === 0 && !promote) return s
      consumed = r.consumed
      return {
        ...s,
        freezes: r.freezes,
        freezeUsed: r.used,
        ...(promote ? { strike: s.tomorrowStrike, tomorrowStrike: undefined } : {}),
      }
    })
    return consumed
  }, [apply])

  const addTask = useCallback(
    (t: Omit<Task, 'id' | 'createdAt'>) => {
      const monster = t.monster ?? monsterFor(t.difficulty, t.category)
      apply((s) => ({ ...s, pool: [...s.pool, { ...t, monster, id: uid(), createdAt: Date.now() }] }))
    },
    [apply],
  )

  const setHeroName = useCallback(
    (name: string) => {
      apply((s) => ({ ...s, heroName: name }))
    },
    [apply],
  )

  const setHeroLook = useCallback(
    (hair?: string, tunic?: string) => {
      apply((s) => ({ ...s, heroHair: hair, heroTunic: tunic }))
    },
    [apply],
  )

  const setHeroClass = useCallback(
    (heroClass: HeroClass) => {
      apply((s) => ({ ...s, heroClass }))
    },
    [apply],
  )

  const setTheme = useCallback(
    (theme: string) => {
      apply((s) => ({ ...s, theme }))
    },
    [apply],
  )

  const setNotif = useCallback(
    (notif: boolean) => {
      apply((s) => ({ ...s, notif }))
    },
    [apply],
  )

  const toggleRepeat = useCallback(
    (id: string) => {
      apply((s) => ({
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
    },
    [apply],
  )

  // 보스 레이드: 큰 몬스터를 잡몹으로 쪼개기 (수집함/슬롯 둘 다 가능)
  const addSub = useCallback(
    (id: string, title: string) => {
      if (!title.trim()) return
      const sub = { id: uid(), title: title.trim().slice(0, 40) }
      const attach = <T extends Task>(t: T): T =>
        t.id === id && (t.subs?.length ?? 0) < 8 ? { ...t, subs: [...(t.subs ?? []), sub] } : t
      apply((s) => ({ ...s, pool: s.pool.map(attach), active: s.active.map(attach) }))
    },
    [apply],
  )

  // All steps checked is a milestone; the parent still needs explicit completion.
  const toggleSub = useCallback(
    (id: string, subId: string): 'sub' | 'cleared' | null => {
      let res: 'sub' | 'cleared' | null = null
      apply((s) => {
        const q = s.active.find((t) => t.id === id)
        const sub = q?.subs?.find((x) => x.id === subId)
        if (!q || !sub) return s
        const earns = s.heroClass === 'mage' && !sub.done && !sub.rewarded
        const subs = q.subs!.map((x) =>
          x.id === subId ? { ...x, done: !x.done, rewarded: x.rewarded || earns } : x,
        )
        res = subs.length > 0 && subs.every((x) => x.done) ? 'cleared' : 'sub'
        // 마법사 보상은 같은 회차의 하위 작업마다 한 번만 지급한다.
        const mageBonus = earns ? { xp: s.xp + 3, gold: s.gold + 3 } : {}
        return { ...s, ...mageBonus, active: s.active.map((t) => (t.id === id ? { ...t, subs } : t)) }
      })
      return res
    },
    [apply],
  )

  const removeTask = useCallback(
    (id: string) => {
      apply((s) => {
        if (!s.pool.some((t) => t.id === id)) return s
        const next = { ...s, pool: s.pool.filter((t) => t.id !== id) }
        undoRef.current = { id, before: s, after: next }
        return next
      })
    },
    [apply],
  )

  // 할 일 편집 — 수집함/슬롯 어디 있든. 난이도가 바뀌면 몬스터도 새로 배정
  const updateTask = useCallback(
    (id: string, patch: TaskPatch) => {
      if (patch.title !== undefined && !patch.title.trim()) return null
      if (patch.due !== undefined && !validTaskDate(patch.due)) return null
      const actionId = uid()
      let changed = false
      const patchTask = <T extends Task>(t: T): T => {
        if (t.id !== id) return t
        const next = { ...t, ...patch }
        if (patch.title !== undefined) next.title = patch.title.trim()
        if (patch.subs) next.subs = mergeSubtasks(t.subs ?? [], patch.subs)
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
      apply((s) => {
        if (![...s.pool, ...s.active].some((task) => task.id === id)) return s
        const next = { ...s, pool: s.pool.map(patchTask), active: s.active.map(patchTask) }
        changed = true
        undoRef.current = { id: actionId, before: s, after: next }
        return next
      })
      return changed ? actionId : null
    },
    [apply],
  )

  // 마지막 처치/삭제 되돌리기. 스냅샷이 있으면 true
  const undo = useCallback(
    (id: string): boolean => {
      const change = undoRef.current
      if (!change || change.id !== id) return false
      const current = stateRef.current
      const next = revertChange(current, change)
      if (!next) return false
      // If new tasks filled the slots, keep the restored tasks safely in the pool.
      // The undo id is an action id (not always a task id), so pick the tasks this undo brought back.
      const limit = slotsFor(levelOf(next.xp))
      if (next.active.length > limit) {
        const stayed = new Set(current.active.map((q) => q.id))
        const active = [...next.active] // never mutate arrays shared with the live state
        const moved: Task[] = []
        while (active.length > limit) {
          let index = active.length - 1
          active.forEach((q, i) => {
            if (!stayed.has(q.id)) index = i
          })
          const [{ acceptedAt: _at, ...rest }] = active.splice(index, 1)
          moved.push(rest)
        }
        next.active = active
        next.pool = [...next.pool, ...moved]
      }
      undoRef.current = null
      apply(() => next)
      return true
    },
    [apply],
  )

  // 빈 슬롯에 바로 적기: 슬롯 비어있으면 active로, 아니면 pool로
  const quickAdd = useCallback(
    (title: string): 'active' | 'pool' => {
      let where: 'active' | 'pool' = 'pool'
      const base: Task = {
        id: uid(),
        title,
        difficulty: 'slime',
        minutes: 15,
        energy: 'low',
        monster: monsterFor('slime'),
        createdAt: Date.now(),
      }
      apply((s) => {
        if (s.active.length < slotsFor(levelOf(s.xp))) {
          where = 'active'
          return { ...s, active: [...s.active, { ...base, acceptedAt: Date.now() }] }
        }
        return { ...s, pool: [...s.pool, base] }
      })
      return where
    },
    [apply],
  )

  // 수집함 순서 이동 (위 = 먼저 뽑힐 확률 높음)
  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      apply((s) => {
        const i = s.pool.findIndex((t) => t.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= s.pool.length) return s
        const pool = [...s.pool]
        ;[pool[i], pool[j]] = [pool[j], pool[i]]
        return { ...s, pool }
      })
    },
    [apply],
  )

  const toggleUrgent = useCallback(
    (id: string) => {
      apply((s) => ({
        ...s,
        pool: s.pool.map((t) => (t.id === id ? { ...t, urgent: !t.urgent } : t)),
      }))
    },
    [apply],
  )

  // 수락: pool -> active (최대 3개). 성공 여부 반환
  const accept = useCallback(
    (id: string): boolean => {
      let ok = false
      apply((s) => {
        const task = s.pool.find((t) => t.id === id)
        if (!task || s.active.length >= slotsFor(levelOf(s.xp)) || !isAvailable(task)) return s
        ok = true
        const quest: ActiveQuest = { ...task, acceptedAt: Date.now() }
        return { ...s, pool: s.pool.filter((t) => t.id !== id), active: [...s.active, quest] }
      })
      return ok
    },
    [apply],
  )

  // 후퇴/도망: active -> pool, 도망 횟수 +1 (2번 도망치면 광폭화). 나무 방패가 있으면 50%는 기록 안 남음
  const abandon = useCallback(
    (id: string): 'retreat' | 'shielded' => {
      let shielded = false
      apply((s) => {
        const q = s.active.find((t) => t.id === id)
        if (!q) return s
        shielded = Math.random() < lootBonus(s.loot).shieldChance
        const { acceptedAt: _a, ...task } = q
        const retreated = shielded ? task : { ...task, retreats: (task.retreats ?? 0) + 1 }
        return { ...s, active: s.active.filter((t) => t.id !== id), pool: [...s.pool, retreated] }
      })
      return shielded ? 'shielded' : 'retreat'
    },
    [apply],
  )

  const complete = useCallback(
    (id: string): CompleteResult | null => {
      let result: CompleteResult | null = null
      apply((s) => {
        const q = s.active.find((t) => t.id === id)
        if (!q) return s
        const now = Date.now()
        const day = todayKey(now)
        const doneToday = s.done.filter((d) => sameDay(d.completedAt, now)).length
        const goalBonus =
          doneToday + 1 >= dailyGoalOf(s) && !(s.goalAwards ?? []).includes(day) && doneToday < dailyGoalOf(s)
            ? DAILY_GOAL_BONUS
            : 0
        const strikeBonus =
          s.strike?.id === id && s.strike.day === day && !(s.strikeAwards ?? []).includes(day)
            ? STRIKE_BONUS
            : 0
        const bonus = lootBonus(s.loot)
        const crit = Math.random() < CRIT_CHANCE + bonus.critChance
        let xp = xpFor(q.difficulty, doneToday)
        if (s.heroClass === 'warrior') xp += Math.min(doneToday, 5) * 2 // 전사: 콤보 보너스 2배
        xp = Math.round(xp * (crit ? CRIT_MULT + bonus.critMult : 1) * (1 + bonus.xpMult))
        const boosted = !!s.xpBoost
        if (boosted) xp = Math.round(xp * XP_BOOST_MULT) // XP 포션
        let gold = goldFor(xp)
        if (s.heroClass === 'rogue') gold = Math.round(gold * 1.25) // 도적: 골드 +25%
        gold = Math.round(gold * (1 + bonus.goldMult))
        const loot = rollLoot(q.difficulty)
        const prevLevel = levelOf(s.xp)
        const nextLevel = levelOf(s.xp + xp + goalBonus + strikeBonus)
        // 레벨업 축하 골드 (여러 레벨 한 번에 오르면 합산)
        let levelGold = 0
        for (let l = prevLevel + 1; l <= nextLevel; l++) levelGold += levelUpGold(l)
        gold += levelGold
        // 빨간 포션이 5개 모이면 XP 포션으로
        const lootNext = { ...s.loot, [loot.id]: (s.loot[loot.id] ?? 0) + 1 }
        const potionsConverted = (lootNext.potion ?? 0) >= POTION_CONVERT
        const items = { ...(s.items ?? {}) }
        if (potionsConverted) {
          lootNext.potion -= POTION_CONVERT
          items.xppotion = (items.xppotion ?? 0) + 1
        }
        const doneQuest: DoneQuest = { ...q, completedAt: now, xp, lootId: loot.id }
        // 주간 보스 / 챕터 보스: 얻은 XP만큼 HP 감소.
        // 잡지 못한 챕터 보스는 주가 넘어가도 이월돼 계속 싸운다 (raidFor)
        const raid = raidFor(s.raid, now)
        const raidHp = Math.max(0, raid.hp - xp)
        const raidKilled = raid.hp > 0 && raidHp === 0
        if (raidKilled) gold += raid.reward ?? chapterOf(now).reward
        const chapterCleared = raidKilled && !!raid.isFinal
        result = {
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
          goalBonus,
          strikeBonus,
          achievements: [],
          village: villageCompletion(s.done, q),
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
                due: nextDue(q.due, q.repeat, now),
                urgent: q.urgent,
                monster: q.monster,
                cost: q.cost,
                category: q.category,
                repeat: q.repeat,
                availableAt: nextAvailable(q.repeat, now),
                subs: q.subs?.map((x) => ({ id: uid(), title: x.title })),
                createdAt: now,
              },
            ]
          : []
        let next: GameState = {
          ...s,
          active: s.active.filter((t) => t.id !== id),
          pool: [...s.pool, ...respawn],
          done: [...s.done, doneQuest],
          xp: s.xp + xp + goalBonus + strikeBonus,
          gold: s.gold + gold + goalBonus + strikeBonus,
          goalAwards: goalBonus ? [...(s.goalAwards ?? []), day] : s.goalAwards,
          strikeAwards: strikeBonus ? [...(s.strikeAwards ?? []), day] : s.strikeAwards,
          loot: lootNext,
          items,
          xpBoost: false,
          strike: strikeRespawn(s.strike, id, respawn[0]?.id, now),
          tomorrowStrike: strikeRespawn(s.tomorrowStrike, id, respawn[0]?.id, now),
          raid: { ...raid, hp: raidHp },
          raidKills: (s.raidKills ?? 0) + (raidKilled ? 1 : 0),
          chapterClears: chapterCleared
            ? [...new Set([...(s.chapterClears ?? []), raid.chapterKey ?? chapterOf(now).key])]
            : s.chapterClears,
        }
        const achievements = newAchievements(next, now)
        if (achievements.length)
          next = {
            ...next,
            achieved: [...(next.achieved ?? []), ...achievements.map((a) => a.id)],
            gold: next.gold + achievements.reduce((sum, a) => sum + a.gold, 0),
          }
        result.achievements = achievements
        undoRef.current = { id, before: s, after: next }
        return next
      })
      return result
    },
    [apply],
  )

  const finishFocus = useCallback(
    (session: { id: string; questId: string; seconds: number; starter: boolean }): boolean => {
      let rewarded = false
      apply((s) => {
        const task = s.active.find((q) => q.id === session.questId)
        if (!task || s.focusSessions?.some((f) => f.id === session.id)) return s
        rewarded = session.starter && !task.starterRewarded
        return {
          ...s,
          xp: s.xp + (rewarded ? STARTER_BONUS_XP : 0),
          gold: s.gold + (rewarded ? STARTER_BONUS_XP : 0),
          focusSessions: [
            ...(s.focusSessions ?? []),
            {
              id: session.id,
              questId: task.id,
              title: task.title,
              seconds: session.seconds,
              endedAt: Date.now(),
            },
          ],
          active: s.active.map((q) => (q.id === task.id && rewarded ? { ...q, starterRewarded: true } : q)),
        }
      })
      return rewarded
    },
    [apply],
  )

  const setPreferences = useCallback(
    (
      patch: Pick<Partial<GameState>, 'dailyGoal' | 'minimumGoal' | 'gentle' | 'readable' | 'reducedMotion'>,
    ) => {
      apply((s) => ({
        ...s,
        ...patch,
        dailyGoal: dailyGoalOf({ ...s, ...patch }),
        minimumGoal: minimumGoalOf({ ...s, ...patch }),
      }))
    },
    [apply],
  )

  const bulkOrganize = useCallback(
    (ids: string[], action: BulkAction) => {
      const id = uid()
      apply((s) => {
        const next = organizeTasks(s, ids, action)
        undoRef.current = { id, before: s, after: next }
        return next
      })
      return id
    },
    [apply],
  )

  const planReturn = useCallback(
    (choices: Record<string, PlanChoice>) => {
      let id: string | null = null
      apply((s) => {
        const next = applyReturnPlan(s, choices)
        if (!next) return s
        id = uid()
        undoRef.current = { id, before: s, after: next }
        return next
      })
      return id
    },
    [apply],
  )

  const saveReview = useCallback(
    (day: string, review: { win: string; obstacle: string; next: string }) => {
      apply((s) => ({ ...s, reviews: { ...s.reviews, [day]: review } }))
    },
    [apply],
  )

  const returnToPool = useCallback(
    (id: string) => {
      apply((s) => {
        const task = s.active.find((q) => q.id === id)
        if (!task) return s
        const { acceptedAt: _at, ...rest } = task
        return { ...s, active: s.active.filter((q) => q.id !== id), pool: [rest, ...s.pool] }
      })
    },
    [apply],
  )

  // ---------- 상점 ----------
  const addReward = useCallback(
    (name: string, cost: number) => {
      apply((s) => ({
        ...s,
        rewards: [...s.rewards, { id: uid(), name, cost, createdAt: Date.now() }],
      }))
    },
    [apply],
  )

  const removeReward = useCallback(
    (id: string) => {
      apply((s) => ({ ...s, rewards: s.rewards.filter((r) => r.id !== id) }))
    },
    [apply],
  )

  // 구매: 골드 부족하면 false
  const buyReward = useCallback(
    (id: string): boolean => {
      let ok = false
      apply((s) => {
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
    },
    [apply],
  )

  // ---------- 장비 상점 ----------
  // 구매하면 자동 장착 (즉시 보상감)
  const buyGear = useCallback(
    (id: string): boolean => {
      let ok = false
      apply((s) => {
        const item = GEAR.find((g) => g.id === id)
        if (!item || s.gold < item.cost || (s.gear ?? []).includes(id)) return s
        ok = true
        return {
          ...s,
          gold: s.gold - item.cost,
          gear: [...(s.gear ?? []), id],
          equippedGear: [...(s.equippedGear ?? []), id],
        }
      })
      return ok
    },
    [apply],
  )

  const toggleGear = useCallback(
    (id: string) => {
      apply((s) => {
        const eq = s.equippedGear ?? []
        return { ...s, equippedGear: eq.includes(id) ? eq.filter((x) => x !== id) : [...eq, id] }
      })
    },
    [apply],
  )

  // 휴식일 부적 구매 — 최대 FREEZE_MAX개
  const buyFreeze = useCallback((): 'nogold' | 'full' | 'ok' => {
    const cur = stateRef.current
    if ((cur.freezes ?? 0) >= FREEZE_MAX) return 'full'
    if (cur.gold < FREEZE_COST) return 'nogold'
    apply((s) => {
      const have = s.freezes ?? 0
      if (have >= FREEZE_MAX || s.gold < FREEZE_COST) return s
      return { ...s, gold: s.gold - FREEZE_COST, freezes: have + 1 }
    })
    return 'ok'
  }, [apply])

  // ---------- 소모품 ----------
  const buyItem = useCallback(
    (id: string): 'nogold' | 'full' | 'ok' => {
      const cur = stateRef.current
      const item = CONSUMABLES.find((c) => c.id === id)
      if (!item) return 'nogold'
      if (itemCount(cur, id) >= ITEM_MAX) return 'full'
      if (cur.gold < item.cost) return 'nogold'
      apply((s) => {
        if (s.gold < item.cost || itemCount(s, id) >= ITEM_MAX) return s
        return { ...s, gold: s.gold - item.cost, items: { ...(s.items ?? {}), [id]: itemCount(s, id) + 1 } }
      })
      return 'ok'
    },
    [apply],
  )

  // 보유 소모품 하나 소모. 없으면 false
  const consumeItem = useCallback(
    (id: string): boolean => {
      if (itemCount(stateRef.current, id) <= 0) return false
      apply((s) => {
        const n = itemCount(s, id)
        if (n <= 0) return s
        return { ...s, items: { ...(s.items ?? {}), [id]: n - 1 } }
      })
      return true
    },
    [apply],
  )

  // XP 포션 사용 → 다음 처치 XP 1.5배
  const useXpPotion = useCallback((): 'none' | 'already' | 'ok' => {
    const cur = stateRef.current
    if (cur.xpBoost) return 'already'
    if (itemCount(cur, 'xppotion') <= 0) return 'none'
    apply((s) => {
      const n = itemCount(s, 'xppotion')
      if (s.xpBoost || n <= 0) return s
      return { ...s, xpBoost: true, items: { ...(s.items ?? {}), xppotion: n - 1 } }
    })
    return 'ok'
  }, [apply])

  // 진정의 향: 광폭 몹의 도망 기록·묵힌 날 초기화 (마감은 그대로)
  const applyCalm = useCallback(
    (taskId: string): boolean => {
      if (itemCount(stateRef.current, 'calm') <= 0) return false
      apply((s) => {
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
    },
    [apply],
  )

  // ---------- 펫 / 오늘의 일격 ----------
  // 먹이 주기: 골드 10G 소비 → 끼니+1. 진화하면 'evolved'
  const feedPet = useCallback((): 'nogold' | 'fed' | 'evolved' => {
    let res: 'nogold' | 'fed' | 'evolved' = 'nogold'
    apply((s) => {
      if (s.gold < PET_FEED_COST) return s
      const before = petStage(s.petFood).name
      const food = s.petFood + 1
      res = petStage(food).name !== before ? 'evolved' : 'fed'
      return { ...s, gold: s.gold - PET_FEED_COST, petFood: food, petFedAt: Date.now() }
    })
    return res
  }, [apply])

  const setPetName = useCallback(
    (name: string) => {
      apply((s) => ({ ...s, petName: name }))
    },
    [apply],
  )

  // 오늘의 일격 지정 (하루 1개). day를 넘기면 그 날짜용으로 예약
  const setStrike = useCallback(
    (id: string, day?: string) => {
      apply((s) =>
        day && day !== todayKey()
          ? { ...s, tomorrowStrike: { id, day } }
          : { ...s, strike: { id, day: todayKey() } },
      )
    },
    [apply],
  )

  // ---------- 업적 ----------
  // 조건을 새로 만족한 업적을 받아 골드를 준다. 받은 목록을 돌려준다.
  const claimAchievements = useCallback((): Achievement[] => {
    let fresh: Achievement[] = []
    apply((s) => {
      // Decide and pay inside the transition so gold always matches what is newly recorded.
      const have = new Set(s.achieved ?? [])
      fresh = newAchievements(s).filter((a) => !have.has(a.id))
      if (fresh.length === 0) return s
      const bonus = fresh.reduce((sum, a) => sum + a.gold, 0)
      return { ...s, achieved: [...(s.achieved ?? []), ...fresh.map((a) => a.id)], gold: s.gold + bonus }
    })
    return fresh
  }, [apply])

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

  const importSave = useCallback(
    (text: string, expectedStored: string | null): RestoreResult => {
      const inspected = inspectSave(text)
      if (!inspected.ok) return inspected
      try {
        const previous = localStorage.getItem(KEY)
        if (previous !== expectedStored)
          return { ok: false, error: '미리보기 이후 기록이 변경됐어요. 백업을 다시 선택해 주세요.' }
        if (storageConflict.current)
          return {
            ok: false,
            error: '다른 창의 최신 기록이 있어요. 현재 기록을 내보낸 뒤 새로고침하고 복구해 주세요.',
          }
        if (!checkpoint(JSON.stringify(stateRef.current), 'before-restore'))
          return {
            ok: false,
            error:
              '복구 전 기록을 백업할 공간이 부족하거나 저장소에 접근할 수 없어요. 현재 기록은 유지됩니다.',
          }
        localStorage.setItem(KEY, inspected.raw)
        lastSaved.current = inspected.raw
        storageBlocked.current = false
        setStorageWarning('')
        undoRef.current = null
        apply(() => inspected.state)
        return { ok: true }
      } catch {
        return { ok: false, error: '복구 내용을 저장하지 못했어요. 현재 기록은 유지됩니다.' }
      }
    },
    [apply],
  )

  return {
    state,
    storageWarning,
    retrySave,
    bulkOrganize,
    planReturn,
    setPreferences,
    saveReview,
    returnToPool,
    finishFocus,
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

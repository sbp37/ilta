import { useCallback, useEffect, useRef, useState } from 'react'
import { SPRITES } from './sprites'
import { UndoChange, revertChange } from './undo'
import { SAVE_KEY, checkpoint, isSave, preservePrevious, readSave } from './persistence'
import { BulkAction, PlanChoice, applyReturnPlan, organizeTasks } from './organization'
import {
  Achievement,
  ActiveQuest,
  CATEGORY_IDS,
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
  SAVE_VERSION,
  STARTER_BONUS_XP,
  STRIKE_BONUS,
  THEMES,
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
  xpAtLevel,
  xpFor,
} from './game'

const KEY = SAVE_KEY

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

const DIFF_IDS = new Set(['slime', 'elite', 'boss'])
const ENERGY_IDS = new Set(['low', 'mid', 'high'])
const REPEAT_IDS = new Set(['daily', 'weekdays', 'weekly'])
const CLASS_IDS = new Set(['warrior', 'mage', 'rogue'])
const THEME_IDS = new Set(THEMES.map((t) => t.id))
const GEAR_IDS = new Set(GEAR.map((g) => g.id))
const CATEGORY_IDS_SET = new Set<string>(CATEGORY_IDS)

const fin = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
const strArr = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined
const numMap = (v: unknown): Record<string, number> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).filter(([, n]) => typeof n === 'number' && Number.isFinite(n)))
    : {}

// 세이브의 태스크 하나를 검증. 잘못된 필드는 버리거나 기본값으로 — 렌더가 깨지지 않는
// 상태를 보장하는 게 목적 (없는 enum 값 하나가 앱 전체를 죽이는 걸 막는다)
function sanitizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Task
  if (typeof t.title !== 'string' || !t.title.trim()) return null
  const category = typeof t.category === 'string' && CATEGORY_IDS_SET.has(t.category) ? t.category : undefined
  const task: Task = {
    id: typeof t.id === 'string' && t.id ? t.id : uid(),
    title: t.title,
    difficulty: DIFF_IDS.has(t.difficulty) ? t.difficulty : 'slime',
    minutes: Math.max(1, fin(t.minutes, 15)),
    energy: ENERGY_IDS.has(t.energy) ? t.energy : 'low',
    createdAt: fin(t.createdAt, Date.now()),
  }
  if (typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due)) task.due = t.due
  if (t.urgent === true) task.urgent = true
  // 몬스터는 스프라이트가 없으면 분류/난이도에서 다시 뽑는다
  if (typeof t.monster === 'string' && SPRITES[t.monster]) task.monster = t.monster
  if (typeof t.cost === 'string') task.cost = t.cost
  if (t.starterRewarded === true) task.starterRewarded = true
  if (typeof t.retreats === 'number' && Number.isFinite(t.retreats)) task.retreats = t.retreats
  if (typeof t.repeat === 'string' && REPEAT_IDS.has(t.repeat)) task.repeat = t.repeat
  if (typeof t.availableAt === 'number' && Number.isFinite(t.availableAt)) task.availableAt = t.availableAt
  if (category) task.category = category
  if (Array.isArray(t.subs))
    task.subs = t.subs
      .filter(
        (s): s is { id: string; title: string; done?: boolean } =>
          !!s && typeof s === 'object' && typeof (s as { title?: unknown }).title === 'string',
      )
      .map((s) => ({
        id: typeof s.id === 'string' ? s.id : uid(),
        title: s.title,
        done: s.done === true,
        rewarded: ('rewarded' in s && s.rewarded === true) || s.done === true,
      }))
  return task
}

// 외부에서 온 데이터(localStorage·불러오기)를 GameState로 정제한다.
// 타입/enum이 하나라도 깨져 있으면 앱 전체가 크래시하므로 필드별로 검증한다.
export function sanitize(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') return empty
  const s = raw as GameState
  // 파생 타입 필드(acceptedAt 등)는 sanitizeTask가 버리므로 원본에서 다시 읽는다
  const tasks = (v: unknown): { t: Task; r: Record<string, unknown> }[] =>
    Array.isArray(v)
      ? v.flatMap((r) => {
          const t = sanitizeTask(r)
          return t && r && typeof r === 'object' ? [{ t, r: r as Record<string, unknown> }] : []
        })
      : []
  const out: GameState = {
    ...empty,
    pool: tasks(s.pool).map(({ t }) => t),
    archived: tasks(s.archived).map(({ t }) => t),
    active: tasks(s.active).map(({ t, r }) => ({
      ...t,
      acceptedAt: fin(r.acceptedAt, Date.now()),
    })),
    done: tasks(s.done).map(({ t, r }) => ({
      ...t,
      completedAt: fin(r.completedAt, Date.now()),
      xp: fin(r.xp, 0),
      lootId: typeof r.lootId === 'string' ? r.lootId : undefined,
    })),
    xp: Math.max(0, fin(s.xp, 0)),
    gold: Math.max(0, fin(s.gold, 0)),
    loot: numMap(s.loot),
    rewards: Array.isArray(s.rewards)
      ? s.rewards.filter((r) => r && typeof r.id === 'string' && typeof r.name === 'string')
      : [],
    purchases: Array.isArray(s.purchases)
      ? s.purchases.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
      : [],
    petFood: Math.max(0, fin(s.petFood, 0)),
    version: fin(s.version, 1),
  }
  if (typeof s.heroName === 'string') out.heroName = s.heroName
  if (typeof s.heroHair === 'string') out.heroHair = s.heroHair
  if (typeof s.heroTunic === 'string') out.heroTunic = s.heroTunic
  if (typeof s.petName === 'string') out.petName = s.petName
  if (typeof s.petFedAt === 'number' && Number.isFinite(s.petFedAt)) out.petFedAt = s.petFedAt
  if (
    s.strike &&
    typeof s.strike === 'object' &&
    typeof s.strike.id === 'string' &&
    typeof s.strike.day === 'string'
  )
    out.strike = s.strike
  if (typeof s.theme === 'string' && THEME_IDS.has(s.theme as (typeof THEMES)[number]['id']))
    out.theme = s.theme
  if (s.notif === true) out.notif = true
  if (typeof s.heroClass === 'string' && CLASS_IDS.has(s.heroClass)) out.heroClass = s.heroClass
  if (s.raid && typeof s.raid === 'object' && typeof s.raid.key === 'string') {
    out.raid = {
      ...s.raid,
      hp: Math.max(0, fin(s.raid.hp, 0)),
      max: Math.max(1, fin(s.raid.max, 300)),
      boss: typeof s.raid.boss === 'string' && SPRITES[s.raid.boss] ? s.raid.boss : undefined,
    }
  }
  if (s.gear) out.gear = strArr(s.gear)?.filter((g) => GEAR_IDS.has(g))
  if (s.equippedGear) out.equippedGear = strArr(s.equippedGear)?.filter((g) => GEAR_IDS.has(g))
  if (typeof s.freezes === 'number') out.freezes = Math.max(0, s.freezes)
  if (s.freezeUsed) out.freezeUsed = strArr(s.freezeUsed)
  if (s.items) out.items = numMap(s.items)
  if (s.xpBoost === true) out.xpBoost = true
  if (s.achieved) out.achieved = strArr(s.achieved)
  if (typeof s.raidKills === 'number') out.raidKills = Math.max(0, s.raidKills)
  if (s.chapterClears) out.chapterClears = strArr(s.chapterClears)
  out.dailyGoal = Math.max(1, Math.min(10, Math.round(fin(s.dailyGoal, 3))))
  out.minimumGoal = minimumGoalOf({ ...out, minimumGoal: fin(s.minimumGoal, 1) })
  if (typeof s.lastVisitedAt === 'number' && Number.isFinite(s.lastVisitedAt))
    out.lastVisitedAt = s.lastVisitedAt
  if (s.goalAwards) out.goalAwards = strArr(s.goalAwards)
  if (s.strikeAwards) out.strikeAwards = strArr(s.strikeAwards)
  if (s.tomorrowStrike && typeof s.tomorrowStrike.id === 'string' && typeof s.tomorrowStrike.day === 'string')
    out.tomorrowStrike = s.tomorrowStrike
  out.gentle = s.gentle !== false
  out.readable = s.readable === true
  out.reducedMotion = s.reducedMotion === true
  if (Array.isArray(s.focusSessions))
    out.focusSessions = s.focusSessions.filter(
      (f) =>
        f &&
        typeof f.id === 'string' &&
        typeof f.questId === 'string' &&
        typeof f.title === 'string' &&
        Number.isFinite(f.seconds) &&
        f.seconds > 0 &&
        Number.isFinite(f.endedAt),
    )
  if (s.reviews && typeof s.reviews === 'object' && !Array.isArray(s.reviews)) {
    out.reviews = Object.fromEntries(
      Object.entries(s.reviews)
        .filter(
          ([, r]) =>
            r && typeof r.win === 'string' && typeof r.obstacle === 'string' && typeof r.next === 'string',
        )
        .map(([day, r]) => [
          day,
          { win: r.win.slice(0, 500), obstacle: r.obstacle.slice(0, 500), next: r.next.slice(0, 500) },
        ]),
    )
  }
  return out
}

export type SaveInspection =
  { ok: true; state: GameState; raw: string; omittedTasks: number } | { ok: false; error: string }

export function inspectSave(text: string): SaveInspection {
  try {
    const parsed = JSON.parse(text)
    if (parsed?.app && parsed.app !== 'ilta')
      return { ok: false, error: '일타에서 내보낸 저장 파일이 아니에요.' }
    const data = parsed?.data ?? parsed
    if (!isSave(JSON.stringify(data)))
      return { ok: false, error: '할 일과 완료 기록이 포함된 일타 저장 파일을 선택해 주세요.' }
    if (typeof data.version === 'number' && data.version > SAVE_VERSION)
      return { ok: false, error: '더 새로운 버전의 저장 파일이에요. 앱을 업데이트한 뒤 불러와 주세요.' }
    const state = migrate(sanitize(data))
    const originalCount = [data.pool, data.active, data.done, data.archived].reduce(
      (sum, tasks) => sum + (Array.isArray(tasks) ? tasks.length : 0),
      0,
    )
    const count = state.pool.length + state.active.length + state.done.length + (state.archived?.length ?? 0)
    return { ok: true, state, raw: JSON.stringify(state), omittedTasks: originalCount - count }
  } catch {
    return { ok: false, error: '파일을 읽을 수 없어요. JSON 저장 파일인지 확인해 주세요.' }
  }
}

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
      const sub = { id: uid(), title }
      const attach = <T extends Task>(t: T): T =>
        t.id === id && (t.subs?.length ?? 0) < 8 ? { ...t, subs: [...(t.subs ?? []), sub] } : t
      apply((s) => ({ ...s, pool: s.pool.map(attach), active: s.active.map(attach) }))
    },
    [apply],
  )

  // 잡몹 하나 처치. 전부 처치하면 'cleared' (→ 보스 자동 사망)
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
    (
      id: string,
      patch: Partial<
        Pick<Task, 'title' | 'difficulty' | 'minutes' | 'energy' | 'due' | 'cost' | 'repeat' | 'category'>
      >,
    ) => {
      const patchTask = <T extends Task>(t: T): T => {
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
      apply((s) => ({ ...s, pool: s.pool.map(patchTask), active: s.active.map(patchTask) }))
    },
    [apply],
  )

  // 마지막 처치/삭제 되돌리기. 스냅샷이 있으면 true
  const undo = useCallback(
    (id: string): boolean => {
      const change = undoRef.current
      if (!change || change.id !== id) return false
      const next = revertChange(stateRef.current, change)
      if (!next) return false
      // If new tasks filled the slots, keep the restored task safely in the pool.
      while (next.active.length > slotsFor(levelOf(next.xp))) {
        const index = next.active.findIndex((q) => q.id === id)
        const [task] = next.active.splice(index < 0 ? next.active.length - 1 : index, 1)
        const { acceptedAt: _at, ...rest } = task
        next.pool = [...next.pool, rest]
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

  const bonusXp = useCallback(
    (amount: number) => {
      apply((s) => ({ ...s, xp: s.xp + amount, gold: s.gold + amount }))
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
    const earned = newAchievements(stateRef.current)
    if (earned.length === 0) return []
    const ids = earned.map((a) => a.id)
    const bonus = earned.reduce((sum, a) => sum + a.gold, 0)
    apply((s) => {
      const have = new Set(s.achieved ?? [])
      const fresh = ids.filter((id) => !have.has(id))
      if (fresh.length === 0) return s
      return { ...s, achieved: [...(s.achieved ?? []), ...fresh], gold: s.gold + bonus }
    })
    return earned
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

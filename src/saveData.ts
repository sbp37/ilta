// 외부에서 온 세이브(localStorage·백업 파일)를 현재 GameState 로 올리는 순수 함수 모음.
// React 에 의존하지 않으므로 단위 테스트와 불러오기 미리보기에서 그대로 쓴다.
import { isMonsterSprite } from './sprites'
import { isSave } from './persistence'
import {
  CATEGORY_IDS,
  GEAR,
  GameState,
  SAVE_VERSION,
  THEMES,
  Task,
  minimumGoalOf,
  uid,
  xpAtLevel,
} from './game'

export const empty: GameState = {
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
  if (isMonsterSprite(t.monster)) task.monster = t.monster
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
      boss: isMonsterSprite(s.raid.boss) ? s.raid.boss : undefined,
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

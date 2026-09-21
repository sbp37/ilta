import {
  Category,
  GameState,
  Task,
  isAvailable,
  levelOf,
  localDate,
  monsterFor,
  slotsFor,
  todayKey,
} from './game'

export type BulkAction =
  | { type: 'archive' }
  | { type: 'restore' }
  | { type: 'category'; category?: Category }
  | { type: 'postpone'; date: string }
export type PlanChoice = 'today' | 'pool' | 'tomorrow' | 'archive'

export function tomorrowDate(now = Date.now()): string {
  const date = new Date(now)
  date.setDate(date.getDate() + 1)
  return localDate(date.getTime())
}

function postpone(task: Task, date: string): Task {
  return {
    ...task,
    availableAt: new Date(`${date}T00:00:00`).getTime(),
    due: task.due ? date : undefined,
    urgent: false,
  }
}

function clearMovedStrike(s: GameState, ids: Set<string>): GameState {
  return {
    ...s,
    strike: s.strike && ids.has(s.strike.id) ? undefined : s.strike,
    tomorrowStrike: s.tomorrowStrike && ids.has(s.tomorrowStrike.id) ? undefined : s.tomorrowStrike,
  }
}

export function organizeTasks(s: GameState, ids: string[], action: BulkAction, now = Date.now()): GameState {
  const selected = new Set(ids)
  const archived = s.archived ?? []
  if (action.type === 'restore') {
    return {
      ...s,
      archived: archived.filter((t) => !selected.has(t.id)),
      pool: [...s.pool, ...archived.filter((t) => selected.has(t.id))],
    }
  }
  if (
    action.type === 'postpone' &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(action.date) ||
      action.date <= localDate(now) ||
      !Number.isFinite(new Date(`${action.date}T00:00:00`).getTime()) ||
      localDate(new Date(`${action.date}T00:00:00`).getTime()) !== action.date)
  )
    return s
  if (action.type === 'archive') {
    return clearMovedStrike(
      {
        ...s,
        pool: s.pool.filter((t) => !selected.has(t.id)),
        archived: [...archived, ...s.pool.filter((t) => selected.has(t.id))],
      },
      selected,
    )
  }
  const pool = s.pool.map((t) =>
    !selected.has(t.id)
      ? t
      : action.type === 'category'
        ? {
            ...t,
            category: action.category,
            monster: action.category === t.category ? t.monster : monsterFor(t.difficulty, action.category),
          }
        : postpone(t, action.date),
  )
  const next = { ...s, pool }
  return action.type === 'postpone' ? clearMovedStrike(next, selected) : next
}

// Build the whole return plan before changing state, so capacity errors cannot partially apply it.
export function applyReturnPlan(
  s: GameState,
  choices: Record<string, PlanChoice>,
  now = Date.now(),
): GameState | null {
  const tasks = [...s.active, ...s.pool]
  const today = tasks.filter(
    (t) => choices[t.id] === 'today' || (!choices[t.id] && s.active.some((q) => q.id === t.id)),
  )
  if (today.length > slotsFor(levelOf(s.xp)) || today.some((t) => !isAvailable(t, now))) return null
  const next: GameState = { ...s, pool: [], active: [], archived: [...(s.archived ?? [])] }
  const moved = new Set<string>()
  for (const t of tasks) {
    const choice = choices[t.id] ?? (s.active.some((q) => q.id === t.id) ? 'today' : 'pool')
    if (choice === 'today') {
      const active = s.active.find((q) => q.id === t.id)
      next.active.push({ ...t, acceptedAt: active?.acceptedAt ?? now })
    } else if (choice === 'archive') {
      next.archived!.push(t)
      moved.add(t.id)
    } else if (choice === 'tomorrow') {
      next.pool.push(postpone(t, tomorrowDate(now)))
      moved.add(t.id)
    } else next.pool.push(t)
  }
  const result = clearMovedStrike(next, moved)
  if (!result.strike || result.strike.day !== todayKey(now)) {
    result.strike = today[0] ? { id: today[0].id, day: todayKey(now) } : undefined
  }
  return result
}

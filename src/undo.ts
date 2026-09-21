import { GameState } from './game'

export interface UndoChange {
  id: string
  before: GameState
  after: GameState
}

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Revert this action only. A dependent change (spent rewards, edited respawn) blocks undo.
export function revertChange(current: GameState, change: UndoChange): GameState | null {
  const result = { ...current }
  const { before, after } = change
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof GameState>) {
    if (equal(before[key], after[key])) continue
    if (key === 'pool' || key === 'active' || key === 'done' || key === 'archived') {
      const oldItems = before[key] ?? []
      const newItems = after[key] ?? []
      const affected = new Set(
        [...oldItems, ...newItems]
          .map((t) => t.id)
          .filter(
            (id) =>
              !equal(
                oldItems.find((t) => t.id === id),
                newItems.find((t) => t.id === id),
              ),
          ),
      )
      for (const id of affected) {
        if (
          !equal(
            (current[key] ?? []).find((t) => t.id === id),
            newItems.find((t) => t.id === id),
          )
        )
          return null
      }
      const items = (current[key] ?? []).filter((t) => !affected.has(t.id))
      for (const [index, task] of oldItems.entries()) {
        if (affected.has(task.id)) items.splice(Math.min(index, items.length), 0, task)
      }
      Object.assign(result, { [key]: items })
    } else {
      if (!equal(current[key], after[key])) return null
      Object.assign(result, { [key]: before[key] })
    }
  }
  return result
}

import { SubTask, Task, localDate } from './game'

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'difficulty' | 'minutes' | 'energy' | 'due' | 'cost' | 'repeat' | 'category' | 'subs'>
>

export function validTaskDate(value: string): boolean {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = new Date(`${value}T00:00:00`).getTime()
  return Number.isFinite(time) && localDate(time) === value
}

// Editing labels/order must not roll back completion or issue the same reward again.
export function mergeSubtasks(current: SubTask[], edited: SubTask[]): SubTask[] {
  const seen = new Set<string>()
  return edited.flatMap((sub) => {
    const title = sub.title.trim()
    if (!title || seen.has(sub.id)) return []
    seen.add(sub.id)
    const existing = current.find((item) => item.id === sub.id)
    return [{ ...(existing ?? { id: sub.id }), title }]
  })
}

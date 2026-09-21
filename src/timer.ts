import { timerLeft } from './game'

export const TIMER_KEY = 'ilta-timer'
export interface TimerState {
  id: string
  questId: string
  seconds: number
  starter: boolean
  startedAt: number
  pausedLeft?: number
  finished?: boolean
}

export function loadTimer(): TimerState | null {
  try {
    const t = JSON.parse(localStorage.getItem(TIMER_KEY) ?? 'null')
    if (
      !t ||
      typeof t.questId !== 'string' ||
      !t.questId ||
      !Number.isFinite(t.startedAt) ||
      !Number.isFinite(t.seconds) ||
      t.seconds <= 0 ||
      t.seconds > 86400
    )
      return null
    return {
      id: typeof t.id === 'string' ? t.id : `legacy-${t.startedAt}`,
      questId: t.questId,
      seconds: t.seconds,
      startedAt: t.startedAt,
      starter: t.starter === true,
      finished: t.finished === true,
      pausedLeft: Number.isFinite(t.pausedLeft) ? Math.max(0, Math.min(t.seconds, t.pausedLeft)) : undefined,
    }
  } catch {
    return null
  }
}

export const remaining = (t: TimerState) =>
  t.finished ? 0 : (t.pausedLeft ?? timerLeft(t.startedAt, t.seconds))

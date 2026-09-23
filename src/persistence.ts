export const SAVE_KEY = 'quest-do-save-v1'
export const BACKUP_KEY = 'ilta-save-backup'
export const VISIT_KEY = 'ilta-last-visited'
export const HISTORY_KEY = 'ilta-save-history'

export interface SaveSnapshot {
  at: number
  kind: 'automatic' | 'before-restore'
  raw: string
}

const HISTORY_LIMIT = 8
const HISTORY_CHAR_LIMIT = 1_000_000

export function readHistory(): SaveSnapshot[] {
  try {
    const history: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    if (!Array.isArray(history)) return []
    return history
      .filter(
        (s): s is SaveSnapshot =>
          !!s &&
          Number.isFinite(s.at) &&
          Number.isFinite(new Date(s.at).getTime()) &&
          s.at > 0 &&
          (s.kind === 'automatic' || s.kind === 'before-restore') &&
          typeof s.raw === 'string' &&
          isSave(s.raw),
      )
      .sort((a, b) => b.at - a.at)
      .slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

// Daily snapshots survive ordinary saves; replacement checkpoints are retained separately.
export function checkpoint(raw: string, kind: SaveSnapshot['kind'], at = Date.now()): boolean {
  if (!isSave(raw)) return false
  try {
    const history = readHistory()
    if (
      kind === 'automatic' &&
      history.some(
        (s) =>
          s.raw === raw || (s.kind === kind && new Date(s.at).toDateString() === new Date(at).toDateString()),
      )
    )
      return true
    const next = [{ at, kind, raw }, ...history.filter((s) => s.raw !== raw)]
    const counts = { automatic: 0, 'before-restore': 0 }
    const retained = next.filter((s) => ++counts[s.kind] <= (s.kind === 'automatic' ? 6 : 2))
    while (retained.length) {
      const encoded = JSON.stringify(retained)
      if (encoded.length <= HISTORY_CHAR_LIMIT) {
        try {
          localStorage.setItem(HISTORY_KEY, encoded)
          return true
        } catch {
          // Retry with fewer older snapshots when this browser has less free space.
        }
      }
      if (retained.length === 1) return false
      let auto = -1
      retained.forEach((s, i) => {
        if (i > 0 && s.kind === 'automatic') auto = i
      })
      retained.splice(auto > 0 ? auto : retained.length - 1, 1)
    }
    return false
  } catch {
    return false
  }
}

export function preservePrevious(raw: string | null) {
  if (!isSave(raw)) return
  checkpoint(raw!, 'automatic')
  try {
    localStorage.setItem(BACKUP_KEY, raw!)
  } catch {
    // A full backup area must not prevent writing a still-saveable current record.
  }
}

export function lastVisit(fallback?: number): number | undefined {
  try {
    const at = Number(localStorage.getItem(VISIT_KEY))
    return Number.isFinite(at) && at > 0 ? at : fallback
  } catch {
    return fallback
  }
}

export function recordVisit() {
  try {
    localStorage.setItem(VISIT_KEY, String(Date.now()))
  } catch {
    // Visit hints are optional and must not interfere with task saves.
  }
}

export function isSave(raw: string | null): boolean {
  try {
    const value = JSON.parse(raw ?? 'null')
    return !!value && Array.isArray(value.pool) && Array.isArray(value.active) && Array.isArray(value.done)
  } catch {
    return false
  }
}

export function readSave(): { raw: string | null; warning: string } {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (isSave(raw)) return { raw, warning: '' }
    const backup = localStorage.getItem(BACKUP_KEY)
    if (isSave(backup))
      return { raw: backup, warning: '이전 자동 백업으로 복구했어요. 내용을 확인해 주세요.' }
    const snapshot = readHistory()[0]
    if (snapshot) return { raw: snapshot.raw, warning: '백업 이력으로 복구했어요. 내용을 확인해 주세요.' }
    return { raw: null, warning: raw ? '저장 파일을 읽을 수 없어요. 기존 파일은 보존되어 있습니다.' : '' }
  } catch {
    return { raw: null, warning: '저장소에 접근할 수 없어요. 내보내기로 기록을 보관해 주세요.' }
  }
}

export function downloadSave(text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `ilta-save-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

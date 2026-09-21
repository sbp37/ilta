export const SAVE_KEY = 'quest-do-save-v1'
export const BACKUP_KEY = 'ilta-save-backup'

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

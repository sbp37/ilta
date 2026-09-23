import { useEffect, useRef, useState } from 'react'
import { GameState, levelOf } from '../game'
import { BACKUP_KEY, SAVE_KEY, SaveSnapshot, downloadSave, isSave, readHistory } from '../persistence'
import { RestoreResult, inspectSave } from '../store'

interface Props {
  state: GameState
  onExport: () => string
  onImport: (text: string, expectedStored: string | null) => RestoreResult
  onToast: (message: string) => void
  onClose: () => void
}

function snapshots(): SaveSnapshot[] {
  const history = readHistory()
  try {
    const previous = localStorage.getItem(BACKUP_KEY)
    if (isSave(previous) && !history.some((s) => s.raw === previous))
      return [{ at: 0, kind: 'automatic', raw: previous! }, ...history]
  } catch {
    // The main save warning covers unavailable storage; export stays usable.
  }
  return history
}

function summary(state: GameState) {
  return [
    state.active.length,
    state.pool.length,
    state.archived?.length ?? 0,
    state.done.length,
    levelOf(state.xp),
  ]
}

export function SaveDataSettings({ state, onExport, onImport, onToast, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLHeadingElement>(null)
  const [history, setHistory] = useState(snapshots)
  const [pending, setPending] = useState<{
    raw: string
    state: GameState
    omittedTasks: number
    source: string
    expectedStored: string | null
  } | null>(null)
  const [error, setError] = useState('')
  const [allowOmissions, setAllowOmissions] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (pending) previewRef.current?.focus()
  }, [pending])

  const download = () => {
    downloadSave(onExport())
    onToast('저장 파일을 내려받았어요')
  }

  const preview = (raw: string, source: string) => {
    setError('')
    setPending(null)
    setAllowOmissions(false)
    const inspected = inspectSave(raw)
    if (!inspected.ok) {
      setError(inspected.error)
      return
    }
    try {
      setPending({ ...inspected, source, expectedStored: localStorage.getItem(SAVE_KEY) })
    } catch {
      setError('저장소에 접근할 수 없어요. 현재 기록을 내보내기로 보관해 주세요.')
    }
  }

  const pickFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPending(null)
    setError('')
    if (file.size > 5 * 1024 * 1024) {
      setError('5MB 이하의 일타 저장 파일을 선택해 주세요.')
      return
    }
    setLoading(true)
    try {
      preview(await file.text(), file.name)
    } catch {
      setError('파일을 읽을 수 없어요. 다시 선택해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="save-settings" aria-label="저장 데이터">
      <div className="field-label">저장 위치 · 이 브라우저</div>
      <div className="settings-row">
        <button className="btn btn-sub" onClick={download}>
          📦 내보내기
        </button>
        <button className="btn btn-sub" disabled={loading} onClick={() => fileRef.current?.click()}>
          {loading ? '읽는 중…' : '📂 불러오기'}
        </button>
        <input
          ref={fileRef}
          aria-label="저장 파일"
          type="file"
          accept=".json,application/json"
          hidden
          onChange={pickFile}
        />
      </div>
      <p className="dim settings-hint">
        브라우저 데이터를 지우면 백업도 삭제됩니다. 기기 밖 보관용 파일은 내보내기로 남겨 주세요.
      </p>

      {error && (
        <p className="save-error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <section className="restore-confirm" aria-label="복구 미리보기">
          <h3 ref={previewRef} tabIndex={-1}>
            복구 미리보기
          </h3>
          <p className="save-source">{pending.source}</p>
          <div className="save-comparison">
            <table>
              <thead>
                <tr>
                  <th scope="col">기록</th>
                  <th scope="col">현재</th>
                  <th scope="col">선택한 백업</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">이름</th>
                  <td>{state.heroName ?? '모험가'}</td>
                  <td>{pending.state.heroName ?? '모험가'}</td>
                </tr>
                {['오늘', '수집함', '보관함', '완료', '레벨'].map((label, i) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{summary(state)[i]}</td>
                    <td>{summary(pending.state)[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>현재 기록을 이 내용으로 바꿀까요?</p>
          <p className="dim settings-hint">복구 직전 기록은 백업 이력에 보존됩니다.</p>
          {pending.omittedTasks > 0 && (
            <label className="save-omissions">
              <input
                type="checkbox"
                checked={allowOmissions}
                onChange={(e) => setAllowOmissions(e.target.checked)}
              />
              손상된 할 일 {pending.omittedTasks}개가 제외됨을 확인했어요
            </label>
          )}
          <div className="row-actions">
            <button className="btn btn-sub" onClick={download}>
              현재 기록 내보내기
            </button>
            <button
              className="btn btn-go"
              disabled={pending.omittedTasks > 0 && !allowOmissions}
              onClick={() => {
                const result = onImport(pending.raw, pending.expectedStored)
                setHistory(snapshots())
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                onToast('저장 데이터를 불러왔습니다!')
                onClose()
              }}
            >
              복구
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setPending(null)
                setError('')
              }}
            >
              취소
            </button>
          </div>
        </section>
      )}

      <h3 className="field-label">백업 이력</h3>
      {history.length === 0 && <p className="dim">아직 저장된 백업이 없어요.</p>}
      <ul className="save-history">
        {history.map((snapshot, index) => {
          const inspected = inspectSave(snapshot.raw)
          if (!inspected.ok) return null
          const label =
            snapshot.at === 0
              ? '이전 자동 백업'
              : snapshot.kind === 'before-restore'
                ? '복구 직전 기록'
                : '날짜별 자동 백업'
          const date = snapshot.at ? new Date(snapshot.at).toLocaleString('ko-KR') : ''
          return (
            <li key={`${snapshot.at}-${index}`}>
              <div className="save-snapshot-info">
                <strong>{label}</strong>
                {date && <time dateTime={new Date(snapshot.at).toISOString()}>{date}</time>}
                <span className="dim">
                  할 일 {inspected.state.active.length + inspected.state.pool.length} · 완료{' '}
                  {inspected.state.done.length} · 보관 {inspected.state.archived?.length ?? 0}
                </span>
              </div>
              <button
                className="btn btn-sub"
                disabled={loading}
                aria-label={`${label} ${date} 미리보기`}
                onClick={() => preview(snapshot.raw, `${label} ${date}`)}
              >
                미리보기
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

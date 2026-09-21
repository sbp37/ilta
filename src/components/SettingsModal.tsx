import { useRef, useState } from 'react'
import { sfx } from '../sound'
import { GameState, THEMES, dailyGoalOf, minimumGoalOf, levelOf } from '../game'
import { downloadSave } from '../persistence'

interface Props {
  state: GameState
  onExport: () => string
  onImport: (text: string) => boolean
  onTheme: (theme: string) => void
  onNotif: (v: boolean) => void
  onToast: (msg: string) => void
  onClose: () => void
  onPreferences: (
    patch: Pick<Partial<GameState>, 'dailyGoal' | 'minimumGoal' | 'gentle' | 'readable' | 'reducedMotion'>,
  ) => void
  onRestore: () => boolean
}

export function SettingsModal({
  state,
  onExport,
  onImport,
  onTheme,
  onNotif,
  onToast,
  onClose,
  onPreferences,
  onRestore,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const [restoreConfirm, setRestoreConfirm] = useState(false)
  const theme = state.theme ?? 'night'
  const level = levelOf(state.xp)

  const download = () => {
    downloadSave(onExport())
    sfx.complete()
    onToast('저장 파일을 내려받았어요')
  }

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file
      .text()
      .then(setPendingImport)
      .catch(() => onToast('파일을 읽을 수 없어요'))
    e.target.value = ''
  }

  const askNotif = async () => {
    if (typeof Notification === 'undefined') {
      onToast('이 브라우저는 알림을 지원하지 않아요')
      return
    }
    if (state.notif) {
      onNotif(false)
      onToast('알림을 껐어요')
      return
    }
    const perm = await Notification.requestPermission()
    if (perm === 'granted') {
      onNotif(true)
      sfx.accept()
      onToast('알림 켜짐! 앱을 열어두면 리마인드를 보내요')
    } else {
      sfx.deny()
      onToast('알림이 차단됐어요 — 브라우저 설정에서 허용해주세요')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pixel-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">설정</div>

        <div className="preferences">
          <label className="preference-row">
            최소 목표
            <input
              aria-label="최소 목표"
              type="number"
              min="1"
              max={dailyGoalOf(state)}
              value={minimumGoalOf(state)}
              onChange={(e) => onPreferences({ minimumGoal: Number(e.target.value) || 1 })}
            />
          </label>
          <label className="preference-row">
            하루 목표 (권장)
            <input
              aria-label="하루 목표"
              type="number"
              min="1"
              max="10"
              value={dailyGoalOf(state)}
              onChange={(e) => onPreferences({ dailyGoal: Number(e.target.value) || 1 })}
            />
          </label>
          <label className="preference-row">
            편안한 모험
            <input
              type="checkbox"
              checked={state.gentle !== false}
              onChange={(e) => onPreferences({ gentle: e.target.checked })}
            />
          </label>
          <label className="preference-row">
            읽기 편한 본문
            <input
              type="checkbox"
              checked={!!state.readable}
              onChange={(e) => onPreferences({ readable: e.target.checked })}
            />
          </label>
          <label className="preference-row">
            움직임 줄이기
            <input
              type="checkbox"
              checked={!!state.reducedMotion}
              onChange={(e) => onPreferences({ reducedMotion: e.target.checked })}
            />
          </label>
        </div>

        <div className="field-label">배경 테마</div>
        <div className="chip-row">
          {THEMES.map((t) => {
            const locked = t.level > level
            return (
              <button
                key={t.id}
                className={`chip ${theme === t.id ? 'chip-on' : ''} ${locked ? 'chip-locked' : ''}`}
                title={locked ? `Lv.${t.level}에 해금` : undefined}
                onClick={() => {
                  if (locked) {
                    sfx.deny()
                    onToast(`「${t.name}」 테마는 Lv.${t.level}에 열려요`)
                    return
                  }
                  sfx.click()
                  onTheme(t.id)
                }}
              >
                {locked ? '🔒 ' : ''}
                {t.name}
              </button>
            )
          })}
        </div>

        <div className="field-label">알림</div>
        <button className={`btn ${state.notif ? 'btn-go' : 'btn-sub'}`} onClick={askNotif}>
          {state.notif ? '🔔 리마인드 켜짐 — 눌러서 끄기' : '🔕 리마인드 켜기'}
        </button>
        <div className="dim settings-hint">
          앱이 열려있을 때 광폭 몹/오늘의 일격을 알려줘요. 홈 화면에 설치하면 남은 오늘의 목표 수가 앱 아이콘
          배지로 표시돼요
        </div>

        <div className="field-label">저장 데이터</div>
        <div className="settings-row">
          <button className="btn btn-sub" onClick={download}>
            📦 내보내기
          </button>
          <button className="btn btn-sub" onClick={() => fileRef.current?.click()}>
            📂 불러오기
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={pickFile} />
        </div>
        <div className="dim settings-hint">브라우저 데이터를 지우기 전에 내보내기로 백업해두세요</div>
        <button className="btn btn-sub" onClick={() => setRestoreConfirm(true)}>
          이전 자동 백업 복구
        </button>
        {(pendingImport || restoreConfirm) && (
          <div className="restore-confirm" role="status">
            <p>현재 기록을 선택한 저장 내용으로 바꿀까요?</p>
            <div className="row-actions">
              <button className="btn btn-sub" onClick={download}>
                현재 기록 내보내기
              </button>
              <button
                className="btn btn-go"
                onClick={() => {
                  const ok = pendingImport ? onImport(pendingImport) : onRestore()
                  onToast(ok ? '저장 데이터를 불러왔습니다!' : '복구할 수 있는 저장 데이터를 찾지 못했어요')
                  setPendingImport(null)
                  setRestoreConfirm(false)
                  if (ok) onClose()
                }}
              >
                복구
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPendingImport(null)
                  setRestoreConfirm(false)
                }}
              >
                취소
              </button>
            </div>
          </div>
        )}

        <button className="btn btn-sub modal-close-btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

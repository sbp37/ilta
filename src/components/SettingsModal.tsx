import { useState } from 'react'
import { sfx } from '../sound'
import { GameState, THEMES, dailyGoalOf, minimumGoalOf, levelOf } from '../game'
import { RestoreResult } from '../store'
import { SaveDataSettings } from './SaveDataSettings'

interface Props {
  state: GameState
  onExport: () => string
  onImport: (text: string, expectedStored: string | null) => RestoreResult
  onTheme: (theme: string) => void
  onNotif: (v: boolean) => void
  onToast: (msg: string) => void
  onClose: () => void
  onPreferences: (
    patch: Pick<Partial<GameState>, 'dailyGoal' | 'minimumGoal' | 'gentle' | 'readable' | 'reducedMotion'>,
  ) => void
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
}: Props) {
  const [view, setView] = useState<'preferences' | 'data'>('preferences')
  const theme = state.theme ?? 'night'
  const level = levelOf(state.xp)

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
        <nav className="view-tabs" aria-label="설정 보기">
          <button
            className={view === 'preferences' ? 'selected' : ''}
            aria-pressed={view === 'preferences'}
            onClick={() => setView('preferences')}
          >
            환경 설정
          </button>
          <button
            className={view === 'data' ? 'selected' : ''}
            aria-pressed={view === 'data'}
            onClick={() => setView('data')}
          >
            저장·복구
          </button>
        </nav>
        {view === 'preferences' && (
          <>
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
              앱이 열려있을 때 광폭 몹/오늘의 일격을 알려줘요. 홈 화면에 설치하면 남은 오늘의 목표 수가 앱
              아이콘 배지로 표시돼요
            </div>
          </>
        )}
        {view === 'data' && (
          <SaveDataSettings
            state={state}
            onExport={onExport}
            onImport={onImport}
            onToast={onToast}
            onClose={onClose}
          />
        )}

        <button className="btn btn-sub modal-close-btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

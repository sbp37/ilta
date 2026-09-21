import { useRef } from 'react'
import { sfx } from '../sound'
import { GameState, THEMES, levelOf } from '../game'

interface Props {
  state: GameState
  onExport: () => string
  onImport: (text: string) => boolean
  onTheme: (theme: string) => void
  onNotif: (v: boolean) => void
  onToast: (msg: string) => void
  onClose: () => void
}

export function SettingsModal({ state, onExport, onImport, onTheme, onNotif, onToast, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const theme = state.theme ?? 'night'
  const level = levelOf(state.xp)

  const download = () => {
    const blob = new Blob([onExport()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ilta-save-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    sfx.complete()
    onToast('저장 파일을 내려받았어요')
  }

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((text) => {
      if (onImport(text)) {
        sfx.levelup()
        onToast('저장 데이터를 불러왔습니다!')
        onClose()
      } else {
        sfx.deny()
        onToast('이 파일은 읽을 수 없어요…')
      }
    })
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

        <button className="btn btn-sub modal-close-btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import { GameState, PET_FEED_COST, petStage } from '../game'

interface Props {
  state: GameState
  onFeed: () => 'nogold' | 'fed' | 'evolved'
  onRename: (name: string) => void
  onToast: (msg: string) => void
  onClose: () => void
}

const FEED_LINES = ['냠냠!', '슬라임이 행복해한다!', '펫이 꼬리를 흔든다!', '맛있게 먹는다!']

export function PetModal({ state, onFeed, onRename, onToast, onClose }: Props) {
  const stage = petStage(state.petFood)
  const displayName = state.petName || stage.name
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(state.petName ?? '')

  const feed = () => {
    const res = onFeed()
    if (res === 'nogold') {
      sfx.deny()
      onToast('골드가 부족합니다! 퀘스트를 처치하세요.')
    } else if (res === 'evolved') {
      sfx.levelup()
      onToast('진화했다!!!')
    } else {
      sfx.accept()
      onToast(FEED_LINES[Math.floor(Math.random() * FEED_LINES.length)] + ` (${state.petFood + 1}끼)`)
    }
  }

  const saveName = () => {
    onRename(name.trim())
    setRenaming(false)
    sfx.click()
  }

  const toNext = stage.next === null ? null : stage.next - state.petFood

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pixel-panel pet-modal" onClick={(e) => e.stopPropagation()}>
        <Pixel name={stage.sprite} size={6} className="bob" />
        <div className="reveal-title">{displayName}</div>
        <div className="dim">단계: {stage.name} · 먹인 끼니 {state.petFood}개</div>

        {toNext !== null ? (
          <div className="dim">다음 진화까지 {toNext}끼 남음</div>
        ) : (
          <div className="dim" style={{ color: '#ffd23f' }}>
            최종 진화 완료! 최고의 파트너
          </div>
        )}

        <button className="btn btn-big btn-gold" onClick={feed} disabled={state.gold < PET_FEED_COST}>
          먹이 주기 ({PET_FEED_COST}G)
        </button>

        {renaming ? (
          <div className="quick-add-row">
            <input
              className="text-input"
              placeholder="펫 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') saveName()
              }}
              maxLength={10}
              autoFocus
            />
            <button className="btn btn-go" onClick={saveName}>
              저장
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={() => setRenaming(true)}>
            이름 짓기
          </button>
        )}
      </div>
    </div>
  )
}

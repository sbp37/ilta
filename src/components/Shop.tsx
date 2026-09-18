import { useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import { GameState } from '../game'

interface Props {
  state: GameState
  onAddReward: (name: string, cost: number) => void
  onRemoveReward: (id: string) => void
  onBuy: (id: string) => boolean
  onToast: (msg: string) => void
}

const PRESETS = [
  { name: '유튜브 30분', cost: 50 },
  { name: '맛있는 간식', cost: 80 },
  { name: '게임 1시간', cost: 120 },
  { name: '넷플릭스 한 편', cost: 150 },
]

export function Shop({ state, onAddReward, onRemoveReward, onBuy, onToast }: Props) {
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')

  const add = (n: string, c: number) => {
    if (!n.trim() || c <= 0) {
      sfx.deny()
      return
    }
    onAddReward(n.trim(), c)
    setName('')
    setCost('')
    sfx.accept()
  }

  const buy = (id: string, rewardName: string) => {
    if (onBuy(id)) {
      sfx.complete()
      onToast(`「${rewardName}」 구매! 즐기세요`)
    } else {
      sfx.deny()
      onToast('골드가 부족합니다!')
    }
  }

  return (
    <div className="shop">
      <div className="pixel-panel shop-balance">
        <Pixel name="coin" size={4} />
        <div>
          <div className="balance-num">{state.gold}G</div>
          <div className="dim">퀘스트 처치로 벌어서 여기서 씁니다</div>
        </div>
      </div>

      <div className="pixel-panel form">
        <div className="field-label">내 보상 등록 — 일한 나에게 주는 선물</div>
        <div className="quick-add-row">
          <input
            className="text-input"
            placeholder="보상 이름 (예: 산책 30분)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter' && name.trim() && Number(cost) > 0) add(name, Number(cost))
            }}
            maxLength={30}
          />
          <input
            className="text-input cost-input"
            placeholder="가격"
            inputMode="numeric"
            value={cost}
            onChange={(e) => setCost(e.target.value.replace(/[^0-9]/g, ''))}
          />
          <button className="btn btn-go" onClick={() => add(name, Number(cost))}>
            등록
          </button>
        </div>
        <div className="chip-row preset-row">
          {PRESETS.map((p) => (
            <button key={p.name} className="chip" onClick={() => add(p.name, p.cost)}>
              {p.name} {p.cost}G
            </button>
          ))}
        </div>
      </div>

      <div className="pool-list">
        <div className="field-label">보상 목록 ({state.rewards.length})</div>
        {state.rewards.length === 0 && (
          <div className="dim">비어있어요. "게임 1시간 120G" 같은 보상을 등록해보세요.</div>
        )}
        {state.rewards.map((r) => (
          <div key={r.id} className="pool-item shop-item">
            <Pixel name="star" size={2} />
            <div className="pool-item-body">
              <div className="pool-item-title">{r.name}</div>
            </div>
            <button className="btn btn-gold buy-btn" disabled={state.gold < r.cost} onClick={() => buy(r.id, r.name)}>
              {r.cost}G
            </button>
            <button className="icon-btn" title="삭제" onClick={() => onRemoveReward(r.id)}>
              ×
            </button>
          </div>
        ))}
      </div>

      {state.purchases.length > 0 && (
        <div className="pool-list">
          <div className="field-label">최근 구매</div>
          {[...state.purchases]
            .sort((a, b) => b.at - a.at)
            .slice(0, 5)
            .map((p) => (
              <div key={p.id} className="purchase-row dim">
                「{p.name}」 -{p.cost}G · {new Date(p.at).toLocaleDateString('ko-KR')}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

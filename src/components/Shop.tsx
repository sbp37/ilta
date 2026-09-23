import { useMemo, useState } from 'react'
import { Pixel } from '../Pixel'
import { Hero } from './Hero'
import { sfx } from '../sound'
import {
  CONSUMABLES,
  FREEZE_COST,
  FREEZE_MAX,
  GEAR,
  GameState,
  ITEM_MAX,
  heroPalette,
  heroSprite,
  itemCount,
  levelOf,
} from '../game'

interface Props {
  state: GameState
  onAddReward: (name: string, cost: number) => void
  onRemoveReward: (id: string) => void
  onBuy: (id: string) => boolean
  onBuyGear: (id: string) => boolean
  onToggleGear: (id: string) => void
  onBuyFreeze: () => 'nogold' | 'full' | 'ok'
  onBuyItem: (id: string) => 'nogold' | 'full' | 'ok'
  onUseXpPotion: () => 'none' | 'already' | 'ok'
  onToast: (msg: string) => void
}

const PRESETS = [
  { name: '유튜브 30분', cost: 50 },
  { name: '맛있는 간식', cost: 80 },
  { name: '게임 1시간', cost: 120 },
  { name: '넷플릭스 한 편', cost: 150 },
]

const SHOP_LINES = [
  '어서오시오! 골드만 있으면 다 드려요',
  '오늘의 추천 상품은… 전부 좋아요',
  '용사님, 몬스터 좀 잡으셨나보네요',
  '이건 싼 거예요. 진짜로',
  '장비 차고 나가면 기분이 다르죠',
]

const SLOT_LABEL: Record<string, string> = {
  head: '머리',
  body: '몸',
  back: '등',
  hand: '손',
  acc: '장신구',
  feet: '발',
}

export function Shop({
  state,
  onAddReward,
  onRemoveReward,
  onBuy,
  onBuyGear,
  onToggleGear,
  onBuyFreeze,
  onBuyItem,
  onUseXpPotion,
  onToast,
}: Props) {
  const level = levelOf(state.xp)
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [view, setView] = useState<'rewards' | 'gear' | 'items'>('rewards')
  const line = useMemo(() => SHOP_LINES[Math.floor(Math.random() * SHOP_LINES.length)], [])

  const equippedGear = state.equippedGear ?? []
  const lootIds = Object.keys(state.loot)
    .sort((a, b) => LOOT_ORDER.indexOf(a) - LOOT_ORDER.indexOf(b))
    .slice(0, 3)
  const equipped = [...equippedGear, ...lootIds]

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

  const freezes = state.freezes ?? 0
  const buyFreeze = () => {
    const r = onBuyFreeze()
    if (r === 'ok') {
      sfx.complete()
      onToast('휴식일 부적 획득! 하루 쉬어도 연속 기록이 지켜져요')
    } else if (r === 'full') {
      sfx.deny()
      onToast(`부적은 최대 ${FREEZE_MAX}개까지만 들 수 있어요`)
    } else {
      sfx.deny()
      onToast('골드가 부족합니다!')
    }
  }

  const buyItem = (id: string, itemName: string) => {
    const r = onBuyItem(id)
    if (r === 'ok') {
      sfx.complete()
      onToast(`「${itemName}」 구매!`)
    } else if (r === 'full') {
      sfx.deny()
      onToast(`「${itemName}」은 최대 ${ITEM_MAX}개까지만 들 수 있어요`)
    } else {
      sfx.deny()
      onToast('골드가 부족합니다!')
    }
  }

  const usePotion = () => {
    const r = onUseXpPotion()
    if (r === 'ok') {
      sfx.levelup()
      onToast('XP 포션 사용! 다음 처치 XP 1.5배')
    } else if (r === 'already') {
      sfx.deny()
      onToast('이미 포션이 적용 중이에요. 먼저 하나 처치하세요')
    } else {
      sfx.deny()
    }
  }

  const buyGear = (id: string, gearName: string) => {
    if (onBuyGear(id)) {
      sfx.complete()
      onToast(`「${gearName}」 구매! 바로 장착했어요`)
    } else {
      sfx.deny()
      onToast('골드가 부족합니다!')
    }
  }

  return (
    <div className="shop">
      <div className="screen-heading">
        <h2>상점</h2>
        <span className="dim">{state.gold}G</span>
      </div>
      <nav className="view-tabs" aria-label="상점 보기">
        {(
          [
            ['rewards', '내 보상'],
            ['gear', '장비'],
            ['items', '소모품'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={view === id ? 'selected' : ''}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <section className="shop-section" hidden={view !== 'rewards'} aria-label="내 보상">
        <div className="pixel-panel shopkeeper">
          <Pixel name="npc" size={3} />
          <div className="bubble">{line}</div>
        </div>

        <div className="field-label">내 보상 상점 — 일한 나에게 주는 선물</div>
        <div className="form">
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
          <details className="quiet-details">
            <summary>추천 보상</summary>
            <div className="chip-row preset-row">
              {PRESETS.map((p) => (
                <button key={p.name} className="chip" onClick={() => add(p.name, p.cost)}>
                  {p.name} {p.cost}G
                </button>
              ))}
            </div>
          </details>
        </div>

        <div className="pool-list">
          {state.rewards.length === 0 && (
            <div className="dim">비어있어요. "게임 1시간 120G" 같은 보상을 등록해보세요.</div>
          )}
          {state.rewards.map((r) => (
            <div key={r.id} className="pool-item shop-item">
              <Pixel name="star" size={2} />
              <div className="pool-item-body">
                <div className="pool-item-title">{r.name}</div>
              </div>
              <button
                className="btn btn-gold buy-btn"
                disabled={state.gold < r.cost}
                onClick={() => buy(r.id, r.name)}
              >
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
      </section>
      <section className="shop-section" hidden={view !== 'gear'} aria-label="장비">
        <div className="shop-hero">
          <Hero
            size={3}
            palette={heroPalette(state)}
            equipped={equipped}
            variant={heroSprite(state.heroClass)}
          />
          <span className="dim">장착 미리보기</span>
        </div>
        <div className="field-label shop-gold-line">
          장비 상점 <Pixel name="coin" size={2} /> {state.gold}G
        </div>
        <div className="gear-grid">
          {GEAR.map((g) => {
            const owned = (state.gear ?? []).includes(g.id)
            const equippedNow = equippedGear.includes(g.id)
            const affordable = state.gold >= g.cost
            const locked = !owned && (g.level ?? 1) > level
            return (
              <div
                key={g.id}
                className={`pixel-panel gear-card ${equippedNow ? 'gear-equipped' : ''} ${locked ? 'gear-locked' : ''}`}
              >
                <div className="gear-sprite">
                  <Pixel name={g.sprite} size={4} />
                </div>
                <div className="gear-name">
                  {g.name} <span className="gear-slot">{SLOT_LABEL[g.slot] ?? g.slot}</span>
                </div>
                <div className="dim gear-desc">{g.desc}</div>
                {locked ? (
                  <button className="btn gear-btn" disabled>
                    🔒 Lv.{g.level} 해금
                  </button>
                ) : equippedNow ? (
                  <button className="btn btn-go gear-btn" onClick={() => onToggleGear(g.id)}>
                    장착중 ✓
                  </button>
                ) : owned ? (
                  <button className="btn gear-btn" onClick={() => onToggleGear(g.id)}>
                    장착
                  </button>
                ) : (
                  <button
                    className="btn btn-gold gear-btn"
                    disabled={!affordable}
                    onClick={() => buyGear(g.id, g.name)}
                  >
                    {g.cost}G
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>
      <section className="shop-section" hidden={view !== 'items'} aria-label="소모품">
        <div className="field-label">소모품</div>
        <div className="pixel-panel freeze-card">
          <Pixel name="shield" size={4} />
          <div className="freeze-body">
            <div className="gear-name">
              휴식일 부적{' '}
              <span className="gear-slot">
                보유 {freezes}/{FREEZE_MAX}
              </span>
            </div>
            <div className="dim gear-desc">
              하루 빠져도 🔥연속 기록이 깨지지 않아요. 빈 날이 생기면 자동으로 쓰여요.
            </div>
          </div>
          <button
            className="btn btn-gold gear-btn"
            disabled={state.gold < FREEZE_COST || freezes >= FREEZE_MAX}
            onClick={buyFreeze}
          >
            {FREEZE_COST}G
          </button>
        </div>

        {CONSUMABLES.map((c) => {
          const have = itemCount(state, c.id)
          return (
            <div key={c.id} className="pixel-panel freeze-card">
              <Pixel name={c.sprite} size={4} />
              <div className="freeze-body">
                <div className="gear-name">
                  {c.name}{' '}
                  <span className="gear-slot">
                    보유 {have}/{ITEM_MAX}
                  </span>
                </div>
                <div className="dim gear-desc">{c.desc}</div>
              </div>
              <div className="item-btns">
                {c.id === 'xppotion' && (have > 0 || state.xpBoost) && (
                  <button className="btn btn-go gear-btn" disabled={!!state.xpBoost} onClick={usePotion}>
                    {state.xpBoost ? '적용 중' : '사용'}
                  </button>
                )}
                <button
                  className="btn btn-gold gear-btn"
                  disabled={state.gold < c.cost || have >= ITEM_MAX}
                  onClick={() => buyItem(c.id, c.name)}
                >
                  {c.cost}G
                </button>
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}

const LOOT_ORDER = ['crown', 'star', 'gem', 'sword', 'shield', 'potion']

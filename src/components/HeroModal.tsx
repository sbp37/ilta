import { Hero } from './Hero'
import { sfx } from '../sound'
import { GameState, HERO_HAIRS, HERO_TUNICS, LOOT } from '../game'

interface Props {
  state: GameState
  onLook: (hair?: string, tunic?: string) => void
  onClose: () => void
}

export function HeroModal({ state, onLook, onClose }: Props) {
  const hair = state.heroHair ?? HERO_HAIRS[0].color
  const tunic = state.heroTunic ?? HERO_TUNICS[0].color
  const equipped = LOOT.filter((l) => (state.loot[l.id] ?? 0) > 0)
    .sort((a, b) => b.rarity - a.rarity)
    .slice(0, 3)
    .map((l) => l.id)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pixel-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">용사 꾸미기</div>
        <div className="hero-preview">
          <Hero size={6} palette={{ H: hair, T: tunic }} equipped={equipped} />
        </div>

        <div className="field-label">머리색</div>
        <div className="swatch-row">
          {HERO_HAIRS.map((h) => (
            <button
              key={h.color}
              className={`swatch ${hair === h.color ? 'swatch-on' : ''}`}
              style={{ background: h.color }}
              title={h.name}
              onClick={() => {
                sfx.click()
                onLook(h.color, state.heroTunic)
              }}
            />
          ))}
        </div>

        <div className="field-label">옷 색</div>
        <div className="swatch-row">
          {HERO_TUNICS.map((t) => (
            <button
              key={t.color}
              className={`swatch ${tunic === t.color ? 'swatch-on' : ''}`}
              style={{ background: t.color }}
              title={t.name}
              onClick={() => {
                sfx.click()
                onLook(state.heroHair, t.color)
              }}
            />
          ))}
        </div>

        <button className="btn btn-sub modal-close-btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

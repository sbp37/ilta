import { Pixel } from '../Pixel'
import { lootById } from '../game'

// knight(12x14) 기준 장비 부착 위치 — 스프라이트 좌상단을 이 좌표에 둠
const EQUIP_POS: Record<string, { x: number; y: number }> = {
  crown: { x: 2, y: -2 },
  sword: { x: 9, y: 5 },
  shield: { x: -3, y: 6 },
  gem: { x: 4, y: 8 },
  star: { x: 10, y: -3 },
  potion: { x: -1, y: 10 },
}

interface Props {
  size?: number
  palette?: Record<string, string>
  equipped?: string[] // 장착한 전리품 id
  className?: string
}

export function Hero({ size = 3, palette, equipped = [], className = '' }: Props) {
  return (
    <div
      className={`hero-sprite ${className}`}
      style={{ width: 12 * size, height: 14 * size }}
      aria-hidden
    >
      <Pixel name="knight" size={size} palette={palette} />
      {equipped.map((id) => {
        const item = lootById(id)
        const pos = EQUIP_POS[id]
        if (!item || !pos) return null
        return (
          <div key={id} className="equip-slot" style={{ left: pos.x * size, top: pos.y * size }}>
            <Pixel name={item.sprite} size={size} />
          </div>
        )
      })}
    </div>
  )
}

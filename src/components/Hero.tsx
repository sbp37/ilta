import { Pixel } from '../Pixel'
import { equipOverlays } from '../game'

interface Props {
  size?: number
  palette?: Record<string, string>
  equipped?: string[] // 장착한 전리품/장비 id (앞에 온 게 우선)
  variant?: string // 용사 스프라이트 (직업별)
  className?: string
}

export function Hero({ size = 3, palette, equipped = [], variant = 'knight', className = '' }: Props) {
  const overlays = equipOverlays(equipped)
  return (
    <div className={`hero-sprite ${className}`} style={{ width: 12 * size, height: 14 * size }} aria-hidden>
      <Pixel name={variant} size={size} palette={palette} />
      {overlays.map((e) => (
        <div key={e.sprite + e.slot} className="equip-slot" style={{ left: e.x * size, top: e.y * size }}>
          <Pixel name={e.sprite} size={size} />
        </div>
      ))}
    </div>
  )
}

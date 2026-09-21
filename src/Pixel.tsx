import { SPRITES } from './sprites'

interface Props {
  name: string
  size?: number
  className?: string
  palette?: Record<string, string>
}

export function Pixel({ name, size = 4, className = '', palette }: Props) {
  const sprite = SPRITES[name]
  if (!sprite) return null
  const pal = palette ? { ...sprite.palette, ...palette } : sprite.palette
  const width = sprite.rows[0].length
  return (
    <div
      className={`pixel-sprite ${className}`}
      style={{ gridTemplateColumns: `repeat(${width}, ${size}px)` }}
      aria-hidden
    >
      {sprite.rows.flatMap((row, y) =>
        row
          .split('')
          .map((ch, x) => (
            <div
              key={`${y}-${x}`}
              style={{ width: size, height: size, background: pal[ch] ?? 'transparent' }}
            />
          )),
      )}
    </div>
  )
}

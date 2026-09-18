import { SPRITES } from './sprites'
import {
  GameState,
  LOOT,
  heroPalette,
  levelOf,
  monsterOf,
  petStage,
  sameDay,
  streakDays,
  titleOf,
} from './game'

const PX = 6 // 스프라이트 1픽셀 = 6px

function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  scale: number,
  paletteOverride?: Record<string, string>,
) {
  const s = SPRITES[name]
  if (!s) return
  const pal = paletteOverride ? { ...s.palette, ...paletteOverride } : s.palette
  s.rows.forEach((row, ry) => {
    row.split('').forEach((ch, rx) => {
      const c = pal[ch]
      if (!c) return
      ctx.fillStyle = c
      ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale)
    })
  })
}

// 전적 카드 PNG 생성 (640x360)
export async function makeShareCard(state: GameState): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  try {
    await document.fonts.ready
  } catch {
    /* 폰트 대기 실패해도 진행 */
  }

  // 배경 + 픽셀 테두리
  ctx.fillStyle = '#0d0e1a'
  ctx.fillRect(0, 0, 640, 360)
  ctx.fillStyle = '#ffd23f'
  ctx.fillRect(0, 0, 640, 8)
  ctx.fillRect(0, 352, 640, 8)
  ctx.fillRect(0, 0, 8, 360)
  ctx.fillRect(632, 0, 8, 360)
  ctx.fillStyle = '#14152b'
  ctx.fillRect(8, 8, 624, 4)
  ctx.fillRect(8, 348, 624, 4)
  ctx.fillRect(8, 8, 4, 344)
  ctx.fillRect(628, 8, 4, 344)

  // 별 장식
  ctx.fillStyle = '#f4f4f455'
  const stars: [number, number][] = [
    [60, 40], [180, 30], [420, 45], [580, 60], [90, 90], [540, 100], [300, 35], [480, 70],
  ]
  for (const [x, y] of stars) ctx.fillRect(x, y, 3, 3)

  // 로고
  ctx.fillStyle = '#ffd23f'
  ctx.font = '26px "Press Start 2P", monospace'
  ctx.textAlign = 'center'
  ctx.fillText('ILTA', 320, 62)
  ctx.fillStyle = '#8a8fa8'
  ctx.font = '14px "NeoDunggeunmo", monospace'
  ctx.fillText('할 일 처치 RPG', 320, 88)

  // 용사 (장비 포함 최대 3개)
  const hx = 90
  const hy = 120
  drawSprite(ctx, 'knight', hx, hy, PX, heroPalette(state))
  const equipped = LOOT.filter((l) => (state.loot[l.id] ?? 0) > 0)
    .sort((a, b) => b.rarity - a.rarity)
    .slice(0, 3)
  const EQUIP_POS: Record<string, { x: number; y: number }> = {
    crown: { x: 2, y: -2 },
    sword: { x: 9, y: 5 },
    shield: { x: -3, y: 6 },
    gem: { x: 4, y: 8 },
    star: { x: 10, y: -3 },
    potion: { x: -1, y: 10 },
  }
  for (const item of equipped) {
    const pos = EQUIP_POS[item.id]
    if (pos) drawSprite(ctx, item.sprite, hx + pos.x * PX, hy + pos.y * PX, PX)
  }

  // 가장 강한 처치 몬스터 (보스 > 정예 > 잡몹, 최근 우선)
  const rank = { boss: 2, elite: 1, slime: 0 }
  const best = [...state.done].sort((a, b) => rank[b.difficulty] - rank[a.difficulty] || b.completedAt - a.completedAt)[0]
  if (best) {
    const m = monsterOf(best)
    drawSprite(ctx, m, 480, 140, PX)
  }
  // 펫
  drawSprite(ctx, petStage(state.petFood).sprite, 430, 200, PX * 0.75)

  // 스탯 텍스트
  const today = state.done.filter((d) => sameDay(d.completedAt, Date.now())).length
  const streak = streakDays(state.done)
  const level = levelOf(state.xp)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f4f4f4'
  ctx.font = '20px "NeoDunggeunmo", monospace'
  ctx.fillText(`${state.heroName ?? '모험가'} · LV.${level} ${titleOf(level)}`, 220, 150)
  ctx.fillStyle = '#ffd23f'
  ctx.fillText(`오늘 ${today}몹 처치`, 220, 185)
  ctx.fillStyle = '#f4f4f4'
  ctx.font = '17px "NeoDunggeunmo", monospace'
  ctx.fillText(`총 ${state.done.length}처치 · 🔥${streak}일 연속 · ${state.gold}G`, 220, 215)

  ctx.fillStyle = '#8a8fa8'
  ctx.font = '13px "NeoDunggeunmo", monospace'
  ctx.textAlign = 'center'
  const d = new Date()
  ctx.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} — 오늘도 몬스터를 처치했다`, 320, 330)

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// 공유 API 지원하면 공유 시트, 아니면 PNG 다운로드
export async function shareCard(state: GameState): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await makeShareCard(state)
  if (!blob) return 'failed'
  const file = new File([blob], 'ilta-card.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '일타 전적' })
      return 'shared'
    } catch {
      return 'failed' // 사용자 취소 포함
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'ilta-card.png'
  a.click()
  URL.revokeObjectURL(a.href)
  return 'downloaded'
}

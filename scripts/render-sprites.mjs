// sprites.ts의 스프라이트들을 PNG 시트로 렌더해 눈으로 확인하기 위한 스크립트
// 사용: node scripts/render-sprites.mjs [out.png]
import { writeFileSync } from 'node:fs'
import zlib from 'node:zlib'

// Node >=23.6은 타입만 지워서 .ts를 그대로 import할 수 있다 (sprites.ts는 지울 수 있는 타입만 사용)
const { SPRITES } = await import('../src/sprites.ts')

const SCALE = 10
const PAD = 2
const cols = 8
const names = Object.keys(SPRITES)
const cellW = 16 + PAD // sprites up to 14 wide
const cellH = 16 + PAD
const Wpx = cols * cellW * SCALE
const Hpx = Math.ceil(names.length / cols) * cellH * SCALE
// 앱 배경색(#1a1b2e)에 합성해 실제로 보이는 대로 확인
const BG = [0x1a, 0x1b, 0x2e, 255]
const buf = Buffer.alloc(Wpx * Hpx * 4)
for (let i = 0; i < buf.length; i += 4) buf.set(BG, i)

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255]
}
function put(x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= Wpx || y >= Hpx) return
  const i = (y * Wpx + x) * 4
  buf[i] = r
  buf[i + 1] = g
  buf[i + 2] = b
  buf[i + 3] = a
}

names.forEach((name, idx) => {
  const s = SPRITES[name]
  const ox = ((idx % cols) * cellW + PAD) * SCALE
  const oy = (Math.floor(idx / cols) * cellH + PAD) * SCALE
  s.rows.forEach((row, y) => {
    row.split('').forEach((ch, x) => {
      const col = s.palette[ch]
      if (!col) return
      const rgba = hex(col)
      for (let dy = 0; dy < SCALE; dy++)
        for (let dx = 0; dx < SCALE; dx++) put(ox + x * SCALE + dx, oy + y * SCALE + dy, rgba)
    })
  })
})

// minimal PNG encoder
function crc32(b) {
  let c,
    table = crc32.t
  if (!table) {
    table = crc32.t = []
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (const byte of b) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(Wpx, 0)
ihdr.writeUInt32BE(Hpx, 4)
ihdr[8] = 8
ihdr[9] = 6 // RGBA
const raw = Buffer.alloc(Hpx * (Wpx * 4 + 1))
for (let y = 0; y < Hpx; y++) buf.copy(raw, y * (Wpx * 4 + 1), y * Wpx * 4, (y + 1) * Wpx * 4)
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
])
const out = process.argv[2] ?? '/tmp/sprites.png'
writeFileSync(out, png)
console.log(`wrote ${out} (${Wpx}x${Hpx})`)
console.log(names.map((n, i) => `${i}:${n}`).join(' '))

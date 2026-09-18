// 16x16 픽셀 아이콘을 PNG로 렌더 (icon-192.png / icon-512.png)
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

const ROWS = [
  '................',
  '...........KK...',
  '..........KYYK..',
  '.........KYYYK..',
  '........KYYYK...',
  '...K...KYYYK....',
  '..KYK.KYYYK.....',
  '..KYYKKYYK......',
  '...KYYKYK.......',
  '....KYKK........',
  '...KKK.KK.......',
  '..KBBK..KKK.....',
  '.KBBBBK.........',
  '.KBBBK..........',
  '..KKK...........',
  '................',
]

const PAL = {
  '.': [0x0d, 0x0e, 0x1a, 0xff],
  K: [0x14, 0x15, 0x2b, 0xff],
  Y: [0xff, 0xd2, 0x3f, 0xff],
  B: [0x7a, 0x4a, 0x2f, 0xff],
}

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4)
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 8 + data.length)
  return out
}

function render(size) {
  const scale = size / 16
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowOff = y * (size * 4 + 1)
    raw[rowOff] = 0
    const srcRow = ROWS[Math.floor(y / scale)]
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = PAL[srcRow[Math.floor(x / scale)]] ?? PAL['.']
      const o = rowOff + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const outDir = path.resolve(import.meta.dirname, '../public')
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), render(size))
  console.log(`icon-${size}.png 생성`)
}

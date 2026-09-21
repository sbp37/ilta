let ctx: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem('quest-do-muted') === '1'
} catch {
  muted = true
}

export function isMuted() {
  return muted
}

export function toggleMute(): boolean {
  muted = !muted
  try {
    localStorage.setItem('quest-do-muted', muted ? '1' : '0')
  } catch {
    /* sound still works for this session */
  }
  if (muted) stopBgm()
  return muted
}

function ac(): AudioContext | null {
  if (muted) return null
  try {
    ctx ??= new (
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.06) {
  const c = ac()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t = c.currentTime + start
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur)
}

export const sfx = {
  click: () => tone(660, 0, 0.06),
  draw: () => {
    tone(330, 0, 0.08)
    tone(440, 0.08, 0.08)
    tone(550, 0.16, 0.08)
    tone(880, 0.24, 0.15)
  },
  reveal: () => {
    tone(523, 0, 0.1)
    tone(784, 0.1, 0.2)
  },
  bossReveal: () => {
    tone(196, 0, 0.15, 'sawtooth', 0.08)
    tone(147, 0.15, 0.15, 'sawtooth', 0.08)
    tone(98, 0.3, 0.3, 'sawtooth', 0.09)
  },
  accept: () => {
    tone(587, 0, 0.08)
    tone(880, 0.08, 0.12)
  },
  complete: () => {
    tone(523, 0, 0.09)
    tone(659, 0.09, 0.09)
    tone(784, 0.18, 0.09)
    tone(1047, 0.27, 0.25)
  },
  levelup: () => {
    tone(523, 0, 0.1)
    tone(659, 0.1, 0.1)
    tone(784, 0.2, 0.1)
    tone(1047, 0.3, 0.1)
    tone(1319, 0.4, 0.35)
  },
  deny: () => tone(140, 0, 0.18, 'sawtooth', 0.07),
  tick: () => tone(880, 0, 0.03, 'square', 0.03),
  slash: () => {
    tone(1200, 0, 0.05, 'sawtooth', 0.05)
    tone(400, 0.04, 0.09, 'sawtooth', 0.08)
    tone(950, 0.1, 0.14, 'square', 0.05)
  },
}

// ---------- 칩튠 BGM 루프 ----------
// 16스텝 멜로디 + 베이스를 setInterval로 재생. 볼륨 아주 낮게.
const MELODY = [523, 0, 659, 0, 784, 0, 659, 0, 587, 0, 698, 0, 880, 0, 784, 0]
const BASS = [131, 0, 131, 0, 165, 0, 165, 0, 175, 0, 175, 0, 196, 0, 165, 0]

let bgmTimer: ReturnType<typeof setInterval> | null = null
let bgmStep = 0

export function startBgm() {
  if (bgmTimer || muted) return
  bgmStep = 0
  bgmTimer = setInterval(() => {
    if (muted || document.hidden) return
    const m = MELODY[bgmStep % MELODY.length]
    const b = BASS[bgmStep % BASS.length]
    if (m) tone(m, 0, 0.2, 'square', 0.014)
    if (b) tone(b, 0, 0.2, 'triangle', 0.03)
    bgmStep++
  }, 230)
}

export function stopBgm() {
  if (bgmTimer) clearInterval(bgmTimer)
  bgmTimer = null
}

export function bgmPlaying() {
  return bgmTimer !== null
}

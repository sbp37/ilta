export type Difficulty = 'slime' | 'elite' | 'boss'
export type Energy = 'low' | 'mid' | 'high'

export interface SubTask {
  id: string
  title: string
  done?: boolean
}

export interface Task {
  id: string
  title: string
  difficulty: Difficulty
  minutes: number
  energy: Energy
  due?: string
  urgent?: boolean
  monster?: string
  cost?: string // 안 하면 생기는 일
  retreats?: number // 도망친 횟수
  repeat?: 'daily' // 처치해도 다음날 다시 나타나는 반복 몬스터
  subs?: SubTask[] // 큰 몬스터를 잡몹으로 쪼갠 목록
  createdAt: number
}

export interface ActiveQuest extends Task {
  acceptedAt: number
}

export interface DoneQuest extends Task {
  completedAt: number
  xp: number
  lootId?: string
}

export interface Reward {
  id: string
  name: string
  cost: number
  createdAt: number
}

export interface Purchase {
  id: string
  name: string
  cost: number
  at: number
}

export interface GameState {
  pool: Task[]
  active: ActiveQuest[]
  done: DoneQuest[]
  xp: number
  gold: number
  loot: Record<string, number>
  rewards: Reward[]
  purchases: Purchase[]
  heroName?: string
  heroHair?: string
  heroTunic?: string
  petFood: number
  petName?: string
  strike?: { id: string; day: string }
  theme?: string
  notif?: boolean
}

export const MAX_ACTIVE = 3
export const XP_PER_LEVEL = 100
export const STARTER_BONUS_XP = 5

export const DIFF: Record<Difficulty, { label: string; xp: number; sprite: string; color: string }> = {
  slime: { label: '잡몹', xp: 10, sprite: 'slime', color: '#43d675' },
  elite: { label: '정예', xp: 25, sprite: 'imp', color: '#a86bff' },
  boss: { label: '보스', xp: 60, sprite: 'demon', color: '#ff4d5e' },
}

// 난이도별 등장 몬스터 — 태스크 생성 때 랜덤 배정
export const MONSTERS: Record<Difficulty, string[]> = {
  slime: ['slime', 'mushroom', 'ghost', 'blueslime'],
  elite: ['imp', 'skeleton', 'witch'],
  boss: ['demon', 'dragon', 'lich', 'golem', 'mimic'],
}

export function randomMonster(d: Difficulty): string {
  const list = MONSTERS[d]
  return list[Math.floor(Math.random() * list.length)]
}

export function monsterOf(t: { monster?: string; difficulty: Difficulty }): string {
  return t.monster ?? DIFF[t.difficulty].sprite
}

export const DAILY_GOAL = 3
export const DAILY_GOAL_BONUS = 20
export const CRIT_CHANCE = 0.15
export const CRIT_MULT = 1.5

// ---------- 광폭화: 미루면 몬스터가 커진다 ----------

export const ENRAGE_DAYS = 3
export const ENRAGE_RETREATS = 2

export function enraged(t: { due?: string; retreats?: number; createdAt: number }, now = Date.now()): boolean {
  if ((t.retreats ?? 0) >= ENRAGE_RETREATS) return true
  if (t.due && new Date(t.due + 'T23:59:59').getTime() < now) return true
  return now - t.createdAt >= ENRAGE_DAYS * 86400000
}

// "안 하면 생기는 일" 프리셋 + NPC 푸시 대사
export const COST_PRESETS = ['야근 확정', '마감 넘김', '신임 하락', '돈 새어나감', '일이 두 배로']

export const NUDGE_LINES = [
  '지금 5분이 내일 1시간을 구합니다.',
  '이 몬스터는 방치하면 커집니다.',
  '도망쳐도 몬스터는 사라지지 않아요.',
  '내일의 내가 오늘의 나를 원망합니다.',
]

// ---------- 오늘의 일격 / 펫 ----------

export const STRIKE_BONUS = 30
export const PET_FEED_COST = 10

export function todayKey(now = Date.now()): string {
  const d = new Date(now)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export const ENERGY_LABEL: Record<Energy, string> = {
  low: '떡실신',
  mid: '보통',
  high: '풀충전',
}

const ENERGY_RANK: Record<Energy, number> = { low: 0, mid: 1, high: 2 }

export const MINUTE_OPTIONS = [5, 15, 30, 60] as const

export interface LootItem {
  id: string
  name: string
  sprite: string
  rarity: number
}

export const LOOT: LootItem[] = [
  { id: 'potion', name: '빨간 포션', sprite: 'potion', rarity: 1 },
  { id: 'sword', name: '낡은 검', sprite: 'sword', rarity: 2 },
  { id: 'shield', name: '나무 방패', sprite: 'shield', rarity: 2 },
  { id: 'gem', name: '푸른 보석', sprite: 'gem', rarity: 3 },
  { id: 'star', name: '별의 조각', sprite: 'star', rarity: 4 },
  { id: 'crown', name: '왕관', sprite: 'crown', rarity: 5 },
]

export const uid = () => Math.random().toString(36).slice(2, 10)

export const levelOf = (xp: number) => Math.floor(xp / XP_PER_LEVEL) + 1
export const levelProgress = (xp: number) => xp % XP_PER_LEVEL

export function sameDay(a: number, b: number) {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

export function dueLabel(due: string, now = Date.now()): { text: string; urgent: boolean } {
  const days = Math.ceil((new Date(due + 'T23:59:59').getTime() - now) / 86400000)
  if (days < 0) return { text: `마감 ${-days}일 지남!`, urgent: true }
  if (days === 0) return { text: '오늘 마감!', urgent: true }
  if (days === 1) return { text: '내일 마감', urgent: true }
  return { text: `D-${days}`, urgent: days <= 3 }
}

// 뽑기 가중치: 마감 임박 + 묵은 지 오래됨 + 급해 표시 + 잡몹(빠른 승리) 살짝 우대
export function drawWeight(t: Task, now = Date.now()): number {
  let w = 1
  if (t.due) {
    const days = (new Date(t.due + 'T23:59:59').getTime() - now) / 86400000
    if (days < 0) w += 5
    else if (days < 1) w += 4
    else if (days < 3) w += 2
  }
  w += Math.min(((now - t.createdAt) / 86400000) * 0.3, 2)
  if (t.urgent) w += 3
  if (t.difficulty === 'slime') w += 0.5
  if (enraged(t, now)) w += 4
  return w
}

export function pickWeighted(tasks: Task[], excludeId?: string, now = Date.now()): Task | null {
  const candidates = excludeId ? tasks.filter((t) => t.id !== excludeId) : tasks
  if (candidates.length === 0) return null
  // 수집함 위쪽에 있을수록 가중치 보너스 (유저가 ▲▼로 정한 우선순위)
  const weightOf = (t: Task, i: number) => drawWeight(t, now) + (candidates.length - i) * 0.4
  const total = candidates.reduce((s, t, i) => s + weightOf(t, i), 0)
  let roll = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    roll -= weightOf(candidates[i], i)
    if (roll <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

// 현재 상태(시간/에너지)에 맞는 퀘스트만 필터
export function filterDoable(pool: Task[], minutes: number, energy: Energy): Task[] {
  return pool.filter((t) => t.minutes <= minutes && ENERGY_RANK[t.energy] <= ENERGY_RANK[energy])
}

function lootRarity(d: Difficulty): number {
  const r = Math.random()
  if (d === 'boss') return r < 0.4 ? 5 : r < 0.75 ? 4 : 3
  if (d === 'elite') return r < 0.15 ? 4 : r < 0.5 ? 3 : 2
  return r < 0.6 ? 1 : r < 0.9 ? 2 : 3
}

export function rollLoot(d: Difficulty): LootItem {
  const rarity = lootRarity(d)
  const table = LOOT.filter((l) => l.rarity === rarity)
  const pick = table[Math.floor(Math.random() * table.length)]
  return pick ?? LOOT[Math.floor(Math.random() * LOOT.length)]
}

// 완료 XP = 난이도 기본값 + 오늘 콤보 보너스
export function xpFor(d: Difficulty, doneToday: number): number {
  return DIFF[d].xp + Math.min(doneToday, 5) * 2
}

// 골드 = 얻은 XP만큼
export function goldFor(xp: number): number {
  return xp
}

export function lootById(id?: string): LootItem | undefined {
  return LOOT.find((l) => l.id === id)
}

// ---------- 칭호 / 스트릭 / 펫 ----------

export function titleOf(level: number): string {
  if (level >= 20) return '전설의 용사'
  if (level >= 15) return '영웅'
  if (level >= 10) return '베테랑 모험가'
  if (level >= 5) return '숙련 모험가'
  if (level >= 3) return '모험가'
  return '견습 모험가'
}

function dayKeyOf(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function streakDays(done: DoneQuest[], now = Date.now()): number {
  const days = new Set(done.map((d) => dayKeyOf(d.completedAt)))
  const cursor = new Date(now)
  // 오늘 아직 안 했으면 어제부터 거슬러 셈 (오늘이 끝나기 전까진 스트릭 유지)
  if (!days.has(dayKeyOf(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKeyOf(cursor.getTime()))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// ---------- 캐릭터 커스터마이징 / 테마 / 주간 통계 ----------

export const HERO_HAIRS = [
  { color: '#7a4a2f', name: '갈색' },
  { color: '#2b2b33', name: '흑발' },
  { color: '#e8c04a', name: '금발' },
  { color: '#c94f4f', name: '빨강' },
  { color: '#4a7ad8', name: '파랑' },
  { color: '#4a9e5c', name: '초록' },
]

export const HERO_TUNICS = [
  { color: '#3d7ad8', name: '파랑' },
  { color: '#d84a4a', name: '빨강' },
  { color: '#3da857', name: '초록' },
  { color: '#8a5ad8', name: '보라' },
  { color: '#4a4f66', name: '검정' },
]

// knight 스프라이트의 H(머리)/T(옷) 색을 덮어씀
export function heroPalette(s: { heroHair?: string; heroTunic?: string }): Record<string, string> | undefined {
  if (!s.heroHair && !s.heroTunic) return undefined
  return { H: s.heroHair ?? '#7a4a2f', T: s.heroTunic ?? '#3d7ad8' }
}

export const THEMES = [
  { id: 'night', name: '밤하늘' },
  { id: 'sunset', name: '노을' },
  { id: 'forest', name: '숲속' },
  { id: 'dungeon', name: '던전' },
] as const

// 최근 7일 처치 수 (주간 차트용)
export function weekCounts(done: DoneQuest[], now = Date.now()): { label: string; count: number }[] {
  const names = ['일', '월', '화', '수', '목', '금', '토']
  const out: { label: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const count = done.filter((q) => sameDay(q.completedAt, d.getTime())).length
    out.push({ label: i === 0 ? '오늘' : names[d.getDay()], count })
  }
  return out
}

// 펫 성장 = 먹인 끼니 수 (골드로 사 먹임 — 직접 키우는 재미)
export function petStage(food: number): { name: string; sprite: string; next: number | null } {
  if (food >= 15) return { name: '왕슬라임', sprite: 'kingslime', next: null }
  if (food >= 6) return { name: '슬라임', sprite: 'slime', next: 15 }
  if (food >= 2) return { name: '아기 슬라임', sprite: 'babyslime', next: 6 }
  return { name: '알', sprite: 'egg', next: 2 }
}

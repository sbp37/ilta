export type Difficulty = 'slime' | 'elite' | 'boss'
export type Energy = 'low' | 'mid' | 'high'
export type HeroClass = 'warrior' | 'mage' | 'rogue'
export type Category = 'study' | 'home' | 'work' | 'health' | 'etc'
export type Repeat = 'daily' | 'weekdays' | 'weekly'

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
  repeat?: Repeat // 처치해도 다시 나타나는 반복 몬스터
  availableAt?: number // 이 시각 전에는 잠들어 있음 (반복 몹 대기)
  category?: Category // 할 일 분류 — 몬스터 종류가 여기서 정해진다
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

export const SAVE_VERSION = 2

export interface GameState {
  version?: number // 저장 데이터 스키마 버전 (없으면 1)
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
  petFedAt?: number
  strike?: { id: string; day: string }
  theme?: string
  notif?: boolean
  heroClass?: HeroClass
  raid?: { key: string; hp: number; max: number }
  gear?: string[]
  equippedGear?: string[]
  freezes?: number // 휴식일 부적 보유 수
  freezeUsed?: string[] // 부적으로 지켜낸 날짜 키
  items?: Record<string, number> // 소모품 보유 수 (reroll / xppotion / calm)
  xpBoost?: boolean // XP 포션 적용 중 — 다음 처치 XP 1.5배
  achieved?: string[] // 획득한 업적 id
  raidKills?: number // 처치한 주간·챕터 보스 수
  chapterClears?: string[] // 클리어한 챕터 키
}

export const MAX_ACTIVE = 3 // 기본 슬롯 수 — 레벨 해금은 slotsFor() 참고
export const XP_PER_LEVEL = 100
export const STARTER_BONUS_XP = 5

// ---------- 레벨 커브: 5레벨까진 100XP, 그 뒤로 레벨당 +20XP씩 더 필요 ----------

export function xpNeed(level: number): number {
  return XP_PER_LEVEL + Math.max(0, level - 5) * 20
}

export function levelOf(xp: number): number {
  let level = 1
  let rest = xp
  while (rest >= xpNeed(level)) {
    rest -= xpNeed(level)
    level++
  }
  return level
}

// 현재 레벨 안에서의 진행도
export function levelProgress(xp: number): { cur: number; need: number } {
  let level = 1
  let rest = xp
  while (rest >= xpNeed(level)) {
    rest -= xpNeed(level)
    level++
  }
  return { cur: rest, need: xpNeed(level) }
}

// 해당 레벨에 도달하는 데 필요한 누적 XP (마이그레이션·테스트용)
export function xpAtLevel(level: number): number {
  let total = 0
  for (let l = 1; l < level; l++) total += xpNeed(l)
  return total
}

// 레벨업 축하 골드 = 새 레벨 × 10
export const levelUpGold = (level: number) => level * 10

// 레벨 해금 표
export const UNLOCKS: { level: number; text: string }[] = [
  { level: 3, text: '테마 「노을」 해금' },
  { level: 5, text: '장비 「가죽 갑옷」 해금' },
  { level: 6, text: '테마 「숲속」 해금' },
  { level: 8, text: '퀘스트 슬롯 4개로 확장!' },
  { level: 10, text: '테마 「던전」 해금' },
  { level: 12, text: '장비 「기사 투구」 해금' },
  { level: 15, text: '테마 「벚꽃」 + 장비 「황금 왕관」 해금' },
]

export const unlocksAt = (level: number) => UNLOCKS.filter((u) => u.level === level).map((u) => u.text)

// 퀘스트 슬롯: 8레벨부터 4개
export const SLOT_UNLOCK_LEVEL = 8
export const slotsFor = (level: number) => (level >= SLOT_UNLOCK_LEVEL ? MAX_ACTIVE + 1 : MAX_ACTIVE)

export const DIFF: Record<Difficulty, { label: string; xp: number; sprite: string; color: string }> = {
  slime: { label: '잡몹', xp: 10, sprite: 'slime', color: '#43d675' },
  elite: { label: '정예', xp: 25, sprite: 'imp', color: '#a86bff' },
  boss: { label: '보스', xp: 60, sprite: 'demon', color: '#ff4d5e' },
}

// 난이도별 등장 몬스터 — 분류를 안 고르면 이 중에서 랜덤 배정
export const MONSTERS: Record<Difficulty, string[]> = {
  slime: ['slime', 'mushroom', 'ghost', 'blueslime', 'bat'],
  elite: ['imp', 'skeleton', 'witch', 'ogre', 'gargoyle'],
  boss: ['demon', 'dragon', 'lich', 'golem', 'mimic'],
}

// 할 일 분류 — 분류마다 전담 몬스터가 난이도별로 하나씩 있다.
// 도감을 보면 "내가 어느 쪽 일을 많이 잡았는지"가 그대로 드러난다.
export const CATEGORIES: Record<
  Category,
  { name: string; color: string; monsters: Record<Difficulty, string> }
> = {
  study: {
    name: '공부',
    color: '#a86bff',
    monsters: { slime: 'mushroom', elite: 'witch', boss: 'lich' },
  },
  home: {
    name: '집안일',
    color: '#43d675',
    monsters: { slime: 'slime', elite: 'skeleton', boss: 'golem' },
  },
  work: {
    name: '회사',
    color: '#4a9ad8',
    monsters: { slime: 'ghost', elite: 'imp', boss: 'demon' },
  },
  health: {
    name: '건강',
    color: '#ff8a5c',
    monsters: { slime: 'blueslime', elite: 'ogre', boss: 'dragon' },
  },
  etc: {
    name: '기타',
    color: '#8a8fa8',
    monsters: { slime: 'bat', elite: 'gargoyle', boss: 'mimic' },
  },
}

export const CATEGORY_IDS = Object.keys(CATEGORIES) as Category[]

// 분류가 있으면 전담 몬스터, 없으면 난이도 풀에서 랜덤
export function monsterFor(difficulty: Difficulty, category?: Category): string {
  if (category && CATEGORIES[category]) return CATEGORIES[category].monsters[difficulty]
  return randomMonster(difficulty)
}

export function randomMonster(d: Difficulty): string {
  const list = MONSTERS[d]
  return list[Math.floor(Math.random() * list.length)]
}

export function monsterOf(t: { monster?: string; difficulty: Difficulty }): string {
  return t.monster ?? DIFF[t.difficulty].sprite
}

// 몬스터 도감 이름표
export const MONSTER_NAMES: Record<string, string> = {
  bat: '박쥐',
  ogre: '오거',
  gargoyle: '가고일',
  slime: '슬라임',
  mushroom: '독버섯',
  ghost: '유령',
  blueslime: '블루슬라임',
  imp: '임프',
  skeleton: '스켈레톤',
  witch: '마녀',
  demon: '데몬',
  dragon: '드래곤',
  lich: '리치',
  golem: '골렘',
  mimic: '미믹',
}

export const ALL_MONSTERS: string[] = [...MONSTERS.slime, ...MONSTERS.elite, ...MONSTERS.boss]

export const REPEAT_LABEL: Record<Repeat, string> = {
  daily: '매일',
  weekdays: '평일만',
  weekly: '주 1회',
}

// 반복 몹이 다시 나타날 시각 — 그 날 0시 기준
export function nextAvailable(repeat: Repeat, now = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  if (repeat === 'weekly') {
    d.setDate(d.getDate() + 7)
    return d.getTime()
  }
  d.setDate(d.getDate() + 1)
  if (repeat === 'weekdays') {
    // 토(6)·일(0)은 건너뛰고 다음 평일로
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  }
  return d.getTime()
}

// 잠들어 있는(대기 중) 몹은 뽑기·수락·습격 대상에서 빠진다
export function isAvailable(t: { availableAt?: number }, now = Date.now()): boolean {
  return !t.availableAt || t.availableAt <= now
}

export function availableLabel(t: { availableAt?: number }, now = Date.now()): string | null {
  if (isAvailable(t, now)) return null
  const days = Math.ceil((t.availableAt! - now) / 86400000)
  if (days <= 1) return '내일 다시 나타남'
  return `${days}일 뒤 다시 나타남`
}

export const DAILY_GOAL = 3
export const DAILY_GOAL_BONUS = 20
export const CRIT_CHANCE = 0.15
export const CRIT_MULT = 1.5

// ---------- 광폭화: 미루면 몬스터가 커진다 ----------

export const ENRAGE_DAYS = 7 // 마감 없는 몹은 일주일 묵혀야 광폭화
export const ENRAGE_RETREATS = 2
export const ENRAGE_CAP = 3 // 동시에 광폭 상태로 보이는 몹 최대 수 (경고 피로 방지)

export function enraged(
  t: { due?: string; retreats?: number; createdAt: number },
  now = Date.now(),
): boolean {
  if ((t.retreats ?? 0) >= ENRAGE_RETREATS) return true
  // 마감이 있는 몹은 마감만 본다 — 멀리 잡아둔 마감 때문에 방치 판정을 받으면 안 됨
  if (t.due) return new Date(t.due + 'T23:59:59').getTime() < now
  return now - t.createdAt >= ENRAGE_DAYS * 86400000
}

// 광폭화 심각도: 마감 넘김 > 도망 횟수 > 오래 묵힘
function enrageSeverity(t: { due?: string; retreats?: number; createdAt: number }, now: number): number {
  let sev = 0
  if (t.due) {
    const over = now - new Date(t.due + 'T23:59:59').getTime()
    if (over > 0) sev += 1000 + over / 86400000
  }
  sev += (t.retreats ?? 0) * 100
  sev += (now - t.createdAt) / 86400000
  return sev
}

// 실제로 "광폭"으로 표시할 몹 id 집합 — 심각한 순으로 ENRAGE_CAP개까지만
export function enragedSet(tasks: Task[], now = Date.now()): Set<string> {
  const mad = tasks.filter((t) => isAvailable(t, now) && enraged(t, now))
  mad.sort((a, b) => enrageSeverity(b, now) - enrageSeverity(a, now))
  return new Set(mad.slice(0, ENRAGE_CAP).map((t) => t.id))
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

// 일격 대상이 처치된 뒤의 strike 정리.
// - 미래 날짜로 예약된 일격이 리스폰했으면 새 id를 따라간다
// - 미래 예약인데 리스폰이 없으면(반복 아님) 죽은 id를 가리키므로 해제한다
// - 오늘/과거 일격은 그대로 둔다 — done 목록에서 "달성"으로 보여주거나 자연 만료
export function strikeRespawn(
  strike: { id: string; day: string } | undefined,
  completedId: string,
  respawnId: string | undefined,
  now = Date.now(),
): { id: string; day: string } | undefined {
  if (!strike || strike.id !== completedId) return strike
  // day는 'Y-M-D' 포맷이라 문자열 비교가 틀어진다 ('2026-8-2' > '2026-8-19') — 날짜로 환산해 비교
  const dayMs = (k: string) => {
    const [y, m, d] = k.split('-').map(Number)
    return new Date(y, m, d).getTime()
  }
  if (dayMs(strike.day) <= dayMs(todayKey(now))) return strike
  return respawnId ? { id: respawnId, day: strike.day } : undefined
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

export function sameDay(a: number, b: number) {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
  )
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
  const candidates = tasks.filter((t) => t.id !== excludeId && isAvailable(t, now))
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

// 현재 상태(시간/에너지)에 맞고 깨어 있는 퀘스트만 필터
export function filterDoable(pool: Task[], minutes: number, energy: Energy, now = Date.now()): Task[] {
  return pool.filter(
    (t) => isAvailable(t, now) && t.minutes <= minutes && ENERGY_RANK[t.energy] <= ENERGY_RANK[energy],
  )
}

// 지금 손댈 수 있는 몹만 (일격 후보·습격·조건 무시 뽑기용)
export function awake<T extends { availableAt?: number }>(tasks: T[], now = Date.now()): T[] {
  return tasks.filter((t) => isAvailable(t, now))
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

// ---------- 전리품 패시브: 모을수록 강해진다 (개당 효과, 상한 있음) ----------

export const LOOT_STACK_CAP = 5
export const POTION_CONVERT = 5 // 빨간 포션 5개 → XP 포션 1개

export const LOOT_EFFECT: Record<string, string> = {
  potion: `${POTION_CONVERT}개 모이면 XP 포션으로 변환`,
  sword: '크리티컬 배율 1.5 → 1.75배',
  shield: '후퇴할 때 50% 확률로 도망 기록 안 남음',
  gem: '개당 골드 +5% (최대 +25%)',
  star: '개당 크리티컬 확률 +3% (최대 +15%)',
  crown: '개당 XP +5% (최대 +25%)',
}

export interface LootBonus {
  critChance: number
  critMult: number
  goldMult: number
  xpMult: number
  shieldChance: number
}

export function lootBonus(loot: Record<string, number>): LootBonus {
  const n = (id: string) => Math.min(loot[id] ?? 0, LOOT_STACK_CAP)
  return {
    critChance: n('star') * 0.03,
    critMult: (loot.sword ?? 0) > 0 ? 0.25 : 0,
    goldMult: n('gem') * 0.05,
    xpMult: n('crown') * 0.05,
    shieldChance: (loot.shield ?? 0) > 0 ? 0.5 : 0,
  }
}

// ---------- 소모품 ----------

export interface Consumable {
  id: string
  name: string
  sprite: string
  cost: number
  desc: string
}

export const ITEM_MAX = 5
export const XP_BOOST_MULT = 1.5

export const CONSUMABLES: Consumable[] = [
  {
    id: 'reroll',
    name: '다시뽑기권',
    sprite: 'ticket',
    cost: 30,
    desc: '퀘스트 뽑기에서 한 번 더 뽑을 수 있다',
  },
  {
    id: 'xppotion',
    name: 'XP 포션',
    sprite: 'potion',
    cost: 40,
    desc: `사용하면 다음 처치 XP ${XP_BOOST_MULT}배`,
  },
  {
    id: 'calm',
    name: '진정의 향',
    sprite: 'incense',
    cost: 45,
    desc: '광폭한 몹 하나를 진정시킨다 (도망·묵힌 기록 초기화)',
  },
]

export const itemCount = (s: { items?: Record<string, number> }, id: string) => s.items?.[id] ?? 0

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

export function streakDays(done: DoneQuest[], now = Date.now(), covered: string[] = []): number {
  const days = new Set([...done.map((d) => dayKeyOf(d.completedAt)), ...covered])
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

// ---------- 휴식일 부적: 하루 빠져도 스트릭을 지켜준다 ----------

export const FREEZE_COST = 60
export const FREEZE_MAX = 3

// 어제부터 거슬러 올라가며 빈 날을 찾고, 그 앞에 지켜야 할 스트릭이 있으면 부적을 소모한다.
// 빈 날 수만큼 부적이 없으면 아무것도 하지 않는다 (반만 덮어봐야 소용없으므로).
export function applyFreezes(
  done: DoneQuest[],
  freezes: number,
  used: string[],
  now = Date.now(),
): { freezes: number; used: string[]; consumed: number } {
  if (freezes <= 0 || done.length === 0) return { freezes, used, consumed: 0 }
  const days = new Set([...done.map((d) => dayKeyOf(d.completedAt)), ...used])
  const cursor = new Date(now)
  cursor.setDate(cursor.getDate() - 1)
  const gap: string[] = []
  while (!days.has(dayKeyOf(cursor.getTime()))) {
    gap.push(dayKeyOf(cursor.getTime()))
    cursor.setDate(cursor.getDate() - 1)
    if (gap.length > freezes) return { freezes, used, consumed: 0 }
    // 너무 오래 전까지 거슬러가지 않도록
    if (gap.length > FREEZE_MAX) return { freezes, used, consumed: 0 }
  }
  if (gap.length === 0) return { freezes, used, consumed: 0 }
  // 빈 날 바로 앞에 실제로 처치한 날이 있어야 지킬 스트릭이 있는 것
  return { freezes: freezes - gap.length, used: [...used, ...gap], consumed: gap.length }
}

// ---------- 타이머: 시작 시각 기준으로 남은 초 계산 (백그라운드에서도 정확) ----------

export function timerLeft(startedAt: number, seconds: number, now = Date.now()): number {
  return Math.max(0, seconds - Math.floor((now - startedAt) / 1000))
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
export function heroPalette(s: {
  heroHair?: string
  heroTunic?: string
}): Record<string, string> | undefined {
  if (!s.heroHair && !s.heroTunic) return undefined
  return { H: s.heroHair ?? '#7a4a2f', T: s.heroTunic ?? '#3d7ad8' }
}

export const THEMES = [
  { id: 'night', name: '밤하늘', level: 1 },
  { id: 'sunset', name: '노을', level: 3 },
  { id: 'forest', name: '숲속', level: 6 },
  { id: 'dungeon', name: '던전', level: 10 },
  { id: 'sakura', name: '벚꽃', level: 15 },
] as const

// ---------- 직업 / 주간 보스 레이드 ----------

export const CLASSES: Record<HeroClass, { name: string; desc: string; icon: string }> = {
  warrior: { name: '전사', desc: '콤보 보너스 2배 — 연속 처치에 강하다', icon: 'sword' },
  mage: { name: '마법사', desc: '하위 잡몹 처치마다 +3XP — 쪼개기에 강하다', icon: 'star' },
  rogue: { name: '도적', desc: '골드 획득 +25% — 전리품에 강하다', icon: 'gem' },
}

export const RAID_MAX_HP = 300
export const RAID_REWARD = 100
const RAID_BOSSES = ['dragon', 'golem', 'lich', 'mimic', 'demon']

// ---------- 시즌(챕터): 4주 = 1챕터, 마지막 주는 챕터 보스 ----------

export const CHAPTER_WEEKS = 4
export const CHAPTER_BOSS_HP = 600
export const CHAPTER_REWARD = 300

// 챕터 기준 월요일 (이 주가 1챕터 1주차)
const CHAPTER_EPOCH = new Date(2026, 0, 5).getTime()

export const CHAPTERS = [
  { name: '잠든 숲', boss: 'dragon', title: '숲의 해방자' },
  { name: '무너진 성', boss: 'golem', title: '성벽의 파괴자' },
  { name: '검은 서고', boss: 'lich', title: '금서의 봉인자' },
  { name: '탐욕의 금고', boss: 'mimic', title: '금고를 연 자' },
  { name: '불타는 왕좌', boss: 'demon', title: '왕좌의 도전자' },
] as const

// 기준 월요일로부터 몇 번째 주인지 (0부터)
export function weekIndex(now = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // 그 주 월요일
  return Math.max(0, Math.round((d.getTime() - CHAPTER_EPOCH) / (7 * 86400000)))
}

export interface ChapterInfo {
  key: string // 챕터 식별자
  index: number // 0부터
  name: string
  week: number // 챕터 안에서 몇 주차 (1..CHAPTER_WEEKS)
  isFinal: boolean // 마지막 주 = 챕터 보스
  boss: string // 이번 주 보스 스프라이트
  title: string // 챕터 클리어 칭호
  maxHp: number
  reward: number
}

export function chapterOf(now = Date.now()): ChapterInfo {
  const wi = weekIndex(now)
  const index = Math.floor(wi / CHAPTER_WEEKS)
  const week = (wi % CHAPTER_WEEKS) + 1
  const ch = CHAPTERS[index % CHAPTERS.length]
  const isFinal = week === CHAPTER_WEEKS
  return {
    key: `C${index}`,
    index,
    name: ch.name,
    week,
    isFinal,
    boss: isFinal ? ch.boss : RAID_BOSSES[wi % RAID_BOSSES.length],
    title: ch.title,
    maxHp: isFinal ? CHAPTER_BOSS_HP : RAID_MAX_HP,
    reward: isFinal ? CHAPTER_REWARD : RAID_REWARD,
  }
}

// 주차 키 — 그 주 월요일 날짜로 만든다. 월요일 0시에만 바뀌므로
// 연말이나 서머타임에 주가 엉키지 않는다. (이전 방식은 1월 1일의 요일에
// 따라 주 경계가 수·금 등으로 밀려서 주간 보스가 엉뚱한 날 초기화됐다)
export function weekKey(now = Date.now()): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // 월요일로 이동
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-W${mm}${dd}`
}

export function raidBoss(key: string): string {
  const w = parseInt(key.split('-W')[1] ?? '1', 10)
  return RAID_BOSSES[w % RAID_BOSSES.length]
}

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

// 펫 컨디션: 새벽엔 자고, 오래 안 먹이면 배고픔
export type PetMood = 'sleeping' | 'hungry' | 'full' | 'ok'

export function petMood(s: { petFedAt?: number }, now = Date.now()): PetMood {
  const h = new Date(now).getHours()
  if (h >= 0 && h < 7) return 'sleeping'
  if (!s.petFedAt) return 'ok'
  const ago = now - s.petFedAt
  if (ago > 24 * 3600_000) return 'hungry'
  if (ago < 6 * 3600_000) return 'full'
  return 'ok'
}

export const PET_MOOD_LABEL: Record<PetMood, string> = {
  sleeping: '자는 중 💤',
  hungry: '배고파한다…',
  full: '배부르다!',
  ok: '심심해한다',
}

// ---------- 직업별 용사 스프라이트 ----------

export function heroSprite(cls?: HeroClass): string {
  if (cls === 'warrior') return 'knight_warrior'
  if (cls === 'mage') return 'knight_mage'
  if (cls === 'rogue') return 'knight_rogue'
  return 'knight'
}

// ---------- 장착 오버레이 (전리품 + 상점 장비) ----------

export interface EquipDef {
  sprite: string
  x: number
  y: number
  slot: string
}

export const EQUIP_MAP: Record<string, EquipDef> = {
  // 전리품 (자동 장착)
  potion: { sprite: 'potion', x: -1, y: 10, slot: 'acc' },
  sword: { sprite: 'sword', x: 9, y: 5, slot: 'hand' },
  shield: { sprite: 'shield', x: -3, y: 6, slot: 'hand' },
  gem: { sprite: 'gem', x: 4, y: 8, slot: 'acc' },
  star: { sprite: 'star', x: 10, y: -3, slot: 'acc' },
  crown: { sprite: 'crown', x: 2, y: -2, slot: 'head' },
  // 상점 장비
  g_potion: { sprite: 'potion', x: -1, y: 10, slot: 'acc' },
  g_boots: { sprite: 'boots', x: 2, y: 9, slot: 'feet' },
  g_amulet: { sprite: 'amulet', x: 4, y: 7, slot: 'acc' },
  g_armor: { sprite: 'armor', x: 2, y: 7, slot: 'body' },
  g_cape: { sprite: 'cape', x: -2, y: 6, slot: 'back' },
  g_wizardhat: { sprite: 'wizardhat', x: 2, y: -3, slot: 'head' },
  g_helmet: { sprite: 'helmet', x: 2, y: -2, slot: 'head' },
  g_crown: { sprite: 'crown', x: 2, y: -2, slot: 'head' },
}

// 장착 목록 → 슬롯 중복 제거한 오버레이 목록 (앞에 온 게 우선)
export function equipOverlays(equipped: string[]): EquipDef[] {
  const seen = new Set<string>()
  const out: EquipDef[] = []
  for (const id of equipped) {
    const e = EQUIP_MAP[id]
    if (!e || seen.has(e.slot)) continue
    seen.add(e.slot)
    out.push(e)
  }
  return out
}

// ---------- 업적 ----------

export interface Achievement {
  id: string
  name: string
  desc: string
  gold: number
  done: (s: GameState, now?: number) => boolean
}

const killsOf = (s: GameState) => s.done.length
const bossKills = (s: GameState) => s.done.filter((d) => d.difficulty === 'boss').length

// 하루 최다 처치
export function bestDay(done: DoneQuest[]): number {
  const byDay = new Map<string, number>()
  for (const d of done) {
    const k = dayKeyOf(d.completedAt)
    byDay.set(k, (byDay.get(k) ?? 0) + 1)
  }
  return Math.max(0, ...byDay.values())
}

// 처치한 몬스터 종류 수
export function dexCount(done: DoneQuest[]): number {
  const seen = new Set(done.map((d) => monsterOf(d)))
  return ALL_MONSTERS.filter((m) => seen.has(m)).length
}

// 처치한 분류 수
export function categoriesCleared(done: DoneQuest[]): number {
  const seen = new Set(done.map((d) => d.category).filter(Boolean))
  return seen.size
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: '첫 발걸음', desc: '몬스터를 1마리 처치', gold: 20, done: (s) => killsOf(s) >= 1 },
  { id: 'kill10', name: '견습 사냥꾼', desc: '10마리 처치', gold: 30, done: (s) => killsOf(s) >= 10 },
  { id: 'kill50', name: '숙련 사냥꾼', desc: '50마리 처치', gold: 60, done: (s) => killsOf(s) >= 50 },
  { id: 'kill100', name: '백몹 학살자', desc: '100마리 처치', gold: 120, done: (s) => killsOf(s) >= 100 },
  { id: 'boss5', name: '보스 도전자', desc: '보스 5마리 처치', gold: 80, done: (s) => bossKills(s) >= 5 },
  { id: 'boss20', name: '보스 사냥꾼', desc: '보스 20마리 처치', gold: 200, done: (s) => bossKills(s) >= 20 },
  {
    id: 'combo5',
    name: '폭주 기관차',
    desc: '하루에 5마리 처치',
    gold: 60,
    done: (s) => bestDay(s.done) >= 5,
  },
  {
    id: 'streak7',
    name: '일주일의 약속',
    desc: '7일 연속 처치',
    gold: 100,
    done: (s, now) => streakDays(s.done, now, s.freezeUsed) >= 7,
  },
  {
    id: 'streak30',
    name: '한 달의 습관',
    desc: '30일 연속 처치',
    gold: 300,
    done: (s, now) => streakDays(s.done, now, s.freezeUsed) >= 30,
  },
  {
    id: 'facedFear',
    name: '두려움을 마주하다',
    desc: '3번 이상 도망친 몹을 처치',
    gold: 80,
    done: (s) => s.done.some((d) => (d.retreats ?? 0) >= 3),
  },
  {
    id: 'nightOwl',
    name: '새벽의 용사',
    desc: '0시~5시에 처치',
    gold: 40,
    done: (s) => s.done.some((d) => new Date(d.completedAt).getHours() < 5),
  },
  {
    id: 'earlyBird',
    name: '아침형 용사',
    desc: '5시~8시에 처치',
    gold: 40,
    done: (s) =>
      s.done.some((d) => {
        const h = new Date(d.completedAt).getHours()
        return h >= 5 && h < 8
      }),
  },
  {
    id: 'dexHalf',
    name: '도감 절반',
    desc: `몬스터 ${Math.ceil(ALL_MONSTERS.length / 2)}종 발견`,
    gold: 80,
    done: (s) => dexCount(s.done) >= Math.ceil(ALL_MONSTERS.length / 2),
  },
  {
    id: 'dexFull',
    name: '도감 완성',
    desc: '모든 몬스터 발견',
    gold: 200,
    done: (s) => dexCount(s.done) >= ALL_MONSTERS.length,
  },
  {
    id: 'allCategories',
    name: '삶의 균형',
    desc: '5가지 분류를 모두 처치',
    gold: 80,
    done: (s) => categoriesCleared(s.done) >= CATEGORY_IDS.length,
  },
  {
    id: 'raid3',
    name: '주말의 사냥',
    desc: '주간 보스 3번 처치',
    gold: 100,
    done: (s) => (s.raidKills ?? 0) >= 3,
  },
  {
    id: 'chapter1',
    name: '첫 챕터 클리어',
    desc: '챕터 보스를 처치',
    gold: 150,
    done: (s) => (s.chapterClears ?? []).length >= 1,
  },
  {
    id: 'geared',
    name: '완전무장',
    desc: '장비 5개 보유',
    gold: 60,
    done: (s) => (s.gear ?? []).length >= 5,
  },
  {
    id: 'petMax',
    name: '최고의 파트너',
    desc: '펫을 최종 진화까지 키움',
    gold: 100,
    done: (s) => petStage(s.petFood).next === null,
  },
  {
    id: 'splitter',
    name: '쪼개기의 달인',
    desc: '잡몹으로 쪼갠 몹을 처치',
    gold: 50,
    done: (s) => s.done.some((d) => (d.subs?.length ?? 0) >= 3),
  },
]

// 지금 조건을 만족하는 업적 id
export function earnedAchievements(s: GameState, now = Date.now()): string[] {
  return ACHIEVEMENTS.filter((a) => a.done(s, now)).map((a) => a.id)
}

// 아직 안 받은 업적만
export function newAchievements(s: GameState, now = Date.now()): Achievement[] {
  const have = new Set(s.achieved ?? [])
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.done(s, now))
}

// ---------- 상점 장비 카탈로그 ----------

export interface GearItem {
  id: string
  name: string
  sprite: string
  cost: number
  slot: string
  desc: string
  level?: number // 해금 레벨
}

export const GEAR: GearItem[] = [
  {
    id: 'g_potion',
    name: '포션 벨트',
    sprite: 'potion',
    cost: 50,
    slot: 'acc',
    desc: '허리에 포션을 차고 다닌다',
  },
  { id: 'g_boots', name: '가벼운 장화', sprite: 'boots', cost: 70, slot: 'feet', desc: '발이 가벼워 보인다' },
  {
    id: 'g_amulet',
    name: '행운의 목걸이',
    sprite: 'amulet',
    cost: 90,
    slot: 'acc',
    desc: '목에 걸면 운이 따를 것 같다',
  },
  {
    id: 'g_armor',
    name: '가죽 갑옷',
    sprite: 'armor',
    cost: 110,
    slot: 'body',
    desc: '몸을 든든하게 감싼다',
    level: 5,
  },
  { id: 'g_cape', name: '모험가 망토', sprite: 'cape', cost: 130, slot: 'back', desc: '뒷모습이 모험가답다' },
  {
    id: 'g_wizardhat',
    name: '뾰족 마법모자',
    sprite: 'wizardhat',
    cost: 160,
    slot: 'head',
    desc: '쓰면 지혜로워 보인다',
  },
  {
    id: 'g_helmet',
    name: '기사 투구',
    sprite: 'helmet',
    cost: 190,
    slot: 'head',
    desc: '묵직한 철 투구',
    level: 12,
  },
  {
    id: 'g_crown',
    name: '황금 왕관',
    sprite: 'crown',
    cost: 260,
    slot: 'head',
    desc: '진짜 용사의 증표',
    level: 15,
  },
]

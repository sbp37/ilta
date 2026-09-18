import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import { shareCard } from '../shareCard'
import {
  ALL_MONSTERS,
  DoneQuest,
  LOOT,
  LOOT_EFFECT,
  LOOT_STACK_CAP,
  GameState,
  MONSTER_NAMES,
  lootById,
  monsterOf,
  streakDays,
  weekCounts,
} from '../game'

function dayKey(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function Journal({ state, onToast }: { state: GameState; onToast: (msg: string) => void }) {
  const days = new Map<string, DoneQuest[]>()
  for (const d of [...state.done].sort((a, b) => a.completedAt - b.completedAt)) {
    const k = dayKey(d.completedAt)
    days.set(k, [...(days.get(k) ?? []), d])
  }
  const dayList = [...days.entries()].reverse()

  const bossKills = state.done.filter((d) => d.difficulty === 'boss').length
  const streak = streakDays(state.done, Date.now(), state.freezeUsed)
  // 최고 콤보 = 하루 최다 처치 수
  let bestCombo = 0
  for (const quests of days.values()) bestCombo = Math.max(bestCombo, quests.length)

  // 주간 차트 + 도망 TOP3
  const week = weekCounts(state.done)
  const weekMax = Math.max(1, ...week.map((w) => w.count))
  const fled = [...state.pool]
    .filter((t) => (t.retreats ?? 0) > 0)
    .sort((a, b) => (b.retreats ?? 0) - (a.retreats ?? 0))
    .slice(0, 3)

  // 몬스터 도감: 처치 수 집계
  const kills: Record<string, number> = {}
  for (const d of state.done) {
    const m = monsterOf(d)
    kills[m] = (kills[m] ?? 0) + 1
  }
  const dexCount = ALL_MONSTERS.filter((m) => (kills[m] ?? 0) > 0).length

  const makeCard = async () => {
    sfx.draw()
    const res = await shareCard(state)
    if (res === 'shared') onToast('카드를 공유했어요!')
    else if (res === 'downloaded') onToast('전적 카드를 저장했어요')
    else onToast('카드 공유가 취소됐어요')
  }

  return (
    <div className="journal">
      <div className="pixel-panel stats-row">
        <div className="stat">
          <span className="stat-num">{state.done.length}</span>
          <span className="stat-label">총 처치</span>
        </div>
        <div className="stat">
          <span className="stat-num boss-num">{bossKills}</span>
          <span className="stat-label">보스</span>
        </div>
        <div className="stat">
          <span className="stat-num">{bestCombo}x</span>
          <span className="stat-label">최고 콤보</span>
        </div>
        <div className="stat">
          <span className="stat-num streak-num">{streak}일</span>
          <span className="stat-label">연속</span>
        </div>
      </div>

      <div className="share-row">
        <button className="btn btn-sub share-btn" onClick={makeCard}>
          🖼 전적 카드 공유
        </button>
        <button
          className="btn btn-sub share-btn"
          onClick={() => {
          const today = state.done.filter((d) => dayKey(d.completedAt) === dayKey(Date.now())).length
          const text = `⚔ 일타 전적\n오늘 ${today}몹 처치 | 총 ${state.done.length}처치 | 보스 ${bossKills} | 🔥${streak}일 연속 | ${state.gold}G`
          navigator.clipboard
            .writeText(text)
            .then(() => onToast('전적을 복사했어요! 자랑하러 가자'))
            .catch(() => onToast('복사 실패…'))
        }}
      >
          전적 복사하기
        </button>
      </div>

      <div className="pixel-panel week-chart">
        <div className="field-label">최근 7일</div>
        <div className="week-bars">
          {week.map((w) => (
            <div key={w.label} className="week-col">
              <div className="week-num">{w.count > 0 ? w.count : ''}</div>
              <div className="week-bar-wrap">
                <div className="week-bar" style={{ height: `${(w.count / weekMax) * 100}%` }} />
              </div>
              <div className={`week-label ${w.label === '오늘' ? 'week-today' : ''}`}>{w.label}</div>
            </div>
          ))}
        </div>
      </div>

      {fled.length > 0 && (
        <div className="pixel-panel fled-top">
          <div className="field-label">가장 많이 도망친 몹 — 지금 잡으면 영웅</div>
          {fled.map((t) => (
            <div key={t.id} className="fled-row">
              <Pixel name={monsterOf(t)} size={2} />
              <span className="fled-title">{t.title}</span>
              <span className="retreat-tag">도망 x{t.retreats}</span>
            </div>
          ))}
        </div>
      )}

      <div className="field-label">
        전리품 <span className="dim">모을수록 강해져요 (최대 {LOOT_STACK_CAP}개까지 효과)</span>
      </div>
      <div className="loot-grid">
        {LOOT.map((l) => {
          const count = state.loot[l.id] ?? 0
          return (
            <div key={l.id} className={`loot-cell ${count === 0 ? 'loot-locked' : ''}`} title={`${l.name} — ${LOOT_EFFECT[l.id]}`}>
              <Pixel name={l.sprite} size={3} />
              {count > 1 && <span className="loot-count">x{count}</span>}
            </div>
          )
        })}
      </div>
      <div className="pixel-panel loot-effects">
        {LOOT.map((l) => {
          const count = state.loot[l.id] ?? 0
          return (
            <div key={l.id} className={`loot-effect-row ${count === 0 ? 'dim' : ''}`}>
              <Pixel name={l.sprite} size={2} />
              <span className="loot-effect-name">{l.name}</span>
              <span className="loot-effect-desc">{LOOT_EFFECT[l.id]}</span>
              <span className="loot-effect-count">{count > 0 ? `x${Math.min(count, LOOT_STACK_CAP)}` : '—'}</span>
            </div>
          )
        })}
      </div>

      <div className="field-label">
        몬스터 도감 <span className="dim">{dexCount}/{ALL_MONSTERS.length} 수집</span>
      </div>
      <div className="dex-grid">
        {ALL_MONSTERS.map((m) => {
          const n = kills[m] ?? 0
          return (
            <div key={m} className={`dex-cell ${n === 0 ? 'dex-locked' : ''}`} title={n > 0 ? `${n}마리 처치` : '미발견'}>
              <Pixel name={m} size={3} />
              <div className="dex-name">{n > 0 ? MONSTER_NAMES[m] : '???'}</div>
              {n > 1 && <div className="dex-count">x{n}</div>}
            </div>
          )
        })}
      </div>

      <div className="field-label">모험 일지</div>
      {dayList.length === 0 && (
        <div className="empty-scene">
          <Pixel name="egg" size={4} className="bob" />
          <div className="dim">아직 쓰인 이야기가 없어요. 첫 퀘스트를 완료해보세요!</div>
        </div>
      )}
      {dayList.map(([k, quests], i) => {
        const totalXp = quests.reduce((s, q) => s + q.xp, 0)
        return (
          <div key={k} className="journal-day pixel-panel">
            <div className="journal-day-header">
              제 {dayList.length - i} 일 <span className="dim">{k}</span>
              <span className="journal-xp">+{totalXp} XP</span>
            </div>
            {quests.map((q) => {
              const loot = lootById(q.lootId)
              return (
                <div key={q.id} className="journal-entry">
                  <div className="journal-entry-line">
                    <Pixel name={monsterOf(q)} size={2} />
                    용사는 「{q.title}」 몬스터를 처치했다!
                    <span className="journal-xp"> +{q.xp}XP</span>
                  </div>
                  {loot && (
                    <div className="journal-loot">
                      <Pixel name={loot.sprite} size={2} /> 전리품 「{loot.name}」 획득!
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

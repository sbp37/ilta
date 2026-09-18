import { Pixel } from '../Pixel'
import { DoneQuest, LOOT, GameState, lootById, monsterOf, streakDays, weekCounts } from '../game'

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
  const streak = streakDays(state.done)
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

      <div className="field-label">전리품</div>
      <div className="loot-grid">
        {LOOT.map((l) => {
          const count = state.loot[l.id] ?? 0
          return (
            <div key={l.id} className={`loot-cell ${count === 0 ? 'loot-locked' : ''}`} title={l.name}>
              <Pixel name={l.sprite} size={3} />
              {count > 1 && <span className="loot-count">x{count}</span>}
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

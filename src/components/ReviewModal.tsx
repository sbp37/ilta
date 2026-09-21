import { useMemo } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import { DAILY_GOAL, GameState, awake, drawWeight, monsterOf, sameDay, todayKey } from '../game'

interface Props {
  state: GameState
  onPickTomorrow: (id: string) => void
  onClose: () => void
}

export function ReviewModal({ state, onPickTomorrow, onClose }: Props) {
  const now = Date.now()
  const todayDone = state.done.filter((d) => sameDay(d.completedAt, now))
  const todayXp = todayDone.reduce((s, q) => s + q.xp, 0)
  const goalDone = todayDone.length >= DAILY_GOAL
  const strikeToday = state.strike?.day === todayKey(now) && todayDone.some((d) => d.id === state.strike!.id)

  // 내일의 일격 후보: 가중치 상위 3개
  const candidates = useMemo(
    () =>
      awake(state.pool)
        .sort((a, b) => drawWeight(b) - drawWeight(a))
        .slice(0, 3),
    [state.pool],
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pixel-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">🌙 오늘의 전과</div>

        {todayDone.length === 0 ? (
          <div className="dim review-empty">오늘은 아직 처치한 몬스터가 없어요. 내일은 더 나을 거예요.</div>
        ) : (
          <div className="review-list">
            {todayDone.map((q) => (
              <div key={q.id} className="review-entry">
                <Pixel name={monsterOf(q)} size={2} />
                <span className="review-title">{q.title}</span>
                <span className="journal-xp">+{q.xp}XP</span>
              </div>
            ))}
          </div>
        )}

        <div className="review-summary pixel-panel">
          <div>
            오늘 처치 <b>{todayDone.length}</b>몹 · +{todayXp}XP
          </div>
          <div className={goalDone ? 'goal-done' : 'dim'}>
            일일 목표 {Math.min(todayDone.length, DAILY_GOAL)}/{DAILY_GOAL} {goalDone ? '달성!' : ''}
          </div>
          {strikeToday && <div className="goal-done">오늘의 일격 성공!</div>}
        </div>

        {candidates.length > 0 && (
          <>
            <div className="field-label">내일의 일격을 미리 고르시오</div>
            <div className="ritual-cards">
              {candidates.map((t) => (
                <button
                  key={t.id}
                  className="ritual-card"
                  onClick={() => {
                    sfx.accept()
                    onPickTomorrow(t.id)
                  }}
                >
                  <Pixel name={monsterOf(t)} size={3} />
                  <span>{t.title}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <button className="btn btn-sub modal-close-btn" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}

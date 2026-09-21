import { useMemo, useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import { GameState, dailyGoalOf, drawWeight, monsterOf, sameDay, todayKey } from '../game'

interface Props {
  state: GameState
  onPickTomorrow: (id: string) => void
  onClose: () => void
  onSaveReview: (day: string, review: { win: string; obstacle: string; next: string }) => void
}

export function ReviewModal({ state, onPickTomorrow, onClose, onSaveReview }: Props) {
  const now = Date.now()
  const [day] = useState(() => todayKey())
  const [review, setReview] = useState(state.reviews?.[day] ?? { win: '', obstacle: '', next: '' })
  const goal = dailyGoalOf(state)
  const todayDone = state.done.filter((d) => sameDay(d.completedAt, now))
  const todayXp = todayDone.reduce((s, q) => s + q.xp, 0)
  const goalDone = todayDone.length >= goal
  const focusMinutes = Math.round(
    (state.focusSessions ?? [])
      .filter((f) => sameDay(f.endedAt, now))
      .reduce((sum, f) => sum + f.seconds, 0) / 60,
  )
  const strikeToday = state.strike?.day === todayKey(now) && todayDone.some((d) => d.id === state.strike!.id)

  // 내일의 일격 후보: 가중치 상위 3개
  const candidates = useMemo(
    () =>
      [...state.pool, ...state.active]
        .filter(
          (t) => !t.availableAt || t.availableAt <= new Date(new Date().setHours(24, 0, 0, 0)).getTime(),
        )
        .sort((a, b) => drawWeight(b) - drawWeight(a))
        .slice(0, 3),
    [state.pool, state.active],
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pixel-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">🌙 오늘의 전과</div>

        {todayDone.length === 0 ? (
          <div className="dim review-empty">완료하지 않은 날에도 시작한 노력은 남아요.</div>
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

        <div className="review-summary">
          <div>
            오늘 처치 <b>{todayDone.length}</b>몹 · +{todayXp}XP
          </div>
          <div className={goalDone ? 'goal-done' : 'dim'}>
            일일 목표 {Math.min(todayDone.length, goal)}/{goal} {goalDone ? '달성!' : ''}
          </div>
          <div>오늘 집중 {focusMinutes}분</div>
          {strikeToday && <div className="goal-done">오늘의 일격 성공!</div>}
        </div>

        <div className="review-fields">
          {(
            [
              ['win', '오늘 잘한 일'],
              ['obstacle', '막혔던 점'],
              ['next', '내일의 첫 행동'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                className="text-input"
                rows={2}
                maxLength={500}
                value={review[key]}
                onChange={(e) => {
                  const next = { ...review, [key]: e.target.value }
                  setReview(next)
                  onSaveReview(day, next)
                }}
              />
            </label>
          ))}
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

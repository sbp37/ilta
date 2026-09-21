import { useState } from 'react'
import { GameState, isAvailable, levelOf, slotsFor } from '../game'
import { PlanChoice } from '../organization'

interface Props {
  state: GameState
  timerQuestId?: string
  onApply: (choices: Record<string, PlanChoice>) => boolean
  onClose: () => void
}

export function ReturnModal({ state, timerQuestId, onApply, onClose }: Props) {
  const tasks = [...state.active, ...state.pool]
  const [choices, setChoices] = useState<Record<string, PlanChoice>>(() =>
    Object.fromEntries(tasks.map((t) => [t.id, state.active.some((q) => q.id === t.id) ? 'today' : 'pool'])),
  )
  const [error, setError] = useState('')
  const slots = slotsFor(levelOf(state.xp))
  const todayCount = tasks.filter((t) => choices[t.id] === 'today').length
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pixel-panel return-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">오늘 다시 고르기</div>
        <div className="return-summary">
          <span>
            오늘 {todayCount}/{slots}
          </span>
          <span>수집함 {tasks.filter((t) => choices[t.id] === 'pool').length}</span>
          <span>내일 {tasks.filter((t) => choices[t.id] === 'tomorrow').length}</span>
          <span>보관 {tasks.filter((t) => choices[t.id] === 'archive').length}</span>
        </div>
        <button
          className="btn btn-sub"
          onClick={() =>
            setChoices(Object.fromEntries(tasks.map((t) => [t.id, t.id === timerQuestId ? 'today' : 'pool'])))
          }
        >
          {timerQuestId ? '집중 중인 일만 오늘에' : '오늘 선택 비우기'}
        </button>
        {tasks.length === 0 && <p className="dim">정리할 할 일이 없어요</p>}
        <div className="return-list">
          {tasks.map((task) => (
            <label className="return-item" key={task.id}>
              <span>
                {task.title}
                {task.subs?.length ? (
                  <small>
                    {task.subs.filter((s) => s.done).length}/{task.subs.length} 단계 완료
                  </small>
                ) : null}
              </span>
              <select
                aria-label={`${task.title} 배치`}
                value={choices[task.id]}
                disabled={task.id === timerQuestId}
                onChange={(e) => {
                  setError('')
                  setChoices({ ...choices, [task.id]: e.target.value as PlanChoice })
                }}
              >
                <option value="today" disabled={!isAvailable(task)}>
                  오늘
                </option>
                <option value="pool">수집함</option>
                <option value="tomorrow">내일로 미루기</option>
                <option value="archive">보관</option>
              </select>
            </label>
          ))}
        </div>
        {(error || todayCount > slots) && (
          <p role="alert">{error || `오늘 할 일은 ${slots}개까지 선택해 주세요`}</p>
        )}
        <div className="modal-actions">
          <button className="btn btn-sub" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn-go"
            disabled={todayCount > slots || !tasks.length}
            onClick={() => {
              if (onApply(choices)) onClose()
              else setError('일정이 바뀌었어요. 오늘 선택과 집중 중인 할 일을 확인해 주세요')
            }}
          >
            이대로 시작
          </button>
        </div>
      </div>
    </div>
  )
}

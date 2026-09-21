import { Pixel } from '../Pixel'
import { ActiveQuest, monsterOf } from '../game'
import { TimerState } from '../timer'

interface Props {
  quest: ActiveQuest
  timer: TimerState
  left: number
  onPause: () => void
  onExtend: () => void
  onComplete: () => void
  onRest: () => void
  onMinimize: () => void
}

export function TimerOverlay({
  quest,
  timer,
  left,
  onPause,
  onExtend,
  onComplete,
  onRest,
  onMinimize,
}: Props) {
  const paused = timer.pausedLeft !== undefined
  return (
    <div className="modal-backdrop" onClick={onMinimize}>
      <div className="modal pixel-panel timer-modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn timer-minimize" title="최소화" aria-label="최소화" onClick={onMinimize}>
          −
        </button>
        <Pixel name={monsterOf(quest)} size={5} className={paused || timer.finished ? '' : 'bob'} />
        <div className="reveal-title">{quest.title}</div>
        <div className="dim">
          {timer.finished
            ? '집중을 마쳤어요'
            : paused
              ? '잠시 쉬는 중'
              : timer.starter
                ? '5분만 시작'
                : '집중 중'}
        </div>
        <div className="timer-clock" role="timer" aria-label="남은 집중 시간">
          {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}
        </div>
        <div className="xp-bar">
          <div className="xp-fill timer-fill" style={{ width: `${(left / timer.seconds) * 100}%` }} />
        </div>
        <div className="timer-controls">
          {timer.finished ? (
            <>
              <button className="btn btn-go" onClick={onComplete}>
                할 일 완료
              </button>
              <button className="btn btn-sub" onClick={onExtend}>
                5분 더 집중
              </button>
              <button className="btn btn-ghost" onClick={onRest}>
                여기까지 쉬기
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-go" onClick={onPause}>
                {paused ? '▶ 다시 시작' : 'Ⅱ 일시정지'}
              </button>
              <button className="btn btn-sub" onClick={onComplete}>
                할 일 완료
              </button>
              <button className="btn btn-ghost" onClick={onRest}>
                집중 종료
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

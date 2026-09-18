import { useEffect, useRef, useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import { ActiveQuest, monsterOf } from '../game'

interface Props {
  quest: ActiveQuest
  seconds: number
  starter: boolean // true면 "5분만 시작" 모드 — 끝나도 퀘스트는 남음
  onFinish: () => void
  onCancel: () => void
}

export function TimerOverlay({ quest, seconds, starter, onFinish, onCancel }: Props) {
  const [left, setLeft] = useState(seconds)
  const done = useRef(false)

  useEffect(() => {
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(t)
          if (!done.current) {
            done.current = true
            sfx.complete()
            onFinish()
          }
          return 0
        }
        if (l <= 4) sfx.tick()
        return l - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [onFinish])

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return (
    <div className="modal-backdrop">
      <div className="modal pixel-panel timer-modal">
        <Pixel name={monsterOf(quest)} size={5} className="bob" />
        <div className="reveal-title">{quest.title}</div>
        <div className="dim">{starter ? '일단 5분만. 시작이 반이다!' : '전투 중…'}</div>
        <div className="timer-clock">{mm}:{ss}</div>
        <div className="xp-bar">
          <div className="xp-fill timer-fill" style={{ width: `${(left / seconds) * 100}%` }} />
        </div>
        <button className="btn btn-ghost" onClick={onCancel}>
          도망치기
        </button>
      </div>
    </div>
  )
}

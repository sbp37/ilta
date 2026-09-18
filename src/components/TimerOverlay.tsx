import { useEffect, useRef, useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import { ActiveQuest, monsterOf, timerLeft } from '../game'

interface Props {
  quest: ActiveQuest
  seconds: number
  startedAt: number // 시작 시각 — 남은 시간은 항상 여기서 계산 (백그라운드 보정)
  starter: boolean // true면 "5분만 시작" 모드 — 끝나도 퀘스트는 남음
  onFinish: () => void
  onCancel: () => void
}

// 화면이 꺼져 있을 때 타이머가 끝나면 알림으로 알려줌
function notifyDone(title: string, starter: boolean) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const body = starter ? `「${title}」 5분 시작 성공! 이어서 갈까?` : `「${title}」 전투 시간 끝! 처치 완료를 눌러줘`
  const opts: NotificationOptions = { body, tag: 'ilta-timer' }
  navigator.serviceWorker?.ready
    .then((reg) => reg.showNotification('일타', opts))
    .catch(() => {
      try {
        new Notification('일타', opts)
      } catch {
        /* 알림 실패는 무시 */
      }
    })
}

export function TimerOverlay({ quest, seconds, startedAt, starter, onFinish, onCancel }: Props) {
  const [left, setLeft] = useState(() => timerLeft(startedAt, seconds))
  const done = useRef(false)
  const lastTick = useRef(left)

  useEffect(() => {
    const finish = () => {
      if (done.current) return
      done.current = true
      sfx.complete()
      if (document.hidden) notifyDone(quest.title, starter)
      onFinish()
    }
    const sync = () => {
      const l = timerLeft(startedAt, seconds)
      setLeft(l)
      // 4초 이하로 내려가는 순간마다 틱 소리 (백그라운드에서 건너뛴 초는 소리 안 냄)
      if (l > 0 && l <= 4 && l < lastTick.current && !document.hidden) sfx.tick()
      lastTick.current = l
      if (l <= 0) finish()
    }
    sync()
    const t = setInterval(sync, 500)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync)
    }
  }, [startedAt, seconds, onFinish, quest.title, starter])

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  return (
    <div className="modal-backdrop">
      <div className="modal pixel-panel timer-modal">
        <Pixel name={monsterOf(quest)} size={5} className="bob" />
        <div className="reveal-title">{quest.title}</div>
        <div className="dim">{starter ? '일단 5분만. 시작이 반이다!' : '전투 중…'}</div>
        <div className="timer-clock">
          {mm}:{ss}
        </div>
        <div className="xp-bar">
          <div className="xp-fill timer-fill" style={{ width: `${(left / seconds) * 100}%` }} />
        </div>
        <div className="dim timer-hint">화면을 꺼도 시간은 계속 흘러요</div>
        <button className="btn btn-ghost" onClick={onCancel}>
          도망치기
        </button>
      </div>
    </div>
  )
}

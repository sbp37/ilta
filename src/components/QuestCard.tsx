import { useRef, useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import { ActiveQuest, CATEGORIES, DIFF, ENERGY_LABEL, REPEAT_LABEL, Task, dueLabel, monsterOf } from '../game'

interface Props {
  quest: ActiveQuest
  isStrike?: boolean
  mad: boolean
  gentle: boolean
  onSetStrike: (id: string) => void
  onComplete: (id: string) => void
  onStarter: (quest: ActiveQuest) => void
  onFight: (quest: ActiveQuest) => void
  onAbandon: (id: string) => void
  onAddSub: (id: string, title: string) => void
  onToggleSub: (id: string, subId: string) => void
  onEdit: (task: Task) => void
}

export function QuestCard({
  quest,
  isStrike,
  mad,
  gentle,
  onSetStrike,
  onComplete,
  onStarter,
  onFight,
  onAbandon,
  onAddSub,
  onToggleSub,
  onEdit,
}: Props) {
  const diff = DIFF[quest.difficulty]
  const due = quest.due ? dueLabel(quest.due) : null
  const [confirming, setConfirming] = useState(false)
  const [dying, setDying] = useState(false)
  const [subsOpen, setSubsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [subInput, setSubInput] = useState('')
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const subs = quest.subs ?? []
  const subsDone = subs.filter((s) => s.done).length

  const handleAbandon = () => {
    if (gentle) {
      onAbandon(quest.id)
      return
    }
    if (confirming) {
      setConfirming(false)
      onAbandon(quest.id)
      return
    }
    sfx.deny()
    setConfirming(true)
    clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setConfirming(false), 3500)
  }

  // 처치 연출: 슬래시 후 실제 완료 처리
  const handleKill = () => {
    if (dying) return
    sfx.slash()
    setDying(true)
    setTimeout(() => onComplete(quest.id), 500)
  }

  const submitSub = () => {
    const t = subInput.trim()
    if (!t) return
    sfx.accept()
    onAddSub(quest.id, t)
    setSubInput('')
  }

  return (
    <div
      className={`quest-card ${mad ? 'quest-enraged' : ''} ${dying ? 'quest-dying' : ''}`}
      style={{ borderColor: mad ? '#ff4d5e' : diff.color }}
    >
      {dying && (
        <div className="kill-fx">
          <div className="slash" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`kill-p kill-p${i}`} />
          ))}
          <div className="kill-text">{quest.difficulty === 'boss' ? '보스 격퇴!' : '처치!'}</div>
        </div>
      )}
      <div className="quest-top">
        <Pixel
          name={monsterOf(quest)}
          size={3}
          className={dying ? 'sprite-die' : mad ? 'shake-slow' : 'bob'}
        />
        <div className="quest-title-wrap">
          <div className="quest-title">
            {isStrike && <span className="strike-tag">일격</span>}
            {mad && <span className="enraged-tag">광폭</span>}
            {quest.repeat && <span className="repeat-tag">🔁{REPEAT_LABEL[quest.repeat]}</span>}
            {quest.title}
          </div>
          <div className="quest-meta">
            {quest.category && (
              <span style={{ color: CATEGORIES[quest.category].color }}>
                {CATEGORIES[quest.category].name}
              </span>
            )}
            <span style={{ color: diff.color }}>{diff.label}</span>
            <span>{quest.minutes}분</span>
            <span>{ENERGY_LABEL[quest.energy]}</span>
            {due && <span className={due.urgent ? 'due-urgent' : ''}>{due.text}</span>}
            {!gentle && (quest.retreats ?? 0) > 0 && (
              <span className="retreat-tag">도망 x{quest.retreats}</span>
            )}
          </div>
          {!gentle && quest.cost && <div className="cost-line">안 하면 → {quest.cost}</div>}
        </div>
        <button
          className={`icon-btn strike-button ${isStrike ? 'act-on' : ''}`}
          title="오늘의 일격으로 지정"
          aria-label="오늘의 일격으로 지정"
          aria-pressed={!!isStrike}
          onClick={() => onSetStrike(quest.id)}
        >
          ★
        </button>
        <button
          className="edit-link"
          title="제목·난이도·분류·시간·마감 고치기"
          onClick={() => {
            sfx.click()
            onEdit(quest)
          }}
        >
          수정
        </button>
      </div>

      {(subs.length > 0 || subsOpen) && (
        <div className="subs">
          {subs.map((s) => (
            <button
              key={s.id}
              className={`sub-item ${s.done ? 'sub-done' : ''}`}
              role="checkbox"
              aria-checked={!!s.done}
              onClick={() => {
                sfx.click()
                onToggleSub(quest.id, s.id)
              }}
            >
              <span className="sub-check">{s.done ? '■' : '□'}</span>
              {s.title}
            </button>
          ))}
          {subs.length > 0 && (
            <div className="sub-progress dim">
              잡몹 {subsDone}/{subs.length} —{' '}
              {subsDone === subs.length ? '전멸! 본체를 처치하세요' : '다 잡으면 본체가 약해집니다'}
            </div>
          )}
          {subs.length < 8 && (
            <input
              className="text-input sub-input"
              placeholder="+ 하위 잡몹 추가 후 Enter"
              value={subInput}
              maxLength={40}
              onChange={(e) => setSubInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') submitSub()
              }}
            />
          )}
        </div>
      )}
      <div className="quest-actions">
        <button className="btn btn-sub" onClick={() => onStarter(quest)} title="5분만 시작">
          5분만
        </button>
        <button className="btn btn-go" onClick={handleKill} disabled={dying}>
          처치 완료!
        </button>
        <button
          className="btn btn-sub"
          onClick={() => onFight(quest)}
          title={`${quest.minutes}분 집중 타이머`}
        >
          집중
        </button>
        <button
          className={`btn btn-ghost more-btn ${moreOpen ? 'act-on' : ''}`}
          onClick={() => setMoreOpen((o) => !o)}
          title="더 많은 행동"
        >
          ···
        </button>
      </div>

      {subs.length === 0 && !subsOpen && (
        <button className="split-task" onClick={() => setSubsOpen(true)}>
          + 작은 단계로 쪼개기
        </button>
      )}

      {moreOpen && (
        <div className="more-row">
          {subs.length === 0 && !subsOpen && (
            <button
              className="btn btn-sub"
              onClick={() => {
                setSubsOpen(true)
                setMoreOpen(false)
              }}
            >
              잡몹으로 쪼개기
            </button>
          )}
          <button
            className={`btn ${confirming ? 'btn-danger' : 'btn-ghost'}`}
            onClick={handleAbandon}
            title={gentle ? '진행을 보존하고 수집함으로 이동' : '수집함으로 되돌리기 (도망 기록 남음)'}
          >
            {gentle ? '나중에 하기' : confirming ? '정말 도망?' : '후퇴'}
          </button>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Pixel } from '../Pixel'
import { Hero } from './Hero'
import { sfx } from '../sound'
import { ActiveQuest, DAILY_GOAL, MONSTER_NAMES, Task, monsterOf, raidBoss } from '../game'
import { QuestCard } from './QuestCard'

interface Props {
  active: ActiveQuest[]
  maxActive: number
  poolSize: number
  doneToday: number
  strikeTask?: Task
  strikeInPool: boolean
  enragedIds: Set<string>
  onDraw: () => void
  onComplete: (id: string) => void
  onStarter: (quest: ActiveQuest) => void
  onFight: (quest: ActiveQuest) => void
  onAbandon: (id: string) => void
  onQuickAdd: (title: string) => void
  onAcceptStrike: (id: string) => void
  onAddSub: (id: string, title: string) => void
  onToggleSub: (id: string, subId: string) => void
  onEdit: (task: Task) => void
  heroPal?: Record<string, string>
  equipped?: string[]
  heroVariant?: string
  raid?: { key: string; hp: number; max: number }
  onReview: () => void
}

function EmptySlot({ onQuickAdd }: { onQuickAdd: (title: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  if (!editing) {
    return (
      <button
        className="empty-slot"
        onClick={() => {
          sfx.click()
          setEditing(true)
        }}
      >
        + 여기에 할 일 적기
      </button>
    )
  }

  return (
    <div className="empty-slot editing">
      <input
        className="slot-input"
        autoFocus
        placeholder="할 일 입력 후 Enter (연속 등록 가능)"
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter' && value.trim()) {
            onQuickAdd(value.trim())
            setValue('')
          }
          if (e.key === 'Escape') {
            setValue('')
            setEditing(false)
          }
        }}
        onBlur={() => {
          // 다른 곳 눌러도 적어둔 내용은 버리지 않고 등록
          if (value.trim()) onQuickAdd(value.trim())
          setValue('')
          setEditing(false)
        }}
      />
    </div>
  )
}

export function QuestBoard({
  active,
  maxActive,
  poolSize,
  doneToday,
  strikeTask,
  strikeInPool,
  enragedIds,
  onDraw,
  onComplete,
  onStarter,
  onFight,
  onAbandon,
  onQuickAdd,
  onAcceptStrike,
  onAddSub,
  onToggleSub,
  onEdit,
  heroPal,
  equipped,
  heroVariant,
  raid,
  onReview,
}: Props) {
  const emptySlots = Math.max(0, maxActive - active.length)
  const goalDone = doneToday >= DAILY_GOAL

  return (
    <div className="board">
      {strikeTask && (
        <div className="pixel-panel strike-banner">
          <Pixel name={monsterOf(strikeTask)} size={3} className="bob" />
          <div className="strike-body">
            <div className="strike-label">⚔ 오늘의 일격</div>
            <div className="strike-title">{strikeTask.title}</div>
          </div>
          {strikeInPool && (
            <button className="btn btn-go" onClick={() => onAcceptStrike(strikeTask.id)}>
              지금 잡기
            </button>
          )}
        </div>
      )}

      {raid && (
        <div className="pixel-panel raid-panel">
          <Pixel
            name={raidBoss(raid.key)}
            size={3}
            className={raid.hp > 0 ? 'boss-glow' : ''}
          />
          <div className="raid-body">
            <div className="raid-label">
              주간 보스 — {MONSTER_NAMES[raidBoss(raid.key)]}
              <span className="dim"> HP {raid.hp}/{raid.max}</span>
            </div>
            <div className="xp-bar raid-bar">
              <div
                className="xp-fill raid-fill"
                style={{ width: `${(raid.hp / raid.max) * 100}%` }}
              />
            </div>
            {raid.hp === 0 ? (
              <div className="goal-done">이번 주 보스 처치 완료!</div>
            ) : (
              <div className="dim raid-hint">퀘스트 처치 XP만큼 데미지 — 이번 주 안에 잡으면 +100G</div>
            )}
          </div>
        </div>
      )}

      <div className="pixel-panel daily-goal">
        <div className="goal-label">
          오늘의 목표
          {goalDone ? (
            <span className="goal-done">달성! +20G</span>
          ) : (
            <span className="dim">
              {doneToday}/{DAILY_GOAL} 처치
            </span>
          )}
        </div>
        <div className="xp-bar goal-bar">
          <div
            className={`xp-fill ${goalDone ? 'goal-fill-done' : ''}`}
            style={{ width: `${Math.min(doneToday / DAILY_GOAL, 1) * 100}%` }}
          />
        </div>
      </div>

      {active.length === 0 && (
        <div className="empty-scene">
          <div className="camp-scene">
            <Hero size={3} className="bob" palette={heroPal} equipped={equipped} variant={heroVariant} />
            <Pixel name="campfire" size={4} className="flicker" />
            <Pixel name="slime" size={3} className="bob delay1" />
          </div>
          <div className="dim">캠프가 한산하네요. 빈 칸을 눌러 할 일을 적거나, 퀘스트를 뽑아보세요!</div>
        </div>
      )}

      {active.map((q) => (
        <QuestCard
          key={q.id}
          quest={q}
          isStrike={strikeTask?.id === q.id}
          mad={enragedIds.has(q.id)}
          onComplete={onComplete}
          onStarter={onStarter}
          onFight={onFight}
          onAbandon={onAbandon}
          onAddSub={onAddSub}
          onToggleSub={onToggleSub}
          onEdit={onEdit}
        />
      ))}

      {Array.from({ length: emptySlots }).map((_, i) => (
        <EmptySlot key={`empty-${i}`} onQuickAdd={onQuickAdd} />
      ))}

      <button
        className="btn btn-big btn-gold draw-btn"
        onClick={() => {
          sfx.click()
          onDraw()
        }}
      >
        퀘스트 뽑기
        <span className="draw-sub">수집함 {poolSize}개 중에서</span>
      </button>

      <button className="btn btn-sub review-btn" onClick={onReview}>
        🌙 하루 마무리 — 오늘의 전과 보기
      </button>
    </div>
  )
}

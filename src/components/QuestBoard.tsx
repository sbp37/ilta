import { useState } from 'react'
import { Pixel } from '../Pixel'
import { Hero } from './Hero'
import { sfx } from '../sound'
import { ActiveQuest, MONSTER_NAMES, RaidState, Task, chapterOf, monsterOf, weekKey } from '../game'
import { QuestCard } from './QuestCard'

interface Props {
  active: ActiveQuest[]
  maxActive: number
  poolSize: number
  doneToday: number
  goal: number
  goalRewarded: boolean
  gentle: boolean
  onSetStrike: (id: string) => void
  strikeTask?: Task
  strikeDone: boolean
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
  raid?: RaidState
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
  goal,
  goalRewarded,
  gentle,
  onSetStrike,
  strikeTask,
  strikeDone,
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
  const goalDone = doneToday >= goal
  const chapter = chapterOf()

  return (
    <div className="board">
      {strikeTask && (
        <div className="pixel-panel strike-banner">
          <Pixel name={monsterOf(strikeTask)} size={3} className="bob" />
          <div className="strike-body">
            <div className="strike-label">오늘의 일격</div>
            <div className="strike-title">{strikeTask.title}</div>
          </div>
          {strikeDone ? (
            <span className="goal-done">일격 달성!</span>
          ) : (
            strikeInPool && (
              <button className="btn btn-go" onClick={() => onAcceptStrike(strikeTask.id)}>
                지금 잡기
              </button>
            )
          )}
        </div>
      )}

      {raid &&
        (() => {
          // 이월된 챕터 보스는 레이드 자체에 정체를 저장해뒀다 — 달력의 현재 챕터가 아니라 그걸 보여준다
          const carried = !!raid.isFinal && raid.key !== weekKey()
          const boss = raid.boss ?? chapter.boss
          const final = raid.isFinal ?? chapter.isFinal
          const title = raid.title ?? chapter.title
          const reward = raid.reward ?? chapter.reward
          return (
            <div className={`pixel-panel raid-panel ${final ? 'raid-final' : ''}`}>
              <Pixel name={boss} size={3} className={raid.hp > 0 ? 'boss-glow' : ''} />
              <div className="raid-body">
                <div className="raid-label">
                  {final ? '챕터 보스' : '주간 보스'} — {MONSTER_NAMES[boss]}
                  <span className="dim">
                    {' '}
                    HP {raid.hp}/{raid.max}
                  </span>
                </div>
                <div className="dim chapter-line">
                  {carried
                    ? '지난 챕터의 보스 — 잡을 때까지 남는다'
                    : `챕터 ${chapter.index + 1} 「${chapter.name}」 · ${chapter.week}/4주차`}
                </div>
                <div className="xp-bar raid-bar">
                  <div className="xp-fill raid-fill" style={{ width: `${(raid.hp / raid.max) * 100}%` }} />
                </div>
                {raid.hp === 0 ? (
                  <div className="goal-done">
                    {final ? `챕터 클리어! 칭호 「${title}」` : '이번 주 보스 처치 완료!'}
                  </div>
                ) : (
                  <div className="dim raid-hint">
                    퀘스트 처치 XP만큼 데미지 — {carried ? '잡으면' : '이번 주 안에 잡으면'} +{reward}G
                  </div>
                )}
              </div>
            </div>
          )
        })()}

      <div className="pixel-panel daily-goal">
        <div className="goal-label">
          오늘의 목표
          {goalDone ? (
            <span className="goal-done">달성!{goalRewarded ? ' +20G' : ''}</span>
          ) : (
            <span className="dim">
              {doneToday}/{goal} 처치
            </span>
          )}
        </div>
        <div className="xp-bar goal-bar">
          <div
            className={`xp-fill ${goalDone ? 'goal-fill-done' : ''}`}
            style={{ width: `${Math.min(doneToday / goal, 1) * 100}%` }}
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
          <div className="dim">
            {doneToday > 0 ? '오늘도 한 걸음 나아갔어요.' : '오늘은 작은 일 하나부터.'}
          </div>
        </div>
      )}

      {active.map((q) => (
        <QuestCard
          key={q.id}
          quest={q}
          gentle={gentle}
          onSetStrike={onSetStrike}
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

      {poolSize > 0 && (
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
      )}

      <button className="btn btn-sub review-btn" onClick={onReview}>
        🌙 하루 마무리 — 오늘의 전과 보기
      </button>
    </div>
  )
}

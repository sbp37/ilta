import { useRef, useState } from 'react'
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
  minimumGoal: number
  onOrganize: () => void
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
  draft: string
  onDraft: (value: string) => void
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

function EmptySlot({
  onQuickAdd,
  full,
  value,
  onDraft: setValue,
}: {
  onQuickAdd: (title: string) => void
  full: boolean
  value: string
  onDraft: (value: string) => void
}) {
  const [editing, setEditing] = useState(!!value)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!editing) {
    return (
      <button
        className="empty-slot"
        onClick={() => {
          sfx.click()
          setEditing(true)
        }}
      >
        {full ? '+ 수집함에 할 일 적기' : '+ 여기에 할 일 적기'}
      </button>
    )
  }

  return (
    <form
      className="empty-slot editing"
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        onQuickAdd(value.trim())
        setValue('')
        inputRef.current?.focus()
      }}
    >
      <input
        className="slot-input"
        ref={inputRef}
        autoFocus
        placeholder={full ? '수집함에 보관할 일' : '오늘 할 일'}
        aria-label="새 할 일"
        enterKeyHint="done"
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault()
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Escape') {
            setValue('')
            setEditing(false)
          }
        }}
      />
      <div className="slot-actions">
        <button type="submit" className="btn btn-go" disabled={!value.trim()}>
          {full ? '보관' : '추가'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setValue('')
            setEditing(false)
          }}
        >
          취소
        </button>
      </div>
    </form>
  )
}

export function QuestBoard({
  active,
  maxActive,
  poolSize,
  doneToday,
  goal,
  minimumGoal,
  onOrganize,
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
  draft,
  onDraft,
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
      <div className="board-status">
        <h2>오늘 할 일</h2>
        <span aria-label="진행 중인 할 일">
          {active.length}/{maxActive}
        </span>
      </div>
      <div className="daily-goal">
        <div className="goal-label">
          <span>
            오늘 {doneToday}/{goal} 완료
            {goalDone && <span className="goal-done"> · 달성!{goalRewarded ? ' +20G' : ''}</span>}
          </span>
          <button className="pool-act" onClick={onOrganize}>
            오늘 다시 고르기
          </button>
        </div>
        <div className="xp-bar goal-bar">
          <div
            className={`xp-fill ${goalDone ? 'goal-fill-done' : ''}`}
            style={{ width: `${Math.min(doneToday / goal, 1) * 100}%` }}
          />
        </div>
        <div className="minimum-goal">
          {doneToday >= minimumGoal ? '최소 목표 달성' : `최소 목표 ${doneToday}/${minimumGoal}`}
        </div>
      </div>
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

      {active.length === 0 && (
        <div className="empty-scene">
          <Hero size={2} palette={heroPal} equipped={equipped} variant={heroVariant} />
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

      <EmptySlot onQuickAdd={onQuickAdd} full={emptySlots === 0} value={draft} onDraft={onDraft} />

      {poolSize > 0 && (
        <button
          className="btn btn-ghost draw-btn"
          onClick={() => {
            sfx.click()
            onDraw()
          }}
        >
          퀘스트 뽑기
          <span className="draw-sub">수집함 {poolSize}개 중에서</span>
        </button>
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
            <details className={`raid-details ${final ? 'raid-final' : ''}`}>
              <summary>
                <span>
                  {final ? '챕터 보스' : '주간 보스'} · {MONSTER_NAMES[boss]}
                </span>
                <span className="dim">{raid.hp === 0 ? '처치 완료' : `HP ${raid.hp}/${raid.max}`}</span>
              </summary>
              <div className="raid-panel">
                <Pixel name={boss} size={2} />
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
            </details>
          )
        })()}

      <button className="btn btn-ghost review-btn" onClick={onReview}>
        🌙 하루 마무리 — 오늘의 전과 보기
      </button>
    </div>
  )
}

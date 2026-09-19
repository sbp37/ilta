import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from './store'
import { Pixel } from './Pixel'
import { isMuted, sfx, startBgm, stopBgm, toggleMute } from './sound'
import {
  ActiveQuest,
  DAILY_GOAL,
  DAILY_GOAL_BONUS,
  LOOT,
  STARTER_BONUS_XP,
  STRIKE_BONUS,
  Task,
  awake,
  enragedSet,
  heroPalette,
  heroSprite,
  itemCount,
  levelOf,
  monsterOf,
  sameDay,
  slotsFor,
  timerLeft,
  todayKey,
  unlocksAt,
} from './game'
import { TitleScreen } from './components/TitleScreen'
import { PetModal } from './components/PetModal'
import { HeroModal } from './components/HeroModal'
import { ReviewModal } from './components/ReviewModal'
import { SettingsModal } from './components/SettingsModal'
import { Header } from './components/Header'
import { QuestBoard } from './components/QuestBoard'
import { DrawModal } from './components/DrawModal'
import { Pool } from './components/Pool'
import { Journal } from './components/Journal'
import { Shop } from './components/Shop'
import { TimerOverlay } from './components/TimerOverlay'
import { EditModal, TaskPatch } from './components/EditModal'

type Tab = 'quest' | 'pool' | 'shop' | 'journal'

interface TimerState {
  questId: string
  seconds: number
  starter: boolean
  startedAt: number
}

interface ToastAction {
  label: string
  fn: () => void
}

const TIMER_KEY = 'ilta-timer'

function loadTimer(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as TimerState
    if (typeof t.startedAt !== 'number' || typeof t.seconds !== 'number' || !t.questId) return null
    return t
  } catch {
    return null
  }
}

export default function App() {
  const {
    state,
    addTask,
    removeTask,
    updateTask,
    undo,
    checkFreezes,
    setHeroName,
    setHeroLook,
    setHeroClass,
    setTheme,
    setNotif,
    quickAdd,
    move,
    toggleUrgent,
    toggleRepeat,
    addSub,
    toggleSub,
    accept,
    abandon,
    complete,
    bonusXp,
    addReward,
    removeReward,
    buyReward,
    buyGear,
    toggleGear,
    buyFreeze,
    buyItem,
    claimAchievements,
    consumeItem,
    useXpPotion,
    applyCalm,
    feedPet,
    setPetName,
    setStrike,
    exportSave,
    importSave,
  } = useGame()
  const [started, setStarted] = useState(false)
  const [petOpen, setPetOpen] = useState(false)
  const [heroOpen, setHeroOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [encounter, setEncounter] = useState<Task | null>(null)
  const [muted, setMuted] = useState(isMuted())
  const [installEvt, setInstallEvt] = useState<Event | null>(null)
  const encounterShown = useRef(false)

  // PWA 설치 유도 — 브라우저가 설치 가능하다고 알려주면 배너 표시
  useEffect(() => {
    if (localStorage.getItem('ilta-install-dismissed') === '1') return
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  const [tab, setTab] = useState<Tab>('quest')
  const [drawing, setDrawing] = useState(false)
  // 저장된 타이머가 있으면 그대로 복원 (시작 시각 기준이라 닫았다 열어도 정확)
  const [timer, setTimer] = useState<TimerState | null>(loadTimer)
  const [toast, setToast] = useState('')
  const [toastActions, setToastActions] = useState<ToastAction[]>([])
  const [flash, setFlash] = useState(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 타이머는 저장해 두고, 앱을 닫았다 열어도 이어서 센다
  useEffect(() => {
    if (timer) localStorage.setItem(TIMER_KEY, JSON.stringify(timer))
    else localStorage.removeItem(TIMER_KEY)
  }, [timer])

  // 토스트는 한 번에 하나씩, 겹치면 줄을 세운다.
  // (업적 알림이 처치 결과를 덮어써서 뭘 얻었는지 못 보는 문제)
  const toastQueue = useRef<{ msg: string; actions: ToastAction[]; ms: number }[]>([])
  const toastShowing = useRef(false)

  const runToast = useCallback(() => {
    const next = toastQueue.current.shift()
    if (!next) {
      toastShowing.current = false
      setToast('')
      setToastActions([])
      return
    }
    toastShowing.current = true
    setToast(next.msg)
    setToastActions(next.actions)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(runToast, next.ms)
  }, [])

  const showToast = useCallback(
    (msg: string, action?: ToastAction | ToastAction[], ms = 3200) => {
      const actions = action ? (Array.isArray(action) ? action : [action]) : []
      // 같은 문구가 연달아 오면 무시, 줄은 2개까지만
      if (toastQueue.current.some((t) => t.msg === msg)) return
      if (toastQueue.current.length >= 2) toastQueue.current.shift()
      toastQueue.current.push({ msg, actions, ms })
      if (!toastShowing.current) runToast()
    },
    [runToast],
  )

  // 토스트의 버튼을 누르면 그 토스트는 끝내고 다음으로 넘어간다
  const closeToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    runToast()
  }, [runToast])

  const undoAction = useCallback(
    (label = '되돌리기'): ToastAction => ({
      label,
      fn: () => {
        if (undo()) {
          sfx.accept()
          showToast('되돌렸어요')
        }
      },
    }),
    [undo, showToast],
  )

  const handleRemove = useCallback(
    (id: string) => {
      removeTask(id)
      sfx.click()
      showToast('몬스터를 놓아줬어요', undoAction(), 5000)
    },
    [removeTask, showToast, undoAction],
  )

  const handleEditSave = useCallback(
    (id: string, patch: TaskPatch) => {
      updateTask(id, patch)
      showToast('수정했어요')
    },
    [updateTask, showToast],
  )

  // 업적: 조건을 새로 만족하면 골드와 함께 알린다
  useEffect(() => {
    if (!started) return
    const earned = claimAchievements()
    if (earned.length === 0) return
    sfx.levelup()
    setFlash((f) => f + 1)
    const names = earned.map((a) => `「${a.name}」`).join(' ')
    const bonus = earned.reduce((sum, a) => sum + a.gold, 0)
    showToast(`업적 달성! ${names} +${bonus}G`, undefined, 6000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    started,
    state.done.length,
    state.loot,
    state.gear,
    state.petFood,
    state.raidKills,
    state.chapterClears,
  ])

  const handleComplete = useCallback(
    (id: string) => {
      const result = complete(id)
      if (!result) return
      const critText = result.crit ? '크리티컬! ' : ''
      const goalBonus = result.combo === DAILY_GOAL ? ` · 일일 목표 달성 +${DAILY_GOAL_BONUS}G!` : ''
      if (result.combo === DAILY_GOAL) bonusXp(DAILY_GOAL_BONUS)
      // 모멘텀: 수집함에 남은 게 있고 슬롯에 자리가 있으면 바로 다음 뽑기 제안 + 잘못 눌렀으면 되돌리기
      const actions: ToastAction[] = [undoAction()]
      if (state.pool.length > 0 && state.active.length < slotsFor(levelOf(state.xp)))
        actions.push({ label: '다음 뽑기 →', fn: () => setDrawing(true) })
      const boostText = result.boosted ? '포션 효과! ' : ''
      const potionText = result.potionsConverted ? ' · 빨간 포션 5개 → XP 포션!' : ''
      // 오늘의 일격 처치 → 대축하 + 보너스
      const isStrike = state.strike?.day === todayKey() && state.strike.id === id
      if (isStrike) {
        bonusXp(STRIKE_BONUS)
        setFlash((f) => f + 1)
        sfx.levelup()
      }
      const strikeText = isStrike ? `오늘의 일격 성공! +${STRIKE_BONUS}G ` : ''
      const raidText = result.raidKilled
        ? result.chapterCleared
          ? ` · 챕터 클리어! 칭호 「${result.chapter.title}」 +${result.chapter.reward}G`
          : ` · 주간 보스 처치! +${result.chapter.reward}G`
        : ''
      if (result.raidKilled) {
        sfx.bossReveal()
        setFlash((f) => f + 1)
      }
      if (result.leveledUp) {
        sfx.levelup()
        setFlash((f) => f + 1)
        const unlockText = unlocksAt(result.newLevel)
          .map((u) => ` · 🔓 ${u}`)
          .join('')
        showToast(
          `${strikeText}LEVEL UP! Lv.${result.newLevel} (+${result.levelGold}G) ${boostText}${critText}+${result.xp}XP +${result.gold}G${goalBonus}${raidText}${potionText}${unlockText}`,
          actions,
          unlockText ? 8000 : 5000,
        )
      } else {
        sfx.complete()
        showToast(
          `${strikeText}${boostText}${critText}처치 완료! +${result.xp}XP +${result.gold}G${
            result.combo > 1 ? ` · x${result.combo} 콤보!` : ''
          }${result.lootName ? ` · 「${result.lootName}」` : ''}${goalBonus}${raidText}${potionText}`,
          actions,
          5000,
        )
      }
    },
    [
      complete,
      showToast,
      bonusXp,
      undoAction,
      state.pool.length,
      state.active.length,
      state.xp,
      state.strike,
    ],
  )

  const handleStarter = useCallback((quest: ActiveQuest) => {
    sfx.click()
    setTimer({ questId: quest.id, seconds: 5 * 60, starter: true, startedAt: Date.now() })
  }, [])

  const handleFight = useCallback((quest: ActiveQuest) => {
    sfx.click()
    setTimer({ questId: quest.id, seconds: quest.minutes * 60, starter: false, startedAt: Date.now() })
  }, [])

  const handleQuickAdd = useCallback(
    (title: string) => {
      const where = quickAdd(title)
      sfx.accept()
      showToast(where === 'active' ? '퀘스트 슬롯에 등록!' : '슬롯이 가득 — 수집함에 보관했어요')
    },
    [quickAdd, showToast],
  )

  // 타이머 정산은 여기 한 곳에서만. 오버레이가 0초를 보고 부르든, 앱 복귀 때 부르든 같은 타이머는 한 번만 처리
  const settledTimer = useRef<number | null>(null)
  const handleTimerFinish = useCallback(
    (returning = false) => {
      if (!timer || settledTimer.current === timer.startedAt) return
      settledTimer.current = timer.startedAt
      setTimer(null)
      const back = returning ? '돌아온 사이 ' : ''
      if (timer.starter) {
        bonusXp(STARTER_BONUS_XP)
        showToast(`${back}5분 시작 성공! +${STARTER_BONUS_XP}XP — 이어서 처치하거나 쉬어도 OK`)
      } else {
        if (returning) showToast('돌아온 사이 전투 시간이 끝났어요! 처치 완료 처리합니다')
        handleComplete(timer.questId)
      }
    },
    [timer, bonusXp, showToast, handleComplete],
  )

  // 앱을 켜면: 복원된 타이머 검사 (퀘스트가 사라졌으면 버리고, 이미 끝났으면 바로 정산) + 휴식일 부적 자동 소모
  useEffect(() => {
    if (!started) return
    if (timer) {
      const alive = state.active.some((q) => q.id === timer.questId)
      if (!alive) setTimer(null)
      else if (timerLeft(timer.startedAt, timer.seconds) <= 0) handleTimerFinish(true)
    }
    const used = checkFreezes()
    if (used > 0) showToast(`휴식일 부적 ${used}개가 연속 기록을 지켜줬어요`)
    // 날짜가 바뀌면 다시 확인
    const t = setInterval(() => {
      const n = checkFreezes()
      if (n > 0) showToast(`휴식일 부적 ${n}개가 연속 기록을 지켜줬어요`)
    }, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  // 하위 잡몹 처치 — 전부 잡으면 본체 자동 처치
  const handleToggleSub = useCallback(
    (id: string, subId: string) => {
      const res = toggleSub(id, subId)
      if (res === 'cleared') {
        setTimeout(() => handleComplete(id), 400)
        showToast('잡몹 전멸! 본체를 처치합니다!')
      }
    },
    [toggleSub, handleComplete, showToast],
  )

  // 테마 적용
  useEffect(() => {
    document.body.dataset.theme = state.theme ?? 'night'
  }, [state.theme])

  // 야생 몬스터 습격 — 세션당 1번, 시작 후 잠시 뒤
  useEffect(() => {
    if (!started || encounterShown.current) return
    encounterShown.current = true
    if (awake(state.pool).length === 0 || state.active.length >= slotsFor(levelOf(state.xp))) return
    if (Math.random() > 0.45) return
    const t = setTimeout(() => {
      const ready = awake(state.pool)
      if (ready.length === 0) return
      const madIds = enragedSet(ready)
      const mad = ready.filter((x) => madIds.has(x.id))
      const pick = mad[0] ?? ready[Math.floor(Math.random() * ready.length)]
      setEncounter(pick)
      sfx.bossReveal()
    }, 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  // 리마인드 알림 — 앱 열어둔 상태에서 1회
  useEffect(() => {
    if (!started || !state.notif || typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    const t = setTimeout(() => {
      const mad = enragedSet(state.pool).size
      const strike =
        state.strike?.day === todayKey()
          ? (state.pool.find((x) => x.id === state.strike!.id) ??
            state.active.find((x) => x.id === state.strike!.id))
          : undefined
      if (mad > 0) {
        new Notification('일타', { body: `광폭 몬스터 ${mad}마리가 커지는 중! 지금 잡으러 가자` })
      } else if (strike) {
        new Notification('일타', { body: `오늘의 일격 「${strike.title}」 아직 살아있다!` })
      }
    }, 20000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  const goTab = (t: Tab) => {
    sfx.click()
    setTab(t)
  }

  const doneToday = state.done.filter((d) => sameDay(d.completedAt, Date.now())).length
  const maxActive = slotsFor(levelOf(state.xp))

  // 광폭 표시는 심각한 순으로 최대 3마리까지만 (전부 빨개지면 경고가 무뎌짐)
  const enragedIds = enragedSet([...state.pool, ...state.active])
  const timerQuest = timer ? state.active.find((q) => q.id === timer.questId) : undefined

  // 장착 장비 — 상점 장비 우선, 전리품 (레어순 3개) 뒤에
  const equippedIds = [
    ...(state.equippedGear ?? []),
    ...LOOT.filter((l) => (state.loot[l.id] ?? 0) > 0)
      .sort((a, b) => b.rarity - a.rarity)
      .slice(0, 3)
      .map((l) => l.id),
  ]

  // 오늘의 일격: 오늘 지정된 게 있고 아직 수집함/슬롯에 살아있으면 표시
  const strikeSet = state.strike?.day === todayKey()
  const strikeTask = strikeSet
    ? (state.pool.find((t) => t.id === state.strike!.id) ??
      state.active.find((t) => t.id === state.strike!.id) ??
      // 오늘 일격을 이미 잡았으면 done 에서 찾아 "달성" 배너로 보여준다 (반복 리스폰으로 id가 바뀌어도 옛 id 유지)
      state.done.find((t) => t.id === state.strike!.id && sameDay(t.completedAt, Date.now())))
    : undefined
  const strikeDone = !!strikeTask && 'completedAt' in strikeTask
  const strikeInPool = !!strikeTask && !strikeDone && state.pool.some((t) => t.id === strikeTask.id)

  if (!started) {
    return (
      <div className="app">
        <TitleScreen
          heroName={state.heroName}
          pool={state.pool}
          strikeSet={!!strikeSet}
          heroPal={heroPalette(state)}
          equipped={equippedIds}
          heroVariant={heroSprite(state.heroClass)}
          onStart={(name) => {
            if (name) setHeroName(name)
            setStarted(true)
            if (!isMuted()) startBgm()
          }}
          onPickStrike={(id) => {
            setStrike(id)
            setStarted(true)
            if (!isMuted()) startBgm()
            showToast('오늘의 일격이 정해졌다! 이 몹만 잡아도 오늘은 승리')
          }}
        />
        <div className="scanlines" />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="title-bar">
        <button
          className="mute-btn settings-btn"
          title="설정"
          onClick={() => {
            sfx.click()
            setSettingsOpen(true)
          }}
        >
          ⚙
        </button>
        <span className="game-title">ILTA</span>
        <button
          className="mute-btn"
          title={muted ? '사운드 켜기' : '사운드 끄기'}
          onClick={() => {
            const m = toggleMute()
            setMuted(m)
            if (!m) {
              sfx.click()
              startBgm()
            } else {
              stopBgm()
            }
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <Header state={state} onPetClick={() => setPetOpen(true)} onHeroClick={() => setHeroOpen(true)} />

      <main className="content">
        {tab === 'quest' && (
          <QuestBoard
            active={state.active}
            maxActive={maxActive}
            poolSize={state.pool.length}
            doneToday={doneToday}
            strikeTask={strikeTask}
            strikeDone={strikeDone}
            strikeInPool={strikeInPool}
            enragedIds={enragedIds}
            onDraw={() => setDrawing(true)}
            onComplete={handleComplete}
            onStarter={handleStarter}
            onFight={handleFight}
            onAbandon={(id) => {
              const r = abandon(id)
              showToast(
                r === 'shielded'
                  ? '나무 방패가 막아줬다! 도망 기록 없이 수집함으로'
                  : '퀘스트를 수집함으로 되돌렸습니다.',
              )
            }}
            onQuickAdd={handleQuickAdd}
            onAcceptStrike={(id) => {
              if (accept(id)) showToast('일격 퀘스트 수락! 오늘은 이것만 깨면 됩니다')
              else showToast('슬롯이 가득 찼습니다! 하나 먼저 처치하세요')
            }}
            onAddSub={addSub}
            onToggleSub={handleToggleSub}
            onEdit={setEditing}
            heroPal={heroPalette(state)}
            equipped={equippedIds}
            heroVariant={heroSprite(state.heroClass)}
            raid={state.raid}
            onReview={() => {
              sfx.click()
              setReviewOpen(true)
            }}
          />
        )}
        {tab === 'pool' && (
          <Pool
            pool={state.pool}
            strikeId={strikeSet ? state.strike!.id : undefined}
            enragedIds={enragedIds}
            onAdd={addTask}
            onRemove={handleRemove}
            onEdit={setEditing}
            calmCount={itemCount(state, 'calm')}
            onCalm={(id) => {
              if (applyCalm(id)) showToast('진정의 향을 피웠다… 몬스터가 차분해졌다')
            }}
            onMove={move}
            onToggleUrgent={toggleUrgent}
            onToggleRepeat={toggleRepeat}
            onSetStrike={(id) => {
              setStrike(id)
              showToast('오늘의 일격으로 지정! 이것만 깨도 오늘은 승리')
            }}
          />
        )}
        {tab === 'shop' && (
          <Shop
            state={state}
            onAddReward={addReward}
            onRemoveReward={removeReward}
            onBuy={buyReward}
            onBuyGear={buyGear}
            onToggleGear={toggleGear}
            onBuyFreeze={buyFreeze}
            onBuyItem={buyItem}
            onUseXpPotion={useXpPotion}
            onToast={showToast}
          />
        )}
        {tab === 'journal' && <Journal state={state} onToast={showToast} />}
      </main>

      <nav className="tab-bar">
        <button className={`tab ${tab === 'quest' ? 'tab-on' : ''}`} onClick={() => goTab('quest')}>
          퀘스트
          {state.active.length > 0 && <span className="tab-badge">{state.active.length}</span>}
        </button>
        <button className={`tab ${tab === 'pool' ? 'tab-on' : ''}`} onClick={() => goTab('pool')}>
          수집함
          <span className="tab-badge">{state.pool.length}</span>
        </button>
        <button className={`tab ${tab === 'shop' ? 'tab-on' : ''}`} onClick={() => goTab('shop')}>
          상점
        </button>
        <button className={`tab ${tab === 'journal' ? 'tab-on' : ''}`} onClick={() => goTab('journal')}>
          모험일지
        </button>
      </nav>

      {petOpen && (
        <PetModal
          state={state}
          onFeed={feedPet}
          onRename={setPetName}
          onToast={showToast}
          onClose={() => setPetOpen(false)}
        />
      )}

      {heroOpen && (
        <HeroModal
          state={state}
          onLook={(h, t) => setHeroLook(h, t)}
          onClass={(c) => {
            setHeroClass(c)
            showToast('직업을 변경했습니다!')
          }}
          onClose={() => setHeroOpen(false)}
        />
      )}

      {reviewOpen && (
        <ReviewModal
          state={state}
          onPickTomorrow={(id) => {
            setStrike(id, todayKey(Date.now() + 86400000))
            setReviewOpen(false)
            showToast('내일의 일격을 예약했습니다!')
          }}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          state={state}
          onExport={exportSave}
          onImport={importSave}
          onTheme={setTheme}
          onNotif={setNotif}
          onToast={showToast}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {encounter && (
        <div className="modal-backdrop" onClick={() => setEncounter(null)}>
          <div className="modal pixel-panel encounter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="encounter-alert">야생의 몬스터 습격!</div>
            <div className="encounter-body">
              <Pixel name={monsterOf(encounter)} size={4} className="shake-slow" />
              <div>
                <div className="encounter-title">{encounter.title}</div>
                {encounter.cost && <div className="cost-line">안 하면 → {encounter.cost}</div>}
                {enragedIds.has(encounter.id) && <div className="enraged-tag">광폭 상태!</div>}
              </div>
            </div>
            <div className="encounter-actions">
              <button
                className="btn btn-go"
                onClick={() => {
                  const id = encounter.id
                  setEncounter(null)
                  if (accept(id)) {
                    sfx.accept()
                    showToast('습격한 몬스터와 전투 개시!')
                  } else {
                    showToast('슬롯이 가득 찼습니다! 하나 먼저 처치하세요')
                  }
                }}
              >
                지금 싸운다
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  sfx.deny()
                  setEncounter(null)
                  showToast('몬스터를 무시했다… 수집함에서 기다리는 중')
                }}
              >
                무시한다
              </button>
            </div>
          </div>
        </div>
      )}

      {drawing && (
        <DrawModal
          pool={state.pool}
          activeFull={state.active.length >= maxActive}
          maxActive={maxActive}
          enragedIds={enragedIds}
          tickets={itemCount(state, 'reroll')}
          onUseTicket={() => consumeItem('reroll')}
          onAccept={accept}
          onClose={() => setDrawing(false)}
        />
      )}

      {timer && timerQuest && (
        <TimerOverlay
          quest={timerQuest}
          seconds={timer.seconds}
          startedAt={timer.startedAt}
          starter={timer.starter}
          onFinish={() => handleTimerFinish()}
          onCancel={() => {
            // 도망치기 = 후퇴 처리 (도망 기록 남음)
            setTimer(null)
            const r = abandon(timer.questId)
            showToast(
              r === 'shielded'
                ? '나무 방패 덕에 도망 기록은 안 남았다!'
                : '도망쳤다! 몬스터는 수집함에서 기다리고 있습니다…',
            )
          }}
        />
      )}

      {editing && <EditModal task={editing} onSave={handleEditSave} onClose={() => setEditing(null)} />}

      {installEvt && (
        <div className="install-banner pixel-panel">
          <span>홈화면에 ILTA를 설치할 수 있어요</span>
          <button
            className="btn btn-go"
            onClick={() => {
              ;(installEvt as { prompt?: () => Promise<unknown> }).prompt?.()
              setInstallEvt(null)
              localStorage.setItem('ilta-install-dismissed', '1')
            }}
          >
            설치
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              setInstallEvt(null)
              localStorage.setItem('ilta-install-dismissed', '1')
            }}
          >
            ×
          </button>
        </div>
      )}

      {toast && (
        <div className="toast pixel-panel">
          {toast}
          {toastActions.length > 0 && (
            <div className="toast-actions">
              {toastActions.map((a) => (
                <button
                  key={a.label}
                  className="toast-btn"
                  onClick={() => {
                    sfx.click()
                    closeToast()
                    a.fn()
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {flash > 0 && <div key={flash} className="levelup-flash" />}
      <div className="scanlines" />
    </div>
  )
}

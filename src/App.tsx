import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from './store'
import { Pixel } from './Pixel'
import { isMuted, sfx, startBgm, stopBgm, toggleMute } from './sound'
import {
  ActiveQuest,
  DAILY_GOAL,
  DAILY_GOAL_BONUS,
  LOOT,
  MAX_ACTIVE,
  STARTER_BONUS_XP,
  STRIKE_BONUS,
  Task,
  enraged,
  heroPalette,
  monsterOf,
  sameDay,
  todayKey,
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

type Tab = 'quest' | 'pool' | 'shop' | 'journal'

interface TimerState {
  quest: ActiveQuest
  seconds: number
  starter: boolean
}

export default function App() {
  const {
    state,
    addTask,
    removeTask,
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
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [toast, setToast] = useState('')
  const [toastAction, setToastAction] = useState<{ label: string; fn: () => void } | null>(null)
  const [flash, setFlash] = useState(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((msg: string, action?: { label: string; fn: () => void }) => {
    setToast(msg)
    setToastAction(action ?? null)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => {
      setToast('')
      setToastAction(null)
    }, 3200)
  }, [])

  const handleComplete = useCallback(
    (id: string) => {
      const result = complete(id)
      if (!result) return
      const critText = result.crit ? '크리티컬! ' : ''
      const goalBonus = result.combo === DAILY_GOAL ? ` · 일일 목표 달성 +${DAILY_GOAL_BONUS}G!` : ''
      if (result.combo === DAILY_GOAL) bonusXp(DAILY_GOAL_BONUS)
      // 모멘텀: 수집함에 남은 게 있고 슬롯에 자리가 있으면 바로 다음 뽑기 제안
      const nextAction =
        state.pool.length > 0 && state.active.length < MAX_ACTIVE
          ? { label: '다음 뽑기 →', fn: () => setDrawing(true) }
          : undefined
      // 오늘의 일격 처치 → 대축하 + 보너스
      const isStrike = state.strike?.day === todayKey() && state.strike.id === id
      if (isStrike) {
        bonusXp(STRIKE_BONUS)
        setFlash((f) => f + 1)
        sfx.levelup()
      }
      const strikeText = isStrike ? `오늘의 일격 성공! +${STRIKE_BONUS}G ` : ''
      const raidText = result.raidKilled ? ' · 주간 보스 처치! +100G' : ''
      if (result.raidKilled) {
        sfx.bossReveal()
        setFlash((f) => f + 1)
      }
      if (result.leveledUp) {
        sfx.levelup()
        setFlash((f) => f + 1)
        showToast(`${strikeText}LEVEL UP! ${critText}+${result.xp}XP +${result.gold}G${goalBonus}${raidText}`, nextAction)
      } else {
        sfx.complete()
        showToast(
          `${strikeText}${critText}처치 완료! +${result.xp}XP +${result.gold}G${
            result.combo > 1 ? ` · x${result.combo} 콤보!` : ''
          }${result.lootName ? ` · 「${result.lootName}」` : ''}${goalBonus}${raidText}`,
          nextAction,
        )
      }
    },
    [complete, showToast, bonusXp, state.pool.length, state.active.length],
  )

  const handleStarter = useCallback((quest: ActiveQuest) => {
    sfx.click()
    setTimer({ quest, seconds: 5 * 60, starter: true })
  }, [])

  const handleFight = useCallback((quest: ActiveQuest) => {
    sfx.click()
    setTimer({ quest, seconds: quest.minutes * 60, starter: false })
  }, [])

  const handleQuickAdd = useCallback(
    (title: string) => {
      const where = quickAdd(title)
      sfx.accept()
      showToast(where === 'active' ? '퀘스트 슬롯에 등록!' : '슬롯이 가득 — 수집함에 보관했어요')
    },
    [quickAdd, showToast],
  )

  const handleTimerFinish = useCallback(() => {
    if (!timer) return
    if (timer.starter) {
      bonusXp(STARTER_BONUS_XP)
      showToast(`시작 성공! +${STARTER_BONUS_XP}XP — 이어서 처치하거나 쉬어도 OK`)
      setTimer(null)
    } else {
      setTimer(null)
      handleComplete(timer.quest.id)
    }
  }, [timer, bonusXp, showToast, handleComplete])

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
    if (state.pool.length === 0 || state.active.length >= MAX_ACTIVE) return
    if (Math.random() > 0.45) return
    const t = setTimeout(() => {
      const mad = state.pool.filter((x) => enraged(x))
      const pick = mad[0] ?? state.pool[Math.floor(Math.random() * state.pool.length)]
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
      const mad = state.pool.filter((x) => enraged(x)).length
      const strike =
        state.strike?.day === todayKey()
          ? state.pool.find((x) => x.id === state.strike!.id) ??
            state.active.find((x) => x.id === state.strike!.id)
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

  // 장착 장비 — Hero 스프라이트에 실제로 붙는 전리품 (레어순 3개)
  const equippedIds = LOOT.filter((l) => (state.loot[l.id] ?? 0) > 0)
    .sort((a, b) => b.rarity - a.rarity)
    .slice(0, 3)
    .map((l) => l.id)

  // 오늘의 일격: 오늘 지정된 게 있고 아직 수집함/슬롯에 살아있으면 표시
  const strikeSet = state.strike?.day === todayKey()
  const strikeTask = strikeSet
    ? state.pool.find((t) => t.id === state.strike!.id) ??
      state.active.find((t) => t.id === state.strike!.id)
    : undefined
  const strikeInPool = !!strikeTask && state.pool.some((t) => t.id === strikeTask.id)

  if (!started) {
    return (
      <div className="app">
        <TitleScreen
          heroName={state.heroName}
          pool={state.pool}
          strikeSet={!!strikeSet}
          heroPal={heroPalette(state)}
          equipped={equippedIds}
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
            poolSize={state.pool.length}
            doneToday={doneToday}
            strikeTask={strikeTask}
            strikeInPool={strikeInPool}
            onDraw={() => setDrawing(true)}
            onComplete={handleComplete}
            onStarter={handleStarter}
            onFight={handleFight}
            onAbandon={(id) => {
              abandon(id)
              showToast('퀘스트를 수집함으로 되돌렸습니다.')
            }}
            onQuickAdd={handleQuickAdd}
            onAcceptStrike={(id) => {
              if (accept(id)) showToast('일격 퀘스트 수락! 오늘은 이것만 깨면 됩니다')
              else showToast('슬롯이 가득 찼습니다! 하나 먼저 처치하세요')
            }}
            onAddSub={addSub}
            onToggleSub={handleToggleSub}
            heroPal={heroPalette(state)}
            equipped={equippedIds}
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
            onAdd={addTask}
            onRemove={removeTask}
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
                {enraged(encounter) && <div className="enraged-tag">광폭 상태!</div>}
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
          activeFull={state.active.length >= MAX_ACTIVE}
          onAccept={accept}
          onClose={() => setDrawing(false)}
        />
      )}

      {timer && (
        <TimerOverlay
          quest={timer.quest}
          seconds={timer.seconds}
          starter={timer.starter}
          onFinish={handleTimerFinish}
          onCancel={() => {
            // 도망치기 = 후퇴 처리 (도망 기록 남음)
            setTimer(null)
            abandon(timer.quest.id)
            showToast('도망쳤다! 몬스터는 수집함에서 기다리고 있습니다…')
          }}
        />
      )}

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
          {toastAction && (
            <button
              className="toast-btn"
              onClick={() => {
                sfx.click()
                toastAction.fn()
                setToast('')
                setToastAction(null)
              }}
            >
              {toastAction.label}
            </button>
          )}
        </div>
      )}
      {flash > 0 && <div key={flash} className="levelup-flash" />}
      <div className="scanlines" />
    </div>
  )
}

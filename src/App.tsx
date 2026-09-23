import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from './store'
import { Pixel } from './Pixel'
import { isMuted, sfx, startBgm, stopBgm, toggleMute } from './sound'
import {
  ActiveQuest,
  LOOT,
  STARTER_BONUS_XP,
  Task,
  awake,
  dailyGoalOf,
  minimumGoalOf,
  enragedSet,
  heroPalette,
  heroSprite,
  itemCount,
  levelOf,
  monsterOf,
  sameDay,
  slotsFor,
  todayKey,
  unlocksAt,
  uid,
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
import { TIMER_KEY, TimerState, loadTimer, remaining } from './timer'
import { downloadSave, lastVisit, recordVisit } from './persistence'
import { useModalFocus } from './useModalFocus'
import { ReturnModal } from './components/ReturnModal'

type Tab = 'quest' | 'pool' | 'shop' | 'journal'

interface ToastAction {
  label: string
  fn: () => void
}

export default function App() {
  useModalFocus()
  const {
    state,
    storageWarning,
    retrySave,
    setPreferences,
    bulkOrganize,
    planReturn,
    saveReview,
    returnToPool,
    finishFocus,
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
  const [started, setStarted] = useState(
    () => !!state.heroName || state.active.length > 0 || state.pool.length > 0 || state.done.length > 0,
  )
  const [petOpen, setPetOpen] = useState(false)
  const [heroOpen, setHeroOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnSuggested, setReturnSuggested] = useState(() => {
    const at = lastVisit(state.lastVisitedAt)
    return !!at && Date.now() - at >= 3 * 86400000 && state.active.length + state.pool.length > 0
  })
  const [editing, setEditing] = useState<Task | null>(null)
  const [encounter, setEncounter] = useState<Task | null>(null)
  const [muted, setMuted] = useState(isMuted())
  const [installEvt, setInstallEvt] = useState<Event | null>(null)
  const encounterShown = useRef(false)

  // PWA 설치 유도 — 브라우저가 설치 가능하다고 알려주면 배너 표시
  useEffect(() => {
    try {
      if (localStorage.getItem('ilta-install-dismissed') === '1') return
    } catch {
      /* optional preference */
    }
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
  const [timerMinimized, setTimerMinimized] = useState(false)
  const [timerWarning, setTimerWarning] = useState('')
  const [clock, setClock] = useState(Date.now())
  const goal = dailyGoalOf(state)
  useEffect(() => {
    if (!started) return
    recordVisit()
    const visit = () => {
      if (document.visibilityState === 'visible') recordVisit()
    }
    document.addEventListener('visibilitychange', visit)
    return () => document.removeEventListener('visibilitychange', visit)
  }, [started])
  const [toast, setToast] = useState('')
  const [toastActions, setToastActions] = useState<ToastAction[]>([])
  const [flash, setFlash] = useState(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 타이머는 저장해 두고, 앱을 닫았다 열어도 이어서 센다
  useEffect(() => {
    try {
      if (timer) localStorage.setItem(TIMER_KEY, JSON.stringify(timer))
      else localStorage.removeItem(TIMER_KEY)
      setTimerWarning('')
    } catch {
      setTimerWarning('집중 시간을 기기에 저장하지 못했어요. 이 화면에서 계속 진행할 수 있습니다.')
    }
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
    (id: string): ToastAction => ({
      label: '되돌리기',
      fn: () => {
        if (undo(id)) {
          toastQueue.current = []
          sfx.accept()
          showToast('되돌렸어요')
        } else showToast('이후 기록을 지키기 위해 이 행동은 더 이상 되돌릴 수 없어요')
      },
    }),
    [undo, showToast],
  )

  const handleRemove = useCallback(
    (id: string) => {
      removeTask(id)
      sfx.click()
      showToast('몬스터를 놓아줬어요', undoAction(id), 5000)
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
      if (timer?.questId === id && !timer.finished) {
        const elapsed = timer.seconds - remaining(timer)
        if (elapsed > 0) finishFocus({ ...timer, seconds: elapsed, starter: false })
      }
      const result = complete(id)
      if (!result) return
      setTimer((current) => (current?.questId === id ? null : current))
      const critText = result.crit ? '크리티컬! ' : ''
      const goalBonus = result.goalBonus ? ` · 일일 목표 달성 +${result.goalBonus}G!` : ''
      // 모멘텀: 수집함에 남은 게 있고 슬롯에 자리가 있으면 바로 다음 뽑기 제안 + 잘못 눌렀으면 되돌리기
      const actions: ToastAction[] = [undoAction(id)]
      if (state.pool.length > 0 && state.active.length <= slotsFor(levelOf(state.xp)))
        actions.push({ label: '다음 뽑기 →', fn: () => setDrawing(true) })
      const boostText = result.boosted ? '포션 효과! ' : ''
      const potionText = result.potionsConverted ? ' · 빨간 포션 5개 → XP 포션!' : ''
      // 오늘의 일격 처치 → 대축하 + 보너스
      const isStrike = result.strikeBonus > 0
      if (isStrike) {
        setFlash((f) => f + 1)
        sfx.levelup()
      }
      const strikeText = isStrike ? `오늘의 일격 성공! +${result.strikeBonus}G ` : ''
      const raidText = result.raidKilled
        ? result.chapterCleared
          ? ` · 챕터 클리어! 칭호 「${result.raidTitle}」 +${result.raidReward}G`
          : ` · 주간 보스 처치! +${result.raidReward}G`
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
      if (result.achievements.length) {
        showToast(
          `업적 달성! ${result.achievements.map((a) => `「${a.name}」`).join(' ')} +${result.achievements.reduce((sum, a) => sum + a.gold, 0)}G`,
          undefined,
          6000,
        )
      }
    },
    [complete, showToast, undoAction, state.pool.length, state.active.length, state.xp, timer, finishFocus],
  )

  const startTimer = useCallback(
    (quest: ActiveQuest, starter: boolean) => {
      if (timer) {
        setTimerMinimized(false)
        return
      }
      sfx.click()
      setTimer({
        id: uid(),
        questId: quest.id,
        seconds: starter ? 300 : quest.minutes * 60,
        starter,
        startedAt: Date.now(),
      })
      setTimerMinimized(false)
    },
    [timer],
  )
  const handleStarter = (quest: ActiveQuest) => startTimer(quest, true)
  const handleFight = (quest: ActiveQuest) => startTimer(quest, false)

  const handleQuickAdd = useCallback(
    (title: string) => {
      const where = quickAdd(title)
      sfx.accept()
      showToast(where === 'active' ? '퀘스트 슬롯에 등록!' : '슬롯이 가득 — 수집함에 보관했어요')
    },
    [quickAdd, showToast],
  )

  // 타이머 정산은 여기 한 곳에서만. 오버레이가 0초를 보고 부르든, 앱 복귀 때 부르든 같은 타이머는 한 번만 처리
  const settledTimer = useRef<string | null>(null)
  const handleTimerFinish = useCallback(
    (returning = false) => {
      if (!timer || timer.finished || settledTimer.current === timer.id) return
      settledTimer.current = timer.id
      setTimer({ ...timer, finished: true, pausedLeft: undefined })
      setTimerMinimized(false)
      const rewarded = finishFocus(timer)
      const back = returning ? '돌아온 사이 ' : ''
      if (timer.starter) {
        showToast(`${back}5분 시작 성공!${rewarded ? ` +${STARTER_BONUS_XP}XP` : ''}`)
      } else {
        showToast(`${back}집중을 마쳤어요. 할 일을 끝냈는지 확인해 주세요`)
      }
      sfx.complete()
      if (
        document.hidden &&
        state.notif &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        navigator.serviceWorker
          ?.getRegistration()
          .then((reg) =>
            reg?.showNotification('일타', {
              body: '집중을 마쳤어요. 다음 행동을 골라 주세요.',
              tag: 'ilta-timer',
            }),
          )
          .catch(() => {})
      }
    },
    [timer, finishFocus, showToast, state.notif],
  )

  useEffect(() => {
    const sync = () => {
      setClock(Date.now())
      if (timer && !timer.finished && timer.pausedLeft === undefined && remaining(timer) <= 0)
        handleTimerFinish(document.hidden)
    }
    sync()
    const interval = setInterval(sync, timer && !timer.finished ? 500 : 30_000)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [timer, handleTimerFinish])

  useEffect(() => {
    if (timer && !state.active.some((q) => q.id === timer.questId)) setTimer(null)
  }, [timer, state.active])

  // 앱을 켜면: 복원된 타이머 검사 (퀘스트가 사라졌으면 버리고, 이미 끝났으면 바로 정산) + 휴식일 부적 자동 소모
  useEffect(() => {
    if (!started) return
    if (timer) {
      const alive = state.active.some((q) => q.id === timer.questId)
      if (!alive) setTimer(null)
      else if (!timer.finished && timer.pausedLeft === undefined && remaining(timer) <= 0)
        handleTimerFinish(true)
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
        showToast('모든 단계를 마쳤어요. 할 일 완료로 마무리하세요')
      }
    },
    [toggleSub, showToast],
  )

  // 테마 적용
  useEffect(() => {
    document.body.dataset.theme = state.theme ?? 'night'
    document.body.dataset.readable = String(!!state.readable)
    document.body.dataset.motion = state.reducedMotion ? 'reduced' : 'full'
  }, [state.theme, state.readable, state.reducedMotion])

  // 야생 몬스터 습격 — 세션당 1번, 시작 후 잠시 뒤
  useEffect(() => {
    if (!started || state.gentle !== false || encounterShown.current) return
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
      if (mad > 0 && state.gentle === false) {
        new Notification('일타', { body: `광폭 몬스터 ${mad}마리가 커지는 중! 지금 잡으러 가자` })
      } else if (strike) {
        new Notification('일타', { body: `오늘의 일격 「${strike.title}」 준비되면 한 걸음 시작해요` })
      }
    }, 20000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  // PWA 앱 배지 — 설치된 앱 아이콘에 오늘 남은 목표 수를 표시 (서버 없이 되는 리마인드)
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    if (!nav.setAppBadge) return
    const update = () => {
      const left = Math.max(0, goal - state.done.filter((d) => sameDay(d.completedAt, Date.now())).length)
      if (left > 0) nav.setAppBadge(left).catch(() => {})
      else nav.clearAppBadge?.().catch(() => {})
    }
    update()
    // 자정이 지나면 state.done이 안 바뀌어도 남은 수가 달라지므로 다음 자정에 다시 계산
    let t: ReturnType<typeof setTimeout>
    const arm = () => {
      const n = new Date()
      const midnight = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1)
      t = setTimeout(() => {
        update()
        arm()
      }, midnight.getTime() - Date.now())
    }
    arm()
    return () => clearTimeout(t)
  }, [state.done, goal])

  const goTab = (t: Tab) => {
    sfx.click()
    setTab(t)
  }

  const doneToday = state.done.filter((d) => sameDay(d.completedAt, clock)).length
  const maxActive = slotsFor(levelOf(state.xp))

  // 광폭 표시는 심각한 순으로 최대 3마리까지만 (전부 빨개지면 경고가 무뎌짐)
  const enragedIds = state.gentle !== false ? new Set<string>() : enragedSet([...state.pool, ...state.active])
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
  const poolView = (
    <Pool
      pool={state.pool}
      archived={state.archived ?? []}
      onBulk={(ids, action) => {
        const id = bulkOrganize(ids, action)
        showToast(
          `${ids.length}개 ${action.type === 'archive' ? '보관했어요' : action.type === 'restore' ? '복원했어요' : '정리했어요'}`,
          undoAction(id),
          5000,
        )
      }}
      strikeId={strikeSet ? state.strike!.id : undefined}
      enragedIds={enragedIds}
      onAdd={addTask}
      onRemove={handleRemove}
      onEdit={setEditing}
      calmCount={itemCount(state, 'calm')}
      gentle={state.gentle !== false}
      full={state.active.length >= maxActive}
      onAccept={(id) => {
        if (accept(id)) {
          setTab('quest')
          showToast('오늘의 퀘스트에 추가했어요')
        } else showToast('지금 시작할 수 없어요. 빈 슬롯과 반복 일정을 확인해 주세요')
      }}
      onCalm={(id) => {
        if (applyCalm(id)) showToast('몬스터가 차분해졌어요')
      }}
      onMove={move}
      onToggleUrgent={toggleUrgent}
      onToggleRepeat={toggleRepeat}
      onSetStrike={(id) => {
        setStrike(id)
        showToast('오늘의 일격으로 지정했어요')
      }}
    />
  )

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
            setHeroName(name || '모험가')
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

      {(storageWarning || timerWarning) && (
        <div className="save-warning" role="alert">
          <p>{storageWarning || timerWarning}</p>
          <div className="row-actions">
            <button className="btn btn-sub" onClick={() => downloadSave(exportSave())}>
              현재 기록 내보내기
            </button>
            <button
              className="btn btn-sub"
              onClick={() => {
                if (!retrySave()) setSettingsOpen(true)
              }}
            >
              저장 재시도
            </button>
            <button className="btn btn-ghost" onClick={() => location.reload()}>
              최신 내용 열기
            </button>
          </div>
        </div>
      )}

      <main className={`content ${tab === 'quest' ? 'workspace' : ''}`}>
        {returnSuggested && tab === 'quest' && (
          <section className="return-banner">
            <div>
              <strong>다시 만나서 반가워요</strong>
              <p>오늘 할 일만 가볍게 골라볼까요?</p>
            </div>
            <button className="btn btn-go" onClick={() => setReturnOpen(true)}>
              다시 고르기
            </button>
            <button
              className="icon-btn"
              aria-label="복귀 안내 닫기"
              onClick={() => setReturnSuggested(false)}
            >
              ×
            </button>
          </section>
        )}
        {tab === 'quest' && (
          <QuestBoard
            active={state.active}
            maxActive={maxActive}
            poolSize={state.pool.length}
            doneToday={doneToday}
            goal={goal}
            minimumGoal={minimumGoalOf(state)}
            onOrganize={() => setReturnOpen(true)}
            goalRewarded={(state.goalAwards ?? []).includes(todayKey())}
            gentle={state.gentle !== false}
            onSetStrike={setStrike}
            strikeTask={strikeTask}
            strikeDone={strikeDone}
            strikeInPool={strikeInPool}
            enragedIds={enragedIds}
            onDraw={() => setDrawing(true)}
            onComplete={handleComplete}
            onStarter={handleStarter}
            onFight={handleFight}
            onAbandon={(id) => {
              if (state.gentle !== false) {
                returnToPool(id)
                showToast('진행 내용을 보관했어요. 준비되면 다시 시작해요')
                return
              }
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
        {tab === 'quest' && (
          <aside className="desktop-pool">
            <h2>수집함</h2>
            {poolView}
          </aside>
        )}
        {tab === 'pool' && poolView}
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
      {returnOpen && (
        <ReturnModal
          state={state}
          timerQuestId={timer?.questId}
          onClose={() => setReturnOpen(false)}
          onApply={(choices) => {
            if (timer && choices[timer.questId] && choices[timer.questId] !== 'today') return false
            const id = planReturn(choices)
            if (!id) return false
            setReturnSuggested(false)
            setTab('quest')
            showToast('오늘의 계획을 정리했어요', undoAction(id), 5000)
            return true
          }}
        />
      )}

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
          onName={setHeroName}
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
          onSaveReview={saveReview}
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
          onImport={(text, expectedStored) => {
            const result = importSave(text, expectedStored)
            if (result.ok) setTimer(null)
            return result
          }}
          onTheme={setTheme}
          onNotif={setNotif}
          onPreferences={setPreferences}
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
          gentle={state.gentle !== false}
          onUseTicket={() => consumeItem('reroll')}
          onAccept={accept}
          onClose={() => setDrawing(false)}
        />
      )}

      {timer && timerQuest && !timerMinimized && (
        <TimerOverlay
          quest={timerQuest}
          timer={timer}
          left={remaining(timer)}
          onMinimize={() => setTimerMinimized(true)}
          onPause={() =>
            setTimer(
              timer.pausedLeft === undefined
                ? { ...timer, pausedLeft: remaining(timer) }
                : {
                    ...timer,
                    startedAt: Date.now() - (timer.seconds - timer.pausedLeft) * 1000,
                    pausedLeft: undefined,
                  },
            )
          }
          onExtend={() =>
            setTimer({
              id: uid(),
              questId: timer.questId,
              seconds: 300,
              starter: false,
              startedAt: Date.now(),
            })
          }
          onComplete={() => handleComplete(timer.questId)}
          onRest={() => {
            const elapsed = timer.seconds - remaining(timer)
            if (!timer.finished && elapsed > 0) finishFocus({ ...timer, seconds: elapsed, starter: false })
            setTimer(null)
            showToast('진행 내용은 그대로 남아 있어요')
          }}
        />
      )}
      {timer && timerQuest && timerMinimized && (
        <button className="timer-dock" onClick={() => setTimerMinimized(false)}>
          <span>{timerQuest.title}</span>
          <b>
            {timer.finished
              ? '집중 완료'
              : timer.pausedLeft !== undefined
                ? '일시정지'
                : `${Math.floor(remaining(timer) / 60)}:${String(remaining(timer) % 60).padStart(2, '0')}`}
          </b>
        </button>
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
              try {
                localStorage.setItem('ilta-install-dismissed', '1')
              } catch {
                /* optional preference */
              }
            }}
          >
            설치
          </button>
          <button
            className="icon-btn"
            onClick={() => {
              setInstallEvt(null)
              try {
                localStorage.setItem('ilta-install-dismissed', '1')
              } catch {
                /* optional preference */
              }
            }}
          >
            ×
          </button>
        </div>
      )}

      {toast && (
        <div className="toast pixel-panel" role="status" aria-live="polite">
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

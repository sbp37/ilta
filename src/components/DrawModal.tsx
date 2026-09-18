import { useEffect, useMemo, useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import {
  ActiveQuest,
  DIFF,
  ENERGY_LABEL,
  Energy,
  MINUTE_OPTIONS,
  NUDGE_LINES,
  Task,
  awake,
  dueLabel,
  filterDoable,
  monsterOf,
  pickWeighted,
} from '../game'

interface Props {
  pool: Task[]
  activeFull: boolean
  maxActive: number
  enragedIds: Set<string>
  tickets: number // 다시뽑기권 보유 수
  onUseTicket: () => boolean
  onAccept: (id: string) => boolean
  onClose: () => void
}

type Phase = 'setup' | 'rolling' | 'reveal'

const NPC_LINES = [
  '수고 많으십니다, 모험가님.',
  '오늘은 어떤 퀘스트를 원하시나요?',
  '조건만 말씀해 주시면 제가 골라드리죠.',
]

export function DrawModal({ pool, activeFull, maxActive, enragedIds, tickets, onUseTicket, onAccept, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [minutes, setMinutes] = useState<number>(30)
  const [energy, setEnergy] = useState<Energy>('mid')
  const [picked, setPicked] = useState<Task | null>(null)
  const [rerolls, setRerolls] = useState(1)
  const [ignoreFilter, setIgnoreFilter] = useState(false)
  const [accepted, setAccepted] = useState<ActiveQuest | null>(null)

  const candidates = useMemo(
    () => (ignoreFilter ? awake(pool) : filterDoable(pool, minutes, energy)),
    [pool, minutes, energy, ignoreFilter],
  )

  useEffect(() => {
    if (phase === 'rolling') {
      const t = setTimeout(() => {
        const pick = pickWeighted(candidates, picked?.id)
        setPicked(pick)
        setPhase('reveal')
        if (pick?.difficulty === 'boss') sfx.bossReveal()
        else sfx.reveal()
      }, 900)
      return () => clearTimeout(t)
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const roll = () => {
    sfx.draw()
    setPhase('rolling')
  }

  const reroll = () => {
    if (rerolls > 0) {
      setRerolls((r) => r - 1)
      roll()
      return
    }
    // 무료 횟수를 다 썼으면 다시뽑기권 소모
    if (tickets > 0 && onUseTicket()) roll()
  }

  const handleAccept = () => {
    if (!picked) return
    if (onAccept(picked.id)) {
      sfx.accept()
      setAccepted({ ...picked, acceptedAt: Date.now() })
    } else {
      sfx.deny()
    }
  }

  const diff = picked ? DIFF[picked.difficulty] : null
  const mad = picked ? enragedIds.has(picked.id) : false
  // 이 퀘스트를 미루면 생기는 일: 등록된 대가 > 마감 경고 > 일반 푸시 대사
  const nudge = picked
    ? picked.cost ??
      (picked.due && dueLabel(picked.due).urgent
        ? `${dueLabel(picked.due).text} — 지금 잡아야 합니다`
        : NUDGE_LINES[[...picked.id].reduce((s, c) => s + c.charCodeAt(0), 0) % NUDGE_LINES.length])
    : ''

  return (
    <div className="modal-backdrop" onClick={phase !== 'rolling' ? onClose : undefined}>
      <div className="modal pixel-panel" onClick={(e) => e.stopPropagation()}>
        <div className="npc-row">
          <Pixel name="npc" size={3} className="bob" />
          <div className="bubble">
            {phase === 'setup' && NPC_LINES[1]}
            {phase === 'rolling' && '흠… 어디 보자…'}
            {phase === 'reveal' && picked && mad && '이건 오래 미뤄져 화가 머리끝까지 난 몬스터다!'}
            {phase === 'reveal' && picked && !mad && '자, 이 퀘스트는 어떠신지?'}
            {phase === 'reveal' && !picked && '조건에 맞는 퀘스트가 없군요…'}
          </div>
        </div>

        {phase === 'setup' && (
          <>
            <div className="field-label">남은 시간</div>
            <div className="chip-row">
              {MINUTE_OPTIONS.map((m) => (
                <button
                  key={m}
                  className={`chip ${minutes === m ? 'chip-on' : ''}`}
                  onClick={() => setMinutes(m)}
                >
                  {m}분
                </button>
              ))}
            </div>
            <div className="field-label">지금 에너지</div>
            <div className="chip-row">
              {(Object.keys(ENERGY_LABEL) as Energy[]).map((e) => (
                <button
                  key={e}
                  className={`chip ${energy === e ? 'chip-on' : ''}`}
                  onClick={() => setEnergy(e)}
                >
                  {ENERGY_LABEL[e]}
                </button>
              ))}
            </div>
            {activeFull && <div className="warn">퀘스트 슬롯이 가득 찼습니다! (최대 {maxActive}개)</div>}
            <button className="btn btn-big btn-go" onClick={roll} disabled={activeFull || pool.length === 0}>
              {pool.length === 0 ? '수집함이 비었어요' : '퀘스트 뽑기!'}
            </button>
          </>
        )}

        {phase === 'rolling' && (
          <div className="rolling-box">
            <Pixel name="chest" size={6} className="shake" />
            <div className="dim center">두근두근…</div>
          </div>
        )}

        {phase === 'reveal' && picked && diff && !accepted && (
          <>
            <div className={`reveal-box ${picked.difficulty === 'boss' ? 'boss-flash' : ''}`}>
              <Pixel name={monsterOf(picked)} size={6} className={mad ? 'shake-slow' : 'bob'} />
              <div className="reveal-label" style={{ color: mad ? '#ff4d5e' : diff.color }}>
                {mad ? '광폭한 ' : '야생의 '}[{diff.label}] 이 나타났다!
              </div>
              <div className="reveal-title">{picked.title}</div>
              {nudge && <div className="nudge-line">지금 안 잡으면 → {nudge}</div>}
              <div className="quest-meta center">
                <span>{picked.minutes}분</span>
                <span>{ENERGY_LABEL[picked.energy]}</span>
                <span>+{diff.xp} XP</span>
              </div>
            </div>
            <div className="row-actions">
              <button className="btn btn-go" onClick={handleAccept}>
                수락한다!
              </button>
              <button className="btn btn-sub" onClick={reroll} disabled={rerolls <= 0 && tickets <= 0}>
                {rerolls > 0 ? `다시 뽑기 (${rerolls}회)` : tickets > 0 ? `🎫 뽑기권 사용 (${tickets})` : '다시 뽑기 (0회)'}
              </button>
            </div>
          </>
        )}

        {phase === 'reveal' && !picked && (
          <div className="center-col">
            <div className="dim">지금 조건에 맞는 퀘스트가 없어요.</div>
            {!ignoreFilter && pool.length > 0 && (
              <button className="btn btn-sub" onClick={() => setIgnoreFilter(true)}>
                조건 무시하고 뽑기
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              닫기
            </button>
          </div>
        )}

        {accepted && (
          <div className="center-col">
            <div className="reveal-label" style={{ color: '#43d675' }}>
              퀘스트 수락 완료!
            </div>
            <div className="dim">슬롯에 추가되었습니다. 행운을 빕니다!</div>
            <button className="btn btn-go" onClick={onClose}>
              출발!
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

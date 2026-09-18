import { useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import {
  COST_PRESETS,
  DIFF,
  Difficulty,
  ENERGY_LABEL,
  Energy,
  MINUTE_OPTIONS,
  Task,
  dueLabel,
} from '../game'

interface Props {
  pool: Task[]
  strikeId?: string
  enragedIds: Set<string>
  onAdd: (t: Omit<Task, 'id' | 'createdAt'>) => void
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onToggleUrgent: (id: string) => void
  onToggleRepeat: (id: string) => void
  onSetStrike: (id: string) => void
  onEdit: (task: Task) => void
}

export function Pool({
  pool,
  strikeId,
  enragedIds,
  onAdd,
  onRemove,
  onMove,
  onToggleUrgent,
  onToggleRepeat,
  onSetStrike,
  onEdit,
}: Props) {
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('slime')
  const [minutes, setMinutes] = useState<number>(15)
  const [energy, setEnergy] = useState<Energy>('low')
  const [due, setDue] = useState('')
  const [cost, setCost] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) {
      sfx.deny()
      return
    }
    onAdd({ title: trimmed, difficulty, minutes, energy, due: due || undefined, cost: cost || undefined })
    setTitle('')
    sfx.accept()
  }

  return (
    <div className="pool">
      <div className="pixel-panel form">
        <div className="quick-add-row">
          <input
            className="text-input"
            placeholder="할 일 입력 → Enter로 계속 추가"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter') submit()
            }}
            maxLength={60}
          />
          <button className="btn btn-go" onClick={submit}>
            넣기
          </button>
        </div>

        <button className="form-toggle" onClick={() => setDetailOpen((o) => !o)}>
          {detailOpen ? '▲ 상세 설정 접기' : '▼ 상세 설정 (난이도·시간·에너지·마감)'}
        </button>

        {detailOpen && (
          <div className="detail-fields">
            <div className="field-label">난이도</div>
            <div className="chip-row">
              {(Object.keys(DIFF) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  className={`chip chip-diff ${difficulty === d ? 'chip-on' : ''}`}
                  style={difficulty === d ? { borderColor: DIFF[d].color } : undefined}
                  onClick={() => setDifficulty(d)}
                >
                  <Pixel name={DIFF[d].sprite} size={2} />
                  {DIFF[d].label}
                  <span className="dim">+{DIFF[d].xp}</span>
                </button>
              ))}
            </div>

            <div className="field-label">예상 시간</div>
            <div className="chip-row">
              {MINUTE_OPTIONS.map((m) => (
                <button key={m} className={`chip ${minutes === m ? 'chip-on' : ''}`} onClick={() => setMinutes(m)}>
                  {m}분
                </button>
              ))}
            </div>

            <div className="field-label">필요한 에너지</div>
            <div className="chip-row">
              {(Object.keys(ENERGY_LABEL) as Energy[]).map((e) => (
                <button key={e} className={`chip ${energy === e ? 'chip-on' : ''}`} onClick={() => setEnergy(e)}>
                  {ENERGY_LABEL[e]}
                </button>
              ))}
            </div>

            <div className="field-label">마감일 (선택)</div>
            <input className="text-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />

            <div className="field-label">안 하면 생기는 일 (선택)</div>
            <input
              className="text-input"
              placeholder="예: 야근 확정, 상사에게 혼남…"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              maxLength={30}
            />
            <div className="chip-row preset-row">
              {COST_PRESETS.map((c) => (
                <button key={c} className={`chip ${cost === c ? 'chip-on' : ''}`} onClick={() => setCost(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pool-list">
        <div className="field-label">
          수집함 ({pool.length}) — <span className="hint">위에 있을수록 먼저 뽑혀요. ▲▼로 우선순위 조정</span>
        </div>
        {pool.length === 0 && (
          <div className="empty-scene">
            <Pixel name="chest" size={4} />
            <div className="dim">비어있어요. 할 일을 던져넣으면 몬스터가 됩니다.</div>
          </div>
        )}
        {pool.map((t, i) => {
          const diff = DIFF[t.difficulty]
          const due = t.due ? dueLabel(t.due) : null
          const mad = enragedIds.has(t.id)
          return (
            <div key={t.id} className={`pool-item ${mad ? 'pool-enraged' : ''}`}>
              <div className="order-btns">
                <button
                  className="icon-btn"
                  disabled={i === 0}
                  title="위로 (우선순위 UP)"
                  onClick={() => {
                    sfx.click()
                    onMove(t.id, -1)
                  }}
                >
                  ▲
                </button>
                <button
                  className="icon-btn"
                  disabled={i === pool.length - 1}
                  title="아래로"
                  onClick={() => {
                    sfx.click()
                    onMove(t.id, 1)
                  }}
                >
                  ▼
                </button>
              </div>
              <Pixel name={t.monster ?? diff.sprite} size={2} />
              <div className="pool-item-body">
                <div className="pool-item-title">
                  {strikeId === t.id && <span className="strike-tag">⚔일격</span>}
                  {mad && <span className="enraged-tag">광폭</span>}
                  {t.repeat && <span className="repeat-tag">🔁</span>}
                  {t.urgent && <span className="urgent-mark">!</span>}
                  {t.title}
                </div>
                <div className="quest-meta">
                  <span style={{ color: diff.color }}>{diff.label}</span>
                  <span>{t.minutes}분</span>
                  <span>{ENERGY_LABEL[t.energy]}</span>
                  {due && <span className={due.urgent ? 'due-urgent' : ''}>{due.text}</span>}
                  {(t.subs?.length ?? 0) > 0 && (
                    <span className="subs-tag">잡몹 {t.subs!.filter((s) => s.done).length}/{t.subs!.length}</span>
                  )}
                  {(t.retreats ?? 0) > 0 && <span className="retreat-tag">도망 x{t.retreats}</span>}
                  {t.cost && <span className="cost-tag">안 하면: {t.cost}</span>}
                </div>
              </div>
              <button
                className="icon-btn"
                title="수정"
                onClick={() => {
                  sfx.click()
                  onEdit(t)
                }}
              >
                ✎
              </button>
              <button
                className={`icon-btn ${t.repeat ? 'repeat-on' : ''}`}
                title="매일 반복 — 처치해도 다시 나타남"
                onClick={() => {
                  sfx.click()
                  onToggleRepeat(t.id)
                }}
              >
                ↻
              </button>
              <button
                className={`icon-btn ${strikeId === t.id ? 'strike-on' : ''}`}
                title="오늘의 일격으로 지정"
                onClick={() => {
                  sfx.accept()
                  onSetStrike(t.id)
                }}
              >
                ⚔
              </button>
              <button
                className={`icon-btn ${t.urgent ? 'urgent-on' : ''}`}
                title="급해! (뽑힐 확률 UP)"
                onClick={() => {
                  sfx.click()
                  onToggleUrgent(t.id)
                }}
              >
                !
              </button>
              <button className="icon-btn" title="삭제" onClick={() => onRemove(t.id)}>
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

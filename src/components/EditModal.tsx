import { useEffect, useMemo, useRef, useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import {
  CATEGORIES,
  CATEGORY_IDS,
  COST_PRESETS,
  Category,
  DIFF,
  Difficulty,
  ENERGY_LABEL,
  Energy,
  MINUTE_OPTIONS,
  REPEAT_LABEL,
  Repeat,
  Task,
  uid,
  monsterFor,
} from '../game'
import { TaskPatch, validTaskDate } from '../taskEditing'

const REPEAT_CYCLE: (Repeat | undefined)[] = [undefined, 'daily', 'weekdays', 'weekly']

interface Props {
  task: Task
  onSave: (id: string, patch: TaskPatch) => void
  onClose: () => void
  creating?: boolean
}

export function EditModal({ task, onSave, onClose, creating = false }: Props) {
  const [title, setTitle] = useState(task.title)
  const [difficulty, setDifficulty] = useState<Difficulty>(task.difficulty)
  const [minutes, setMinutes] = useState<number>(task.minutes)
  const [energy, setEnergy] = useState<Energy>(task.energy)
  const [due, setDue] = useState(task.due ?? '')
  const [cost, setCost] = useState(task.cost ?? '')
  const [repeat, setRepeat] = useState<Repeat | undefined>(task.repeat)
  const [category, setCategory] = useState<Category | undefined>(task.category)
  const previewMonster = useMemo(
    () =>
      difficulty === task.difficulty && category === task.category
        ? (task.monster ?? monsterFor(difficulty, category))
        : monsterFor(difficulty, category),
    [difficulty, category, task.difficulty, task.category, task.monster],
  )
  const [subs, setSubs] = useState(task.subs ?? [])
  const [subTitle, setSubTitle] = useState('')
  const [error, setError] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const discardRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (discarding) discardRef.current?.focus()
  }, [discarding])
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])
  const dirty =
    title !== task.title ||
    difficulty !== task.difficulty ||
    minutes !== task.minutes ||
    energy !== task.energy ||
    due !== (task.due ?? '') ||
    cost !== (task.cost ?? '') ||
    repeat !== task.repeat ||
    category !== task.category ||
    !!subTitle.trim() ||
    JSON.stringify(subs) !== JSON.stringify(task.subs ?? [])
  const requestClose = () => {
    if (dirty) setDiscarding(true)
    else onClose()
  }
  const addStep = () => {
    if (!subTitle.trim() || subs.length >= 8) return
    setSubs([...subs, { id: uid(), title: subTitle.trim() }])
    setSubTitle('')
  }

  const save = () => {
    const trimmed = title.trim()
    if (!trimmed) {
      sfx.deny()
      setError('할 일 이름을 적어 주세요.')
      return
    }
    if (!validTaskDate(due)) {
      setError('마감일을 올바르게 입력해 주세요.')
      return
    }
    if (subs.some((sub) => !sub.title.trim())) {
      setError('빈 단계에 이름을 적거나 삭제해 주세요.')
      return
    }
    sfx.accept()
    onSave(task.id, {
      title: trimmed,
      difficulty,
      minutes,
      energy,
      due: due || undefined,
      cost: cost.trim() || undefined,
      repeat,
      category,
      subs: subTitle.trim() && subs.length < 8 ? [...subs, { id: uid(), title: subTitle.trim() }] : subs,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={requestClose}>
      <div className="modal pixel-panel edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{creating ? '할 일 추가' : '몬스터 정보 수정'}</div>
        {discarding && (
          <div className="edit-discard" role="alert" tabIndex={-1} ref={discardRef}>
            <p>저장하지 않은 변경을 버릴까요?</p>
            <div className="row-actions">
              <button className="btn btn-sub" onClick={() => setDiscarding(false)}>
                계속 편집
              </button>
              <button className="btn btn-ghost" onClick={onClose}>
                변경 버리기
              </button>
            </div>
          </div>
        )}
        <div className="edit-head">
          <Pixel name={previewMonster} size={3} className="bob" />
          <input
            className="text-input"
            aria-label="할 일 이름"
            value={title}
            maxLength={60}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter') save()
            }}
          />
        </div>

        <div className="field-label">작은 단계 ({subs.length}/8)</div>
        <div className="step-editor">
          {subs.map((sub, index) => (
            <div className="step-editor-row" key={sub.id}>
              <input
                className="text-input"
                aria-label={`단계 ${index + 1}`}
                value={sub.title}
                maxLength={40}
                onChange={(e) =>
                  setSubs(
                    subs.map((item) => (item.id === sub.id ? { ...item, title: e.target.value } : item)),
                  )
                }
              />
              <button
                className="icon-btn"
                title={`단계 ${index + 1} 삭제`}
                aria-label={`단계 ${index + 1} 삭제`}
                onClick={() => setSubs(subs.filter((item) => item.id !== sub.id))}
              >
                ×
              </button>
            </div>
          ))}
          {subs.length < 8 && (
            <div className="step-editor-row">
              <input
                className="text-input"
                aria-label="새 단계"
                placeholder="다음 작은 단계"
                value={subTitle}
                maxLength={40}
                onChange={(e) => setSubTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    addStep()
                  }
                }}
              />
              <button
                className="icon-btn"
                title="단계 추가"
                aria-label="단계 추가"
                disabled={!subTitle.trim()}
                onClick={addStep}
              >
                +
              </button>
            </div>
          )}
        </div>

        <div className="field-label">분류</div>
        <div className="chip-row">
          {CATEGORY_IDS.map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              className={`chip cat-chip ${category === c ? 'chip-on' : ''}`}
              onClick={() => setCategory(category === c ? undefined : c)}
            >
              {CATEGORIES[c].name}
            </button>
          ))}
        </div>

        <div className="field-label">난이도</div>
        <div className="chip-row">
          {(Object.keys(DIFF) as Difficulty[]).map((d) => (
            <button
              key={d}
              aria-pressed={difficulty === d}
              className={`chip chip-diff ${difficulty === d ? 'chip-on' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              <Pixel name={DIFF[d].sprite} size={2} />
              {DIFF[d].label}
              <span className="dim">+{DIFF[d].xp}</span>
            </button>
          ))}
        </div>
        {(difficulty !== task.difficulty || category !== task.category) && (
          <div className="dim edit-hint">난이도나 분류를 바꾸면 몬스터가 새로 배정돼요</div>
        )}

        <div className="field-label">예상 시간</div>
        <div className="chip-row">
          {MINUTE_OPTIONS.map((m) => (
            <button
              key={m}
              aria-pressed={minutes === m}
              className={`chip ${minutes === m ? 'chip-on' : ''}`}
              onClick={() => setMinutes(m)}
            >
              {m}분
            </button>
          ))}
        </div>

        <div className="field-label">필요한 에너지</div>
        <div className="chip-row">
          {(Object.keys(ENERGY_LABEL) as Energy[]).map((e) => (
            <button
              key={e}
              aria-pressed={energy === e}
              className={`chip ${energy === e ? 'chip-on' : ''}`}
              onClick={() => setEnergy(e)}
            >
              {ENERGY_LABEL[e]}
            </button>
          ))}
        </div>

        <div className="field-label">마감일</div>
        <div className="quick-add-row">
          <input
            className="text-input"
            aria-label="마감일"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          {due && (
            <button className="icon-btn" title="마감 없애기" onClick={() => setDue('')}>
              ×
            </button>
          )}
        </div>

        <details className="cost-settings" open={task.cost ? true : undefined}>
          <summary>안 하면 생기는 일</summary>
          <input
            className="text-input"
            placeholder="예: 야근 확정, 상사에게 혼남…"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            maxLength={30}
          />
          <div className="chip-row preset-row">
            {COST_PRESETS.map((c) => (
              <button
                key={c}
                aria-pressed={cost === c}
                className={`chip ${cost === c ? 'chip-on' : ''}`}
                onClick={() => setCost(cost === c ? '' : c)}
              >
                {c}
              </button>
            ))}
          </div>
        </details>

        <div className="field-label">반복</div>
        <div className="chip-row">
          {REPEAT_CYCLE.map((r) => (
            <button
              key={r ?? 'off'}
              aria-pressed={repeat === r}
              className={`chip ${repeat === r ? 'chip-on' : ''}`}
              onClick={() => setRepeat(r)}
            >
              {r ? REPEAT_LABEL[r] : '반복 없음'}
            </button>
          ))}
        </div>

        {error && (
          <p className="edit-error" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </p>
        )}
        <div className="row-actions edit-footer">
          <button className="btn btn-go" onClick={save}>
            {creating ? '추가' : '저장'}
          </button>
          <button className="btn btn-ghost" onClick={requestClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

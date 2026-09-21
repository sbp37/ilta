import { useState } from 'react'
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
  monsterFor,
} from '../game'

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'difficulty' | 'minutes' | 'energy' | 'due' | 'cost' | 'repeat' | 'category'>
>

const REPEAT_CYCLE: (Repeat | undefined)[] = [undefined, 'daily', 'weekdays', 'weekly']

interface Props {
  task: Task
  onSave: (id: string, patch: TaskPatch) => void
  onClose: () => void
}

export function EditModal({ task, onSave, onClose }: Props) {
  const [title, setTitle] = useState(task.title)
  const [difficulty, setDifficulty] = useState<Difficulty>(task.difficulty)
  const [minutes, setMinutes] = useState<number>(task.minutes)
  const [energy, setEnergy] = useState<Energy>(task.energy)
  const [due, setDue] = useState(task.due ?? '')
  const [cost, setCost] = useState(task.cost ?? '')
  const [repeat, setRepeat] = useState<Repeat | undefined>(task.repeat)
  const [category, setCategory] = useState<Category | undefined>(task.category)

  const save = () => {
    const trimmed = title.trim()
    if (!trimmed) {
      sfx.deny()
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
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pixel-panel edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">몬스터 정보 수정</div>
        <div className="edit-head">
          <Pixel
            name={
              difficulty === task.difficulty && category === task.category
                ? (task.monster ?? monsterFor(difficulty, category))
                : monsterFor(difficulty, category)
            }
            size={3}
            className="bob"
          />
          <input
            className="text-input"
            value={title}
            maxLength={60}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') onClose()
            }}
          />
        </div>

        <div className="field-label">분류</div>
        <div className="chip-row">
          {CATEGORY_IDS.map((c) => (
            <button
              key={c}
              className={`chip cat-chip ${category === c ? 'chip-on' : ''}`}
              style={
                category === c ? { borderColor: CATEGORIES[c].color, color: CATEGORIES[c].color } : undefined
              }
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
        {(difficulty !== task.difficulty || category !== task.category) && (
          <div className="dim edit-hint">난이도나 분류를 바꾸면 몬스터가 새로 배정돼요</div>
        )}

        <div className="field-label">예상 시간</div>
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

        <div className="field-label">필요한 에너지</div>
        <div className="chip-row">
          {(Object.keys(ENERGY_LABEL) as Energy[]).map((e) => (
            <button key={e} className={`chip ${energy === e ? 'chip-on' : ''}`} onClick={() => setEnergy(e)}>
              {ENERGY_LABEL[e]}
            </button>
          ))}
        </div>

        <div className="field-label">마감일</div>
        <div className="quick-add-row">
          <input className="text-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          {due && (
            <button className="icon-btn" title="마감 없애기" onClick={() => setDue('')}>
              ×
            </button>
          )}
        </div>

        <div className="field-label">안 하면 생기는 일</div>
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
              className={`chip ${cost === c ? 'chip-on' : ''}`}
              onClick={() => setCost(cost === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="field-label">반복</div>
        <div className="chip-row">
          {REPEAT_CYCLE.map((r) => (
            <button
              key={r ?? 'off'}
              className={`chip ${repeat === r ? 'chip-on' : ''}`}
              onClick={() => setRepeat(r)}
            >
              {r ? REPEAT_LABEL[r] : '반복 없음'}
            </button>
          ))}
        </div>

        <div className="row-actions">
          <button className="btn btn-go" onClick={save}>
            저장
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

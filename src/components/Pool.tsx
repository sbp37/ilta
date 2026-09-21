import { useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import {
  CATEGORIES,
  CATEGORY_IDS,
  Category,
  DIFF,
  Difficulty,
  ENERGY_LABEL,
  REPEAT_LABEL,
  Task,
  availableLabel,
  dueLabel,
  localDate,
  isAvailable,
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
  calmCount: number
  onCalm: (id: string) => void
  onAccept: (id: string) => void
  full: boolean
  gentle: boolean
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
  calmCount,
  onCalm,
  onAccept,
  full,
  gentle,
}: Props) {
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('slime')
  const [category, setCategory] = useState<Category | undefined>(undefined)
  const [moreId, setMoreId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sort, setSort] = useState('manual')
  const today = localDate()
  const visible = pool.filter((t) => {
    if (!t.title.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())) return false
    if (filterCategory !== 'all' && t.category !== filterCategory) return false
    if (view === 'today')
      return isAvailable(t) && (!!t.urgent || (!!t.due && t.due <= today) || t.id === strikeId)
    if (view === 'scheduled') return !isAvailable(t) || (!!t.due && t.due > today)
    if (view === 'undated') return !t.due && isAvailable(t)
    if (view === 'repeat') return !!t.repeat
    return true
  })
  if (sort === 'due') visible.sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  if (sort === 'new') visible.sort((a, b) => b.createdAt - a.createdAt)
  const manual = sort === 'manual' && !query && view === 'all' && filterCategory === 'all'

  const submit = () => {
    const trimmed = title.trim()
    if (!trimmed) {
      sfx.deny()
      return
    }
    onAdd({ title: trimmed, difficulty, minutes: 15, energy: 'low', category })
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

        <div className="chip-row cat-row">
          {CATEGORY_IDS.map((c) => (
            <button
              key={c}
              className={`chip cat-chip ${category === c ? 'chip-on' : ''}`}
              style={
                category === c ? { borderColor: CATEGORIES[c].color, color: CATEGORIES[c].color } : undefined
              }
              title={`${CATEGORIES[c].name} — 전담 몬스터가 정해져요`}
              onClick={() => setCategory(category === c ? undefined : c)}
            >
              {CATEGORIES[c].name}
            </button>
          ))}
        </div>

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
        <div className="hint">시간·에너지·마감은 넣은 뒤 수정에서 조정할 수 있어요</div>
      </div>

      <div className="pool-list">
        <div className="pool-filters">
          <input
            className="text-input"
            type="search"
            aria-label="할 일 검색"
            placeholder="할 일 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filter-row">
            <select aria-label="일정 필터" value={view} onChange={(e) => setView(e.target.value)}>
              <option value="all">전체 일정</option>
              <option value="today">오늘·기한 지남</option>
              <option value="scheduled">예정</option>
              <option value="undated">미정</option>
              <option value="repeat">반복</option>
            </select>
            <select
              aria-label="분류 필터"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">모든 분류</option>
              {CATEGORY_IDS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIES[c].name}
                </option>
              ))}
            </select>
            <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="manual">내 순서</option>
              <option value="due">마감순</option>
              <option value="new">최근 등록순</option>
            </select>
          </div>
        </div>
        <div className="field-label">
          수집함 ({visible.length}/{pool.length})
        </div>
        {pool.length === 0 && (
          <div className="empty-scene">
            <Pixel name="chest" size={4} />
            <div className="dim">비어있어요. 할 일을 던져넣으면 몬스터가 됩니다.</div>
          </div>
        )}
        {pool.length > 0 && visible.length === 0 && (
          <div className="empty-scene">
            <p>일치하는 할 일이 없어요</p>
            <button
              className="btn btn-sub"
              onClick={() => {
                setQuery('')
                setView('all')
                setFilterCategory('all')
              }}
            >
              필터 초기화
            </button>
          </div>
        )}
        {visible.map((t) => {
          const i = pool.findIndex((q) => q.id === t.id)
          const diff = DIFF[t.difficulty]
          const due = t.due ? dueLabel(t.due) : null
          const mad = enragedIds.has(t.id)
          return (
            <div
              key={t.id}
              className={`pool-item ${mad ? 'pool-enraged' : ''} ${availableLabel(t) ? 'pool-sleeping' : ''}`}
            >
              <div className="pool-item-main">
                {manual && (
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
                )}
                <Pixel name={t.monster ?? diff.sprite} size={2} />
                <div className="pool-item-body">
                  <div className="pool-item-title">
                    {strikeId === t.id && <span className="strike-tag">일격</span>}
                    {mad && <span className="enraged-tag">광폭</span>}
                    {t.repeat && <span className="repeat-tag">🔁{REPEAT_LABEL[t.repeat]}</span>}
                    {t.urgent && <span className="urgent-mark">!</span>}
                    {t.title}
                  </div>
                  <div className="quest-meta">
                    {t.category && (
                      <span style={{ color: CATEGORIES[t.category].color }}>
                        {CATEGORIES[t.category].name}
                      </span>
                    )}
                    <span style={{ color: diff.color }}>{diff.label}</span>
                    <span>{t.minutes}분</span>
                    <span>{ENERGY_LABEL[t.energy]}</span>
                    {due && <span className={due.urgent ? 'due-urgent' : ''}>{due.text}</span>}
                    {(t.subs?.length ?? 0) > 0 && (
                      <span className="subs-tag">
                        잡몹 {t.subs!.filter((s) => s.done).length}/{t.subs!.length}
                      </span>
                    )}
                    {!gentle && (t.retreats ?? 0) > 0 && (
                      <span className="retreat-tag">도망 x{t.retreats}</span>
                    )}
                  </div>
                  {!gentle && t.cost && <div className="cost-line">안 하면 → {t.cost}</div>}
                  {availableLabel(t) && <div className="sleep-line">💤 {availableLabel(t)}</div>}
                </div>
                <button
                  className="icon-btn more-toggle"
                  title="더 많은 행동"
                  onClick={() => {
                    sfx.click()
                    setMoreId(moreId === t.id ? null : t.id)
                  }}
                >
                  ···
                </button>
              </div>

              <button
                className="btn btn-go pool-start"
                disabled={full || !isAvailable(t)}
                title={
                  full
                    ? '오늘의 슬롯이 가득 찼어요'
                    : !isAvailable(t)
                      ? '다음 반복 일정에 시작할 수 있어요'
                      : '오늘의 퀘스트로 이동'
                }
                onClick={() => onAccept(t.id)}
              >
                {full ? '슬롯 가득' : !isAvailable(t) ? '예정된 할 일' : '바로 시작'}
              </button>

              {moreId === t.id && (
                <div className="pool-actions">
                  <button
                    className="pool-act"
                    title="제목·난이도·시간·마감 고치기"
                    onClick={() => {
                      sfx.click()
                      onEdit(t)
                    }}
                  >
                    수정
                  </button>
                  <button
                    className={`pool-act ${strikeId === t.id ? 'act-on' : ''}`}
                    title="오늘의 일격으로 지정 — 이것만 잡아도 오늘은 승리"
                    disabled={!!availableLabel(t)}
                    onClick={() => {
                      sfx.accept()
                      onSetStrike(t.id)
                    }}
                  >
                    일격
                  </button>
                  <button
                    className={`pool-act ${t.urgent ? 'act-on act-urgent' : ''}`}
                    title="급해! — 뽑힐 확률 UP"
                    onClick={() => {
                      sfx.click()
                      onToggleUrgent(t.id)
                    }}
                  >
                    급해
                  </button>
                  <button
                    className={`pool-act ${t.repeat ? 'act-on' : ''}`}
                    title="매일 반복 — 처치해도 다음날 다시 나타남"
                    onClick={() => {
                      sfx.click()
                      onToggleRepeat(t.id)
                    }}
                  >
                    반복
                  </button>
                  {mad && calmCount > 0 && (
                    <button
                      className="pool-act act-calm"
                      title={`진정의 향 사용 (${calmCount}개 보유) — 광폭 해제`}
                      onClick={() => {
                        sfx.accept()
                        onCalm(t.id)
                      }}
                    >
                      진정
                    </button>
                  )}
                  <button
                    className="pool-act act-del"
                    title="수집함에서 없애기 (되돌리기 가능)"
                    onClick={() => onRemove(t.id)}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

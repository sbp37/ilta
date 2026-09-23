import { useState } from 'react'
import { Pixel } from '../Pixel'
import { sfx } from '../sound'
import { BulkAction, tomorrowDate } from '../organization'
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
  archived: Task[]
  onBulk: (ids: string[], action: BulkAction) => void
  strikeId?: string
  enragedIds: Set<string>
  onAdd: (t: Omit<Task, 'id' | 'createdAt'>) => void
  onCreate: (t: Omit<Task, 'id' | 'createdAt'>, onCreated: () => void) => void
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
  draft: Pick<Task, 'title' | 'difficulty' | 'category'>
  onDraft: (draft: Pick<Task, 'title' | 'difficulty' | 'category'>) => void
}

export function Pool({
  pool,
  archived,
  onBulk,
  strikeId,
  enragedIds,
  onAdd,
  onCreate,
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
  draft,
  onDraft,
}: Props) {
  const { title, difficulty, category } = draft
  const [entryOptionsOpen, setEntryOptionsOpen] = useState(!!category || difficulty !== 'slime')
  const setTitle = (title: string) => onDraft({ ...draft, title })
  const setDifficulty = (difficulty: Difficulty) => onDraft({ ...draft, difficulty })
  const setCategory = (category: Category | undefined) => onDraft({ ...draft, category })
  const [moreId, setMoreId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sort, setSort] = useState('manual')
  const [archiveView, setArchiveView] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [postponeDate, setPostponeDate] = useState(tomorrowDate)
  const [bulkCategory, setBulkCategory] = useState('')
  const source = archiveView ? archived : pool
  const today = localDate()
  const visible = source.filter((t) => {
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
  const manual =
    !archiveView && !selecting && sort === 'manual' && !query && view === 'all' && filterCategory === 'all'
  const selectedIds = selected.filter((id) => visible.some((t) => t.id === id))
  const applyBulk = (action: BulkAction) => {
    if (!selectedIds.length) return
    onBulk(selectedIds, action)
    setSelected([])
  }

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
      <div className="screen-heading">
        <h2>수집함</h2>
      </div>
      {!selecting && !archiveView && (
        <div className="form">
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

          <div className="entry-tools">
            <details
              className="quiet-details entry-options"
              open={entryOptionsOpen}
              onToggle={(e) => setEntryOptionsOpen(e.currentTarget.open)}
            >
              <summary>
                분류 · 난이도{' '}
                <span className="dim">
                  {category ? `${CATEGORIES[category].name} · ` : ''}
                  {DIFF[difficulty].label}
                </span>
              </summary>
              <div className="chip-row cat-row">
                {CATEGORY_IDS.map((c) => (
                  <button
                    key={c}
                    aria-pressed={category === c}
                    className={`chip cat-chip ${category === c ? 'chip-on' : ''}`}
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
            </details>
            <button
              className="btn btn-ghost detailed-add"
              onClick={() => {
                onCreate({ title: title.trim(), difficulty, minutes: 15, energy: 'low', category }, () =>
                  setTitle(''),
                )
              }}
            >
              상세 입력
            </button>
          </div>
        </div>
      )}

      <div className="pool-list">
        <div className="organize-toolbar">
          <div className="view-tabs" role="tablist" aria-label="수집함 보기">
            {[false, true].map((archivedTab) => (
              <button
                key={String(archivedTab)}
                role="tab"
                aria-selected={archiveView === archivedTab}
                className={archiveView === archivedTab ? 'selected' : ''}
                onClick={() => {
                  setArchiveView(archivedTab)
                  setSelected([])
                  setView('all')
                }}
              >
                {archivedTab ? `보관함 ${archived.length}` : `할 일 ${pool.length}`}
              </button>
            ))}
          </div>
          <button
            className="btn btn-sub"
            aria-pressed={selecting}
            onClick={() => {
              setSelecting(!selecting)
              setSelected([])
            }}
          >
            {selecting ? '선택 끝내기' : '여러 개 정리'}
          </button>
        </div>
        <div className="pool-filters">
          <input
            className="text-input"
            type="search"
            aria-label="할 일 검색"
            placeholder="할 일 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <details className="quiet-details filter-options">
            <summary>
              필터 · 정렬
              {(view !== 'all' || filterCategory !== 'all' || sort !== 'manual') && (
                <span className="dim">적용 중</span>
              )}
            </summary>
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
          </details>
        </div>
        <div className="field-label">
          {archiveView ? '보관함' : '수집함'} ({visible.length}/{source.length})
        </div>
        {selecting && (
          <div className="bulk-toolbar">
            <label className="bulk-selection">
              <input
                type="checkbox"
                aria-label="보이는 할 일 모두 선택"
                checked={visible.length > 0 && selectedIds.length === visible.length}
                onChange={(e) => setSelected(e.target.checked ? visible.map((t) => t.id) : [])}
              />
              {selectedIds.length}개 선택
            </label>
            {archiveView ? (
              <button
                className="btn btn-go"
                disabled={!selectedIds.length}
                onClick={() => applyBulk({ type: 'restore' })}
              >
                수집함으로 복원
              </button>
            ) : (
              <>
                <div className="bulk-controls">
                  <input
                    type="date"
                    aria-label="미룰 날짜"
                    min={tomorrowDate()}
                    value={postponeDate}
                    onChange={(e) => setPostponeDate(e.target.value)}
                  />
                  <button
                    className="btn btn-sub"
                    disabled={!selectedIds.length || postponeDate <= today}
                    onClick={() => applyBulk({ type: 'postpone', date: postponeDate })}
                  >
                    마감도 함께 미루기
                  </button>
                </div>
                <div className="bulk-controls">
                  <select
                    aria-label="선택한 할 일 분류"
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                  >
                    <option value="">분류 선택</option>
                    <option value="none">분류 없음</option>
                    {CATEGORY_IDS.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORIES[c].name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-sub"
                    disabled={!selectedIds.length || !bulkCategory}
                    onClick={() =>
                      applyBulk({
                        type: 'category',
                        category: bulkCategory === 'none' ? undefined : (bulkCategory as Category),
                      })
                    }
                  >
                    분류 변경
                  </button>
                </div>
                <button
                  className="btn btn-sub"
                  disabled={!selectedIds.length}
                  onClick={() => applyBulk({ type: 'archive' })}
                >
                  보관하기
                </button>
              </>
            )}
          </div>
        )}
        {source.length === 0 && (
          <div className="empty-scene">
            <Pixel name="chest" size={4} />
            <div className="dim">
              {archiveView ? '보관한 할 일이 없어요' : '비어있어요. 할 일을 던져넣으면 몬스터가 됩니다.'}
            </div>
          </div>
        )}
        {source.length > 0 && visible.length === 0 && (
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
                {selecting && (
                  <label className="task-selection">
                    <input
                      className="task-select"
                      type="checkbox"
                      aria-label={`${t.title} 선택`}
                      checked={selectedIds.includes(t.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? [...selected, t.id] : selected.filter((id) => id !== t.id),
                        )
                      }
                    />
                  </label>
                )}
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
                    {t.category && <span>{CATEGORIES[t.category].name}</span>}
                    <span>{diff.label}</span>
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
                {!archiveView && !selecting && (
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
                )}
              </div>

              {archiveView ? (
                <button
                  className="btn btn-sub pool-start"
                  onClick={() => onBulk([t.id], { type: 'restore' })}
                >
                  수집함으로 복원
                </button>
              ) : (
                !selecting && (
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
                )
              )}

              {!archiveView && !selecting && moreId === t.id && (
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
                  <button className="pool-act" onClick={() => onBulk([t.id], { type: 'archive' })}>
                    보관
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

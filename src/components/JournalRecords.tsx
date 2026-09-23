import { useMemo, useState } from 'react'
import { Pixel } from '../Pixel'
import { GameState, lootById, monsterOf } from '../game'
import { JOURNAL_FILTER, JournalEntry, JournalFilter, filterJournal, journalEntries } from '../journal'

const PAGE_SIZE = 40

export function JournalRecords({ state }: { state: GameState }) {
  const [filter, setFilter] = useState(JOURNAL_FILTER)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const entries = useMemo(
    () => journalEntries({ done: state.done, focusSessions: state.focusSessions, reviews: state.reviews }),
    [state.done, state.focusSessions, state.reviews],
  )
  const records = filterJournal(entries, filter)
  const visible = records.slice(0, limit)
  const groups = new Map<string, JournalEntry[]>()
  visible.forEach((entry) => {
    const group = groups.get(entry.day)
    if (group) group.push(entry)
    else groups.set(entry.day, [entry])
  })
  const change = (patch: Partial<JournalFilter>) => {
    setFilter((current) => ({ ...current, ...patch }))
    setLimit(PAGE_SIZE)
  }
  const invalidRange = filter.period === 'custom' && filter.from && filter.to && filter.from > filter.to

  return (
    <section className="journal-records">
      <div className="journal-filters">
        <input
          type="search"
          aria-label="기록 검색"
          placeholder="완료한 일 · 집중 · 회고 검색"
          value={filter.search}
          onChange={(event) => change({ search: event.target.value })}
        />
        <div className="journal-filter-row">
          <select
            aria-label="기록 종류"
            value={filter.kind}
            onChange={(event) => change({ kind: event.target.value as JournalFilter['kind'] })}
          >
            <option value="all">모든 기록</option>
            <option value="done">완료</option>
            <option value="focus">집중</option>
            <option value="review">회고</option>
          </select>
          <select
            aria-label="기록 기간"
            value={filter.period}
            onChange={(event) => change({ period: event.target.value as JournalFilter['period'] })}
          >
            <option value="all">전체 기간</option>
            <option value="today">오늘</option>
            <option value="week">최근 7일</option>
            <option value="month">최근 30일</option>
            <option value="custom">기간 선택</option>
          </select>
        </div>
        {filter.period === 'custom' && (
          <div className="journal-filter-row">
            <label>
              시작일
              <input
                type="date"
                aria-label="기록 시작일"
                value={filter.from}
                onChange={(event) => change({ from: event.target.value })}
              />
            </label>
            <label>
              종료일
              <input
                type="date"
                aria-label="기록 종료일"
                value={filter.to}
                onChange={(event) => change({ to: event.target.value })}
              />
            </label>
          </div>
        )}
      </div>
      {invalidRange && <p role="alert">종료일은 시작일보다 빠를 수 없어요.</p>}
      <div className="journal-result-summary" role="status">
        {records.length}개 기록 · {visible.length}개 표시
      </div>
      {records.length === 0 && (
        <div className="empty-scene">
          <Pixel name="egg" size={4} className="bob" />
          <p className="dim">{entries.length === 0 ? '아직 기록이 없어요.' : '조건에 맞는 기록이 없어요.'}</p>
          {entries.length > 0 && (
            <button
              className="btn btn-sub"
              onClick={() => {
                setFilter(JOURNAL_FILTER)
                setLimit(PAGE_SIZE)
              }}
            >
              필터 초기화
            </button>
          )}
        </div>
      )}
      {[...groups].map(([day, items]) => (
        <section className="journal-record-day" key={day} aria-label={`${day} 기록`}>
          <h3 className="journal-day-header">
            <time dateTime={day}>{day}</time>
          </h3>
          {items.map((entry) => {
            if (entry.kind === 'review')
              return (
                <article className="journal-record journal-review" key={entry.key}>
                  <div className="field-label">하루 회고</div>
                  {entry.value.win && <p>{entry.value.win}</p>}
                  {entry.value.obstacle && <p className="dim">막혔던 점 · {entry.value.obstacle}</p>}
                  {entry.value.next && <p>다음 행동 · {entry.value.next}</p>}
                </article>
              )
            if (entry.kind === 'focus')
              return (
                <article className="journal-record focus-entry" key={entry.key}>
                  <span>{entry.value.title}</span>
                  <span>
                    {entry.value.seconds < 60 ? '1분 미만' : `${Math.floor(entry.value.seconds / 60)}분`} 집중
                  </span>
                </article>
              )
            const quest = entry.value
            const loot = lootById(quest.lootId)
            return (
              <article className="journal-record journal-entry" key={entry.key}>
                <div className="journal-entry-line">
                  <Pixel name={monsterOf(quest)} size={2} />
                  <span className="journal-task-title">{quest.title}</span>
                  <span className="journal-xp">완료 · +{quest.xp}XP</span>
                </div>
                {loot && (
                  <div className="journal-loot">
                    <Pixel name={loot.sprite} size={2} />
                    전리품 「{loot.name}」 획득!
                  </div>
                )}
              </article>
            )
          })}
        </section>
      ))}
      {visible.length < records.length && (
        <button
          className="btn btn-sub journal-more"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
        >
          기록 더 보기 ({records.length - visible.length})
        </button>
      )}
    </section>
  )
}

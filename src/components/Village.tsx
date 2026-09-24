import { useState } from 'react'
import type { GameState } from '../game'
import { Pixel } from '../Pixel'
import { ResidentId, STAGE_NAMES, VILLAGE_STAGES, residentFor, villageOf } from '../village'

export function Village({ state }: { state: GameState }) {
  const village = villageOf(state)
  const [selected, setSelected] = useState<ResidentId>('librarian')
  const place = village.places.find((p) => p.resident.id === selected)!
  const { resident, count, stage } = place
  const next = VILLAGE_STAGES[stage + 1]
  const recent = [...state.done]
    .filter((task) => residentFor(task).id === selected)
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 3)

  return (
    <section className="village" aria-label="우리 마을">
      <div className="village-heading">
        <h3>작은 발걸음 마을</h3>
        <span className="dim">함께 해낸 일 {village.total}</span>
      </div>
      <div className="village-scene" role="group" aria-label="마을 주민과 가게">
        <div className="village-road" aria-hidden="true" />
        {village.places.map(({ resident: r, count: completed, stage: level }) => (
          <button
            key={r.id}
            type="button"
            className="village-place"
            aria-pressed={selected === r.id}
            aria-label={`${r.place}, ${r.role} ${r.name}, ${STAGE_NAMES[level]}, 완료 ${completed}개`}
            onClick={() => setSelected(r.id)}
          >
            <span className="village-building">
              <Pixel
                name={level === 0 ? 'village_camp' : level === 1 ? 'village_house' : 'village_shop'}
                size={3}
                palette={{ R: r.color }}
              />
              {level >= 3 && <Pixel name="village_flowers" size={2} className="village-flowers" />}
              <Pixel name={`resident_${r.id}`} size={2} className="village-walker" />
            </span>
            <span className="village-place-name">{r.place}</span>
          </button>
        ))}
        <div className="village-square" aria-label={`보스 격퇴 기념 ${village.trophies}회`}>
          <Pixel name={village.trophies > 0 ? 'crown' : 'campfire'} size={2} />
          <span>{village.trophies > 0 ? `보스 격퇴 기념 ${village.trophies}` : '마을의 작은 모닥불'}</span>
          {village.trophies > 0 && <span className="village-pennant" aria-hidden="true" />}
        </div>
      </div>

      <div className="resident-visit" aria-live="polite" aria-atomic="true">
        <Pixel name={`resident_${resident.id}`} size={3} />
        <div>
          <h4>
            {resident.role} {resident.name}
          </h4>
          <p>{resident.greetings[stage]}</p>
        </div>
      </div>
      <div className="village-progress">
        <div>
          <span>{resident.place}</span>
          <span className="dim">{STAGE_NAMES[stage]}</span>
        </div>
        <progress aria-label={`${resident.place} 성장`} value={count} max={next ?? Math.max(count, 15)} />
        <p className="dim">
          {next
            ? `${STAGE_NAMES[stage + 1]}까지 ${next - count}개 · 함께 해낸 일 ${count}`
            : `함께 해낸 일 ${count} · 꽃 핀 거리에서 계속되는 이야기`}
        </p>
      </div>
      {recent.length > 0 && (
        <div className="village-memories">
          <h4>이곳에 남은 발걸음</h4>
          <ul>
            {recent.map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
          <p className="dim">{resident.thanks}</p>
        </div>
      )}
    </section>
  )
}

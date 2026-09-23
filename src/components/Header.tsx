import { Pixel } from '../Pixel'
import { Hero } from './Hero'
import {
  CLASSES,
  GameState,
  LOOT,
  PET_MOOD_LABEL,
  XP_BOOST_MULT,
  heroPalette,
  heroSprite,
  levelOf,
  levelProgress,
  petMood,
  petStage,
  sameDay,
  streakDays,
  titleOf,
} from '../game'

export function Header({
  state,
  onPetClick,
  onHeroClick,
}: {
  state: GameState
  onPetClick: () => void
  onHeroClick: () => void
}) {
  const level = levelOf(state.xp)
  const progress = levelProgress(state.xp)
  const combo = state.done.filter((d) => sameDay(d.completedAt, Date.now())).length
  const streak = streakDays(state.done, Date.now(), state.freezeUsed)
  const freezes = state.freezes ?? 0
  const pet = petStage(state.petFood)
  const mood = petMood(state)

  // 장착 장비(상점) 우선 + 보유 전리품 (레어 높은 순 최대 3개)
  const lootEquip = LOOT.filter((l) => (state.loot[l.id] ?? 0) > 0)
    .sort((a, b) => b.rarity - a.rarity)
    .slice(0, 3)
  const equipped = [...(state.equippedGear ?? []), ...lootEquip.map((l) => l.id)]
  const displayLoot = LOOT.filter((l) => equipped.includes(l.id)).slice(0, 3)

  return (
    <header className="header">
      <div className="hero-col">
        <button className="hero-box hero-btn" title="눌러서 용사 꾸미기" onClick={onHeroClick}>
          <Hero
            size={2}
            palette={heroPalette(state)}
            equipped={equipped}
            variant={heroSprite(state.heroClass)}
            className="bob"
          />
        </button>
      </div>

      <button
        className="pet-box pet-btn"
        title={`펫: ${state.petName || pet.name} — ${PET_MOOD_LABEL[mood]}`}
        onClick={onPetClick}
      >
        <Pixel name={pet.sprite} size={2} className={mood === 'sleeping' ? '' : 'bob'} />
        <span className="pet-name">{state.petName || pet.name}</span>
        {mood === 'hungry' && <span className="pet-alert">!</span>}
        {mood === 'sleeping' && <span className="pet-zzz">z</span>}
      </button>

      <div className="hero-info">
        <div className="hero-name">
          {state.heroName ?? '모험가'}
          <span className="lv-badge">LV.{level}</span>
        </div>
        <div className="xp-bar" title={`${progress.cur}/${progress.need} XP`}>
          <div className="xp-fill" style={{ width: `${(progress.cur / progress.need) * 100}%` }} />
        </div>
        <div className="hero-sub">
          <span className="gold-display">
            <Pixel name="coin" size={2} /> {state.gold}G
          </span>
          {state.xpBoost && (
            <span className="boost-badge" title="XP 포션 적용 중">
              포션 x{XP_BOOST_MULT}
            </span>
          )}
          {combo > 0 && <span className="combo">x{combo} 콤보!</span>}
        </div>
      </div>
      <details className="quiet-details hero-details">
        <summary>모험 정보</summary>
        <div className="hero-details-body">
          <span>{titleOf(level)}</span>
          {state.heroClass && <span>{CLASSES[state.heroClass].name}</span>}
          <span>
            {progress.cur}/{progress.need} XP
          </span>
          {streak >= 2 && <span className="streak-badge">연속 {streak}일</span>}
          {freezes > 0 && (
            <span className="freeze-badge" title="하루 빠져도 연속 기록 유지">
              휴식일 부적 {freezes}
            </span>
          )}
          {displayLoot.length > 0 && (
            <div className="equip-row" title="획득한 전리품">
              {displayLoot.map((l) => (
                <Pixel key={l.id} name={l.sprite} size={1} />
              ))}
            </div>
          )}
        </div>
      </details>
    </header>
  )
}

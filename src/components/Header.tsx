import { Pixel } from '../Pixel'
import { Hero } from './Hero'
import {
  CLASSES,
  GameState,
  LOOT,
  PET_MOOD_LABEL,
  XP_PER_LEVEL,
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
  const streak = streakDays(state.done)
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
            size={3}
            palette={heroPalette(state)}
            equipped={equipped}
            variant={heroSprite(state.heroClass)}
            className="bob"
          />
        </button>
        {displayLoot.length > 0 && (
          <div className="equip-row" title="획득한 전리품이 장비가 됩니다">
            {displayLoot.map((l) => (
              <Pixel key={l.id} name={l.sprite} size={2} />
            ))}
          </div>
        )}
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
          {state.heroName ?? '모험가'} <span className="hero-title">{titleOf(level)}</span>
          {state.heroClass && <span className="class-badge">{CLASSES[state.heroClass].name}</span>}
          <span className="lv-badge">LV.{level}</span>
          {streak >= 2 && <span className="streak-badge">🔥{streak}일</span>}
        </div>
        <div className="xp-bar" title={`${progress}/${XP_PER_LEVEL}`}>
          <div className="xp-fill" style={{ width: `${(progress / XP_PER_LEVEL) * 100}%` }} />
        </div>
        <div className="hero-sub">
          <span className="gold-display">
            <Pixel name="coin" size={2} /> {state.gold}G
          </span>
          {combo > 0 ? (
            <span className="combo">x{combo} 콤보!</span>
          ) : (
            <span className="dim">오늘의 첫 퀘스트를 노려보자</span>
          )}
        </div>
      </div>
    </header>
  )
}

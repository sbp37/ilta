import { Pixel } from '../Pixel'
import {
  GameState,
  LOOT,
  XP_PER_LEVEL,
  heroPalette,
  levelOf,
  levelProgress,
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

  // 보유 전리품 = 장비 (레어 높은 순 최대 3개)
  const equipped = LOOT.filter((l) => (state.loot[l.id] ?? 0) > 0)
    .sort((a, b) => b.rarity - a.rarity)
    .slice(0, 3)

  return (
    <header className="header">
      <div className="hero-col">
        <button className="hero-box hero-btn" title="눌러서 용사 꾸미기" onClick={onHeroClick}>
          <Pixel name="knight" size={3} className="bob" palette={heroPalette(state)} />
        </button>
        {equipped.length > 0 && (
          <div className="equip-row" title="획득한 전리품이 장비가 됩니다">
            {equipped.map((l) => (
              <Pixel key={l.id} name={l.sprite} size={2} />
            ))}
          </div>
        )}
      </div>

      <button
        className="pet-box pet-btn"
        title={`펫: ${state.petName || pet.name} — 눌러서 먹이 주기`}
        onClick={onPetClick}
      >
        <Pixel name={pet.sprite} size={2} className="bob" />
        <span className="pet-name">{state.petName || pet.name}</span>
      </button>

      <div className="hero-info">
        <div className="hero-name">
          {state.heroName ?? '모험가'} <span className="hero-title">{titleOf(level)}</span>
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

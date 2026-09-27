// 처치 결과를 토스트 문구로 바꾸는 순수 함수. 소리·번쩍임 같은 연출은 App 이 맡는다.
import { Achievement, unlocksAt } from './game'
import type { CompleteResult } from './store'

export function completionToast(result: CompleteResult): { text: string; duration: number } {
  const crit = result.crit ? '크리티컬! ' : ''
  const goal = result.goalBonus ? ` · 일일 목표 달성 +${result.goalBonus}G!` : ''
  const boost = result.boosted ? '포션 효과! ' : ''
  const potion = result.potionsConverted ? ' · 빨간 포션 5개 → XP 포션!' : ''
  const strike = result.strikeBonus > 0 ? `오늘의 일격 성공! +${result.strikeBonus}G ` : ''
  const raid = result.raidKilled
    ? result.chapterCleared
      ? ` · 챕터 클리어! 칭호 「${result.raidTitle}」 +${result.raidReward}G`
      : ` · 주간 보스 처치! +${result.raidReward}G`
    : ''
  const village = result.village ? ` · ${result.village}` : ''
  if (result.leveledUp) {
    const unlock = unlocksAt(result.newLevel)
      .map((u) => ` · 🔓 ${u}`)
      .join('')
    return {
      text: `${strike}LEVEL UP! Lv.${result.newLevel} (+${result.levelGold}G) ${boost}${crit}+${result.xp}XP +${result.gold}G${goal}${raid}${potion}${unlock}${village}`,
      duration: unlock ? 8000 : 5000,
    }
  }
  const combo = result.combo > 1 ? ` · x${result.combo} 콤보!` : ''
  const loot = result.lootName ? ` · 「${result.lootName}」` : ''
  return {
    text: `${strike}${boost}${crit}처치 완료! +${result.xp}XP +${result.gold}G${combo}${loot}${goal}${raid}${potion}${village}`,
    duration: 5000,
  }
}

export function achievementToast(achievements: Achievement[]): string {
  const names = achievements.map((a) => `「${a.name}」`).join(' ')
  const bonus = achievements.reduce((sum, a) => sum + a.gold, 0)
  return `업적 달성! ${names} +${bonus}G`
}

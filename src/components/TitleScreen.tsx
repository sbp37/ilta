import { useMemo, useState } from 'react'
import { Pixel } from '../Pixel'
import { Hero } from './Hero'
import { sfx } from '../sound'
import { Task, drawWeight, monsterOf } from '../game'

interface Props {
  heroName?: string
  pool: Task[]
  strikeSet: boolean
  heroPal?: Record<string, string>
  equipped?: string[]
  onStart: (name?: string) => void
  onPickStrike: (id: string) => void
}

export function TitleScreen({ heroName, pool, strikeSet, heroPal, equipped, onStart, onPickStrike }: Props) {
  const [name, setName] = useState(heroName ?? '')
  const [phase, setPhase] = useState<'title' | 'ritual'>('title')
  const needsName = !heroName

  // 아침 의식: 가중치 상위 3개를 "오늘의 일격" 후보로 제시
  const candidates = useMemo(
    () => [...pool].sort((a, b) => drawWeight(b) - drawWeight(a)).slice(0, 3),
    [pool],
  )

  const start = () => {
    if (needsName && !name.trim()) {
      sfx.deny()
      return
    }
    sfx.levelup()
    if (!strikeSet && candidates.length > 0) {
      if (needsName) onStart(name.trim()) // 이름 먼저 저장
      setPhase('ritual')
    } else {
      onStart(name.trim() || undefined)
    }
  }

  const pick = (id: string) => {
    sfx.accept()
    onPickStrike(id)
  }

  if (phase === 'ritual') {
    return (
      <div className="title-screen">
        <div className="ritual-box pixel-panel">
          <Pixel name="npc" size={3} className="bob" />
          <div className="ritual-title">오늘의 일격을 고르시오</div>
          <div className="dim ritual-sub">이 몹 하나만 잡아도 오늘은 이긴 겁니다</div>
          <div className="ritual-cards">
            {candidates.map((t) => (
              <button key={t.id} className="ritual-card" onClick={() => pick(t.id)}>
                <Pixel name={monsterOf(t)} size={3} className="bob" />
                <span>{t.title}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-ghost" onClick={() => onStart(name.trim() || undefined)}>
            안 고르고 시작
          </button>
        </div>
        <div className="scanlines" />
      </div>
    )
  }

  return (
    <div className="title-screen">
      <div className="title-logo">
        <div className="logo-sub">할 일이 퀘스트가 되는 곳</div>
        <div className="logo-main">ILTA</div>
        <div className="logo-kr">일 타</div>
      </div>

      <div className="title-scene">
        <Pixel name="mushroom" size={4} className="bob" />
        <Pixel name="skeleton" size={4} className="bob delay1" />
        <Pixel name="campfire" size={5} className="flicker" />
        <Hero size={4} className="bob delay2" palette={heroPal} equipped={equipped} />
        <Pixel name="demon" size={4} className="bob delay3" />
      </div>

      <div className="title-menu">
        {needsName && (
          <div className="name-entry">
            <div className="field-label center">용사의 이름을 알려주시오</div>
            <input
              className="text-input name-input"
              placeholder="이름 입력"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') start()
              }}
              maxLength={12}
              autoFocus
            />
          </div>
        )}
        <button className="btn btn-big btn-gold" onClick={start}>
          {needsName ? '모험 시작' : `${heroName} — 모험 계속하기`}
        </button>
        <div className="press-start blink-slow">▶ PRESS START</div>
      </div>

      <div className="title-footer dim">v0.3 — 할 일을 처치하고 세상을 밝히자</div>
    </div>
  )
}

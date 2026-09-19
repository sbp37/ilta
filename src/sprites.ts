export interface Sprite {
  palette: Record<string, string>
  rows: string[]
}

const K = '#14152b' // outline
const W = '#f4f4f4'
const Y = '#ffd23f'
const R = '#ff4d5e'
const S = '#b8c0d8'
const F = '#f2c49b'

export const SPRITES: Record<string, Sprite> = {
  // 잡몹 — 슬라임
  slime: {
    palette: { K, G: '#43d675', g: '#2aa852', B: K },
    rows: [
      '....KKKK....',
      '...KGGGGK...',
      '..KGGGGGGK..',
      '.KGGGGGGGGK.',
      '.KGBBGGBBGK.',
      '.KGGGGGGGGK.',
      '.KGGKGGKGGK.',
      '..KGGGGGGK..',
      '..KGgggGGK..',
      '..KKKKKKKK..',
    ],
  },
  // 정예 — 임프
  imp: {
    palette: { K, W, P: '#a86bff', R },
    rows: [
      'KK........KK',
      'KWK......KWK',
      '.KK......KK.',
      '..KPPPPPPK..',
      '.KPPPPPPPPK.',
      '.KPRRPPRRPK.',
      '.KPPPPPPPPK.',
      '.KPKKPPKKPK.',
      '..KPPPPPPK..',
      '..KPPPPPPK..',
      '..KKK..KKK..',
    ],
  },
  // 보스 — 데몬
  demon: {
    palette: { K, W, R, Y },
    rows: [
      '.KK........KK.',
      '.KYYK....KYYK.',
      '.KYYYK..KYYYK.',
      '..KRRRRRRRRK..',
      '.KRRRRRRRRRRK.',
      '.KRYRRRRRRYRK.',
      '.KRRRRRRRRRRK.',
      '.KRKRRRRRRKRK.',
      '.KRRRWWWWRRRK.',
      '..KRRRRRRRRK..',
      '..KRRRRRRRRK..',
      '..KKKKKKKKKK..',
    ],
  },
  // 용사 — 모험가 (갈색머리 + 파란 튜닉 + 벨트 + 부츠)
  knight: {
    palette: { K, H: '#7a4a2f', F, T: '#3d7ad8', L: '#5a5f7a', Y, B: '#5a3a22' },
    rows: [
      '.....KK.....',
      '....KHHK....',
      '...KHHHHK...',
      '..KHHHHHHK..',
      '..KFFFFFFK..',
      '..KFKFFKFK..',
      '..KFFFFFFK..',
      '...KFFFFK...',
      '..KTTTTTTK..',
      '.KTTKTTKTTK.',
      '.KFKTTTTKFK.',
      '..KYTTTTYK..',
      '..KLLK.KLLK.',
      '..KBBK.KBBK.',
    ],
  },
  // 용사 — 전사 (철 투구 + 판금 갑옷)
  knight_warrior: {
    palette: { K, S: '#9aa7bd', F, T: '#5a6f9e', Y, L: '#4a4f66', B: '#5a3a22' },
    rows: [
      '....KKKK....',
      '...KSSSSK...',
      '..KSSSSSSK..',
      '..KSKSSKSK..',
      '..KSSSSSSK..',
      '...KFFFFK...',
      '...KFKKFK...',
      '...KFFFFK...',
      '..KYTTTTYK..',
      '.KSTKTTKTSK.',
      '.KFKTTTTKFK.',
      '..KTTTTTTK..',
      '..KLLKKLLK..',
      '..KBBK.KBBK.',
    ],
  },
  // 용사 — 마법사 (뾰족 모자 + 로브 + 지팡이)
  knight_mage: {
    palette: { K, P: '#8a5ad8', F, T: '#5a4aa8', B: '#7a4a2f', Y },
    rows: [
      '.....KK.....',
      '....KPPK....',
      '...KPPPPK...',
      '..KPPPPPPK..',
      '.KKKKKKKKKK.',
      '...KFFFFK...',
      '...KFKKFK...',
      '...KFFFFK...',
      'YK..KTTK....',
      'BKTTTTTTTK..',
      'BKTTKTTKTTK.',
      'BKFKTTTTKFK.',
      'BKTTTTTTTTK.',
      'BKKKKKKKKKK.',
    ],
  },
  // 용사 — 도적 (후드 + 복면 + 단검)
  knight_rogue: {
    palette: { K, D: '#3a3f55', F, T: '#4a4f66', S, L: '#2f3346', B: '#5a3a22' },
    rows: [
      '.....KK.....',
      '....KDDK....',
      '...KDDDDK...',
      '..KDDDDDDK..',
      '..KDFKKFDK..',
      '..KDFFFFDK..',
      '..KDDDDDDK..',
      '...KTTTTK...',
      '..KTTTTTTK..',
      '.KTTKTTKTSK.',
      '.KFKTTTTKFK.',
      '..KTTTTTTK..',
      '..KLLKKLLK..',
      '..KBBK.KBBK.',
    ],
  },
  // 퀘스트 주는 NPC
  npc: {
    palette: { K, D: '#3d4a8a', F },
    rows: [
      '.....KK.....',
      '....KDDK....',
      '...KDDDDK...',
      '..KDDDDDDK..',
      '..KDDFFDDK..',
      '..KDDFFDDK..',
      '..KDDDDDDK..',
      '.KDDDDDDDDK.',
      '.KDKDDDDKDK.',
      '.KDDDDDDDDK.',
      '.KDDDDDDDDK.',
      'KDDDDDDDDDDK',
      'KDDKKDDKKDDK',
      'KKKKKKKKKKKK',
    ],
  },
  chest: {
    palette: { K, B: '#a56a3f', Y },
    rows: [
      '..KKKKKKKK..',
      '.KBBBBBBBBK.',
      'KBBBBBBBBBBK',
      'KBBBKYYKBBBK',
      'KKKKKYYKKKKK',
      'KBBBBYYBBBBK',
      'KBBBBBBBBBBK',
      'KBBBBBBBBBBK',
      'KBBBBBBBBBBK',
      '.KKKKKKKKKK.',
    ],
  },
  potion: {
    palette: { K, W, R },
    rows: ['..KKKK..', '..KWWK..', '.KWWWWK.', '.KRRRRK.', 'KRRRRRRK', 'KRRRRRRK', '.KRRRRK.', '..KKKK..'],
  },
  sword: {
    palette: { K, S },
    rows: ['.......K', '......KS', '.....KS.', '..K.KS..', '.KSKS...', 'KKS.....', '........', '........'],
  },
  shield: {
    palette: { K, S, A: Y },
    rows: ['.KKKKKK.', 'KSSSSSSK', 'KSAKKASK', 'KSSSSSSK', 'KSSSSSSK', '.KSSSSK.', '..KSSK..', '...KK...'],
  },
  gem: {
    palette: { K, W, C: '#4fd6ff' },
    rows: ['..KKKK..', '.KCWWCK.', 'KCWWWWCK', 'KCWWWWCK', '.KCWWCK.', '..KCCK..', '...KK...', '........'],
  },
  star: {
    palette: { K, Y },
    rows: ['...KK...', '..KYYK..', '.KYYYYK.', 'KYYYYYYK', '.KYYYYK.', '..KYYK..', '.KYKKYK.', 'KK....KK'],
  },
  crown: {
    palette: { K, Y },
    rows: ['K.K..K.K', 'KYKYKYK.', 'KYYYYYYK', 'KYYYYYYK', '.KYYYYK.', '..KKKK..', '........', '........'],
  },
  // ---------- 펫 ----------
  egg: {
    palette: { K, W, P: '#ff9ec4' },
    rows: ['..KKKK..', '.KWWWWK.', 'KWWPWWWK', 'KWWWWWWK', 'KWPWWWPK', '.KWWWWK.', '..KKKK..', '........'],
  },
  babyslime: {
    palette: { K, P: '#ff9ec4', B: K },
    rows: ['..KKKK..', '.KPPPPK.', 'KPPPPPPK', 'KPBBPPBK', 'KPPPPPPK', 'KPPKKPPK', '.KKKKKK.', '........'],
  },
  kingslime: {
    palette: { K, G: '#43d675', g: '#2aa852', B: K, Y },
    rows: [
      '..KYKYKYK...',
      '..KYYYYYK...',
      '..KKKKKKK...',
      '...KGGGGK...',
      '..KGGGGGGK..',
      '.KGGGGGGGGK.',
      '.KGBBGGBBGK.',
      '.KGGGGGGGGK.',
      '.KGGKGGKGGK.',
      '..KGGGGGGK..',
      '..KGgggGGK..',
      '..KKKKKKKK..',
    ],
  },
  coin: {
    palette: { K, Y, W },
    rows: ['..KKKK..', '.KYYYYK.', 'KYWYYYYK', 'KYYYYYYK', 'KYYYYYYK', 'KYWYYYK.', '.KYYYYK.', '..KKKK..'],
  },
  // ---------- 몬스터 추가 ----------
  // 잡몹 — 독버섯
  mushroom: {
    palette: { K, R, W },
    rows: [
      '...KKKKK....',
      '..KRRRRRK...',
      '.KRRWWRRRK..',
      'KRWRRRRRWRK.',
      'KRRRRRRRRRK.',
      '.KKKKKKKKK..',
      '...KWWWWK...',
      '...KWKKWK...',
      '...KWWWWK...',
      '...KKKKKK...',
    ],
  },
  // 정예 — 스켈레톤
  skeleton: {
    palette: { K, W },
    rows: [
      '..KKKKKKK...',
      '.KWWWWWWWK..',
      '.KWKKWKKWK..',
      '.KWWWWWWWK..',
      '.KWKKKKKWK..',
      '.KWKWKWKWK..',
      '..KWWWWWK...',
      '..KWWKWWK...',
      '.KWKWWKWWK..',
      '.KWWKWWKWK..',
      '.KKKKKKKKK..',
    ],
  },
  // 보스 — 드래곤
  dragon: {
    palette: { K, R, Y, W },
    rows: [
      '.KK........KK.',
      '.KYYK....KYYK.',
      '.KYYYK..KYYYK.',
      '..KRRRRRRRRK..',
      '.KRRRRRRRRRRK.',
      '.KRYRRRRRRYRK.',
      '.KRRRRRRRRRRK.',
      'KWKRRKRRKRRKWK',
      'KWWKRRRRRRKWWK',
      'KWKRRRRRRRRKWK',
      '..KRRRKKRRRK..',
      '..KRRRRRRRRK..',
      '..KKKKKKKKKK..',
    ],
  },
  // 보스 — 리치
  lich: {
    palette: { K, D: '#4a3a6a', C: '#4fd6ff' },
    rows: [
      '....KKKK....',
      '...KDDDDK...',
      '..KDDDDDDK..',
      '..KDCCKCCK..',
      '..KDDDDDDK..',
      '..KDDKKDDK..',
      '.KDDDDDDDDK.',
      '.KDDKDDKDDK.',
      '.KDDDDDDDDK.',
      'KDKDDDDDDKDK',
      'KDDDKDDKDDDK',
      'KDDKKDDKKDDK',
      'KKKKKKKKKKKK',
    ],
  },
  // ---------- 오브젝트 ----------
  campfire: {
    palette: { K, Y, O: '#ff8c3a', B: '#a56a3f' },
    rows: [
      '............',
      '.....K......',
      '....KYK.....',
      '...KYOYK....',
      '...KYOYK....',
      '..KYOOOYK...',
      '..KYYYYYK...',
      '..KKKKKKK...',
      '.KBBBBBBBK..',
      '.KKKKKKKKK..',
    ],
  },
  grass: {
    palette: { K, G: '#2a7a45' },
    rows: ['..K....K..K.', '.KGK..KGKKG.', 'KGGGKKGKGGGK', 'KKKKKKKKKKKK'],
  },
  // ---------- 몬스터 추가 2 ----------
  // 잡몹 — 유령
  ghost: {
    palette: { K, W },
    rows: [
      '..KKKKKK..',
      '.KWWWWWWK.',
      'KWWWWWWWWK',
      'KWKKWWKKWK',
      'KWWWWWWWWK',
      'KWWWKKWWWK',
      'KWWWWWWWWK',
      'KWKWKWKWK.',
      '.KKKKKKKK.',
    ],
  },
  // 잡몹 — 블루슬라임
  blueslime: {
    palette: { K, G: '#4fb8ff', g: '#2a85d8', B: K },
    rows: [
      '....KKKK....',
      '...KGGGGK...',
      '..KGGGGGGK..',
      '.KGGGGGGGGK.',
      '.KGBBGGBBGK.',
      '.KGGGGGGGGK.',
      '.KGGKGGKGGK.',
      '..KGGGGGGK..',
      '..KGgggGGK..',
      '..KKKKKKKK..',
    ],
  },
  // 정예 — 마녀
  witch: {
    palette: { K, P: '#a86bff', G: '#43d675', D: '#3d2a5a', B: K },
    rows: [
      '....KK......',
      '...KPPK.....',
      '..KPPPPK....',
      '..KPPPPPK...',
      '.KKKKKKKK...',
      '.KGGGGGGK...',
      '.KGBBGGBGK..',
      '.KGGGGGGK...',
      '.KGKGGKGK...',
      '.KGGGGGGK...',
      '.KDDDDDDK...',
      '.KKKKKKKK...',
    ],
  },
  // 보스 — 골렘
  golem: {
    palette: { K, G: '#8a8fa8', Y },
    rows: [
      '..KKKKKKKKKK..',
      '.KGGGGGGGGGGK.',
      '.KGYKGGGGKYGK.',
      '.KGGGGGGGGGGK.',
      '.KGGGGKKGGGGK.',
      'KGGGGGGGGGGGGK',
      'KGKGGGGGGGGKGK',
      'KGGGGGGGGGGGGK',
      '.KGGGGGGGGGGK.',
      '.KGKKGGGGKKGK.',
      '.KKKKK..KKKKK.',
    ],
  },
  // 보스 — 미믹
  mimic: {
    palette: { K, B: '#a56a3f', Y, W },
    rows: [
      '..KKKKKKKKKK..',
      '.KBBBBBBBBBBK.',
      'KBBKYBBBBKYBBK',
      'KBBBBBBBBBBBBK',
      'KKKKKKKKKKKKKK',
      'KWWKWWKWWKWWKK',
      'KBBBBBBBBBBBBK',
      'KBBBBBBBBBBBBK',
      '.KBBBBBBBBBBK.',
      '..KKKKKKKKKK..',
    ],
  },
  // ---------- 상점 장비 ----------
  helmet: {
    palette: { K, S },
    rows: ['..KKKK..', '.KSSSSK.', 'KSSSSSSK', 'KSKSSKSK', 'KSSSSSSK', '.KKKKKK.', '........', '........'],
  },
  wizardhat: {
    palette: { K, P: '#8a5ad8' },
    rows: ['...KK...', '..KPPK..', '..KPPK..', '.KPPPPK.', '.KPPPPK.', 'KKKKKKKK', '.KKKKKK.', '........'],
  },
  cape: {
    palette: { K, C: '#c94f6a' },
    rows: ['KKK.....', 'KCCK....', '.KCCK...', '.KCCK...', '..KCCK..', '..KCCK..', '..KCK...', '..KK....'],
  },
  amulet: {
    palette: { K, S, Y },
    rows: ['S......S', 'SS....SS', '.SS..SS.', '..KYYK..', '..KYYK..', '...KK...', '........', '........'],
  },
  boots: {
    palette: { K, B: '#5a3a22' },
    rows: ['........', '........', 'KK..KK..', 'KBK.KBK.', 'KBBKBBK.', 'KBBKBBK.', '.KK..KK.', '........'],
  },
  armor: {
    palette: { K, S, Y },
    rows: ['.KKKKKK.', 'KSSSSSSK', 'KSKSSKSK', 'KSSSSSSK', 'KSSYSSSK', '.KSSSSK.', '..KKKK..', '........'],
  },
  // 소모품 — 다시뽑기권
  ticket: {
    palette: { K, Y, W, R },
    rows: [
      'KKKKKKKKKK',
      'KYYYYYYYYK',
      'KYWWKWWKYK',
      'KYYYYYYYYK',
      'KYRRRRRRYK',
      'KYYYYYYYYK',
      'KYWWKWWKYK',
      'KYYYYYYYYK',
      'KKKKKKKKKK',
    ],
  },
  // 소모품 — 진정의 향
  incense: {
    palette: { K, W, S, P: '#a86bff', Y },
    rows: [
      '...S....',
      '..S.S...',
      '...S....',
      '..S.....',
      '...Y....',
      '...K....',
      '...K....',
      '.KPPPPK.',
      'KPPPPPPK',
      '.KKKKKK.',
    ],
  },
  // 잡몹 — 박쥐 (기타 카테고리)
  bat: {
    palette: { K, P: '#6b5ba8', W },
    rows: [
      '..K......K..',
      '.KPK....KPK.',
      'KPPPK..KPPPK',
      'KPPPPKKPPPPK',
      'KPPWPPPPWPPK',
      '.KPPPPPPPPK.',
      '..KPPPPPPK..',
      '...KPPPPK...',
      '....KKKK....',
    ],
  },
  // 정예 — 오거 (건강 카테고리)
  ogre: {
    palette: { K, W, G: '#7a9e4a', g: '#5c7a36' },
    rows: [
      '..KKKKKKKK..',
      '.KGGGGGGGGK.',
      'KGGGGGGGGGGK',
      'KGGWKGGKWGGK',
      'KGGGGGGGGGGK',
      'KGGKWWWWKGGK',
      '.KGGGGGGGGK.',
      '..KGGGGGGK..',
      '.KgGGGGGGgK.',
      '.KgKGGGGKgK.',
      '..KKKKKKKK..',
    ],
  },
  // 정예 — 가고일 (기타 카테고리)
  gargoyle: {
    palette: { K, R, S, s: '#5f6478' },
    rows: [
      '.K........K.',
      '.KSK....KSK.',
      '.KSSK..KSSK.',
      '..KSSKKSSK..',
      '...KSSSSK...',
      '..KSRSSRSK..',
      '..KSSSSSSK..',
      '..KSKKKKSK..',
      '...KSSSSK...',
      '...KsKKsK...',
      '....KKKK....',
    ],
  },
}

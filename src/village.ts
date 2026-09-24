import type { Category, DoneQuest, GameState, Task } from './game'

export const RESIDENTS = [
  {
    id: 'librarian',
    name: '모아',
    role: '졸린 사서',
    place: '별빛 서재',
    color: '#b49be8',
    requests: [
      '하암… 오늘은 어느 페이지부터 펼쳐볼까?',
      '한 줄씩 읽다 보면 이야기가 쌓일 거야.',
      '조용한 자리를 비워 뒀어. 천천히 해도 돼.',
    ],
    thanks: '네 덕분에 서재에 이야기가 하나 더 생겼어.',
    greetings: [
      '아직 책장은 없지만, 읽을 자리는 있어.',
      '작은 책장에 첫 이야기를 꽂아 뒀어.',
      '찾는 책이 있으면 불러 줘. 안 자고 있을게… 아마.',
      '창가 자리엔 늘 네 몫의 책갈피가 있어.',
    ],
  },
  {
    id: 'smith',
    name: '두리',
    role: '무뚝뚝한 대장장이',
    place: '두리 공방',
    color: '#d68f68',
    requests: [
      '한 번에 다 벼릴 필요 없어. 한 번만 두드려 보자.',
      '오늘 손볼 일인가? 작업대는 준비됐어.',
      '완벽하지 않아도 돼. 먼저 모양부터 잡자.',
    ],
    thanks: '좋아. 네가 보탠 만큼 공방도 단단해졌어.',
    greetings: [
      '도구는 챙겨 왔어. 시작은 여기서 하지.',
      '작아도 비는 안 새. 제법 쓸 만한 공방이야.',
      '작업대가 넓어졌어. 네가 보탠 덕이지.',
      '문 옆 꽃? …네가 오면 좋을 것 같아서.',
    ],
  },
  {
    id: 'herbalist',
    name: '초롱',
    role: '씩씩한 약초사',
    place: '초롱 약초원',
    color: '#78cc89',
    requests: [
      '오늘 몸은 어때? 무리하지 말고 조금만 움직이자.',
      '숨 한 번 고르고, 네 속도로 가 보자!',
      '건강한 모험엔 쉬어 가는 시간도 필요해.',
    ],
    thanks: '잘했어! 약초원에도 싱그러운 기운이 도네.',
    greetings: [
      '햇볕 좋은 땅을 찾아뒀어!',
      '첫 화분이 자리를 잡았어. 같이 돌봐 주자.',
      '차 한 잔 마시고 가! 오늘 딴 잎이야.',
      '꽃이 활짝 폈어. 쉬었다 가기 딱 좋은 날이네.',
    ],
  },
  {
    id: 'innkeeper',
    name: '보리',
    role: '푸근한 여관 주인',
    place: '보리 여관',
    color: '#e7bd52',
    requests: [
      '한 귀퉁이만 정리해도 한결 편안해질 거야.',
      '돌아와 쉴 자리를 함께 가꿔 볼까?',
      '소소한 살림도 어엿한 모험이지. 부탁할게.',
    ],
    thanks: '고마워. 덕분에 좀 더 포근해졌구나.',
    greetings: [
      '따뜻한 차는 있어. 잠깐 앉았다 가렴.',
      '작은 지붕이 생겼어. 편히 쉬었다 가.',
      '새 손님이 와도 이제 자리가 넉넉하겠구나.',
      '네가 언제 돌아와도 따뜻한 자리는 남겨 둘게.',
    ],
  },
  {
    id: 'bard',
    name: '라라',
    role: '떠돌이 음유시인',
    place: '라라 작은 극장',
    color: '#df8fbd',
    requests: [
      '서툰 첫 소절도 좋아. 네 이야기를 들려줘!',
      '정답은 없어. 오늘 떠오른 것부터 남겨 볼까?',
      '조금 삐뚤어져도 그게 네 멋이지. 시작해 보자.',
    ],
    thanks: '이건 네가 만든 이야기야. 마을에 남겨 둘게!',
    greetings: [
      '무대는 없어도 노래는 시작할 수 있지!',
      '비를 피하며 노래할 자리가 생겼어!',
      '오늘 공연의 주인공은 너야. 앞자리를 비워둘게.',
      '커튼도 꽃도 준비됐어. 네 다음 이야기가 궁금해.',
    ],
  },
  {
    id: 'courier',
    name: '루루',
    role: '호기심 많은 우편배달부',
    place: '루루 우체국',
    color: '#70b9df',
    requests: [
      '작은 부탁 하나 도착! 어디부터 해볼까?',
      '이 일의 다음 이야기는 뭘까? 같이 가 보자.',
      '급행일 필요는 없어. 한 걸음씩 배달하자.',
    ],
    thanks: '완료 소식 잘 받았어! 마을에도 전해 둘게.',
    greetings: [
      '여기가 우리 첫 번째 주소야!',
      '이제 편지를 둘 작은 지붕이 생겼어.',
      '온 마을 소식이 여기 모여. 네 이야기도!',
      '오랜만이어도 반가워! 네 우편함은 늘 여기 있어.',
    ],
  },
] as const

export type Resident = (typeof RESIDENTS)[number]
export type ResidentId = Resident['id']
const CATEGORY_RESIDENT: Record<Exclude<Category, 'etc'>, ResidentId> = {
  study: 'librarian',
  work: 'smith',
  health: 'herbalist',
  home: 'innkeeper',
}
const TITLE_RULES: [ResidentId, RegExp][] = [
  ['innkeeper', /청소|정리|빨래|설거지|세탁|분리수거|장보기|요리|집안|\b(clean|laundry|dishes|tidy)\b/i],
  ['librarian', /공부|독서|시험|과제|복습|예습|강의|수업|문제집|책\s*읽|\b(study|read|exam|homework)\b/i],
  [
    'herbalist',
    /운동|산책|걷기|달리기|러닝|스트레칭|헬스|요가|병원|약\s*먹|물\s*마|\b(workout|walk|run|yoga)\b/i,
  ],
  [
    'bard',
    /그림|드로잉|글쓰기|소설|작곡|악기|기타\s*연습|피아노|노래|취미|뜨개|사진|\b(draw|paint|music|guitar|creative)\b/i,
  ],
  [
    'smith',
    /업무|보고서|회의|개발|코딩|코드|배포|출근|기획|메일|이메일|\b(work|report|meeting|code|deploy|email)\b/i,
  ],
]

// Explicit categories win; unspecified/miscellaneous tasks get a local, deterministic match.
export function residentFor(task: Pick<Task, 'title' | 'category'>): Resident {
  const id =
    task.category && task.category !== 'etc'
      ? CATEGORY_RESIDENT[task.category]
      : (TITLE_RULES.find(([, pattern]) => pattern.test(task.title))?.[0] ?? 'courier')
  return RESIDENTS.find((r) => r.id === id) ?? RESIDENTS[5]
}

export function requestLine(task: Pick<Task, 'id' | 'title' | 'category'>): string {
  const resident = residentFor(task)
  const hash = Array.from(task.id).reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0)
  return resident.requests[hash % resident.requests.length]
}

export const VILLAGE_STAGES = [0, 1, 5, 15] as const
export const STAGE_NAMES = ['첫 캠프', '작은 보금자리', '문을 연 가게', '꽃 핀 거리'] as const
export function growthStage(count: number): number {
  return VILLAGE_STAGES.filter((threshold) => count >= threshold).length - 1
}

// Derived from retained completion history: reload, import and undo share the same source of truth.
export function villageOf(state: Pick<GameState, 'done' | 'raidKills'>) {
  const counts = Object.fromEntries(RESIDENTS.map((r) => [r.id, 0])) as Record<ResidentId, number>
  for (const task of state.done) counts[residentFor(task).id]++
  return {
    total: state.done.length,
    trophies: Math.max(0, Math.floor(state.raidKills ?? 0)),
    places: RESIDENTS.map((resident) => ({
      resident,
      count: counts[resident.id],
      stage: growthStage(counts[resident.id]),
    })),
  }
}

export function villageCompletion(done: DoneQuest[], task: Task): string {
  const resident = residentFor(task)
  const count = done.filter((d) => residentFor(d).id === resident.id).length
  return growthStage(count + 1) > growthStage(count)
    ? `${resident.place} · ${STAGE_NAMES[growthStage(count + 1)]}!`
    : `${resident.name}의 의뢰 완료`
}

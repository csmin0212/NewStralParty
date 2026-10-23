import type { BossDef } from '../engine/types';

// 보스 = 블루 아카이브 총력전 보스. 판 위의 규칙은 100% OJ 코옵 보스(행동 카드 공개 → 라운드 끝 보스 차례)와
// 아스트랄 파티 PVE(정예 · 도둑 · 진행도)를 따른다. 원작 스킬 이름을 그대로 쓰고, 효과는 보드 게임에 맞게 옮겼다.
// 조사: docs/BOSSES.md

/** 기믹만 있는 처음 보스 (행동 카드 없음). 테스트와 연습용 */
export const PLACEHOLDER_BOSS: BossDef = {
  id: 'practice',
  stars: 1,
  name: '연습용 보스',
  icon: '👑',
  summary: '보스 차례 없음',
  hpPerPlayer: 20,
  atk: 3,
  def: 1,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['robot', 'robot', 'drone', 'delinquent'] }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    {
      at: 6,
      actions: [
        { type: 'summon', enemies: ['robot', 'drone', 'delinquent'] },
        { type: 'buffEnemies', atk: 1, def: 1 },
      ],
    },
    {
      at: 9,
      actions: [
        { type: 'summon', enemies: ['drone', 'delinquent', 'delinquent'] },
        { type: 'buffEnemies', atk: 1, def: 1 },
      ],
    },
  ],
};

const BINAH: BossDef = {
  id: 'binah',
  map: 'abydos',
  stars: 2,
  name: '비나',
  title: '데카그라마톤',
  icon: '🐍',
  summary: '직선 광선 · 근거리 화염 · 50%에서 잠행 → 밀집 지점 습격',
  ref: '블루 아카이브 총력전 비나: 아츠일트의 빛 · 대도의 겁화 · 정화의 폭풍 · 60%에서 잠행',
  hpPerPlayer: 24,
  atk: 3,
  def: 1,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['drone', 'drone', 'robot'] }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    { at: 6, actions: [{ type: 'summon', enemies: ['drone', 'robot', 'thief'] }] },
    { at: 9, actions: [{ type: 'summon', enemies: ['drone', 'elite'] }, { type: 'buffEnemies', atk: 1, def: 0 }] },
    { at: 12, actions: [{ type: 'summon', enemies: ['robot', 'robot'] }] },
  ],
  deckOrder: 'cycle',
  deck: ['atsilut', 'fires', 'atsilut', 'storm'],
  moves: {
    atsilut: {
      name: '아츠일트의 빛',
      text: '앞쪽 5칸 직선 2 피해',
      effects: [{ type: 'damage', target: 'line', range: 5, amount: 2 }],
    },
    fires: {
      name: '대도의 겁화',
      text: '가까운 순서로 3 · 2 · 1 피해',
      effects: [{ type: 'damageRanked', amounts: [3, 2, 1] }],
    },
    storm: {
      name: '정화의 폭풍',
      text: '모든 아군 1 피해 · 방어 -1 (2턴)',
      breakAt: 15,
      effects: [
        { type: 'damage', target: 'all', amount: 1 },
        { type: 'debuff', target: 'all', status: 'defDown', amount: 1, turns: 2 },
      ],
    },
    burrow: {
      name: '잠행',
      text: '땅속으로 사라진다. 다음 라운드 동안 공격받지 않는다',
      effects: [{ type: 'hide', then: 'emerge' }],
    },
    emerge: {
      name: '사막의 습격',
      text: '아군이 모인 곳에서 솟아오른다: 주변 1칸 3 피해',
      effects: [{ type: 'warp', where: 'crowd', amount: 3, range: 1 }],
    },
  },
  phase2: {
    at: 0.5,
    name: '비나 (잠행)',
    icon: '🐍',
    atk: 3,
    def: 1,
    deck: ['fires', 'burrow', 'atsilut', 'storm'],
    enter: [{ type: 'hide', then: 'emerge' }],
  },
};

const CHESED: BossDef = {
  id: 'chesed',
  map: 'factory',
  stars: 1,
  name: '케세드',
  title: '데카그라마톤',
  icon: '👑',
  summary: '오토마타 수만큼 게이지 · 전멸시키면 코어 노출',
  ref: '블루 아카이브 총력전 케세드: 왕좌로의 부름 · 병사 수만큼 게이지 · 왕의 자비 · 웨이브를 넘기면 코어 노출',
  hpPerPlayer: 20,
  atk: 2,
  def: 2,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['robot', 'robot', 'drone'] }] },
    { at: 2, actions: [{ type: 'bossAppear' }] },
    { at: 7, actions: [{ type: 'buffEnemies', atk: 1, def: 0 }] },
    { at: 10, actions: [{ type: 'summon', enemies: ['delinquent', 'drone'] }] },
  ],
  passive: { gauge: { max: 6, perMinion: 'automaton', release: 'mercy' } },
  deckOrder: 'cycle',
  deck: ['call', 'shell', 'barrage', 'call', 'witness'],
  moves: {
    call: {
      name: '왕좌로의 부름',
      text: '오토마타 병사 3 소환 (3차례 뒤 자폭)',
      effects: [{ type: 'summon', enemies: ['automaton', 'automaton', 'automaton'], near: 'boss' }],
    },
    shell: {
      name: '포격',
      text: '체력이 가장 높은 아군 3 피해',
      effects: [{ type: 'damage', target: 'highestHp', amount: 3 }],
    },
    barrage: {
      name: '일제 사격',
      text: '모든 아군 1 피해',
      effects: [{ type: 'damage', target: 'all', amount: 1 }],
    },
    witness: {
      name: '지고의 권능을 보라',
      text: '모든 에너미 공격 +1',
      effects: [{ type: 'buffEnemies', atk: 1, def: 0 }],
    },
    mercy: {
      name: '왕은 자비를 베푼다',
      text: '게이지가 가득 찼다: 모든 아군 3 피해',
      breakAt: 18,
      effects: [{ type: 'damage', target: 'all', amount: 3 }],
    },
  },
};

const SHIROKURO: BossDef = {
  id: 'shirokuro',
  map: 'slumpia-park',
  stars: 2,
  name: '시로',
  title: '슬럼피아',
  icon: '💣',
  summary: '시한폭탄 (멈추면 해체) · 50%에서 쿠로: 돌진 · 밀어내기',
  ref: '블루 아카이브 총력전 시로&쿠로: 도카앙!! · 굴러라 굴러라 · 쿠로 돌진 · 무기력 증후군',
  hpPerPlayer: 24,
  atk: 2,
  def: 1,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['slumpia', 'slumpia', 'drone'] }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    { at: 7, actions: [{ type: 'summon', enemies: ['slumpia', 'slumpia', 'thief'] }] },
    { at: 10, actions: [{ type: 'buffEnemies', atk: 1, def: 0 }] },
  ],
  deckOrder: 'cycle',
  deck: ['dundun', 'roll', 'dundun', 'toss'],
  moves: {
    dundun: {
      name: '도카앙!!',
      text: '폭탄 3개 설치: 다음 보스 차례에 주변 1칸 3 피해. 폭탄 칸에 멈추면 해체 (코인 +2)',
      effects: [{ type: 'marks', kind: 'bomb', count: 3, near: 'players' }],
    },
    roll: {
      name: '굴러라 굴러라',
      text: '앞쪽 6칸 직선 3 피해',
      effects: [{ type: 'damage', target: 'line', range: 6, amount: 3 }],
    },
    toss: {
      name: '깜짝 폭탄',
      text: '아무 아군 2명 2 피해',
      effects: [{ type: 'damage', target: 'random', count: 2, amount: 2 }],
    },
    rush: {
      name: '돌진이다!!!',
      text: '가까운 아군에게 6칸 돌진: 지나간 아군 3 피해 · 2칸 밀어냄',
      effects: [{ type: 'charge', steps: 6, amount: 3, push: 2 }],
    },
    lethargy: {
      name: '무기력 증후군',
      text: '모든 아군 1 피해 · 다음 이동 -2',
      effects: [
        { type: 'damage', target: 'all', amount: 1 },
        { type: 'debuff', target: 'all', status: 'slow', amount: 2 },
      ],
    },
    teacup: {
      name: '찻잔 행렬',
      text: '폭탄 2개 설치 · 앞쪽 4칸 직선 2 피해',
      effects: [
        { type: 'marks', kind: 'bomb', count: 2, near: 'players' },
        { type: 'damage', target: 'line', range: 4, amount: 2 },
      ],
    },
  },
  phase2: {
    at: 0.5,
    name: '쿠로',
    icon: '🖤',
    atk: 3,
    def: 1,
    deck: ['rush', 'lethargy', 'rush', 'teacup'],
    enter: [{ type: 'summon', enemies: ['slumpia', 'slumpia'], near: 'boss' }],
  },
};

const HIERONYMUS: BossDef = {
  id: 'hieronymus',
  map: 'cathedral',
  stars: 2,
  name: '히에로니무스',
  title: '코무니오 상크토룸',
  icon: '⛪',
  summary: '높은 방어 · 초록 성유물 받는 피해 +1 · 빨강 성유물 행동 저지 · 저주',
  ref: '블루 아카이브 총력전 히에로니무스: 성유물 · 불가타의 성서(저주, 체력을 채우면 해제) · 사막의 고행',
  hpPerPlayer: 24,
  atk: 3,
  def: 3,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['robot', 'drone', 'delinquent'] }] },
    { at: 2, actions: [{ type: 'move', move: 'relics' }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    { at: 9, actions: [{ type: 'summon', enemies: ['elite', 'drone'] }] },
  ],
  deckOrder: 'cycle',
  deck: ['damasus', 'vulgate', 'relics', 'reaper', 'penance'],
  moves: {
    damasus: {
      name: '다마수스의 초청',
      text: '보스 2칸 안 3 피해',
      effects: [{ type: 'damage', target: 'near', range: 2, amount: 3 }],
    },
    vulgate: {
      name: '불가타의 성서',
      text: '체력이 가장 낮은 아군에게 저주: 다음 보스 차례에 주변 1칸 3 피해. 그때 체력이 가득 차 있으면 풀린다',
      effects: [{ type: 'debuff', target: 'lowestHp', status: 'curse' }],
    },
    relics: {
      name: '성유물',
      text: '초록 성유물 2 · 빨강 성유물 1',
      effects: [
        { type: 'marks', kind: 'relicGreen', count: 2, near: 'players' },
        { type: 'marks', kind: 'relicRed', count: 1, near: 'players' },
      ],
    },
    reaper: {
      name: '사자의 구원',
      text: '모든 아군 1 피해',
      effects: [{ type: 'damage', target: 'all', amount: 1 }],
    },
    penance: {
      name: '사막의 고행',
      text: '모든 아군 3 피해',
      breakAt: 18,
      effects: [{ type: 'damage', target: 'all', amount: 3 }],
    },
  },
};

const KAITEN: BossDef = {
  id: 'kaiten',
  map: 'arena',
  stars: 2,
  name: '카이텐 FX Mk.0',
  title: '카이텐저',
  icon: '🤖',
  summary: '카이텐저 5 전멸 → 등장 · 부위 순환 · 부위 파괴',
  ref: '블루 아카이브 총력전 KAITEN FX Mk.0: 1페이즈 카이텐저 5인 · 오른팔(분홍) · 가슴(빨강) · 왼팔(초록) 순환과 부위 파괴',
  hpPerPlayer: 20,
  atk: 2,
  def: 1,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['kaitenger', 'kaitenger', 'kaitenger', 'kaitenger', 'kaitenger'] }] },
    { at: 6, actions: [{ type: 'bossAppear' }] },
    { at: 9, actions: [{ type: 'summon', enemies: ['robot', 'robot', 'drone'] }] },
    { at: 12, actions: [{ type: 'buffEnemies', atk: 1, def: 0 }] },
  ],
  passive: {
    appearWhenCleared: 'kaitenger',
    parts: [
      { id: 'pink', name: '오른팔', text: '공격력 +2', breakAt: 12 },
      { id: 'red', name: '가슴', text: '보스에게 맞은 아군은 기절', breakAt: 12 },
      { id: 'green', name: '왼팔', text: '받는 피해 절반', breakAt: 15 },
    ],
  },
  deckOrder: 'cycle',
  deck: ['shrimp', 'sardine', 'spin', 'mackerel'],
  moves: {
    shrimp: {
      name: '무한회전 · 슈퍼 새우 머신건',
      text: '보스 2칸 안 2 피해',
      effects: [{ type: 'damage', target: 'near', range: 2, amount: 2 }],
    },
    sardine: {
      name: '무한회전 · 하이퍼 정어리 미사일',
      text: '모든 아군 1 피해',
      effects: [{ type: 'damage', target: 'all', amount: 1 }],
    },
    spin: {
      name: '무한회전 · 돌진',
      text: '가까운 아군에게 4칸 돌진: 지나간 아군 2 피해',
      effects: [{ type: 'charge', steps: 4, amount: 2 }],
    },
    mackerel: {
      name: '무한회전 · 파이널 고등어 슬래시',
      text: '모든 아군 3 피해',
      breakAt: 15,
      effects: [{ type: 'damage', target: 'all', amount: 3 }],
    },
  },
};

const PERORODZILLA: BossDef = {
  id: 'perorodzilla',
  map: 'library',
  stars: 1,
  name: '페로로지라',
  title: '도서관의 전승',
  icon: '🦖',
  summary: '미니언 피해 공유 · 흡수 회복 · 2마리 이상 쓰러지면 그로기',
  ref: '블루 아카이브 총력전 페로로지라: 미니언 피해 반사 · 미니언 흡수와 그로기 · 백열 안광(방어 -9999) · 거품',
  hpPerPlayer: 27,
  atk: 3,
  def: 2,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['drone', 'robot', 'thief'] }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    { at: 8, actions: [{ type: 'summon', enemies: ['delinquent', 'drone'] }] },
    { at: 11, actions: [{ type: 'buffEnemies', atk: 1, def: 1 }] },
  ],
  deckOrder: 'cycle',
  deck: ['minions', 'eye', 'bubble', 'absorb', 'beam'],
  moves: {
    minions: {
      name: '페로로 미니언 소환',
      text: '미니언을 인원수만큼 소환: 미니언이 받은 피해는 보스도 받는다',
      effects: [{ type: 'summon', enemies: ['perorominion'], near: 'boss', perPlayer: true }],
    },
    eye: {
      name: '백열 안광',
      text: '가장 가까운 아군 1 피해 · 방어 0 (2턴)',
      effects: [
        { type: 'damage', target: 'closest', amount: 1 },
        { type: 'debuff', target: 'closest', status: 'defDown', amount: 9, turns: 2 },
      ],
    },
    bubble: {
      name: '거품',
      text: '체력이 가장 높은 아군 2명 3 피해',
      effects: [{ type: 'damage', target: 'highestHp', count: 2, amount: 3 }],
    },
    absorb: {
      name: '미니언 흡수',
      text: '남은 미니언 1마리당 체력 +10. 그 사이 미니언이 2마리 이상 쓰러졌으면 그로기',
      effects: [{ type: 'absorb', kind: 'perorominion', heal: 10 }],
    },
    beam: {
      name: '하이퍼 스파이럴 열시선',
      text: '모든 아군 2 피해',
      breakAt: 18,
      effects: [{ type: 'damage', target: 'all', amount: 2 }],
    },
  },
};

const HOD: BossDef = {
  id: 'hod',
  map: 'datatower',
  stars: 2,
  name: '호드',
  title: '데카그라마톤',
  icon: '📡',
  summary: '필러: 보스 방어 +1 · 주변 코인 -2 · 광채마다 공격 +1',
  ref: '블루 아카이브 총력전 호드: 인베이드 필러(침식 영역) · 디스트럭션 Type I · II · 영광의 광채(공격력 누적) · 에너지 과부하',
  hpPerPlayer: 24,
  atk: 3,
  def: 1,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['robot', 'drone'] }] },
    { at: 2, actions: [{ type: 'bossAppear' }] },
    { at: 6, actions: [{ type: 'summon', enemies: ['robot', 'robot', 'drone'] }] },
    { at: 10, actions: [{ type: 'summon', enemies: ['delinquent', 'thief'] }] },
  ],
  passive: { guard: { kind: 'pillar', def: 1 }, drain: { kind: 'pillar', range: 2, amount: 2 } },
  deckOrder: 'cycle',
  deck: ['pillar', 'destruction1', 'radiance', 'destruction2', 'overload'],
  moves: {
    pillar: {
      name: '인베이드 필러 생성',
      text: '필러 2 소환: 1개마다 보스 방어 +1, 2칸 안 아군 코인 -2',
      effects: [{ type: 'summon', enemies: ['pillar', 'pillar'], near: 'players' }],
    },
    destruction1: {
      name: '디스트럭션 Type I',
      text: '보스 2칸 안 3 피해',
      effects: [{ type: 'damage', target: 'near', range: 2, amount: 3 }],
    },
    destruction2: {
      name: '디스트럭션 Type II',
      text: '앞쪽 5칸 직선 2 피해',
      effects: [{ type: 'damage', target: 'line', range: 5, amount: 2 }],
    },
    radiance: {
      name: '영광의 광채',
      text: '모든 아군 1 피해 · 호드 공격력 +1 (계속 쌓인다)',
      effects: [
        { type: 'damage', target: 'all', amount: 1 },
        { type: 'buffSelf', atk: 1 },
      ],
    },
    overload: {
      name: '에너지 과부하',
      text: '모든 아군 2 피해',
      breakAt: 12,
      effects: [{ type: 'damage', target: 'all', amount: 2 }],
    },
  },
};

const GOZ: BossDef = {
  id: 'goz',
  map: 'circus',
  stars: 1,
  name: '고즈',
  title: '슬럼피아',
  icon: '🎩',
  summary: '분신 2 (다음 라운드 폭발) · 코인 모자',
  ref: '블루 아카이브 총력전 고즈: 나우 유 씨 어스(분신) · 쓰리 라이트 몬테(분신 폭발) · 매지컬 코인 햇 · 스크림 라이더',
  hpPerPlayer: 27,
  atk: 2,
  def: 1,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['slumpia', 'slumpia', 'thief'] }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    { at: 7, actions: [{ type: 'summon', enemies: ['slumpia', 'slumpia', 'thief'] }] },
    { at: 10, actions: [{ type: 'buffEnemies', atk: 1, def: 0 }] },
  ],
  deckOrder: 'cycle',
  deck: ['vanish', 'monte', 'hats', 'present', 'scream'],
  moves: {
    vanish: {
      name: '나우 유 씨 어스',
      text: '사라졌다가 분신 2과 함께 다른 칸에 나타난다. 분신은 공격받으면 사라진다',
      effects: [{ type: 'clones', count: 2 }],
    },
    monte: {
      name: '쓰리 라이트 몬테',
      text: '남은 분신이 터진다: 주변 1칸 3 피해',
      effects: [{ type: 'detonate', kind: 'gozClone', amount: 3, range: 1 }],
    },
    hats: {
      name: '매지컬 코인 햇',
      text: '모자 3개: 코인이 든 모자에 멈추면 코인 +6, 빈 모자는 2 피해. 다음 보스 차례에 남은 빈 모자는 터진다',
      effects: [{ type: 'marks', kind: 'hat', count: 3, near: 'players' }],
    },
    present: {
      name: '서프라이즈 프레젠트',
      text: '코인이 가장 많은 아군 4 피해',
      effects: [{ type: 'damage', target: 'richest', amount: 4 }],
    },
    scream: {
      name: '스크림 라이더',
      text: '앞쪽 6칸 직선 2 피해 · 슬럼피아 병사 2 소환',
      effects: [
        { type: 'damage', target: 'line', range: 6, amount: 2 },
        { type: 'summon', enemies: ['slumpia', 'slumpia'], near: 'players' },
      ],
    },
  },
};

const WAKAMO: BossDef = {
  id: 'wakamo',
  map: 'resort',
  stars: 1,
  name: '와카모 (수영복)',
  title: '재앙의 여우',
  icon: '🦊',
  summary: '50%에서 호버크래프트 · 미사일 장치가 있으면 리조트 -1, 0이면 패배',
  ref: '블루 아카이브 총력전 와카모: 셀라돈 꽃점 · 초조한 산탄 · 호버크래프트 미사일 프렌지(리조트 6, 무너지면 패배)',
  hpPerPlayer: 27,
  atk: 3,
  def: 1,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['drone', 'drone', 'robot'] }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    { at: 7, actions: [{ type: 'summon', enemies: ['drone', 'delinquent'] }] },
    { at: 10, actions: [{ type: 'buffEnemies', atk: 1, def: 0 }] },
  ],
  passive: { resort: { hp: 6, kind: 'missile' } },
  deckOrder: 'cycle',
  deck: ['divination', 'buckshot', 'explosive'],
  moves: {
    divination: {
      name: '셀라돈 꽃점',
      text: '가장 먼 아군 3 피해 · 기절',
      effects: [
        { type: 'damage', target: 'farthest', amount: 3 },
        { type: 'debuff', target: 'farthest', status: 'stun' },
      ],
    },
    buckshot: {
      name: '초조한 산탄',
      text: '앞쪽 5칸 직선 3 피해',
      effects: [{ type: 'damage', target: 'line', range: 5, amount: 3 }],
    },
    explosive: {
      name: '사로잡는 유탄',
      text: '가까운 아군 2명 2 피해',
      effects: [{ type: 'damage', target: 'closest', count: 2, amount: 2 }],
    },
    twin: {
      name: '트윈 캐논',
      text: '아무 아군 2명 2 피해',
      effects: [{ type: 'damage', target: 'random', count: 2, amount: 2 }],
    },
    frenzy: {
      name: '이렇게 된 이상……!',
      text: '미사일 유도 장치 소환: 있는 동안 보스 차례마다 리조트 -1. 장치가 받은 피해는 보스도 받는다',
      effects: [{ type: 'summon', enemies: ['missile'], near: 'boss' }],
    },
    blaze: {
      name: '블레이즈 로켓',
      text: '체력이 가장 높은 아군 3 피해',
      effects: [{ type: 'damage', target: 'highestHp', amount: 3 }],
    },
  },
  phase2: {
    at: 0.5,
    name: '와카모 (호버크래프트)',
    icon: '🚤',
    atk: 3,
    def: 2,
    deck: ['twin', 'blaze', 'frenzy'],
    enter: [{ type: 'summon', enemies: ['missile'], near: 'boss' }],
  },
};

const KUROKAGE: BossDef = {
  id: 'kurokage',
  map: 'ghost-alley',
  stars: 2,
  name: '묘귀 쿠로카게',
  title: '백귀야행',
  icon: '🐈‍⬛',
  summary: '조각 피해 공유 · 화신 추격 자폭 · 위압 (회복으로 해제)',
  ref: '블루 아카이브 총력전 쿠로카게: 묘귀의 조각(피해 공유) · 화신 자폭 · 묘귀 야행(돌진 · 밀어냄) · 위압(회복으로 해제)',
  hpPerPlayer: 31,
  atk: 3,
  def: 1,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['drone', 'robot', 'thief'] }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    { at: 8, actions: [{ type: 'summon', enemies: ['delinquent', 'drone'] }] },
    { at: 11, actions: [{ type: 'buffEnemies', atk: 1, def: 0 }] },
  ],
  deckOrder: 'cycle',
  deck: ['pieces', 'procession', 'shriek', 'legends', 'aftershock'],
  moves: {
    pieces: {
      name: '묘귀의 조각',
      text: '조각을 인원수만큼 소환: 조각이 받은 피해는 보스도 받는다',
      effects: [{ type: 'summon', enemies: ['myoukiPiece'], near: 'boss', perPlayer: true }],
    },
    procession: {
      name: '질주하는 묘귀 야행',
      text: '가까운 아군에게 6칸 돌진: 지나간 아군 3 피해 · 2칸 밀어냄',
      effects: [{ type: 'charge', steps: 6, amount: 3, push: 2 }],
    },
    shriek: {
      name: '화신을 부르는 귀곡',
      text: '화신 2 소환: 가까운 아군을 쫓다가 2차례 뒤 자폭 (주변 1칸 3 피해)',
      effects: [{ type: 'summon', enemies: ['incarnation', 'incarnation'], near: 'players' }],
    },
    legends: {
      name: '퍼지는 가두괴담',
      text: '모든 아군 1 피해 · 위압 (차례마다 체력 -1, 회복하면 풀린다)',
      effects: [
        { type: 'damage', target: 'all', amount: 1 },
        { type: 'debuff', target: 'all', status: 'erode' },
      ],
    },
    aftershock: {
      name: '묘귀의 여진',
      text: '보스 3칸 안 3 피해',
      breakAt: 18,
      effects: [{ type: 'damage', target: 'near', range: 3, amount: 3 }],
    },
  },
};

const GREGORIUS: BossDef = {
  id: 'gregorius',
  map: 'undercroft',
  stars: 3,
  name: '그레고리오',
  title: '코무니오 상크토룸',
  icon: '🎹',
  summary: '성가: 오르간 방향 치유 · 성가 뒤 보스 쪽으로',
  ref: '블루 아카이브 총력전 그레고리오: 파이프 오르간 방향에 따라 바뀌는 그레고리오 성가 · 성자의 속삭임(공격 -40%) · 엄숙한 회개(정화)',
  hpPerPlayer: 24,
  atk: 2,
  def: 2,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['robot', 'delinquent', 'drone'] }] },
    { at: 2, actions: [{ type: 'move', move: 'organ' }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    { at: 7, actions: [{ type: 'summon', enemies: ['elite', 'drone'] }] },
    { at: 10, actions: [{ type: 'buffEnemies', atk: 1, def: 1 }] },
  ],
  passive: { organ: true },
  deckOrder: 'cycle',
  deck: ['chant', 'whispers', 'repentance'],
  moves: {
    organ: {
      name: '파이프 오르간',
      text: '오르간이 나타난다. 멈추면 성가가 아군 쪽으로',
      effects: [{ type: 'marks', kind: 'organ', count: 1, near: 'boss' }],
    },
    chant: {
      name: '그레고리오 성가',
      text: '오르간이 보스 쪽이면 보스 체력 +10, 아군 쪽이면 모든 아군 체력 +3',
      effects: [{ type: 'chant' }],
    },
    whispers: {
      name: '성자의 속삭임',
      text: '모든 아군 1 피해 · 공격 -1 (2턴)',
      effects: [
        { type: 'damage', target: 'all', amount: 1 },
        { type: 'debuff', target: 'all', status: 'atkDown', amount: 1, turns: 2 },
      ],
    },
    repentance: {
      name: '엄숙한 회개',
      text: '아군의 강화 효과를 지운다 · 모든 아군 1 피해',
      effects: [{ type: 'cleanse' }, { type: 'damage', target: 'all', amount: 1 }],
    },
  },
};

const GEBURAH: BossDef = {
  id: 'geburah',
  map: 'snowfield',
  stars: 3,
  name: '게부라',
  title: '데카그라마톤',
  icon: '❄️',
  summary: '난로 유지 · 꺼지면 저체온 · 보스 방어 +2',
  ref: '블루 아카이브 총력전 게부라: 회복해야 하는 난로 · 저체온 게이지 · 진리로의 길 · 불 속 물 밑',
  hpPerPlayer: 20,
  atk: 3,
  def: 2,
  counter: true,
  defense: 'block',
  defeatAt: 28,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['robot', 'robot', 'drone'] }, { type: 'move', move: 'heater' }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    { at: 7, actions: [{ type: 'summon', enemies: ['delinquent', 'delinquent'] }] },
    { at: 10, actions: [{ type: 'buffEnemies', atk: 1, def: 0 }] },
  ],
  passive: { heater: { hp: 6, decay: 1 } },
  deckOrder: 'cycle',
  deck: ['truth', 'flood', 'frost'],
  moves: {
    heater: {
      name: '난로',
      text: '난로가 놓인다. 멈추면 난로 +3 · 체력 +2',
      effects: [{ type: 'marks', kind: 'heater', count: 1, near: 'boss' }],
    },
    truth: {
      name: '진리로의 길',
      text: '모든 아군 2 피해',
      effects: [{ type: 'damage', target: 'all', amount: 2 }],
    },
    flood: {
      name: '불 속 물 밑',
      text: '보스 3칸 안 2 피해 · 다음 이동 -2',
      effects: [
        { type: 'damage', target: 'near', range: 3, amount: 2 },
        { type: 'debuff', target: 'near', range: 3, status: 'slow', amount: 2 },
      ],
    },
    frost: {
      name: '혹한',
      text: '가장 먼 아군 2명 2 피해',
      breakAt: 18,
      effects: [{ type: 'damage', target: 'farthest', count: 2, amount: 2 }],
    },
  },
};

/** 고르기 화면 순서 */
export const BOSSES: BossDef[] = [
  BINAH,
  CHESED,
  SHIROKURO,
  HIERONYMUS,
  KAITEN,
  PERORODZILLA,
  HOD,
  GOZ,
  WAKAMO,
  KUROKAGE,
  GREGORIUS,
  GEBURAH,
];

export const DEFAULT_BOSS = BINAH;

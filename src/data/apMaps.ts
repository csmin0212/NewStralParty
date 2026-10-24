// 아스트랄 파티 협동 맵 보스 · 진행도 시간표 · 과제 (보통 난이도). 정리: docs/AP_MAPS.md
// 보드는 data/apBoards.ts, 몬스터는 data/enemies.ts, 규칙은 engine/ap.ts.

import type { ApSkill, BossDef, EnemyKind, MapTask } from '../engine/types';

const sk = (id: ApSkill['id'], name: string, cd: number, text: string, more: Partial<ApSkill> = {}): ApSkill => ({ id, name, cd, text, ...more });

const kill = (id: string, name: string, kinds: EnemyKind[], count: number, reward: MapTask['reward'], branch?: string): MapTask => ({
  id,
  name,
  kill: kinds,
  count,
  reward,
  ...(branch ? { branch } : {}),
});

/** 원작 보스 한 명 (HP는 인원과 무관) */
function apBoss(def: Omit<BossDef, 'hpPerPlayer' | 'defense'> & { defense?: BossDef['defense'] }): BossDef {
  return { defense: 'block', hpPerPlayer: Math.ceil((def.ap?.hp ?? 100) / 4), ...def };
}

// ───────────────────────── 드리마 ─────────────────────────

export const KING_GAWU = apBoss({
  id: 'dreama',
  name: '가우 왕',
  title: '드리마',
  icon: '🏴‍☠️',
  stars: 1,
  ref: '星趴·梦想号 · 海盗王嘎呜',
  map: 'dreama',
  atk: 5,
  def: 6,
  counter: true,
  defeatAt: 20,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['sharkPirate', 'sharkPirate', 'sharkPirate', 'sharkPirate'] }] },
    { at: 3, actions: [{ type: 'bossAppear', tile: 'F1' }] },
    { at: 6, actions: [{ type: 'summon', enemies: ['elitePirate', 'elitePirate'] }] },
    { at: 11, actions: [{ type: 'wake' }] },
  ],
  ap: {
    board: 'dreama',
    hp: 88,
    sleeps: true,
    roam: 3,
    rules: ['chaseRandom'],
    skill: sk('shootTop', '총격', 3, '체력이 가장 높은 캐릭터 4 피해', { range: 99, amount: 4 }),
    tasks: [
      kill('shark4', '상어 해적', ['sharkPirate'], 4, { chip: 1 }),
      kill('elite2', '엘리트 해적', ['elitePirate'], 2, { chip: 2, event: 'gawuDefDown' }),
      kill('shark9', '상어 해적', ['sharkPirate'], 9, { chip: 3, progress: -1 }),
    ],
  },
});

// ───────────────────────── 영혼 축전 ─────────────────────────

export const MASAO = apBoss({
  id: 'soul',
  name: '텐노지 마사오',
  title: '영혼 축전',
  icon: '🏮',
  stars: 2,
  ref: '御魂庆典 · 天王寺雅央',
  map: 'soul',
  atk: 3,
  def: 1,
  counter: true,
  defeatAt: 20,
  timeline: [
    { at: 1, actions: [{ type: 'bossAppear', tile: 'G7' }, { type: 'summon', enemies: ['blueSpirit', 'blueSpirit'], tiles: ['A7', 'M7'] }] },
    { at: 3, actions: [{ type: 'summon', enemies: ['blueSpirit', 'blueSpirit', 'redSpirit'] }, { type: 'wake' }] },
    { at: 7, actions: [{ type: 'summon', enemies: ['swordSpirit', 'spearSpirit'], tiles: ['E5', 'I9'] }] },
    { at: 13, actions: [{ type: 'summon', enemies: ['swordSpirit', 'spearSpirit'] }, { type: 'buffEnemies', atk: 1, def: 1 }] },
  ],
  ap: {
    board: 'soul',
    hp: 140,
    sleeps: true,
    roam: 2,
    rules: ['spiritLink'],
    skill: sk('masao', '떨어지는 정신', 4, '검 영혼 · 창 영혼 중 하나 소환'),
    tasks: [
      kill('blue4', '파란 영혼', ['blueSpirit'], 4, { chip: 1 }),
      kill('elite2', '검 · 창 영혼', ['swordSpirit', 'spearSpirit'], 2, { chip: 2 }),
      kill('elite5', '검 · 창 영혼', ['swordSpirit', 'spearSpirit'], 5, { chip: 3, progress: -1 }),
    ],
  },
});

// ───────────────────────── 워터 타운 ─────────────────────────

export const LION_GAWU = apBoss({
  id: 'watertown',
  name: '사자 가우',
  title: '워터 타운',
  icon: '🦁',
  stars: 2,
  ref: '水乡古镇 · 舞狮嘎呜 + 指挥平台',
  map: 'watertown',
  atk: 3,
  def: 0,
  counter: true,
  defeatAt: 20,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['ambientRobot', 'croak', 'croak', 'croak'], tiles: ['A10', 'A1', 'J1', 'J10'] }] },
    { at: 3, actions: [{ type: 'bossAppear', tile: 'A1' }, { type: 'summon', enemies: ['platform'], tiles: ['J10'] }] },
    { at: 5, actions: [{ type: 'summon', enemies: ['croak', 'croak', 'croak'] }, { type: 'buffEnemies', atk: 1, def: 1 }] },
    { at: 10, actions: [{ type: 'summon', enemies: ['ambientRobot', 'snakeDragon'] }, { type: 'buffEnemies', atk: 1, def: 1 }] },
  ],
  ap: {
    board: 'watertown',
    hp: 120,
    roam: 2,
    rules: ['momentum', 'sharedHp'],
    tasks: [
      kill('croak4', '폭죽 개구리', ['croak'], 4, { chip: 1 }),
      kill('croak9', '폭죽 개구리', ['croak'], 9, { chip: 2 }),
      kill('robot2', '분위기 로봇 · 기계 뱀용', ['ambientRobot', 'snakeDragon'], 2, { chip: 3 }),
    ],
  },
});

// ───────────────────────── 매직 아카데미 ─────────────────────────

const ACADEMY_LATER = [
  { at: 4, actions: [{ type: 'summon', enemies: ['jellyWizard', 'teapot'] }, { type: 'buffEnemies', atk: 1, def: 1 }] },
  { at: 10, actions: [{ type: 'summon', enemies: ['jellyGuard', 'jellyGuard', 'teapot', 'teapot'] }, { type: 'buffEnemies', atk: 1, def: 1 }] },
] satisfies BossDef['timeline'];

const enter = kill('fighter', '젤리 전사', ['jellyFighter'], 1, { coins: 6, event: 'academyStage2' });

export const ACTING_DEAN = apBoss({
  id: 'academy',
  name: '대행 학장',
  title: '매직 아카데미',
  icon: '🫖',
  stars: 2,
  ref: '魔法学院 · 代理院长',
  map: 'academy',
  atk: 2,
  def: 2,
  counter: true,
  defeatAt: 18,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['jellyFighter', 'teapot', 'teapot', 'teapot'], tiles: ['G1'] }] },
    ...ACADEMY_LATER,
  ],
  ap: {
    board: 'academy',
    hp: 111,
    roam: 2,
    rules: ['sugar'],
    skill: sk('tea', '티타임', 1, '5칸 안 찻주전자 흡수 (공격력 · 방어력 +1) · 없으면 찻주전자 소환', { range: 5 }),
    tasks: [
      enter,
      kill('teapot3', '마법 찻주전자', ['teapot'], 3, { chip: 1 }),
      kill('teapot8', '마법 찻주전자', ['teapot'], 8, { chip: 3, progress: -1 }),
      kill('guard2', '젤리 호위병', ['jellyGuard'], 2, { chip: 2 }),
    ],
  },
});

export const SECURITY_OFFICER = apBoss({
  id: 'academy-officer',
  name: '학원 안전관',
  title: '매직 아카데미',
  icon: '👮',
  stars: 2,
  ref: '魔法学院 · 学院安全官',
  map: 'academy',
  atk: 2,
  def: 1,
  counter: true,
  defeatAt: 18,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['jellyFighter', 'jellyGuard', 'jellyGuard'], tiles: ['G1'] }] },
    ...ACADEMY_LATER,
  ],
  ap: {
    board: 'academy',
    hp: 99,
    roam: 2,
    rules: ['fury'],
    skill: sk('indicate', '지시', 1, '가장 가까운 캐릭터에게 그놈 탓이야! (체력 50% 이하면 2명)'),
    tasks: [
      enter,
      kill('guard4', '젤리 호위병', ['jellyGuard'], 4, { chip: 2 }),
      kill('teapot3', '마법 찻주전자', ['teapot'], 3, { chip: 1, progress: -1 }),
      kill('guard2', '젤리 호위병', ['jellyGuard'], 2, { chip: 2 }),
    ],
  },
});

// ───────────────────────── 드래곤 팰리스 ─────────────────────────

const DRAGON_COMMON: MapTask[] = [
  kill('duo', '큰목소리 · 무술 수련생', ['loudmouth', 'trainee'], 2, { chip: 1, event: 'dragonVote' }),
  kill('crab6', '게 병사', ['crab'], 6, { chip: 1 }),
];

const DRAGON_TIMELINE: BossDef['timeline'] = [
  { at: 1, actions: [{ type: 'summon', enemies: ['crab', 'crab', 'crab', 'crab', 'loudmouth', 'trainee'], tiles: ['', '', '', '', 'H3', 'H8'] }] },
  { at: 9, actions: [{ type: 'summon', enemies: ['crab', 'crab', 'crab'] }, { type: 'buffEnemies', atk: 1, def: 1 }] },
];

/** 소우리 편을 들면 마무시가 보스 */
export const MAMUSHI = apBoss({
  id: 'dragon-mamushi',
  name: '아마카와 마무시',
  title: '드래곤 팰리스 뮤즈먼트 파크',
  icon: '🐍',
  stars: 3,
  ref: '龙宫游乐园 · 天川真梦梓',
  map: 'dragonpalace',
  atk: 4,
  def: 1,
  counter: true,
  defeatAt: 18,
  timeline: DRAGON_TIMELINE,
  ap: {
    board: 'dragonpalace',
    hp: 99,
    roam: 2,
    rules: ['reverseScale'],
    skill: sk('mamushiChain', '연쇄 반응', 1, '5칸 안 모든 캐릭터 효과 카드 1장 버리기 · 손패 4장 미만이면 3 피해', { range: 5 }),
    tasks: [
      ...DRAGON_COMMON,
      kill('prawn2', '새우 병사', ['prawn'], 2, { chip: 1 }, 'mamushi'),
      kill('prawn4', '새우 병사', ['prawn'], 4, { chip: 2, progress: -1 }, 'mamushi'),
      { id: 'gourd4', name: '호리병', counter: 'gourd', count: 4, branch: 'mamushi', reward: { chip: 3, event: 'gourdDone' } },
    ],
  },
});

/** 마무시 편을 들면 소우리가 보스 */
export const SOURI = apBoss({
  id: 'dragon-souri',
  name: '아마카와 소우리',
  title: '드래곤 팰리스 뮤즈먼트 파크',
  icon: '🎏',
  stars: 3,
  ref: '龙宫游乐园 · 天川苍鲤',
  map: 'dragonpalace',
  atk: 1,
  def: 1,
  counter: true,
  defeatAt: 18,
  timeline: DRAGON_TIMELINE,
  ap: {
    board: 'dragonpalace',
    hp: 88,
    roam: 2,
    rules: ['goldScale'],
    skill: sk('summon', '권속 소환', 2, '곁에 금붕어 1', { kind: 'goldfish' }),
    tasks: [
      ...DRAGON_COMMON,
      kill('fish3', '금붕어', ['goldfish'], 3, { chip: 1 }, 'souri'),
      kill('fish6', '금붕어', ['goldfish'], 6, { chip: 2, progress: -1 }, 'souri'),
      { id: 'scale11', name: '소우리 금린 11', counter: 'scale', count: 11, branch: 'souri', reward: { chip: 3, event: 'scaleDone' } },
    ],
  },
});

/** 투표 전에는 보스가 없다. 고르면 MAMUSHI · SOURI로 바뀐다 */
export const DRAGON_PALACE = apBoss({
  ...MAMUSHI,
  id: 'dragonpalace',
  name: '천천 자매',
  icon: '🐉',
  ap: { ...MAMUSHI.ap!, tasks: DRAGON_COMMON, rules: ['vote'] },
});

// ───────────────────────── 유령 골목 ─────────────────────────

export const MAD_SCIENTIST = apBoss({
  id: 'ghostalley',
  name: '과학 괴인',
  title: '유령 골목',
  icon: '🧪',
  stars: 3,
  ref: '幽魂暗巷 · 科学怪人',
  map: 'ghostalley',
  atk: 0,
  def: 0,
  counter: false,
  defeatAt: 18,
  timeline: [
    {
      at: 1,
      actions: [
        { type: 'bossAppear', tile: 'E8' },
        { type: 'summon', enemies: ['synth1', 'monkeyBox', 'monkeyBox', 'sawMonkey'], tiles: ['E10'] },
        { type: 'apEvent', event: 'mist' },
      ],
    },
    { at: 4, actions: [{ type: 'summon', enemies: ['monkeyBox', 'monkeyBox', 'monkeyBox', 'sawMonkey'] }] },
    { at: 7, actions: [{ type: 'summon', enemies: ['pinata', 'pinata'] }, { type: 'buffEnemies', atk: 1, def: 0 }] },
    { at: 9, actions: [{ type: 'summon', enemies: ['monkeyBox', 'monkeyBox', 'madApe'] }, { type: 'buffEnemies', atk: 1, def: 1 }] },
  ],
  ap: {
    board: 'ghostalley',
    hp: 9,
    rules: ['shield'],
    skill: sk('scientist', '신체 개조', 3, '가장 가까운 개조 없는 캐릭터 개조 3 · 주변 2칸 독안개'),
    tasks: [
      { id: 'star', name: '첫 1성', counter: 'star', count: 1, reward: { event: 'firstStar' } },
      kill('saw3', '톱날 원숭이 조수', ['sawMonkey'], 3, { chip: 1 }),
      kill('synth1', '인공생명체-천붕', ['synth1'], 1, { chip: 2 }),
      kill('ape3', '과학 원숭이', ['madApe'], 3, { chip: 2, progress: -1 }),
      kill('synth2', '인공생명체-흉조', ['synth2'], 1, { chip: 3 }),
    ],
  },
});

// ───────────────────────── 가을숲 환상경 ─────────────────────────

export const KID_GAWU = apBoss({
  id: 'autumnwood',
  name: '골목대장 가우',
  title: '가을숲 환상경',
  icon: '🍂',
  stars: 2,
  ref: '森秋幻境 · 孩子王嘎呜',
  map: 'autumnwood',
  atk: 0,
  def: 1,
  counter: false,
  defeatAt: 17,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['dino', 'owl', 'owl', 'owl'], tiles: ['E12', 'C4', 'K4', 'I12'] }] },
    { at: 3, actions: [{ type: 'bossAppear', tile: 'G1' }, { type: 'summon', enemies: ['bear', 'owl'], tiles: ['D4', 'J4'] }] },
    { at: 7, actions: [{ type: 'summon', enemies: ['bear', 'bear', 'dino'], tiles: ['A7', 'M7', 'G12'] }, { type: 'buffEnemies', atk: 1, def: 1 }] },
    {
      at: 10,
      actions: [{ type: 'summon', enemies: ['bear', 'bear', 'dino', 'dino'], tiles: ['C11', 'K2', 'C2', 'K11'] }, { type: 'buffEnemies', atk: 1, def: 1 }],
    },
  ],
  ap: {
    board: 'autumnwood',
    hp: 120,
    roam: 2,
    rules: ['kidGawu'],
    skill: sk('summon', '친구 부르기', 3, '곁에 채집 곰 1', { kind: 'bear' }),
    tasks: [
      kill('owl3', '알람 부엉이', ['owl'], 3, { chip: 1, card: 'building' }),
      kill('bear3', '채집 곰', ['bear'], 3, { chip: 2 }),
      kill('dino2', '장난감 공룡', ['dino'], 2, { chip: 2, progress: -1 }),
      { id: 'build8', name: '건물 짓기', counter: 'build', count: 8, reward: { chip: 3 } },
    ],
  },
});

// ───────────────────────── 정원 안뜰 ─────────────────────────

const GARDEN_GATES: MapTask[] = [
  kill('waiter', '가금 종업원', ['waiter'], 1, { event: 'peacockGate' }),
  { id: 'eggs', name: '신비한 알', counter: 'egg', count: 2, reward: { event: 'loveGate' } },
];

const GARDEN_TIMELINE: BossDef['timeline'] = [
  {
    at: 1,
    actions: [{ type: 'summon', enemies: ['waiter', 'swallow', 'swallow', 'swallow'], tiles: ['H10', 'I2', 'B14', 'C6'] }, { type: 'apEvent', event: 'eggs' }],
  },
  {
    at: 7,
    actions: [{ type: 'summon', enemies: ['swallow', 'swallow', 'crane', 'crane'], tiles: ['E1', 'I7', 'B9', 'F15'] }, { type: 'buffEnemies', atk: 1, def: 1 }],
  },
];

const routeTasks = (branch: string, fourth: MapTask, fifth: MapTask): MapTask[] => [
  ...GARDEN_GATES,
  kill(`${branch}-swallow`, '마중 제비', ['swallow'], 3, { chip: 1 }, branch),
  kill(`${branch}-crane`, '청동 학', ['crane'], 2, { chip: 2 }, branch),
  fourth,
  fifth,
];

export const FEN_PEACOCK = apBoss({
  id: 'garden-peacock',
  name: '펭 (공작 의식)',
  title: '정원 안뜰',
  icon: '🦚',
  stars: 3,
  ref: '园林中庭 · 姬梦枫（孔雀意识）',
  map: 'garden',
  atk: 4,
  def: 3,
  counter: true,
  defeatAt: 18,
  timeline: GARDEN_TIMELINE,
  ap: {
    board: 'garden',
    hp: 55,
    roam: 2,
    rules: ['flameHit'],
    tasks: routeTasks(
      'peacock',
      kill('peacock1', '청동 공작', ['peacock'], 1, { chip: 2, event: 'fenPeacock' }, 'peacock'),
      kill('peacock2', '청동 공작', ['peacock'], 2, { chip: 3 }, 'peacock'),
    ),
  },
});

export const FEN_LOVEBIRD = apBoss({
  id: 'garden-lovebird',
  name: '펭 (원앙 의식)',
  title: '정원 안뜰',
  icon: '🦆',
  stars: 3,
  ref: '园林中庭 · 姬梦枫（鸳鸯意识）',
  map: 'garden',
  atk: 3,
  def: 2,
  counter: true,
  defeatAt: 18,
  timeline: GARDEN_TIMELINE,
  ap: {
    board: 'garden',
    hp: 50,
    roam: 2,
    rules: ['solitude'],
    skill: sk('fenBond', '연리 시련', 2, '연리 없는 무작위 2명 연리 3'),
    tasks: routeTasks(
      'lovebird',
      kill('love2', '청동 원앙', ['lovebirdChalice'], 2, { chip: 2, event: 'fenLovebird' }, 'lovebird'),
      kill('love4', '청동 원앙', ['lovebirdChalice'], 4, { chip: 3 }, 'lovebird'),
    ),
  },
});

export const PHOENIX = apBoss({
  id: 'garden-phoenix',
  name: '폭주한 봉황',
  title: '정원 안뜰',
  icon: '🔥',
  stars: 3,
  ref: '园林中庭 · 失控凤凰',
  map: 'garden',
  atk: 0,
  def: 0,
  counter: true,
  defeatAt: 18,
  timeline: GARDEN_TIMELINE,
  ap: {
    board: 'garden',
    hp: 150,
    roam: 2,
    rules: ['rebirth'],
    skill: sk('wings', '불타는 날개', 2, '6칸 밖 캐릭터 손패 1장 → 잿빛 깃털 · 모두 연리 3'),
    tasks: [
      ...GARDEN_GATES,
      kill('phoenix-swallow', '마중 제비', ['swallow'], 3, { chip: 1 }, 'phoenix'),
      kill('phoenix-crane', '청동 학', ['crane'], 2, { chip: 2 }, 'phoenix'),
      kill('phoenix-peacock', '청동 공작', ['peacock'], 1, { chip: 2 }, 'phoenix'),
      kill('phoenix-love', '청동 원앙', ['lovebirdChalice'], 2, { chip: 3 }, 'phoenix'),
    ],
  },
});

/** 루트를 고르기 전 */
export const GARDEN = apBoss({
  ...FEN_PEACOCK,
  id: 'garden',
  name: '펭',
  icon: '🪶',
  ap: { ...FEN_PEACOCK.ap!, tasks: GARDEN_GATES, rules: ['route'] },
});

// ───────────────────────── 목록 ─────────────────────────

/** 보스 고르기 화면 (원작 맵 순서) */
export const AP_BOSSES: BossDef[] = [KING_GAWU, MASAO, LION_GAWU, ACTING_DEAN, DRAGON_PALACE, MAD_SCIENTIST, KID_GAWU, GARDEN];

/** 갈래로 바뀌는 보스 */
export const AP_VARIANTS: Record<string, BossDef> = {
  dean: ACTING_DEAN,
  officer: SECURITY_OFFICER,
  mamushi: MAMUSHI,
  souri: SOURI,
  peacock: FEN_PEACOCK,
  lovebird: FEN_LOVEBIRD,
  phoenix: PHOENIX,
};

import type { ApSkill, DefenseMode, EnemyKind } from '../engine/types';

export interface EnemyInfo {
  name: string;
  icon: string;
  hp: number;
  atk: number;
  def: number;
  /** 반격형 여부 */
  counter: boolean;
  defense: DefenseMode;
  reward: number;
  /** 보스 차례 뒤에 움직이는 칸 수 (1~roam). 아군이 있는 칸에 들어가면 덮쳐서 공격력만큼 피해를 주고 멈춘다 */
  roam?: number;
  /** 움직일 때 가장 가까운 아군을 쫓는다. 없으면 길을 따라 앞으로 */
  chase?: boolean;
  /** 덮칠 때 피해 대신 코인을 훔쳐 계속 달린다 (AP 小偷). 쓰러뜨리면 훔친 코인을 돌려받는다 */
  steal?: number;
  /** 나오고 이만큼 보스 차례가 지나면 터진다: range칸 안 아군 피해 */
  fuse?: { turns: number; amount: number; range: number };
  /** 이만큼 보스 차례마다 옆에 kind를 부른다 (AP 精锐) */
  calls?: { every: number; kind: EnemyKind };
  /** 받은 피해를 보스도 그대로 받는다 (페로로 미니언 · 묘귀의 조각 · 미사일 유도 장치) */
  link?: boolean;
  /** 분신: 공격받으면 피해 없이 사라진다. 화면에는 보스와 똑같이 보인다 */
  decoy?: boolean;
  /** 원작 액티브 (engine/ap.ts) */
  skill?: ApSkill;
  /** 비행: 지나가도 전투가 안 나고 도전할 수 없다 (카드 · 스킬로만) */
  fly?: boolean;
  /** 이동이 늘 이만큼 */
  fixedMove?: number;
  /** 쓰러뜨린 캐릭터가 얻는 것 */
  drop?: 'firecracker' | 'candy' | 'building' | 'feather' | 'heal2' | 'card';
  /** 아군 NPC: 공격받지 않는다 */
  ally?: boolean;
  elite?: boolean;
}

const sk = (id: ApSkill['id'], name: string, cd: number, text: string, more: Partial<ApSkill> = {}): ApSkill => ({ id, name, cd, text, ...more });

/** 학원 도시의 에너미. icon은 그림이 없을 때 쓰는 임시 아이콘 */
export const ENEMIES: Record<EnemyKind, EnemyInfo> = {
  // 원작 몬스터 체급 (보통): 海盗鲨鱼 4/1/9/6 · 金小鱼 2/0/6/5 · 惊喜猴子盒 4/0/8/6
  robot: { name: '경비 로봇', icon: '🤖', hp: 9, atk: 4, def: 1, counter: false, defense: 'block', reward: 6, roam: 2, chase: true },
  drone: { name: '정찰 드론', icon: '🛸', hp: 6, atk: 2, def: 0, counter: true, defense: 'evade', reward: 5 },
  delinquent: { name: '불량배', icon: '😼', hp: 10, atk: 3, def: 1, counter: true, defense: 'block', reward: 8 },
  thief: {
    name: '라쿤', icon: '🦝', hp: 6, atk: 0, def: 0, counter: false, defense: 'block', reward: 5,
    roam: 3, steal: 4,
  },
  elite: {
    // 海盗精锐 4/2/25/15
    name: '스케반 간부', icon: '🏏', hp: 25, atk: 4, def: 2, counter: true, defense: 'block', reward: 15,
    calls: { every: 3, kind: 'robot' }, roam: 1, chase: true,
  },
  automaton: {
    name: '오토마타 병사', icon: '🦾', hp: 8, atk: 3, def: 1, counter: false, defense: 'block', reward: 5,
    fuse: { turns: 3, amount: 3, range: 1 },
  },
  kaitenger: {
    name: '카이텐저', icon: '🍣', hp: 9, atk: 3, def: 0, counter: true, defense: 'block', reward: 6,
    roam: 2, chase: true,
  },
  perorominion: {
    name: '페로로 미니언', icon: '🐤', hp: 4, atk: 1, def: 0, counter: false, defense: 'block', reward: 2,
    link: true,
  },
  pillar: { name: '인베이드 필러', icon: '🗼', hp: 6, atk: 0, def: 1, counter: false, defense: 'block', reward: 4 },
  gozClone: {
    name: '고즈', icon: '🎩', hp: 1, atk: 0, def: 0, counter: false, defense: 'block', reward: 0,
    decoy: true,
  },
  slumpia: {
    name: '슬럼피아 병사', icon: '🎪', hp: 7, atk: 2, def: 0, counter: false, defense: 'block', reward: 5,
    roam: 3,
  },
  missile: {
    name: '미사일 유도 장치', icon: '📡', hp: 10, atk: 0, def: 0, counter: false, defense: 'block', reward: 0,
    link: true,
  },
  myoukiPiece: {
    name: '묘귀의 조각', icon: '🐾', hp: 4, atk: 0, def: 0, counter: false, defense: 'evade', reward: 2,
    link: true,
  },
  teapot: {
    // 魔法茶壶 3/1/10/6
    name: '마법 찻주전자', icon: '🫖', hp: 10, atk: 3, def: 1, counter: false, defense: 'block', reward: 6, roam: 2, chase: true, drop: 'heal2',
  },
  incarnation: {
    name: '묘귀의 화신', icon: '🐈‍⬛', hp: 4, atk: 2, def: 0, counter: false, defense: 'block', reward: 3,
    roam: 3, chase: true, fuse: { turns: 2, amount: 3, range: 1 },
  },

  // ───────── 원작 협동 맵 (보통 난이도) ─────────
  // 드리마
  sharkPirate: { name: '상어 해적', icon: '🦈', hp: 9, atk: 4, def: 1, counter: false, defense: 'block', reward: 6, roam: 3, chase: true },
  elitePirate: {
    name: '엘리트 해적', icon: '🏴‍☠️', hp: 25, atk: 4, def: 2, counter: true, defense: 'block', reward: 15, roam: 2, chase: true, elite: true,
    skill: sk('summon', '상어 소환', 3, '곁에 상어 해적 1', { kind: 'sharkPirate' }),
  },
  // 영혼 축전
  blueSpirit: { name: '파란 영혼', icon: '🔵', hp: 10, atk: 4, def: 0, counter: false, defense: 'block', reward: 6, roam: 3, chase: true },
  redSpirit: { name: '빨간 영혼', icon: '🔴', hp: 5, atk: 4, def: 4, counter: true, defense: 'block', reward: 8, fixedMove: 3 },
  swordSpirit: { name: '검 영혼', icon: '🗡️', hp: 22, atk: 4, def: 0, counter: false, defense: 'block', reward: 12, roam: 2, chase: true, elite: true },
  spearSpirit: {
    name: '창 영혼', icon: '🔱', hp: 11, atk: 3, def: 4, counter: true, defense: 'block', reward: 12, elite: true,
    skill: sk('poisonTop', '독성 공격', 1, '7칸 안 체력이 가장 높은 캐릭터 2 피해 · 중독 3', { range: 7, amount: 2 }),
  },
  // 워터 타운
  croak: {
    name: '폭죽 개구리', icon: '🐸', hp: 7, atk: 1, def: 1, counter: false, defense: 'block', reward: 6, drop: 'firecracker',
    skill: sk('shootTop', '안전하지 않은 불꽃놀이', 1, '4칸 안 체력이 가장 높은 캐릭터에게 공격력만큼 피해', { range: 4 }),
  },
  ambientRobot: {
    name: '분위기 로봇', icon: '🤖', hp: 21, atk: 3, def: 0, counter: true, defense: 'block', reward: 15, roam: 2, chase: true, elite: true,
    skill: sk('buffNear', '분위기 띄우기', 1, '4칸 안 몬스터 공격력 · 방어력 +1', { range: 4 }),
  },
  snakeDragon: {
    name: '기계 뱀용', icon: '🐉', hp: 8, atk: 0, def: 0, counter: false, defense: 'block', reward: 9, fly: true, drop: 'firecracker', elite: true,
    skill: sk('guard', '수호 보주', 1, '5칸 안 몬스터 하나 방어력 +9 (다음 피해까지)', { range: 5 }),
  },
  platform: {
    name: '지휘대', icon: '🎛️', hp: 120, atk: 0, def: 0, counter: false, defense: 'block', reward: 0, fly: true, roam: 3,
    skill: sk('summon', '명절엔 불꽃놀이!', 1, '곁에 폭죽 개구리 1 (최대 4)', { kind: 'croak', max: 4 }),
  },
  // 매직 아카데미
  jellyFighter: { name: '젤리 전사', icon: '🟩', hp: 35, atk: 2, def: 6, counter: true, defense: 'block', reward: 6, roam: 2, chase: true, elite: true },
  jellyGuard: { name: '젤리 호위병', icon: '🟦', hp: 15, atk: 3, def: 4, counter: true, defense: 'block', reward: 9, roam: 2, chase: true, elite: true },
  jellyWizard: {
    name: '젤리 마법사', icon: '🟪', hp: 15, atk: 2, def: 1, counter: false, defense: 'block', reward: 8, roam: 2, chase: true, elite: true,
    skill: sk('shootFar', '원격 비탄', 1, '5칸 밖 체력이 가장 높은 캐릭터 3 피해', { range: 5, amount: 3 }),
  },
  mutantTeapot: { name: '변이 찻주전자', icon: '🧪', hp: 7, atk: 4, def: 2, counter: false, defense: 'block', reward: 8, roam: 2, chase: true, drop: 'card' },
  // 드래곤 팰리스
  crab: { name: '게 병사', icon: '🦀', hp: 7, atk: 2, def: 1, counter: false, defense: 'block', reward: 6, roam: 3, chase: true },
  prawn: { name: '새우 병사', icon: '🦐', hp: 20, atk: 3, def: 1, counter: true, defense: 'block', reward: 8, roam: 2, chase: true, elite: true },
  goldfish: {
    name: '금붕어', icon: '🐠', hp: 6, atk: 2, def: 0, counter: true, defense: 'evade', reward: 5, roam: 3, chase: true,
    skill: sk('scale', '권속 지원', 1, '아마카와 소우리 금린 +1'),
  },
  loudmouth: {
    name: '큰목소리', icon: '📢', hp: 18, atk: 3, def: 0, counter: false, defense: 'block', reward: 8, elite: true,
    skill: sk('aoe', '가시 폭풍', 1, '4칸 안 모든 캐릭터 2 피해', { range: 4, amount: 2 }),
  },
  trainee: { name: '무술 수련생', icon: '🥋', hp: 13, atk: 3, def: 3, counter: true, defense: 'block', reward: 8, elite: true },
  mamushiAlly: { name: '아마카와 마무시', icon: '🐍', hp: 99, atk: 6, def: 6, counter: false, defense: 'block', reward: 0, ally: true },
  souriAlly: { name: '아마카와 소우리', icon: '🎏', hp: 99, atk: 4, def: 4, counter: false, defense: 'block', reward: 0, ally: true },
  // 유령 골목
  monkeyBox: { name: '깜짝 원숭이 상자', icon: '🎁', hp: 8, atk: 4, def: 0, counter: false, defense: 'block', reward: 6, roam: 3, chase: true },
  sawMonkey: {
    name: '톱날 원숭이 조수', icon: '🐒', hp: 16, atk: 3, def: 1, counter: true, defense: 'block', reward: 8, roam: 2, chase: true, drop: 'candy',
    skill: sk('saw', '묘수 신의', 3, '6칸 안 개조 없는 캐릭터 체력 +1 · 개조 3', { range: 6 }),
  },
  madApe: { name: '과학 원숭이', icon: '🦍', hp: 22, atk: 4, def: 2, counter: true, defense: 'block', reward: 8, roam: 2, chase: true, elite: true },
  pinata: {
    name: '사탕 피냐타', icon: '🪅', hp: 8, atk: 3, def: 0, counter: true, defense: 'evade', reward: 5, fixedMove: 4, drop: 'candy',
    skill: sk('pinata', '강제 개조', 99, '자기에게 개조 4'),
  },
  synth1: { name: '인공생명체-천붕', icon: '🧟', hp: 26, atk: 4, def: 1, counter: false, defense: 'block', reward: 8, roam: 2, chase: true, elite: true },
  synth2: {
    name: '인공생명체-흉조', icon: '🧟', hp: 26, atk: 4, def: 2, counter: true, defense: 'block', reward: 8, roam: 2, chase: true, elite: true,
    skill: sk('chain', '연쇄 반응', 2, '개조된 캐릭터 체력 -2 · 그만큼 회복'),
  },
  synth3: {
    name: '인공생명체-혼란', icon: '🧟', hp: 38, atk: 5, def: 3, counter: true, defense: 'block', reward: 8, roam: 2, chase: true, elite: true,
    skill: sk('chain', '연쇄 반응', 2, '개조된 캐릭터 체력 -2 · 그만큼 회복'),
  },
  // 가을숲 환상경
  owl: { name: '알람 부엉이', icon: '🦉', hp: 8, atk: 3, def: 0, counter: true, defense: 'block', reward: 6, roam: 3, chase: true },
  bear: {
    name: '채집 곰', icon: '🧸', hp: 14, atk: 3, def: 1, counter: true, defense: 'block', reward: 8, roam: 2, chase: true, drop: 'building', elite: true,
    skill: sk('mushroom', '이상한 냄새 버섯', 2, '5칸 안 가장 가까운 캐릭터 2 피해 · 주목 2', { range: 5, amount: 2 }),
  },
  dino: {
    name: '장난감 공룡', icon: '🦖', hp: 19, atk: 3, def: 1, counter: true, defense: 'block', reward: 13, roam: 2, chase: true, elite: true,
    skill: sk('noise', '소음 공격', 1, '2칸 안 모든 캐릭터 2 피해 · 맞힌 수만큼 공격력 +1', { range: 2, amount: 2 }),
  },
  // 정원 안뜰
  swallow: { name: '마중 제비', icon: '🐦', hp: 10, atk: 3, def: 1, counter: false, defense: 'block', reward: 7, roam: 3, chase: true },
  waiter: { name: '가금 종업원', icon: '🐔', hp: 18, atk: 4, def: 2, counter: false, defense: 'block', reward: 10, roam: 2, chase: true, drop: 'feather', elite: true },
  crane: { name: '청동 학', icon: '🦢', hp: 20, atk: 4, def: 2, counter: true, defense: 'block', reward: 12, roam: 2, chase: true, drop: 'feather', elite: true },
  peacock: {
    name: '청동 공작', icon: '🦚', hp: 40, atk: 5, def: 2, counter: true, defense: 'block', reward: 18, roam: 2, chase: true, drop: 'feather', elite: true,
    skill: sk('display', '경염', 3, '자기와 체력이 가장 높은 캐릭터에게 공작 개병'),
  },
  lovebirdChalice: {
    name: '청동 원앙', icon: '🦆', hp: 20, atk: 3, def: 2, counter: true, defense: 'block', reward: 12, roam: 2, chase: true, drop: 'feather', elite: true,
    skill: sk('bond', '원앙 연리', 2, '가장 가까운 캐릭터 연리 3'),
  },
};

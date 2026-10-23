import type { CardId } from '../engine/types';

/**
 * 카드 종류. 언제 쓰는지가 다르다.
 *  boost   주사위 전 · 나에게
 *  support 주사위 전 · 아군 1명을 골라서
 *  event   주사위 전 · 판 전체 또는 에너미 1마리를 골라서
 *  battle  전투 중 (timing: 내가 공격할 때 / 반격을 받을 때), 전투 코스트를 쓴다
 * 주사위 전 카드는 턴마다 1장. 전투 카드는 인카운터마다 코스트(3 + 성) 안에서 여러 장.
 *
 * 수치는 100% 오렌지 쥬스 · 아스트랄 파티의 실제 카드를 기준으로 맞췄다 (docs/CARD_REFERENCE.md, ref).
 */
export type CardType = 'boost' | 'support' | 'event' | 'battle';
export type BattleTiming = 'attack' | 'defend';

export interface CardInfo {
  id: CardId;
  name: string;
  type: CardType;
  timing?: BattleTiming;
  /** 이 성(레벨) 이상이어야 쓸 수 있다 */
  level: number;
  /** 덱 포인트. 덱 합계가 캐릭터 예산을 넘으면 안 된다 */
  points: 0 | 2 | 5;
  /** 덱에 넣을 수 있는 장수. 0이면 덱에 못 넣는다 (상점 · 생성 카드) */
  limit: 0 | 1 | 2 | 3;
  /** 쓸 때 내는 코인 */
  cost?: number;
  /** 전투 카드가 쓰는 전투 코스트 */
  battleCost?: number;
  /** 대상: 아군 1명(자신 포함 여부) 또는 에너미 1마리 */
  target?: 'ally' | 'otherAlly' | 'enemy';
  /** 에너미 대상 카드의 사거리 (칸) */
  range?: number;
  icon: string;
  text: string;
  /** 참고한 원작 카드 */
  ref: string;
}

type Extra = Partial<Omit<CardInfo, 'id' | 'name' | 'type' | 'icon' | 'text' | 'ref'>>;

const card = (id: CardId, name: string, type: CardType, icon: string, text: string, ref: string, extra: Extra = {}): CardInfo => ({
  id,
  name,
  type,
  icon,
  text,
  ref,
  level: 0,
  points: 0,
  limit: 3,
  ...extra,
});

export const CARDS: Record<CardId, CardInfo> = {
  // ── 부스트 ──
  dash: card('dash', '질주', 'boost', '💨', '이동 +2', '기본'),
  doubleDice: card('doubleDice', '더블 주사위', 'boost', '🎲', '이동 주사위 2개', 'OJ Dash! (3★)', { cost: 3 }),
  tripleDice: card('tripleDice', '트리플 주사위', 'boost', '🎰', '이동 주사위 3개 · 다음 차례 쉼', 'OJ Overtime (Lv3 10★)', {
    level: 2, points: 2, limit: 1, cost: 5,
  }),
  remoteDice: card('remoteDice', '리모컨 주사위', 'boost', '🎮', '이동 1~6 중 고르기', 'AP 遥控骰子', { level: 1, points: 2, limit: 2 }),
  portal: card('portal', '랜덤 포털', 'boost', '🌀', '무작위 워프 칸으로 이동한 뒤 주사위', 'AP 随机传送门', { limit: 2 }),
  cookie: card('cookie', '매점 쿠키', 'boost', '🍪', '체력 +1', "OJ Saki's Cookie (Lv1 0★)"),
  cake: card('cake', '초코 케이크', 'boost', '🍰', '체력 +2', 'AP 巧克力蛋糕'),
  bandage: card('bandage', '붕대', 'boost', '🩹', '체력 +4', 'AP 汉堡', { level: 1, points: 2 }),
  pudding: card('pudding', '푸딩', 'boost', '🍮', '체력 전부 회복', 'OJ Pudding (Lv4 0★)', { level: 3, points: 5, limit: 1 }),
  poisonCure: card('poisonCure', '이독제독', 'boost', '🧪', '체력 -2 · 2턴 동안 차례 시작에 체력 +3', 'AP 以毒攻毒', { level: 1, points: 2, limit: 2 }),
  notes: card('notes', '수업 노트', 'boost', '📒', '카드 2장 뽑기', 'OJ Nice Present (Lv2 10★, 1장)', { level: 2, limit: 1, cost: 5 }),
  extend: card('extend', '보충 수업', 'boost', '📚', '쓰러지면 다음 차례에 부활', 'OJ Extend (Lv3 10★, 1장)', {
    level: 3, points: 5, limit: 1, cost: 10,
  }),
  kingPower: card('kingPower', '왕의 힘', 'boost', '👑', '체력 -4 · 3턴 동안 공격력 +5', 'AP 王之力', { level: 2, points: 5, limit: 1 }),
  immovable: card('immovable', '굳건함', 'boost', '🗿', '2턴 동안 방어력 +6', 'AP 岿然不动', { level: 2, points: 5, limit: 2 }),

  // ── 지원 ──
  hurry: card('hurry', '서둘러', 'support', '⏩', '아군 다음 이동 주사위 2개', 'AP 加急加快', { target: 'ally' }),
  feast: card('feast', '호화 만찬', 'support', '🍱', '아군과 그 3칸 안 아군 체력 +3', 'AP 奢华大餐', { level: 1, points: 2, limit: 2, target: 'ally' }),
  share: card('share', '너도 나도', 'support', '🤝', '나와 아군 카드 1장씩', 'AP 你有我有', { target: 'otherAlly' }),
  backup: card('backup', '지원 요청', 'support', '📍', '아군 칸으로 순간이동', 'AP 支援', { level: 1, points: 2, limit: 2, target: 'otherAlly' }),

  // ── 이벤트 ──
  dinner: card('dinner', '단체 급식', 'event', '🍲', '모든 아군 체력 +3', 'OJ Dinner (Lv3 10★)', { level: 3, points: 2, cost: 10 }),
  allOut: card('allOut', '총공격', 'event', '📣', '모든 아군 다음 전투 공격력 +2', 'OJ Super All-Out Mode (Lv3 30★)', {
    level: 3, points: 5, limit: 1, cost: 15,
  }),
  revival: card('revival', '긴급 호출', 'event', '📞', '쓰러진 아군 모두 부활 · 체력 절반', 'OJ Forced Revival (Lv3 30★, 코옵 1장)', {
    level: 3, points: 5, limit: 1, cost: 15,
  }),
  slingshot: card('slingshot', '새총', 'event', '🪃', '10칸 안 에너미 2 피해', 'AP 皮筋弹弓', { target: 'enemy', range: 10 }),
  laser: card('laser', '레이저', 'event', '🔦', '6칸 안 에너미 3 피해', 'AP 对怪激光', { level: 1, points: 2, target: 'enemy', range: 6 }),
  brick: card('brick', '벽돌', 'event', '🧱', '3칸 안 에너미 5 피해', 'AP 对怪板砖', { level: 2, points: 2, target: 'enemy', range: 3 }),
  blast: card('blast', '정밀 폭파', 'event', '💣', '6칸 안 에너미와 그 2칸 안 에너미 4 피해', 'AP 定向爆破', {
    level: 3, points: 5, limit: 2, cost: 10, target: 'enemy', range: 6,
  }),
  railgun: card('railgun', '레일건', 'event', '⚡', '5칸 안 에너미 6 피해', 'AP 轨道炮', {
    level: 3, points: 5, limit: 1, cost: 15, target: 'enemy', range: 5,
  }),

  // ── 전투: 공격할 때 ──
  atkM: card('atkM', '공격 강화 (중)', 'battle', '🗡', '공격력 +1~3', 'AP 攻击(中)', { timing: 'attack', battleCost: 1 }),
  atkL: card('atkL', '공격 강화 (대)', 'battle', '⚔', '공격력 +1~6', 'AP 攻击(大)', { timing: 'attack', battleCost: 2 }),
  atkG: card('atkG', '공격 강화 (특대)', 'battle', '🔱', '공격력 +1~10', 'AP 攻击(特大)', { timing: 'attack', battleCost: 3, level: 1, points: 2 }),
  onFire: card('onFire', '불타는 의지', 'battle', '🔥', '공격력 +1 · 방어력 -1', "OJ I'm on Fire! (Lv1 5★)", { timing: 'attack', battleCost: 1 }),
  magnum: card('magnum', '매그넘', 'battle', '🔫', '체력 1을 내고 공격력 +2', 'OJ Big Magnum (Lv3 20★)', {
    timing: 'attack', battleCost: 1, level: 2, points: 2,
  }),
  shadowRaid: card('shadowRaid', '그림자 습격', 'battle', '🌑', '공격력 +3 · 반격 없음', 'AP 暗影突袭', {
    timing: 'attack', battleCost: 2, level: 1, points: 2, limit: 2,
  }),
  gawu: card('gawu', '명검', 'battle', '🗡', '공격력 +1~20', 'AP 名刀：嘎呜切 (코스트 4, 1성)', {
    timing: 'attack', battleCost: 4, level: 1, points: 5, limit: 1,
  }),
  charge: card('charge', '축적', 'battle', '🌀', '공격력 +5 · 「전력 공격」 획득', 'AP 蓄力 (코스트 5, 2성)', {
    timing: 'attack', battleCost: 5, level: 2, points: 5, limit: 1,
  }),
  fullAttack: card('fullAttack', '전력 공격', 'battle', '💥', '공격력 +6 · 최종 공격력 ×1.5', 'AP 全力攻击', {
    timing: 'attack', battleCost: 3, limit: 0,
  }),
  accel: card('accel', '액셀', 'battle', '🎯', '공격 주사위 2개 중 높은 눈', 'OJ Accel Hyper (Lv4 30★, 1장)', {
    timing: 'attack', battleCost: 3, level: 3, points: 5, limit: 1,
  }),

  // ── 전투: 반격을 받을 때 ──
  defM: card('defM', '방어 강화 (중)', 'battle', '🛡', '방어력 +1~3', 'AP 防御(中)', { timing: 'defend', battleCost: 1 }),
  defL: card('defL', '방어 강화 (대)', 'battle', '🛡', '방어력 +1~6', 'AP 防御(大)', { timing: 'defend', battleCost: 2 }),
  defG: card('defG', '방어 강화 (특대)', 'battle', '🏰', '방어력 +1~10', 'AP 防御(特大)', { timing: 'defend', battleCost: 3, level: 1, points: 2 }),
  rainbow: card('rainbow', '무지개 원', 'battle', '🌈', '회피 주사위 +1', 'OJ Rainbow-Colored Circle (Lv2 5★)', {
    timing: 'defend', battleCost: 2, level: 1, points: 2,
  }),
  retreat: card('retreat', '전술적 후퇴', 'battle', '🏃', '반격을 받지 않고 이탈', 'OJ Tactical Retreat (Lv1 레벨×5★)', {
    timing: 'defend', battleCost: 1, points: 2, cost: 3,
  }),
  shieldCounter: card('shieldCounter', '실드 카운터', 'battle', '↩', '에너미에게 (공격력 − 내 방어력, 최소 1) 피해 · 반격을 받지 않는다', 'OJ Shield Counter (Lv4 20★, 1장)', {
    timing: 'defend', battleCost: 4, level: 3, points: 5, limit: 1,
  }),
};

export const CARD_IDS = Object.keys(CARDS) as CardId[];
/** 덱에 넣을 수 있는 카드 */
export const DECK_CARD_IDS = CARD_IDS.filter((id) => CARDS[id].limit > 0);

export const CARD_TYPE_NAMES: Record<CardType, string> = {
  boost: '부스트',
  support: '지원',
  event: '이벤트',
  battle: '전투',
};

export interface DeckPreset {
  name: string;
  cards: CardId[];
}

/** 덱 슬롯 5개의 처음 값. 덱 편성 화면에서 고치고 저장한다 */
export const DEFAULT_PRESETS: DeckPreset[] = [
  {
    name: '기본 덱',
    cards: ['dash', 'dash', 'doubleDice', 'cake', 'cake', 'atkM', 'atkM', 'defM', 'rainbow', 'laser'],
  },
  {
    name: '돌격 덱',
    cards: ['atkM', 'atkM', 'atkL', 'atkL', 'shadowRaid', 'onFire', 'magnum', 'gawu', 'brick', 'dash'],
  },
  {
    name: '서포트 덱',
    cards: ['hurry', 'hurry', 'share', 'share', 'feast', 'backup', 'cake', 'cake', 'defM', 'retreat'],
  },
  { name: '덱 4', cards: [] },
  { name: '덱 5', cards: [] },
];

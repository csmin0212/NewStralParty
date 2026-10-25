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
  /** 성마다 늘어나는 코인 비용 (실제 비용 = max(cost, 성 × costPerLevel)) */
  costPerLevel?: number;
  /** 전투 카드가 쓰는 전투 코스트 */
  battleCost?: number;
  /** 대상: 아군 1명(자신 포함 여부) · 에너미 1마리 · 칸 (건물 · 깃털) */
  target?: 'ally' | 'otherAlly' | 'enemy' | 'tile';
  /** 에너미 대상 카드의 사거리 (칸) */
  range?: number;
  /** 숫자를 골라서 쓰는 카드 (스마트 주사위 1~6 · 금지 표지판 앞 칸 수) */
  pick?: [number, number];
  icon: string;
  text: string;
  /** 참고한 원작 카드 */
  ref: string;
  /** 전투 카드가 붙이는 값 (예상 범위 계산용, 효과는 game.ts) */
  battle?: BattleBonus;
}

export interface BattleBonus {
  atk?: [number, number];
  def?: [number, number];
  /** 공격 · 회피 주사위 개수 추가 (높은 눈) */
  attackDice?: number;
  evadeDice?: number;
  /** 공격 주사위 2개를 더한다 (액셀) */
  sumDice?: boolean;
  /** 최종 공격력 배수 */
  mult?: number;
  noCounter?: boolean;
  /** 반격을 받지 않고 끝난다 (전술적 후퇴 · 실드 카운터) */
  escape?: boolean;
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
  dash: card('dash', '질주', 'boost', '💨', '이동 +2', '원작 없음 (docs/CARD_BALANCE.md)', { limit: 2 }),
  doubleDice: card('doubleDice', '더블 주사위', 'boost', '🎲', '이동 주사위 2개', 'OJ Dash! (3★)', { cost: 3 }),
  tripleDice: card('tripleDice', '트리플 주사위', 'boost', '🎰', '이동 주사위 3개 · 다음 차례 쉼', 'OJ Overtime (Lv3 10★)', {
    level: 2, points: 2, limit: 1, cost: 5,
  }),
  remoteDice: card('remoteDice', '스마트 주사위', 'boost', '🎮', '이동 1~6 중 고르기', 'AP 遥控骰子', { level: 1, points: 2, limit: 2, pick: [1, 6] }),
  portal: card('portal', '랜덤 포털', 'boost', '🌀', '무작위 워프 칸으로 이동한 뒤 주사위', 'AP 随机传送门', { limit: 2 }),
  cookie: card('cookie', '매점 쿠키', 'boost', '🍪', '체력 +1', "OJ Saki's Cookie (Lv1 0★)"),
  cake: card('cake', '초콜릿 케이크', 'boost', '🍰', '체력 +2', 'AP 巧克力蛋糕'),
  bandage: card('bandage', '햄버거', 'boost', '🍔', '체력 +4', 'AP 汉堡', { level: 1, points: 2 }),
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
  share: card('share', '너도 나도', 'support', '🤝', '나와 아군 카드 1장씩', 'AP 你有我有', { points: 2, target: 'otherAlly' }),
  backup: card('backup', '지원 요청', 'support', '📍', '아군 칸으로 순간이동', 'AP 支援', { level: 1, points: 2, limit: 2, target: 'otherAlly' }),

  // ── 이벤트 ──
  dinner: card('dinner', '단체 급식', 'event', '🍲', '모든 아군 체력 +3', 'OJ Dinner (Lv3 10★)', { level: 3, points: 2, cost: 10 }),
  allOut: card('allOut', '총공격', 'event', '📣', '모든 아군 다음 전투 공격력 +2', 'OJ Super All-Out Mode (Lv3 30★)', {
    level: 3, points: 5, limit: 1, cost: 15,
  }),
  revival: card('revival', '긴급 호출', 'event', '📞', '쓰러진 아군 모두 부활 · 체력 절반', 'OJ Forced Revival (Lv3 30★, 코옵 1장)', {
    level: 3, points: 5, limit: 1, cost: 15,
  }),
  slingshot: card('slingshot', '새총', 'event', '🪃', '10칸 안 에너미 2 피해', 'AP 皮筋弹弓 (PvP 카드를 몬스터용으로)', {
    level: 1, points: 2, target: 'enemy', range: 10,
  }),
  laser: card('laser', '레이저', 'event', '🔦', '6칸 안 에너미 3 피해', 'AP 对怪激光', { level: 1, points: 2, target: 'enemy', range: 6 }),
  brick: card('brick', '벽돌', 'event', '🧱', '3칸 안 에너미 5 피해', 'AP 对怪板砖', {
    level: 2, points: 2, limit: 2, target: 'enemy', range: 3,
  }),
  blast: card('blast', '정밀 폭파', 'event', '💣', '6칸 안 에너미와 그 2칸 안 에너미 4 피해', 'AP 定向爆破', {
    level: 3, points: 5, limit: 2, cost: 10, target: 'enemy', range: 6,
  }),
  railgun: card('railgun', '레일건', 'event', '⚡', '5칸 안 에너미 6 피해', 'AP 轨道炮', {
    level: 3, points: 5, limit: 1, cost: 15, target: 'enemy', range: 5,
  }),

  // ── 전투: 공격할 때 ──
  atkM: card('atkM', '공격 강화 (중)', 'battle', '🗡', '공격력 +1~3', 'AP 攻击(中)', { timing: 'attack', battleCost: 1, battle: { atk: [1, 3] } }),
  atkL: card('atkL', '공격 강화 (대)', 'battle', '⚔', '공격력 +1~6', 'AP 攻击(大)', { timing: 'attack', battleCost: 2, battle: { atk: [1, 6] } }),
  atkG: card('atkG', '공격 강화 (특대)', 'battle', '🔱', '공격력 +1~10', 'AP 攻击(特大)', {
    timing: 'attack', battleCost: 3, level: 1, points: 2, battle: { atk: [1, 10] },
  }),
  onFire: card('onFire', '불타는 의지', 'battle', '🔥', '공격력 +1 · 방어력 -1', "OJ I'm on Fire! (Lv1 5★)", {
    timing: 'attack', battleCost: 1, battle: { atk: [1, 1], def: [-1, -1] },
  }),
  magnum: card('magnum', '매그넘', 'battle', '🔫', '체력 1을 내고 공격력 +2', 'OJ Big Magnum (Lv3 20★)', {
    timing: 'attack', battleCost: 1, level: 2, points: 2, battle: { atk: [2, 2] },
  }),
  shadowRaid: card('shadowRaid', '그림자 습격', 'battle', '🌑', '공격력 +3 · 반격 없음 (보스 제외)', 'AP 暗影突袭', {
    timing: 'attack', battleCost: 2, level: 1, points: 2, limit: 2, battle: { atk: [3, 3], noCounter: true },
  }),
  gawu: card('gawu', '명검: 가우 베기', 'battle', '🗡', '공격력 +1~20', 'AP 名刀：嘎呜切 (코스트 4, 1성 → 2성)', {
    timing: 'attack', battleCost: 4, level: 2, points: 5, limit: 1, battle: { atk: [1, 20] },
  }),
  charge: card('charge', '축적', 'battle', '🌀', '공격력 +5 · 「전력 공격」 획득', 'AP 蓄力 (코스트 5, 2성)', {
    timing: 'attack', battleCost: 5, level: 2, points: 5, limit: 1, battle: { atk: [5, 5] },
  }),
  fullAttack: card('fullAttack', '전력 공격', 'battle', '💥', '공격력 +6 · 최종 공격력 ×1.5', 'AP 全力攻击', {
    timing: 'attack', battleCost: 3, limit: 0, battle: { atk: [6, 6], mult: 1.5 },
  }),
  accel: card('accel', '액셀', 'battle', '🎯', '공격 주사위 2개를 더한다', 'OJ Accel Hyper (Lv4 30★, 1장)', {
    timing: 'attack', battleCost: 3, level: 3, points: 5, limit: 1, battle: { sumDice: true },
  }),

  // ── 전투: 반격을 받을 때 ──
  defM: card('defM', '방어 강화 (중)', 'battle', '🛡', '방어력 +1~3', 'AP 防御(中)', { timing: 'defend', battleCost: 1, battle: { def: [1, 3] } }),
  defL: card('defL', '방어 강화 (대)', 'battle', '🛡', '방어력 +1~6', 'AP 防御(大)', { timing: 'defend', battleCost: 2, battle: { def: [1, 6] } }),
  defG: card('defG', '방어 강화 (특대)', 'battle', '🏰', '방어력 +1~10', 'AP 防御(特大)', {
    timing: 'defend', battleCost: 3, level: 1, points: 2, battle: { def: [1, 10] },
  }),
  rainbow: card('rainbow', '무지개 원', 'battle', '🌈', '회피 주사위 +1', 'OJ Rainbow-Colored Circle (Lv2 5★)', {
    timing: 'defend', battleCost: 2, level: 1, points: 2, battle: { evadeDice: 1 },
  }),
  retreat: card('retreat', '전술적 후퇴', 'battle', '🏃', '반격을 받지 않고 이탈 · 코인 성 × 3 (최소 3)', 'OJ Tactical Retreat (Lv1 레벨×5★)', {
    timing: 'defend', battleCost: 1, points: 2, cost: 3, costPerLevel: 3, battle: { escape: true },
  }),
  shieldCounter: card('shieldCounter', '실드 카운터', 'battle', '↩', '에너미에게 (공격력 − 내 방어력, 최소 1) 피해 · 반격을 받지 않는다', 'OJ Shield Counter (Lv4 20★, 1장)', {
    timing: 'defend', battleCost: 4, level: 3, points: 5, limit: 1, battle: { escape: true },
  }),

  // ── 캐릭터가 만드는 카드 (공용 카드에는 없다) ──
  livingPage: card('livingPage', '리빙 북', 'event', '📖', '5칸 안 몬스터 2 피해 · 표식 +1 · 표식 3 이상이면 이번 턴 카드 +1', 'AP 活体书页 (린)', {
    limit: 0, target: 'enemy', range: 5,
  }),
  talismanFu: card('talismanFu', '부적 카드 - 행운', 'support', '🧧', '아군 체력 +2 · 이번 턴 카드 +1', 'AP 符卡-福 (유메)', { limit: 0, target: 'ally' }),
  talismanHuo: card('talismanHuo', '부적 카드 - 불행', 'event', '🀄', '10칸 안 몬스터 1 피해 · 턴 끝에 손에 있으면 체력 -1', 'AP 符卡-祸 (유메)', {
    limit: 0, target: 'enemy', range: 10,
  }),
  bite: card('bite', '깨물기', 'battle', '🦷', '각성 +1 · 이번 턴 각성만큼 공격력 + (최대 4) · 반격 없음', 'AP 撕咬 (마무시)', {
    timing: 'attack', battleCost: 2, limit: 0, battle: { atk: [1, 4], noCounter: true },
  }),
  dragonRoar: card('dragonRoar', '용의 포효', 'battle', '🐉', '공격력 +3 · 이번 턴 대상 방어력 -3 · 이동 -9 · 반격 없음', 'AP 龙之咆哮 (마무시 진룡)', {
    timing: 'attack', battleCost: 3, limit: 0, battle: { atk: [3, 3], noCounter: true },
  }),
  banSign: card('banSign', '금지 표지판', 'event', '⛔', '10칸 안 칸에 배치 · 지나는 캐릭터는 멈추고 다음 이동 +2', 'AP 强化拒止 (링링)', {
    limit: 0, target: 'tile',
  }),
  fateGuide: card('fateGuide', '운명의 인도', 'boost', '🔮', '이동 1~6 중 고르기', 'AP 命运的指引 (키이세이)', { limit: 0, pick: [1, 6] }),

  // ── 원작 협동 맵 카드 (docs/AP_MAPS.md) ──
  firecracker: card('firecracker', '고승포', 'event', '🧨', '10칸 안 몬스터 3 피해 · 분위기 · 기세 해제 · 이번 라운드 반격 없음', 'AP 高升炮 (워터 타운)', {
    limit: 0, target: 'enemy', range: 10,
  }),
  hisFault: card('hisFault', '그놈 탓이야!', 'support', '👉', '아군 1 피해 · 문제아 · 코인 +3 · 차례 끝에 손에 있으면 1 피해', 'AP 是他干的 (매직 아카데미)', {
    limit: 0, target: 'otherAlly',
  }),
  poisonFang: card('poisonFang', '독니', 'battle', '🦷', '금린 -2 · 반격 없음', 'AP 毒牙 (드래곤 팰리스)', {
    timing: 'attack', battleCost: 2, limit: 0, battle: { noCounter: true },
  }),
  gourd: card('gourd', '호리병', 'event', '🍶', '카드 3장', 'AP 葫芦 (드래곤 팰리스)', { limit: 0 }),
  supportGum: card('supportGum', '지원 껌', 'support', '🍬', '아군 체력 +2 · 개조 해제 · 이번 턴 카드 +1', 'AP 支援口香糖 (유령 골목)', { limit: 0, target: 'ally' }),
  energyBar: card('energyBar', '에너지 바', 'support', '🍫', '아군 공격력 +2 · 이동 +2 (2턴) · 개조 2', 'AP 能量补充棒 (유령 골목)', { limit: 0, target: 'ally' }),
  smartGummy: card('smartGummy', '똑똑이 젤리', 'support', '🍭', '아군 카드 3장 · 개조 해제', 'AP 大聪明软糖 (유령 골목)', { limit: 0, target: 'ally' }),
  hasteMushroom: card('hasteMushroom', '질주 버섯', 'event', '🍄', '건물: 질주 칸 · 멈추면 다음 이동 +3 · 이번 턴 카드 +1', 'AP 疾行菇 (가을숲)', { limit: 0, target: 'tile' }),
  starfruit: card('starfruit', '신선 스타프루트', 'event', '⭐', '건물: 보장점 · 이번 턴 카드 +1', 'AP 仙品杨桃 (가을숲)', { limit: 0, target: 'tile' }),
  peach: card('peach', '향기로운 복숭아', 'event', '🍑', '건물: 지나가면 체력 +2 · 주목 해제 · 이번 턴 카드 +1', 'AP 芳香蜜桃 (가을숲)', { limit: 0, target: 'tile' }),
  moneyTree: card('moneyTree', '돈나무', 'event', '💰', '건물: 상점 · 이번 턴 카드 +1', 'AP 招财树 (가을숲)', { limit: 0, target: 'tile' }),
  feather: card('feather', '오색 깃털', 'event', '🪶', '5칸 안 칸으로 순간이동 · 체력 +3', 'AP 彩羽 (정원 안뜰)', { limit: 0, target: 'tile' }),
  ashenFeather: card('ashenFeather', '잿빛 깃털', 'boost', '🌫️', '낼 수 없다 · 차례 시작에 온염 +1', 'AP 灰烬之羽 (정원 안뜰)', { limit: 0 }),
};

export const CARD_IDS = Object.keys(CARDS) as CardId[];
/** 공용 카드 (무게 = limit) */
export const DECK_CARD_IDS = CARD_IDS.filter((id) => CARDS[id].limit > 0);

export const CARD_TYPE_NAMES: Record<CardType, string> = {
  boost: '부스트',
  support: '지원',
  event: '이벤트',
  battle: '전투',
};

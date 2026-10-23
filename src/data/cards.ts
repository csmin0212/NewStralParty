import type { CardId } from '../engine/types';

/**
 * 카드 종류. 언제 쓰는지가 다르다.
 *  boost   주사위 전 · 나에게
 *  support 주사위 전 · 아군에게
 *  event   주사위 전 · 판 전체
 *  battle  전투 중 (timing: 내가 공격할 때 / 반격을 받을 때)
 * 주사위 전 카드는 턴마다 1장, 전투 카드는 공격 때 1장 · 반격 때 1장.
 */
export type CardType = 'boost' | 'support' | 'event' | 'battle';
export type BattleTiming = 'attack' | 'defend';

export interface CardInfo {
  id: CardId;
  name: string;
  type: CardType;
  timing?: BattleTiming;
  /** 쓸 때 내는 코인 */
  cost?: number;
  /** 덱에 넣을 수 있는 장수 */
  limit: 1 | 2;
  /** 그림이 오기 전까지 쓰는 아이콘 */
  icon: string;
  text: string;
}

const card = (id: CardId, name: string, type: CardType, icon: string, text: string, extra: Partial<CardInfo> = {}): CardInfo => ({
  id,
  name,
  type,
  icon,
  text,
  limit: 2,
  ...extra,
});

export const CARDS: Record<CardId, CardInfo> = {
  // ── 부스트 ──
  dash: card('dash', '질주', 'boost', '💨', '이동 +2'),
  doubleDice: card('doubleDice', '더블 주사위', 'boost', '🎲', '주사위 2개'),
  tripleDice: card('tripleDice', '트리플 주사위', 'boost', '🎰', '주사위 3개', { cost: 4, limit: 1 }),
  sprint: card('sprint', '전력 질주', 'boost', '👟', '이동 +4 · 체력 -1'),
  stroll: card('stroll', '산책', 'boost', '🌿', '주사위 눈 최대 3'),
  luckyDice: card('luckyDice', '행운의 주사위', 'boost', '🍀', '주사위를 2번 굴려 높은 눈'),
  recall: card('recall', '귀환 신호', 'boost', '🏫', '본부로 돌아간 뒤 이동'),
  adrenaline: card('adrenaline', '아드레날린', 'boost', '🔥', '이번 턴 공격력 +2'),
  guard: card('guard', '수비 태세', 'boost', '🛡', '이번 턴 방어력 +2'),
  focus: card('focus', '집중', 'boost', '🎯', '이번 턴 회피 주사위 +1'),
  bandage: card('bandage', '붕대', 'boost', '🩹', '체력 +4'),
  energyDrink: card('energyDrink', '에너지 드링크', 'boost', '🥤', '체력 +2 · 이동 +1'),
  allowance: card('allowance', '용돈', 'boost', '💰', '코인 +5'),
  notes: card('notes', '수업 노트', 'boost', '📒', '카드 2장 뽑기'),
  refresh: card('refresh', '리프레시', 'boost', '⏱', '액티브 재사용 대기 -2'),

  // ── 전투: 공격할 때 ──
  powerStrike: card('powerStrike', '강타', 'battle', '👊', '공격력 +2', { timing: 'attack' }),
  fullPower: card('fullPower', '혼신의 일격', 'battle', '💥', '공격력 +4', { timing: 'attack', cost: 3 }),
  critical: card('critical', '급소 노리기', 'battle', '🎯', '공격 주사위 2개 중 높은 눈', { timing: 'attack' }),
  pierce: card('pierce', '관통탄', 'battle', '🔫', '방어 · 회피 무시', { timing: 'attack', cost: 4, limit: 1 }),
  stun: card('stun', '기절탄', 'battle', '💫', '반격 없음', { timing: 'attack' }),
  lifeSteal: card('lifeSteal', '흡혈 탄환', 'battle', '🩸', '준 피해만큼 체력 회복', { timing: 'attack' }),
  bounty: card('bounty', '현상금', 'battle', '💎', '처치 보상 2배', { timing: 'attack' }),

  // ── 전투: 반격을 받을 때 ──
  ironWall: card('ironWall', '철벽', 'battle', '🧱', '방어력 +3', { timing: 'defend' }),
  sidestep: card('sidestep', '사이드 스텝', 'battle', '🌀', '회피 주사위 +1', { timing: 'defend' }),
  perfectDodge: card('perfectDodge', '완벽한 회피', 'battle', '✨', '반드시 회피', { timing: 'defend', limit: 1 }),
  counterShot: card('counterShot', '맞받아치기', 'battle', '↩', '방어로 받은 피해만큼 반사', { timing: 'defend' }),
  smokeBomb: card('smokeBomb', '연막탄', 'battle', '🌫', '반격을 받지 않고 이탈', { timing: 'defend' }),

  // ── 지원 ──
  firstAid: card('firstAid', '구급상자', 'support', '🧰', '체력이 가장 낮은 아군 체력 +4'),
  groupMeal: card('groupMeal', '단체 급식', 'support', '🍱', '모든 아군 체력 +2'),
  clubFund: card('clubFund', '동아리 회비', 'support', '🪙', '모든 아군 코인 +3'),
  emergencyCall: card('emergencyCall', '긴급 호출', 'support', '📞', '쓰러진 아군 1명 부활 · 체력 절반', { limit: 1 }),
  batonTouch: card('batonTouch', '바톤 터치', 'support', '🏃', '다른 아군 액티브 재사용 대기 -1'),
  cheer: card('cheer', '응원', 'support', '📣', '다른 아군 카드 1장 뽑기'),

  // ── 이벤트 ──
  airStrike: card('airStrike', '지원 사격', 'event', '🚁', '모든 일반 에너미 체력 -2', { cost: 3 }),
  bossBreak: card('bossBreak', '보스 공략', 'event', '📡', '보스 체력 -3', { cost: 3 }),
  curfew: card('curfew', '통금', 'event', '🚨', '모든 일반 에너미 공격력 -1'),
  overtime: card('overtime', '방과 후 연장', 'event', '🌙', '진행도 -1', { cost: 8, limit: 1 }),
  expel: card('expel', '정학 처분', 'event', '📜', '체력이 가장 낮은 일반 에너미 퇴장', { cost: 5, limit: 1 }),
};

export const CARD_IDS = Object.keys(CARDS) as CardId[];

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

/** 처음 주어지는 덱 3개. 덱 화면에서 고칠 수 있다 */
export const DEFAULT_PRESETS: DeckPreset[] = [
  {
    name: '기본 덱',
    cards: ['dash', 'dash', 'doubleDice', 'bandage', 'bandage', 'powerStrike', 'ironWall', 'sidestep', 'allowance', 'notes'],
  },
  {
    name: '돌격 덱',
    cards: ['powerStrike', 'powerStrike', 'critical', 'fullPower', 'stun', 'bounty', 'adrenaline', 'adrenaline', 'dash', 'energyDrink'],
  },
  {
    name: '서포트 덱',
    cards: ['firstAid', 'firstAid', 'groupMeal', 'clubFund', 'cheer', 'batonTouch', 'airStrike', 'guard', 'sidestep', 'bandage'],
  },
];

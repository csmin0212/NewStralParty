// 이벤트 칸: 멈추면 무작위 하나 (아스트랄 파티 事件格: 잘 되면 공격 +5, 안 되면 팀 전체 -2, 배달 음식 식중독 …)

export type EventId =
  | 'vending'
  | 'lostFound'
  | 'lunch'
  | 'training'
  | 'delivery'
  | 'wallet'
  | 'cheer'
  | 'drill'
  | 'ambush'
  | 'shortcut';

export interface EventInfo {
  name: string;
  icon: string;
  text: string;
  /** 좋은 일인지 (화면 색) */
  good: boolean;
}

export const EVENTS: Record<EventId, EventInfo> = {
  vending: { name: '행운의 자판기', icon: '🥤', text: '코인 +6', good: true },
  lostFound: { name: '분실물 센터', icon: '📦', text: '카드 1장', good: true },
  lunch: { name: '매점 특식', icon: '🍙', text: '체력 +3', good: true },
  training: { name: '특별 훈련', icon: '🥊', text: '다음 전투 공격력 +2', good: true },
  cheer: { name: '응원단', icon: '📣', text: '모든 아군 체력 +1', good: true },
  shortcut: { name: '비밀 통로', icon: '🚪', text: '아무 워프 칸으로', good: true },
  delivery: { name: '배달 사고', icon: '🍱', text: '체력 -2', good: false },
  wallet: { name: '지갑 분실', icon: '👛', text: '코인 -4', good: false },
  drill: { name: '단체 기합', icon: '📢', text: '모든 아군 체력 -1', good: false },
  ambush: { name: '매복', icon: '😼', text: '옆 칸에 불량배', good: false },
};

export const EVENT_IDS = Object.keys(EVENTS) as EventId[];

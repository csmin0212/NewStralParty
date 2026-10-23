// 밸런스 수치. 플레이해 보면서 여기만 고치면 된다.

export const RULES = {
  startCoins: 0,
  /** 자기 턴 시작마다 받는 코인 */
  turnIncome: 2,
  coinPlus: 6,
  coinMinus: 4,
  heal: 3,

  /** 현재 레벨 → 다음 레벨로 올리는 비용. 없는 레벨은 더 못 올린다 */
  levelUpCost: { 1: 20, 2: 40 } as Record<number, number>,

  handLimit: 3,
  dashSteps: 2,
  bandageHeal: 4,

  baseStats: { hp: 10, atk: 1, def: 1, eva: 1 },
  /** KO 되면 다음 라운드를 쉬고 그다음 라운드에 부활: 쓰러진 라운드 + 2 */
  reviveAfterRounds: 2,

  /** 남겨 둘 인카운터 기록 수 */
  battleHistory: 3,
  noticeHistory: 5,
  logLimit: 60,
};

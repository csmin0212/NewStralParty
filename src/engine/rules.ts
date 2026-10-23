// 밸런스 수치. 플레이해 보면서 여기만 고치면 된다.

// 캐릭터별 능력치 · 시작 코인 · 별 성장은 data/characters.ts에 있다.
export const RULES = {
  /** 자기 턴 시작마다 받는 코인 */
  turnIncome: 2,
  coinPlus: 6,
  coinMinus: 4,
  heal: 3,

  /** 현재 별(성) → 다음 별로 올리는 비용. 0성에서 시작해 3성까지. 원작 참고값 (밸런스 때 조정) */
  levelUpCost: { 0: 15, 1: 20, 2: 25 } as Record<number, number>,

  /** 덱 장수 상한 · 하한 */
  deckSize: 10,
  deckMin: 5,
  /** 시작 손패. 이후 자기 차례 시작마다 1장, 카드 칸에서 1장 */
  startHand: 2,
  handLimit: 4,

  /** KO 되면 다음 라운드를 쉬고 그다음 라운드에 부활: 쓰러진 라운드 + 2 */
  reviveAfterRounds: 2,

  /** 남겨 둘 인카운터 기록 수 */
  battleHistory: 3,
  noticeHistory: 5,
  logLimit: 60,
};

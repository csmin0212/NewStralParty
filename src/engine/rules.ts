// 밸런스 수치. 플레이해 보면서 여기만 고치면 된다.

// 캐릭터별 능력치 · 시작 코인 · 별 성장은 data/characters.ts에 있다.
export const RULES = {
  /** 시작 코인 (원작 미확인 · 임시) */
  startCoins: 5,
  /** 회복 칸 · 거점 · 확인 지점 회복 */
  heal: 2,
  /** 횡재: 이 중 하나 */
  windfall: [2, 3, 4, 5, 10],
  /** 재앙 피해 */
  calamity: 2,
  /** 카드 칸 장수 */
  cardTile: 2,
  /** 한 번 이동 최대 칸 */
  moveCap: 10,

  /** 현재 별(성) → 다음 별로 올리는 비용. 0성에서 시작해 3성까지. 원작 참고값 (밸런스 때 조정) */
  levelUpCost: { 0: 15, 1: 20, 2: 25 } as Record<number, number>,

  /** 시작 손패 (보통 · 어려움). 차례가 끝날 때 한도를 넘으면 버린다 */
  startHand: 6,
  handLimit: 8,
  /** 전투 코스트 = 기본 + 성 (아스트랄 파티 코옵) */
  battleCostBase: 3,
  /** 라운드 보상: N라운드마다 모두 코인 + 카드 1장 (아스트랄 파티 코옵: 3라운드, 5코인) */
  roundRewardEvery: 3,
  roundRewardCoins: 5,
  /** 상점: 카드 3장, 장당 3코인 */
  shopOffers: 3,
  shopPrice: 3,
  /** 상점 송금 단위 */
  transferCoins: 5,

  /** KO 되면 다음 라운드를 쉬고 그다음 라운드에 부활: 쓰러진 라운드 + 2 */
  reviveAfterRounds: 2,

  /** 남겨 둘 인카운터 기록 수 */
  battleHistory: 3,
  noticeHistory: 5,
  logLimit: 60,
};

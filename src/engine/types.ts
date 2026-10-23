// 게임 상태와 행동 타입. 전부 JSON으로 직렬화 가능해야 한다 (네트워크로 통째로 보낼 것이므로).

export type TileKind =
  | 'empty'
  | 'coinPlus'
  | 'coinMinus'
  | 'card'
  | 'spawn'
  | 'heal'
  | 'warp'
  | 'shop'
  | 'base';

export interface Tile {
  id: number;
  kind: TileKind;
  /** 이동 방향으로 이어진 칸. 2개 이상이면 갈림길 */
  next: number[];
  /** 화면 배치용 격자 좌표 */
  x: number;
  y: number;
  /** warp 칸의 도착 칸 */
  warpTo?: number;
}

export interface Board {
  name: string;
  tiles: Tile[];
  /** 본부 칸: 시작 · 레벨업 지점 */
  baseTile: number;
  /** 에너미가 소환되는 지점. 다 차 있으면 다른 빈 칸에 나온다 */
  spawnTiles: number[];
  /** 보스가 나타나는 칸 */
  bossTile: number;
}

/** 카드 목록과 효과 글은 data/cards.ts, 효과는 engine/cards.ts */
export type CardId =
  | 'dash'
  | 'doubleDice'
  | 'tripleDice'
  | 'remoteDice'
  | 'portal'
  | 'cookie'
  | 'cake'
  | 'bandage'
  | 'pudding'
  | 'poisonCure'
  | 'notes'
  | 'extend'
  | 'kingPower'
  | 'immovable'
  | 'hurry'
  | 'feast'
  | 'share'
  | 'backup'
  | 'dinner'
  | 'allOut'
  | 'revival'
  | 'slingshot'
  | 'laser'
  | 'brick'
  | 'blast'
  | 'railgun'
  | 'atkM'
  | 'atkL'
  | 'atkG'
  | 'onFire'
  | 'magnum'
  | 'shadowRaid'
  | 'gawu'
  | 'charge'
  | 'fullAttack'
  | 'accel'
  | 'defM'
  | 'defL'
  | 'defG'
  | 'rainbow'
  | 'retreat'
  | 'shieldCounter';

export interface HandCard {
  card: CardId;
  /** 상점에서 산 카드: 쓰면 사라지고 덱으로 돌아가지 않는다 */
  shop?: boolean;
}

export type CharacterId = 'mutbyeol';

export interface Player {
  id: number;
  name: string;
  color: string;
  character: CharacterId;
  /** 잠재 능력 해방 여부 (게임 시작 때 정한다) */
  potential: boolean;
  tile: number;
  coins: number;
  /** 스타(성). 0성에서 시작해 본부에서 코인을 내고 올린다 */
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  /** 주사위를 굴릴 때마다 더 가는 칸 수 (이동거리) */
  move: number;
  /** 카드 효과로 붙은 상태 */
  status: PlayerStatus;
  /** 내 덱 구성 (최대 10장). 뽑을 더미 · 버린 더미 · 손패를 오가며 내 덱 안에서만 돈다 */
  deck: CardId[];
  drawPile: CardId[];
  discard: CardId[];
  hand: HandCard[];
  /** 액티브 스킬 재사용 대기 (라운드). 0이면 쓸 수 있다 */
  skillCooldown: number;
  /** 액티브 스킬 효과가 이 라운드의 자기 차례 시작까지 유지된다 (뭇별: 회피 주사위 2개) */
  skillActiveUntil: number | null;
  /** KO 상태. 쓰러진 자리에 누워 있다 */
  ko: boolean;
  /** KO 상태일 때, 이 라운드의 자기 차례에 부활한다 */
  reviveRound: number | null;
}

export type EnemyKind = 'robot' | 'delinquent' | 'drone';

export type DefenseMode = 'block' | 'evade';

/** 보드 위의 에너미 또는 보스. 스탯은 데이터에서 복사해 오고, 기믹 등으로 바뀔 수 있다 */
export interface Enemy {
  id: number;
  kind: EnemyKind | 'boss';
  name: string;
  icon: string;
  isBoss: boolean;
  tile: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  /** 반격형이면 공격받고 살아남았을 때 1회 반격한다 */
  counter: boolean;
  /** 공격받을 때 쓰는 방어 방식 */
  defense: DefenseMode;
  reward: number;
}

export type GimmickAction =
  | { type: 'summon'; enemies: EnemyKind[] }
  | { type: 'bossAppear' }
  /** 지금 있는 에너미와 앞으로 소환될 에너미 모두 강화 (보스 제외) */
  | { type: 'buffEnemies'; atk: number; def: number };

/** 진행도가 at에 닿으면 actions를 순서대로 실행한다 */
export interface Gimmick {
  at: number;
  actions: GimmickAction[];
}

/** 보스 한 판의 정의: 보스 스탯 + 진행도 시간표 */
export interface BossDef {
  name: string;
  icon: string;
  /** 보스 HP = hpPerPlayer × 플레이어 수 */
  hpPerPlayer: number;
  atk: number;
  def: number;
  counter: boolean;
  defense: DefenseMode;
  /** 진행도가 여기에 닿으면 패배 */
  defeatAt: number;
  timeline: Gimmick[];
}

export interface AttackResult {
  mode: DefenseMode;
  /** 공격 주사위 눈 */
  attackRoll: number;
  /** 공격값 = 공격력 + 주사위 */
  attackValue: number;
  /** 방어 · 회피에 쓴 주사위 눈 (여러 개 굴렸으면 그중 고른 값) */
  defenseRoll: number;
  /** 굴린 주사위 전부 (뭇별 액티브처럼 2개 굴려 높은 값을 고를 때) */
  defenseRolls: number[];
  /** 방어: 방어력 + 주사위, 회피: 주사위 (공격 주사위와 비교) */
  defenseValue: number;
  damage: number;
}

export type BattleEvent =
  | { type: 'attack'; attacker: 'player' | 'enemy'; result: AttackResult; targetHp: number }
  | { type: 'enemyDefeated'; reward: number }
  | { type: 'playerKO' }
  | { type: 'release' }
  /** 회피에 성공해서 발동한 캐릭터 효과 (뭇별 패시브 · 잠재 능력) */
  | { type: 'skill'; name: string; damage?: number; targetHp?: number }
  /** 전투 카드 사용. value는 굴린 강화 수치, damage가 있으면 그 카드로 에너미가 피해를 입었다 (실드 카운터) */
  | { type: 'card'; card: CardId; value?: number; damage?: number; targetHp?: number }
  /** 연막탄으로 반격을 받지 않고 빠졌다 */
  | { type: 'escape' };

/** 인카운터 한 번의 기록. 화면은 events를 순서대로 연출한다 */
export interface Battle {
  seq: number;
  player: number;
  /** 인카운터 시작 시점의 에너미 */
  enemy: Enemy;
  events: BattleEvent[];
  done: boolean;
}

export type Phase =
  | { kind: 'preRoll' }
  | { kind: 'choosePath'; stepsLeft: number; options: number[] }
  | { kind: 'encounter'; enemy: number; stepsLeft: number }
  | { kind: 'defend'; enemy: number; stepsLeft: number }
  /** 상점 칸: 지나가거나 멈추면 연다. 멈췄으면 첫 구매가 무료 */
  | { kind: 'shop'; stepsLeft: number; offers: ShopOffer[]; free: boolean }
  | { kind: 'endTurn' }
  | { kind: 'gameOver'; result: 'victory' | 'defeat' };

/** 카드로 붙는 상태. turns는 자기 차례가 시작될 때마다 1씩 준다 */
export interface PlayerStatus {
  regen: { amount: number; turns: number } | null;
  atkUp: { amount: number; turns: number } | null;
  defUp: { amount: number; turns: number } | null;
  /** 쓰러지면 다음 차례에 부활 (보충 수업) */
  extend: boolean;
  /** 다음 전투 공격력 (총공격) */
  nextBattleAtk: number;
  /** 다음 이동 주사위 수 (서둘러). 0이면 없음 */
  nextMoveDice: number;
  /** 다음 차례를 쉰다 (트리플 주사위) */
  skipTurn: boolean;
}

/** 인카운터 한 번 동안만 가는 전투 카드 효과 */
export interface BattleMods {
  /** 이번 인카운터의 전투 코스트 (3 + 성) 중 쓴 만큼 */
  costUsed: number;
  atk: number;
  def: number;
  evadeDice: number;
  /** 공격 주사위 수 (높은 눈) */
  attackDice: number;
  /** 최종 공격력 배수 (전력 공격) */
  atkMult: number;
  noCounter: boolean;
}

/** 현재 턴의 임시 값 */
export interface TurnInfo {
  /** 주사위 전 카드(부스트 · 지원 · 이벤트)를 썼는지 */
  cardPlayed: boolean;
  skillUsed: boolean;
  diceCount: number;
  extraSteps: number;
  /** 정해 둔 이동 칸 (리모컨 주사위) */
  fixedMove: number | null;
  dice: number[];
  battle: BattleMods;
}

export interface ShopOffer {
  card: CardId;
  price: number;
  sold: boolean;
}

/** 화면 연출용: 마지막으로 쓴 카드 */
export interface CardPlay {
  seq: number;
  player: number;
  card: CardId;
}

/** 화면 연출용: 마지막으로 말이 지나간 칸들 (시작 칸 포함) */
export interface Move {
  seq: number;
  player: number;
  path: number[];
}

/** 화면에 크게 띄울 알림 (기믹 발동 등) */
export interface Notice {
  seq: number;
  text: string;
}

export interface GameState {
  board: Board;
  boss: BossDef;
  players: Player[];
  enemies: Enemy[];
  nextEnemyId: number;
  /** 기믹으로 쌓인 에너미 강화치. 새로 소환되는 에너미에도 더한다 */
  enemyBonus: { atk: number; def: number };
  current: number;
  /** 진짜 라운드. 라운드 쿨타임은 이것만 따른다 */
  round: number;
  /** 보스 기믹이 따라가는 시계. 라운드마다 +1, KO마다 +1 */
  progress: number;
  /** 기믹을 어디까지 실행했는지 (진행도 기준) */
  gimmicksDone: number;
  phase: Phase;
  turn: TurnInfo;
  lastMove: Move | null;
  lastCard: CardPlay | null;
  /** 최근 인카운터 기록 (한 행동 안에서 전투가 끝나고 다음 전투가 시작될 수 있어서 몇 개 남겨 둔다) */
  battles: Battle[];
  notices: Notice[];
  log: string[];
  /** 시드 기반 RNG의 현재 상태. 주사위·랜덤은 전부 여기서 나온다 */
  rngState: number;
  seq: number;
}

export type Action =
  /** target: 아군이면 플레이어 id, 에너미면 에너미 id · value: 리모컨 주사위 눈 */
  | { type: 'PLAY_CARD'; player: number; handIndex: number; target?: number; value?: number }
  | { type: 'BUY_CARD'; player: number; offer: number }
  | { type: 'LEAVE_SHOP'; player: number }
  | { type: 'ROLL'; player: number }
  | { type: 'CHOOSE_PATH'; player: number; to: number }
  | { type: 'ENCOUNTER'; player: number; choice: 'attack' | 'release' }
  | { type: 'DEFEND'; player: number; mode: DefenseMode }
  | { type: 'USE_SKILL'; player: number }
  /** 본부에서 덱 정비: 카드 1장 넣기 또는 빼기 */
  | { type: 'EDIT_DECK'; player: number; add?: CardId; remove?: CardId }
  | { type: 'END_TURN'; player: number };

// 게임 상태와 행동 타입. 전부 JSON으로 직렬화 가능해야 한다 (네트워크로 통째로 보낼 것이므로).

export type TileKind =
  | 'empty'
  | 'coinPlus'
  | 'coinMinus'
  | 'card'
  | 'spawn'
  | 'heal'
  | 'warp'
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

export type CardId = 'dash' | 'doubleDice' | 'bandage';

export interface Player {
  id: number;
  name: string;
  color: string;
  tile: number;
  coins: number;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  eva: number;
  hand: CardId[];
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
  eva: number;
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
  eva: number;
  counter: boolean;
  defense: DefenseMode;
  /** 진행도가 여기에 닿으면 패배 */
  defeatAt: number;
  timeline: Gimmick[];
}

export interface AttackResult {
  mode: DefenseMode;
  attackRoll: number;
  attackValue: number;
  defenseRoll: number;
  defenseValue: number;
  damage: number;
}

export type BattleEvent =
  | { type: 'attack'; attacker: 'player' | 'enemy'; result: AttackResult; targetHp: number }
  | { type: 'enemyDefeated'; reward: number }
  | { type: 'playerKO' }
  | { type: 'release' };

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
  | { kind: 'endTurn' }
  | { kind: 'gameOver'; result: 'victory' | 'defeat' };

/** 현재 턴의 임시 값 */
export interface TurnInfo {
  cardPlayed: boolean;
  diceCount: number;
  extraSteps: number;
  dice: number[];
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
  /** 최근 인카운터 기록 (한 행동 안에서 전투가 끝나고 다음 전투가 시작될 수 있어서 몇 개 남겨 둔다) */
  battles: Battle[];
  notices: Notice[];
  log: string[];
  /** 시드 기반 RNG의 현재 상태. 주사위·랜덤은 전부 여기서 나온다 */
  rngState: number;
  seq: number;
}

export type Action =
  | { type: 'PLAY_CARD'; player: number; handIndex: number }
  | { type: 'ROLL'; player: number }
  | { type: 'CHOOSE_PATH'; player: number; to: number }
  | { type: 'ENCOUNTER'; player: number; choice: 'attack' | 'release' }
  | { type: 'DEFEND'; player: number; mode: DefenseMode }
  | { type: 'END_TURN'; player: number };

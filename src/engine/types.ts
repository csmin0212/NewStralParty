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

export interface EnemySpawn {
  tile: number;
  enemy: EnemyKind;
}

export interface Board {
  name: string;
  tiles: Tile[];
  /** 본부 칸: 시작 · 레벨업 · 부활 지점 */
  baseTile: number;
  /** 에너미가 나타나는 지점. 한 칸에는 에너미가 하나만 선다 */
  enemySpawns: EnemySpawn[];
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
  /** KO 상태. 다음 자기 턴 시작 때 부활한다 */
  ko: boolean;
}

export type EnemyKind = 'slime' | 'goblin' | 'bat';

export type DefenseMode = 'block' | 'evade';

/** 보드 위의 에너미 하나. 스탯은 종류에서 복사해 오고, 이후 버프 등으로 바뀔 수 있다 */
export interface Enemy {
  id: number;
  kind: EnemyKind;
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
  | { type: 'playerKO'; coinsLost: number }
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
  | { kind: 'gameOver'; winner: number };

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

export interface GameState {
  board: Board;
  players: Player[];
  enemies: Enemy[];
  nextEnemyId: number;
  current: number;
  round: number;
  phase: Phase;
  turn: TurnInfo;
  lastMove: Move | null;
  /** 최근 인카운터 기록 (한 행동 안에서 전투가 끝나고 다음 전투가 시작될 수 있어서 몇 개 남겨 둔다) */
  battles: Battle[];
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

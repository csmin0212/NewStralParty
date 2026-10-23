// 게임 상태와 행동 타입. 전부 JSON으로 직렬화 가능해야 한다 (네트워크로 통째로 보낼 것이므로).

export type TileKind =
  | 'empty'
  | 'coinPlus'
  | 'coinMinus'
  | 'card'
  | 'monster'
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
  /** 본부 칸: 시작 · 레벨업 · 부활 지점 */
  baseTile: number;
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

export type Phase =
  | { kind: 'preRoll' }
  | { kind: 'choosePath'; stepsLeft: number; options: number[] }
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
  current: number;
  round: number;
  phase: Phase;
  turn: TurnInfo;
  lastMove: Move | null;
  log: string[];
  /** 시드 기반 RNG의 현재 상태. 주사위·랜덤은 전부 여기서 나온다 */
  rngState: number;
  seq: number;
}

export type Action =
  | { type: 'PLAY_CARD'; player: number; handIndex: number }
  | { type: 'ROLL'; player: number }
  | { type: 'CHOOSE_PATH'; player: number; to: number }
  | { type: 'END_TURN'; player: number };

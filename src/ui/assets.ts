import type { CardId, Enemy, TileKind } from '../engine/types';

const root = `${import.meta.env.BASE_URL}assets/`;

/** 화면 전체 배경. CSS에서 절대 경로를 쓰면 GitHub Pages 하위 경로에서 깨지므로 BASE_URL을 붙여 변수로 넘긴다 */
export const BACKGROUND_ART = `${root}board/background.webp`;

export const TILE_ART: Partial<Record<TileKind, string>> = {
  base: `${root}tiles/base.webp`,
  coinPlus: `${root}tiles/coin-plus.webp`,
  spawn: `${root}tiles/spawn.webp`,
  coinMinus: `${root}tiles/coin-minus.webp`,
  card: `${root}tiles/card.webp`,
  heal: `${root}tiles/heal.webp`,
  warp: `${root}tiles/warp.webp`,
  empty: `${root}tiles/empty.webp`,
};

export const ENEMY_ART: Partial<Record<Enemy['kind'], string>> = {
  robot: `${root}enemies/robot/idle.webp`,
  drone: `${root}enemies/drone/idle.webp`,
  delinquent: `${root}enemies/delinquent/idle.webp`,
};

export type EnemyPose = 'idle' | 'attack' | 'hit' | 'evade';
export const ENEMY_POSES: Partial<Record<Enemy['kind'], Partial<Record<EnemyPose, string>>>> = {
  robot: { idle: ENEMY_ART.robot, hit: `${root}enemies/robot/hit.webp` },
  drone: { idle: ENEMY_ART.drone, hit: `${root}enemies/drone/hit.webp`, evade: `${root}enemies/drone/evade.webp` },
  delinquent: { idle: ENEMY_ART.delinquent, attack: `${root}enemies/delinquent/attack.webp`, hit: `${root}enemies/delinquent/hit.webp` },
};

export const CARD_ART: Record<CardId, string> = {
  dash: `${root}cards/dash.webp`,
  doubleDice: `${root}cards/double-dice.webp`,
  bandage: `${root}cards/bandage.webp`,
};

export const UI_ART = {
  coin: `${root}ui/coin.webp`,
  heart: `${root}ui/heart.webp`,
  star: `${root}ui/star.webp`,
  cardBack: `${root}ui/card-back.webp`,
  logo: `${root}ui/logo.webp`,
};

/** 현재 보행로는 SVG로 이어 그린다. 이 그림은 다른 맵에서 사용할 수 있다. */
export const PATH_ART = `${root}board/path.webp`;

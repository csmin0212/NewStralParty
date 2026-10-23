import type { Enemy, TileKind } from '../engine/types';

const root = `${import.meta.env.BASE_URL}assets/`;

/** 화면 전체 배경. CSS에서 절대 경로를 쓰면 GitHub Pages 하위 경로에서 깨지므로 BASE_URL을 붙여 변수로 넘긴다 */
export const BACKGROUND_ART = `${root}board/background.webp`;

export const TILE_ART: Partial<Record<TileKind, string>> = {
  base: `${root}tiles/base.webp`,
  coinPlus: `${root}tiles/coin-plus.webp`,
  spawn: `${root}tiles/spawn.webp`,
};

// 에너미 그림은 2차분이 들어오면 robot / drone / delinquent 순으로 등록한다
export const ENEMY_ART: Partial<Record<Enemy['kind'], string>> = {};

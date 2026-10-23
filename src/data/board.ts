import type { Board, TileKind } from '../engine/types';

export const TILE_INFO: Record<TileKind, { name: string; icon: string }> = {
  empty: { name: '빈 칸', icon: '' },
  coinPlus: { name: '코인+', icon: '🪙' },
  coinMinus: { name: '코인-', icon: '💸' },
  card: { name: '카드', icon: '🃏' },
  spawn: { name: '균열', icon: '🌀' },
  heal: { name: '회복', icon: '❤️' },
  warp: { name: '워프', icon: '🚪' },
  base: { name: '본부', icon: '🏠' },
};

/**
 * 8 x 5 직사각형 외곽 루프(시계 방향) + 가운데 세로 지름길.
 *
 *   0 → 1 → 2 → 3 → 4 → 5 → 6 → 7
 *   ↑           ↓(갈림길)          ↓
 *  21          22                  8
 *   ↑           ↓                  ↓
 *  20          23                  9
 *   ↑           ↓                  ↓
 *  19          24                 10
 *   ↑           ↓                  ↓
 *  18 ← 17 ← 16 ← 15 ← 14 ← 13 ← 12 ← 11
 *
 * 지름길(22~24)은 짧지만 에너미가 많다. 12번 워프는 20번으로 날아간다.
 */
export const DEFAULT_BOARD: Board = {
  name: '중앙 학원가',
  baseTile: 0,
  tiles: [
    { id: 0, kind: 'base', x: 0, y: 0, next: [1] },
    { id: 1, kind: 'coinPlus', x: 1, y: 0, next: [2] },
    { id: 2, kind: 'empty', x: 2, y: 0, next: [3] },
    { id: 3, kind: 'card', x: 3, y: 0, next: [4, 22] },
    { id: 4, kind: 'coinPlus', x: 4, y: 0, next: [5] },
    { id: 5, kind: 'heal', x: 5, y: 0, next: [6] },
    { id: 6, kind: 'coinMinus', x: 6, y: 0, next: [7] },
    { id: 7, kind: 'coinPlus', x: 7, y: 0, next: [8] },
    { id: 8, kind: 'card', x: 7, y: 1, next: [9] },
    { id: 9, kind: 'coinPlus', x: 7, y: 2, next: [10] },
    { id: 10, kind: 'spawn', x: 7, y: 3, next: [11] },
    { id: 11, kind: 'coinPlus', x: 7, y: 4, next: [12] },
    { id: 12, kind: 'warp', x: 6, y: 4, next: [13], warpTo: 20 },
    { id: 13, kind: 'coinMinus', x: 5, y: 4, next: [14] },
    { id: 14, kind: 'card', x: 4, y: 4, next: [15] },
    { id: 15, kind: 'coinPlus', x: 3, y: 4, next: [16] },
    { id: 16, kind: 'empty', x: 2, y: 4, next: [17] },
    { id: 17, kind: 'spawn', x: 1, y: 4, next: [18] },
    { id: 18, kind: 'coinPlus', x: 0, y: 4, next: [19] },
    { id: 19, kind: 'heal', x: 0, y: 3, next: [20] },
    { id: 20, kind: 'card', x: 0, y: 2, next: [21] },
    { id: 21, kind: 'coinMinus', x: 0, y: 1, next: [0] },
    { id: 22, kind: 'spawn', x: 3, y: 1, next: [23] },
    { id: 23, kind: 'empty', x: 3, y: 2, next: [24] },
    { id: 24, kind: 'spawn', x: 3, y: 3, next: [15] },
  ],
  spawnTiles: [10, 17, 22, 24],
  // 지름길 한가운데. 보스가 길을 막고 서 있다
  bossTile: 23,
};

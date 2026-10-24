import type { Board, MapRes, TileKind } from '../engine/types';

export const TILE_INFO: Record<TileKind, { name: string; icon: string; text?: string }> = {
  empty: { name: '빈 칸', icon: '' },
  windfall: { name: '횡재', icon: '🪙', text: '코인 2 · 3 · 4 · 5 · 10' },
  calamity: { name: '재앙', icon: '⚡', text: '2 피해' },
  checkpoint: { name: '확인 지점', icon: '🚩', text: '체력 +2 · 성 오름' },
  chipShop: { name: '칩 상점', icon: '🔷', text: '유물 · 10 + 5 × 산 수' },
  haste: { name: '질주', icon: '💨', text: '한 번 더' },
  card: { name: '카드', icon: '🃏', text: '카드 2장' },
  monster: { name: '몬스터', icon: '👾', text: '몬스터 · 바로 전투' },
  heal: { name: '회복', icon: '❤️', text: '체력 +2' },
  warp: { name: '워프', icon: '🚪' },
  shop: { name: '상점', icon: '🛒' },
  event: { name: '이벤트', icon: '❓' },
  sand: { name: '유사', icon: '⏳', text: '다음 이동 -2' },
  boost: { name: '가속', icon: '⏩', text: '+1칸' },
  conveyor: { name: '컨베이어', icon: '⏭️', text: '앞으로 3칸' },
  current: { name: '해류', icon: '🌊', text: '앞으로 2칸 · 체력 +1' },
  assault: { name: '돌격문', icon: '🚪', text: '에너미 1 · 코인 +3' },
  trap: { name: '함정', icon: '⚠️', text: '2 피해' },
  ice: { name: '빙판', icon: '🧊', text: '빙판 끝까지' },
  clue: { name: '단서', icon: '🔍', text: '코인 +2 · 증거 +1' },
  clock: { name: '시계탑', icon: '🕰️', text: '오버클럭 +1' },
  stage: { name: '스포트라이트', icon: '🔦', text: '마인드 +2' },
  candy: { name: '사탕 자판기', icon: '🍭', text: '코인 5 → 회복 카드' },
  detention: { name: '반성실', icon: '📝', text: '문제아 2차례' },
  base: { name: '거점', icon: '🏠', text: '체력 +2 · 성 오름' },
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
 * 지름길(22~24)은 짧지만 에너미가 많다. 워프: 12번 → 20번, 6번 → 14번.
 */
export const DEFAULT_BOARD: Board = {
  id: 'campus',
  name: '중앙 학원가',
  baseTile: 0,
  // 네 모서리가 1 ~ 4번 자리의 거점
  homeTiles: [0, 7, 11, 18],
  tiles: [
    { id: 0, kind: 'base', x: 0, y: 0, next: [1] },
    { id: 1, kind: 'windfall', x: 1, y: 0, next: [2] },
    { id: 2, kind: 'shop', x: 2, y: 0, next: [3] },
    { id: 3, kind: 'card', x: 3, y: 0, next: [4, 22] },
    { id: 4, kind: 'windfall', x: 4, y: 0, next: [5] },
    { id: 5, kind: 'heal', x: 5, y: 0, next: [6] },
    { id: 6, kind: 'warp', x: 6, y: 0, next: [7], warpTo: 14 },
    { id: 7, kind: 'base', x: 7, y: 0, next: [8] },
    { id: 8, kind: 'card', x: 7, y: 1, next: [9] },
    { id: 9, kind: 'event', x: 7, y: 2, next: [10] },
    { id: 10, kind: 'monster', x: 7, y: 3, next: [11] },
    { id: 11, kind: 'base', x: 7, y: 4, next: [12] },
    { id: 12, kind: 'warp', x: 6, y: 4, next: [13], warpTo: 20 },
    { id: 13, kind: 'calamity', x: 5, y: 4, next: [14] },
    { id: 14, kind: 'card', x: 4, y: 4, next: [15] },
    { id: 15, kind: 'windfall', x: 3, y: 4, next: [16] },
    { id: 16, kind: 'shop', x: 2, y: 4, next: [17] },
    { id: 17, kind: 'monster', x: 1, y: 4, next: [18] },
    { id: 18, kind: 'base', x: 0, y: 4, next: [19] },
    { id: 19, kind: 'heal', x: 0, y: 3, next: [20] },
    { id: 20, kind: 'card', x: 0, y: 2, next: [21] },
    { id: 21, kind: 'event', x: 0, y: 1, next: [0] },
    { id: 22, kind: 'monster', x: 3, y: 1, next: [23] },
    { id: 23, kind: 'empty', x: 3, y: 2, next: [24] },
    { id: 24, kind: 'monster', x: 3, y: 3, next: [15] },
  ],
  spawnTiles: [10, 17, 22, 24],
  // 지름길 한가운데. 보스가 길을 막고 서 있다
  bossTile: 23,
};

/** 맵 자원 (보드 기믹) */
export const MAP_RES_INFO: Record<MapRes, { name: string; icon: string; text: string }> = {
  evidence: { name: '증거', icon: '🔍', text: '4마다 유물' },
  overclock: { name: '오버클럭', icon: '🕰️', text: '다음 이동 +1씩' },
  mind: { name: '마인드', icon: '🔦', text: '3 이상: 공격력 +1 · 피해를 받으면 -1 (최대 5)' },
  problem: { name: '문제아', icon: '📝', text: '공격력 +2 · 방어력 -2' },
};

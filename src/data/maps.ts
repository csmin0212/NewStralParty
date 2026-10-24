// 보스 전용 맵. 바깥 고리(모서리 좌표) + 지름길(모서리 좌표)로 칸을 만들고, 칸 종류는 맵마다 정한 수만큼 고르게 흩는다.
// 좌표: x 오른쪽, y 아래 (화면에서는 아이소메트릭). 고리는 시계 방향.

import type { Board, EnemyKind, Tile, TileKind } from '../engine/types';
import { AP_BOARD_MAP, AP_THEMES } from './apBoards';

export type Pt = [number, number];

/** 칸 종류 수 (거점 · 보스 칸 · 워프는 따로) */
type Mix = Partial<Record<TileKind, number>>;

/** 맵 그림: 땅 · 길 색, 흩어 놓을 소품, 한두 개 큰 랜드마크 */
export type PropKind =
  | 'block'
  | 'tower'
  | 'tree'
  | 'pine'
  | 'palm'
  | 'cactus'
  | 'rock'
  | 'dune'
  | 'pool'
  | 'lamp'
  | 'lantern'
  | 'crate'
  | 'pipe'
  | 'tent'
  | 'shelf'
  | 'pillar'
  | 'seat'
  | 'umbrella'
  | 'snowman'
  | 'ice'
  | 'torii'
  | 'flag'
  | 'server';

export interface Prop {
  t: PropKind;
  x: number;
  y: number;
  w?: number;
  d?: number;
  h?: number;
  /** 지붕 · 몸 색 */
  c?: string;
  /** 옆면 색 */
  c2?: string;
}

export interface MapTheme {
  /** 섬 윗면 · 격자 · 옆면 */
  ground: string;
  grid: string;
  side: string;
  /** 길: 테두리 · 가운데 · 안쪽 */
  road: [string, string, string];
  /** 빈 칸에 흩어 놓을 소품 (무게) */
  scatter: [PropKind, number][];
  /** 빈 칸마다 소품을 놓을 확률 */
  density: number;
  landmarks: Prop[];
  /** 바닥 글자 */
  label: string;
  /** 소품 색 */
  palette: { a: string; b: string; c: string };
  /** 화면 배경 (맵 바깥) */
  sky: string;
}

export interface MapDef {
  id: string;
  name: string;
  /** 고리 모서리 (시계 방향) */
  loop: Pt[];
  /** 지름길: from(고리 · 지름길 칸) → 모서리들 → to(이미 있는 칸) */
  branches: { from: Pt; via: Pt[]; to: Pt }[];
  homes: [Pt, Pt, Pt, Pt];
  boss: Pt;
  warps?: [Pt, Pt][];
  /** 고리 칸 종류 수 */
  loopMix: Mix;
  /** 지름길 칸 종류 수 */
  branchMix: Mix;
  /** 좌표로 정해 둔 칸 */
  fixed?: Partial<Record<string, TileKind>>;
  /** 돌격문에서 나오는 에너미 */
  assault?: EnemyKind;
  /** 몬스터 칸에서 나오는 에너미 */
  monsters: EnemyKind[];
  theme: MapTheme;
}

const key = (p: Pt) => `${p[0]},${p[1]}`;

/** 모서리 사이를 한 칸씩 잇는다 (끝점 포함, 시작점 제외) */
function walk(from: Pt, corners: Pt[]): Pt[] {
  const out: Pt[] = [];
  let [x, y] = from;
  for (const [cx, cy] of corners) {
    while (x !== cx) {
      x += Math.sign(cx - x);
      out.push([x, y]);
    }
    while (y !== cy) {
      y += Math.sign(cy - y);
      out.push([x, y]);
    }
  }
  return out;
}

/** 맵 id로 정해지는 작은 난수 (칸 종류 흩기) */
function seeded(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** 고르게 흩기: 종류마다 간격을 두고, 이미 찬 칸이면 다음 빈 칸 */
function spread(slots: number[], mix: Mix, rand: () => number, kinds: Map<number, TileKind>) {
  const free = slots.filter((i) => !kinds.has(i));
  const n = free.length;
  const order = Object.entries(mix).sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0)) as [TileKind, number][];
  for (const [kind, count] of order) {
    const offset = Math.floor(rand() * n);
    for (let i = 0; i < count; i++) {
      let pos = Math.floor(offset + (i * n) / count) % n;
      for (let tries = 0; tries < n && kinds.has(free[pos]); tries++) pos = (pos + 1) % n;
      if (!kinds.has(free[pos])) kinds.set(free[pos], kind);
    }
  }
}

export function buildMap(def: MapDef): Board {
  const tiles: Tile[] = [];
  const index = new Map<string, number>();
  const add = (p: Pt): number => {
    const k = key(p);
    if (index.has(k)) return index.get(k)!;
    const id = tiles.length;
    tiles.push({ id, kind: 'empty', x: p[0], y: p[1], next: [] });
    index.set(k, id);
    return id;
  };
  const link = (a: number, b: number) => {
    if (!tiles[a].next.includes(b)) tiles[a].next.push(b);
  };

  // 고리
  const start = def.loop[0];
  const ring = [start, ...walk(start, [...def.loop.slice(1), start]).slice(0, -1)];
  const loopIds = ring.map(add);
  loopIds.forEach((id, i) => link(id, loopIds[(i + 1) % loopIds.length]));

  // 지름길
  const branchIds: number[] = [];
  for (const b of def.branches) {
    const path = walk(b.from, [...b.via, b.to]);
    let prev = add(b.from);
    for (const p of path) {
      const existed = index.has(key(p));
      const id = add(p);
      if (!existed) branchIds.push(id);
      link(prev, id);
      prev = id;
    }
  }

  const kinds = new Map<number, TileKind>();
  const homes = def.homes.map((h) => index.get(key(h))!);
  for (const h of homes) kinds.set(h, 'base');
  const bossTile = index.get(key(def.boss))!;
  kinds.set(bossTile, 'empty');
  for (const [from, to] of def.warps ?? []) {
    const f = index.get(key(from))!;
    kinds.set(f, 'warp');
    tiles[f].warpTo = index.get(key(to))!;
  }
  for (const [k, kind] of Object.entries(def.fixed ?? {})) if (kind) kinds.set(index.get(k)!, kind);
  // 확인 지점: 지름길 가운데 (원작 保障点은 맵 가운데 하나)
  const mid = branchIds.filter((id) => !kinds.has(id))[Math.floor(branchIds.length / 2)];
  if (mid !== undefined) kinds.set(mid, 'checkpoint');
  const rand = seeded(def.id);
  spread(loopIds, def.loopMix, rand, kinds);
  spread(branchIds, def.branchMix, rand, kinds);
  for (const [id, kind] of kinds) tiles[id].kind = kind;
  // 갈림길 칸이 워프면 길이 끊기므로 워프는 갈림길이 아닌 칸에만 (데이터에서 지킨다)

  return {
    id: def.id,
    name: def.name,
    tiles,
    baseTile: homes[0],
    homeTiles: homes,
    spawnTiles: tiles.filter((t) => t.kind === 'monster').map((t) => t.id),
    bossTile,
    assault: def.assault,
    monsters: def.monsters,
  };
}

// ───────────────────────── 맵 ─────────────────────────

/** 원작 맵 구성 비율 (星趴·梦想号 56칸): 횡재 5 · 재앙 6 · 카드 4 · 회복 4 · 상점 3 · 칩 상점 1 · 이벤트 8 · 몬스터 8 · 질주 4 */
const LOOP_BASE: Mix = { windfall: 4, calamity: 3, card: 3, heal: 3, shop: 2, chipShop: 1, event: 4, monster: 4, haste: 2 };

export const MAP_DEFS: MapDef[] = [
  {
    id: 'abydos',
    monsters: ['robot', 'drone', 'thief'],
    name: '아비도스 사막',
    loop: [[0, 0], [11, 0], [11, 7], [0, 7]],
    branches: [{ from: [3, 0], via: [[3, 3], [8, 3]], to: [8, 7] }],
    homes: [[0, 0], [11, 0], [11, 7], [0, 7]],
    boss: [5, 3],
    warps: [[[6, 7], [11, 3]]],
    loopMix: { ...LOOP_BASE, sand: 4, boost: 2 },
    branchMix: { sand: 3, card: 1, monster: 1, boost: 1 },
    assault: 'drone',
    theme: {
      ground: '#f3dcb0', grid: '#e6c792', side: '#c99a5b', road: ['#d8b27a', '#fff3dc', '#fbe7c2'],
      scatter: [['dune', 4], ['cactus', 3], ['rock', 2], ['pillar', 1]], density: 0.55,
      landmarks: [{ t: 'block', x: 5, y: 1, w: 1.6, d: 0.9, h: 34, c: '#e9cf9f', c2: '#c9a06a' }, { t: 'pillar', x: 9.4, y: 5.2, h: 50 }],
      label: 'ABYDOS DESERT', palette: { a: '#e8b86b', b: '#7fae6a', c: '#b98a5a' }, sky: 'linear-gradient(180deg, #ffd9a3, #f6b977)',
    },
  },
  {
    id: 'factory',
    monsters: ['automaton', 'robot', 'drone'],
    name: '데카그라마톤 생산 시설',
    loop: [[0, 0], [6, 0], [6, 2], [11, 2], [11, 8], [0, 8]],
    branches: [{ from: [3, 0], via: [[3, 5]], to: [11, 5] }],
    homes: [[0, 0], [11, 2], [11, 8], [0, 8]],
    boss: [7, 5],
    loopMix: { ...LOOP_BASE, conveyor: 3, assault: 2 },
    branchMix: { conveyor: 4, assault: 1, monster: 1, card: 1 },
    assault: 'automaton',
    theme: {
      ground: '#d9e1ea', grid: '#c2ccd8', side: '#7d8ba0', road: ['#9aa8b9', '#f4f7fa', '#e3e9f0'],
      scatter: [['crate', 3], ['pipe', 3], ['block', 2], ['lamp', 1]], density: 0.6,
      landmarks: [{ t: 'tower', x: 8, y: 3, w: 1.2, d: 1, h: 90, c: '#c9d3df', c2: '#8f9db1' }],
      label: 'AUTOMATON FACTORY', palette: { a: '#8fa3b8', b: '#ffb627', c: '#5f6f84' }, sky: 'linear-gradient(180deg, #cfd8e3, #9fb0c4)',
    },
  },
  {
    id: 'slumpia-park',
    monsters: ['slumpia', 'thief', 'drone'],
    name: '슬럼피아 놀이공원',
    loop: [[0, 0], [11, 0], [11, 7], [6, 7], [6, 4], [5, 4], [5, 7], [0, 7]],
    branches: [{ from: [2, 0], via: [[2, 3], [9, 3]], to: [9, 0] }],
    homes: [[0, 0], [11, 0], [11, 7], [0, 7]],
    boss: [6, 3],
    warps: [[[3, 7], [10, 0]]],
    loopMix: { ...LOOP_BASE, boost: 3, trap: 2 },
    branchMix: { boost: 4, event: 1, monster: 1 },
    assault: 'slumpia',
    theme: {
      ground: '#ffe7f1', grid: '#f9cfe0', side: '#d88aab', road: ['#f3a8c6', '#fffafc', '#ffeef6'],
      scatter: [['tent', 3], ['flag', 2], ['tree', 2], ['lamp', 1]], density: 0.55,
      landmarks: [{ t: 'tower', x: 8, y: 5, w: 1.4, d: 1.2, h: 70, c: '#ffd166', c2: '#e39b3c' }, { t: 'tent', x: 2.5, y: 5.2, w: 1.6, d: 1.2, h: 46, c: '#ff6fae' }],
      label: 'SLUMPIA', palette: { a: '#ff6fae', b: '#ffd166', c: '#6ccff6' }, sky: 'linear-gradient(180deg, #ffd6e8, #c5b4ff)',
    },
  },
  {
    id: 'cathedral',
    monsters: ['delinquent', 'robot', 'thief'],
    name: '트리니티 고성당',
    loop: [[3, 0], [8, 0], [8, 3], [11, 3], [11, 6], [8, 6], [8, 8], [3, 8], [3, 6], [0, 6], [0, 3], [3, 3]],
    branches: [
      { from: [5, 0], via: [], to: [5, 8] },
      { from: [0, 4], via: [], to: [11, 4] },
    ],
    homes: [[3, 0], [11, 3], [8, 8], [0, 6]],
    boss: [5, 4],
    loopMix: { ...LOOP_BASE, heal: 5, trap: 2 },
    branchMix: { heal: 2, card: 2, monster: 1, event: 1 },
    assault: 'delinquent',
    theme: {
      ground: '#f6efe2', grid: '#e6d9c2', side: '#b59a74', road: ['#d9c39d', '#fffbf3', '#f6ead4'],
      scatter: [['pillar', 3], ['lamp', 2], ['tree', 1]], density: 0.5,
      landmarks: [{ t: 'tower', x: 1, y: 1, w: 1.2, d: 1.2, h: 110, c: '#f1e4c8', c2: '#b8986a' }, { t: 'tower', x: 9.4, y: 1, w: 1.2, d: 1.2, h: 110, c: '#f1e4c8', c2: '#b8986a' }],
      label: 'COMMUNIO SANCTORUM', palette: { a: '#d8b46a', b: '#9b6bff', c: '#e8405f' }, sky: 'linear-gradient(180deg, #fff1d6, #e8c9a3)',
    },
  },
  {
    id: 'arena',
    monsters: ['kaitenger', 'robot', 'drone'],
    name: '카이텐 특촬 결승 무대',
    loop: [[2, 0], [9, 0], [9, 1], [11, 1], [11, 6], [9, 6], [9, 7], [2, 7], [2, 6], [0, 6], [0, 1], [2, 1]],
    branches: [
      { from: [5, 0], via: [], to: [5, 7] },
      { from: [0, 3], via: [], to: [11, 3] },
    ],
    homes: [[2, 0], [11, 1], [9, 7], [0, 6]],
    boss: [5, 3],
    loopMix: { ...LOOP_BASE, stage: 4, boost: 2 },
    branchMix: { stage: 3, assault: 1, monster: 1 },
    assault: 'kaitenger',
    theme: {
      ground: '#e8eaf6', grid: '#d0d4ea', side: '#5d6598', road: ['#aab0d6', '#ffffff', '#eef0fb'],
      scatter: [['seat', 4], ['lamp', 2], ['flag', 1]], density: 0.6,
      landmarks: [{ t: 'block', x: 7, y: 4.4, w: 1.6, d: 1.2, h: 18, c: '#e8405f', c2: '#a32a45' }],
      label: 'GRAND FINAL', palette: { a: '#e8405f', b: '#ffd166', c: '#3d5478' }, sky: 'linear-gradient(180deg, #2b3e5f, #6a5acd)',
    },
  },
  {
    id: 'library',
    monsters: ['perorominion', 'robot', 'thief'],
    name: '무한 도서관',
    loop: [[0, 0], [11, 0], [11, 8], [0, 8]],
    branches: [
      { from: [4, 0], via: [[4, 4]], to: [0, 4] },
      { from: [11, 4], via: [[7, 4]], to: [7, 8] },
      { from: [4, 4], via: [], to: [7, 4] },
    ],
    homes: [[0, 0], [11, 0], [11, 8], [0, 8]],
    boss: [5, 4],
    warps: [[[2, 8], [9, 0]], [[9, 8], [2, 0]]],
    loopMix: { ...LOOP_BASE, clue: 5 },
    branchMix: { clue: 3, card: 2, monster: 1 },
    assault: 'perorominion',
    theme: {
      ground: '#efe2cf', grid: '#ddc8aa', side: '#8a6a47', road: ['#c9a97c', '#fffaf1', '#f4e7d2'],
      scatter: [['shelf', 5], ['lamp', 1], ['crate', 1]], density: 0.7,
      landmarks: [{ t: 'shelf', x: 1.5, y: 2, w: 1.8, d: 0.5, h: 60 }, { t: 'shelf', x: 8.6, y: 6, w: 1.8, d: 0.5, h: 60 }],
      label: 'LIBRARY OF LORE', palette: { a: '#8a5a3c', b: '#4f8a5b', c: '#c9a97c' }, sky: 'linear-gradient(180deg, #f2dfc0, #c79e70)',
    },
  },
  {
    id: 'datatower',
    monsters: ['robot', 'drone', 'pillar'],
    name: '데이터 타워',
    loop: [[0, 0], [11, 0], [11, 7], [0, 7]],
    branches: [{ from: [2, 0], via: [[2, 2], [9, 2], [9, 5], [4, 5]], to: [4, 7] }],
    homes: [[0, 0], [11, 0], [11, 7], [0, 7]],
    boss: [9, 3],
    loopMix: { ...LOOP_BASE, boost: 3, trap: 2 },
    branchMix: { boost: 3, trap: 2, monster: 1, card: 1 },
    assault: 'robot',
    theme: {
      ground: '#dfe9f5', grid: '#bfd2ea', side: '#3d5478', road: ['#7fa7d9', '#f5faff', '#dceafb'],
      scatter: [['server', 4], ['lamp', 1], ['pipe', 1]], density: 0.6,
      landmarks: [{ t: 'tower', x: 5.6, y: 3.2, w: 1.4, d: 1, h: 120, c: '#cfe3f8', c2: '#5d7fa8' }],
      label: 'DECAGRAMMATON · HOD', palette: { a: '#33aef3', b: '#3d5478', c: '#8edbff' }, sky: 'linear-gradient(180deg, #1f3a68, #4a9bef)',
    },
  },
  {
    id: 'circus',
    monsters: ['slumpia', 'thief', 'delinquent'],
    name: '슬럼피아 서커스 거리',
    loop: [[0, 0], [3, 0], [3, 1], [6, 1], [6, 0], [11, 0], [11, 7], [8, 7], [8, 6], [5, 6], [5, 7], [0, 7]],
    branches: [{ from: [3, 1], via: [[3, 4], [8, 4]], to: [8, 6] }],
    homes: [[0, 0], [11, 0], [11, 7], [0, 7]],
    boss: [5, 4],
    loopMix: { ...LOOP_BASE, event: 5, boost: 2 },
    branchMix: { event: 3, monster: 1, card: 1 },
    assault: 'slumpia',
    theme: {
      ground: '#fff1dc', grid: '#f6dcb6', side: '#b0603f', road: ['#e8a068', '#fffaf2', '#fdebd2'],
      scatter: [['tent', 3], ['lantern', 3], ['flag', 2]], density: 0.6,
      landmarks: [{ t: 'tent', x: 5.6, y: 2.3, w: 2, d: 1.2, h: 56, c: '#e8405f' }],
      label: 'CIRCUS OF SLUMPIA', palette: { a: '#e8405f', b: '#ffd166', c: '#7a3fd1' }, sky: 'linear-gradient(180deg, #ffd9b0, #e88fa0)',
    },
  },
  {
    id: 'resort',
    monsters: ['drone', 'robot', 'thief'],
    name: '여름 해변 리조트',
    loop: [[0, 0], [11, 0], [11, 5], [8, 5], [8, 8], [0, 8]],
    branches: [{ from: [4, 0], via: [[4, 5]], to: [8, 5] }],
    homes: [[0, 0], [11, 0], [8, 8], [0, 8]],
    boss: [4, 4],
    loopMix: { ...LOOP_BASE, current: 4, heal: 4 },
    branchMix: { current: 3, monster: 1, card: 1 },
    assault: 'drone',
    theme: {
      ground: '#fbefd2', grid: '#efdcb0', side: '#3fa3c9', road: ['#e6c98e', '#fffdf6', '#fdf2d8'],
      scatter: [['palm', 4], ['umbrella', 3], ['rock', 1]], density: 0.55,
      landmarks: [{ t: 'pool', x: 9.2, y: 6.3, w: 2.2, d: 1.8, c: '#5ec8e8' }, { t: 'block', x: 1.4, y: 2, w: 1.4, d: 1, h: 46, c: '#ffffff', c2: '#a9d8ea' }],
      label: 'SUMMER RESORT', palette: { a: '#5ec8e8', b: '#ff9a5a', c: '#7fc96a' }, sky: 'linear-gradient(180deg, #8edbff, #4fb6f5)',
    },
  },
  {
    id: 'ghost-alley',
    monsters: ['incarnation', 'delinquent', 'thief'],
    name: '백귀야행 골목',
    loop: [[0, 0], [5, 0], [5, 2], [11, 2], [11, 8], [6, 8], [6, 6], [0, 6]],
    branches: [{ from: [2, 0], via: [[2, 4], [8, 4]], to: [8, 8] }],
    homes: [[0, 0], [11, 2], [11, 8], [0, 6]],
    boss: [5, 4],
    loopMix: { ...LOOP_BASE, clock: 3, candy: 2, trap: 2 },
    branchMix: { clock: 2, trap: 2, monster: 1, candy: 1 },
    assault: 'incarnation',
    theme: {
      ground: '#3b3458', grid: '#4c4470', side: '#221d38', road: ['#6b5f9a', '#f2e8ff', '#cdbff0'],
      scatter: [['lantern', 4], ['torii', 1], ['block', 2], ['tree', 1]], density: 0.6,
      landmarks: [{ t: 'torii', x: 8.6, y: 0.4, h: 60 }, { t: 'block', x: 3.6, y: 6.9, w: 1.4, d: 0.8, h: 50, c: '#5a4a7a', c2: '#2f2647' }],
      label: 'HYAKKIYAKO', palette: { a: '#ff9a3c', b: '#8a5aff', c: '#e8405f' }, sky: 'linear-gradient(180deg, #1c1733, #4a3570)',
    },
  },
  {
    id: 'undercroft',
    monsters: ['teapot', 'delinquent', 'robot'],
    name: '지하 대성당 학원',
    loop: [[0, 0], [11, 0], [11, 8], [0, 8]],
    branches: [
      { from: [5, 0], via: [], to: [5, 8] },
      { from: [0, 4], via: [], to: [5, 4] },
      { from: [5, 4], via: [], to: [11, 4] },
    ],
    homes: [[0, 0], [11, 0], [11, 8], [0, 8]],
    boss: [5, 5],
    loopMix: { ...LOOP_BASE, detention: 3 },
    branchMix: { detention: 2, heal: 2, card: 1, monster: 1 },
    assault: 'teapot',
    theme: {
      ground: '#e6e9f4', grid: '#cfd5ea', side: '#4a4f7a', road: ['#a3a9d0', '#ffffff', '#eceffb'],
      scatter: [['pillar', 3], ['seat', 2], ['lamp', 2]], density: 0.55,
      landmarks: [{ t: 'tower', x: 2, y: 1.6, w: 1.6, d: 0.6, h: 100, c: '#d8c690', c2: '#9a8550' }, { t: 'tower', x: 8, y: 1.6, w: 1.6, d: 0.6, h: 100, c: '#d8c690', c2: '#9a8550' }],
      label: 'GREGORIUS', palette: { a: '#d8b46a', b: '#5d6598', c: '#e8405f' }, sky: 'linear-gradient(180deg, #2b2f55, #5d6598)',
    },
  },
  {
    id: 'snowfield',
    monsters: ['robot', 'drone', 'delinquent'],
    name: '설원 전초 기지',
    loop: [[0, 0], [11, 0], [11, 7], [0, 7]],
    branches: [
      { from: [0, 3], via: [[5, 3]], to: [5, 0] },
      { from: [11, 4], via: [[6, 4]], to: [6, 7] },
    ],
    homes: [[0, 0], [11, 0], [11, 7], [0, 7]],
    boss: [5, 3],
    loopMix: { ...LOOP_BASE, heal: 2, ice: 5 },
    branchMix: { ice: 4, monster: 1, card: 1 },
    assault: 'robot',
    theme: {
      ground: '#f4f9ff', grid: '#dbe9f7', side: '#8fb4d6', road: ['#b9d3ec', '#ffffff', '#eaf4ff'],
      scatter: [['pine', 4], ['snowman', 1], ['ice', 2], ['rock', 1]], density: 0.6,
      landmarks: [{ t: 'block', x: 8.4, y: 1.6, w: 1.6, d: 1.2, h: 40, c: '#ffffff', c2: '#a9c4de' }],
      label: 'SNOWFIELD OUTPOST', palette: { a: '#a9d8ff', b: '#4f8a5b', c: '#ffffff' }, sky: 'linear-gradient(180deg, #dceeff, #9cc3e8)',
    },
  },
];

export const MAPS: Record<string, Board> = { ...Object.fromEntries(MAP_DEFS.map((d) => [d.id, buildMap(d)])), ...AP_BOARD_MAP };
export const MAP_THEMES: Record<string, MapTheme> = { ...Object.fromEntries(MAP_DEFS.map((d) => [d.id, d.theme])), ...AP_THEMES };

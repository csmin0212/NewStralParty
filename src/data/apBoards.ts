// 아스트랄 파티 협동 맵 보드. 원작 격자 · 칸 연결 그대로 (docs/AP_MAPS.md).
// grid: 한 줄 = 한 행, 칸은 띄어쓰기로 나눈다. 열은 A부터, 행은 1부터 → 칸 이름 'F1'.
// paths: 칸 이름을 잇는 길 (양방향). 원작처럼 지나온 칸으로는 되돌아가지 않는다.

import type { Board, EnemyKind, Tile, TileKind } from '../engine/types';
import type { MapTheme } from './maps';

/** S1~S4 시작 · B 보장점 · Q 칩 상점 · $ 상점 · M 몬스터 · A 몬스터 돌격문 · P 포털 · H 질주 · C 카드 · E 이벤트 · W 횡재 · X 재앙 · R 회복 · Y 사탕 기계 */
const KIND: Record<string, TileKind> = {
  B: 'checkpoint',
  Q: 'chipShop',
  $: 'shop',
  M: 'monster',
  A: 'assault',
  P: 'warp',
  H: 'haste',
  C: 'card',
  E: 'event',
  W: 'windfall',
  X: 'calamity',
  R: 'heal',
  Y: 'candy',
};

export interface ApBoardDef {
  id: string;
  name: string;
  grid: string;
  paths: string[];
  /** 시작 칸에서 처음 나아가는 칸 (P1~P4). 없으면 처음 움직일 때 고른다 */
  facing?: [string, string, string, string];
  /** 멀리 이어진 칸 (원작 점프 선) */
  jumps?: [string, string][];
  /** 건물을 지을 수 있는 칸 (森秋幻境) */
  buildable?: string[];
  /** 보스가 처음 나오는 칸 */
  boss: string;
  /** 몬스터 칸에서 나오는 몬스터 */
  monsters: EnemyKind[];
  theme: MapTheme;
}

const col = (c: string) => c.charCodeAt(0) - 65;

/** 'F12' → [5, 11] */
function cellXY(cell: string): [number, number] {
  return [col(cell[0]), Number(cell.slice(1)) - 1];
}

export function buildApBoard(def: ApBoardDef): Board {
  const tiles: Tile[] = [];
  const cells: Record<string, number> = {};
  const homes: number[] = [];
  def.grid
    .trim()
    .split('\n')
    .forEach((line, row) => {
      line
        .trim()
        .split(/\s+/)
        .forEach((tok, c) => {
          if (tok === '.') return;
          const cell = `${String.fromCharCode(65 + c)}${row + 1}`;
          const id = tiles.length;
          const start = /^S([1-4])$/.exec(tok);
          const kind: TileKind = start ? 'base' : KIND[tok];
          if (!kind) throw new Error(`${def.id}: 모르는 칸 ${tok} (${cell})`);
          if (start) homes[Number(start[1]) - 1] = id;
          tiles.push({ id, kind, x: c, y: row, next: [], cell });
          cells[cell] = id;
        });
    });
  const at = (cell: string) => {
    const id = cells[cell];
    if (id === undefined) throw new Error(`${def.id}: 없는 칸 ${cell}`);
    return id;
  };
  const link = (a: number, b: number) => {
    if (!tiles[a].next.includes(b)) tiles[a].next.push(b);
    if (!tiles[b].next.includes(a)) tiles[b].next.push(a);
  };
  for (const path of def.paths) {
    const ids = path.trim().split(/\s+/).map(at);
    for (let i = 1; i < ids.length; i++) link(ids[i - 1], ids[i]);
  }
  for (const [a, b] of def.jumps ?? []) link(at(a), at(b));
  const bossTile = at(def.boss);
  return {
    id: def.id,
    name: def.name,
    tiles,
    baseTile: homes[0],
    homeTiles: homes,
    spawnTiles: tiles.filter((t) => t.kind === 'monster').map((t) => t.id),
    bossTile,
    monsters: def.monsters,
    twoWay: true,
    cells,
    facing: def.facing?.map(at),
    buildable: def.buildable?.map(at),
  };
}

export { cellXY };

// ───────────────────────── 맵 그림 ─────────────────────────

const theme = (t: Omit<MapTheme, 'landmarks'> & { landmarks?: MapTheme['landmarks'] }): MapTheme => ({ landmarks: [], ...t });

const SEA = theme({
  ground: '#cfeaf5', grid: '#b5dcec', side: '#5a9fc0', road: ['#7dbcd8', '#ffffff', '#e8f6fc'],
  scatter: [['crate', 2], ['lamp', 2], ['umbrella', 2], ['palm', 1]], density: 0.4,
  label: 'DREAMA', palette: { a: '#4fb6f5', b: '#ff9a5a', c: '#ffffff' }, sky: 'linear-gradient(180deg, #8edbff, #4fb6f5)',
});
const FESTIVAL = theme({
  ground: '#f2e3d0', grid: '#e4cfb6', side: '#a8744d', road: ['#c99a6b', '#fff6ea', '#f6e3cb'],
  scatter: [['lantern', 4], ['torii', 1], ['tree', 2]], density: 0.45,
  label: 'SOUL CELEBRATION', palette: { a: '#e8405f', b: '#ffb627', c: '#7a3fd1' }, sky: 'linear-gradient(180deg, #2b2149, #6b3a6e)',
});
const TOWN = theme({
  ground: '#e6eef0', grid: '#d2dfe2', side: '#6f8f96', road: ['#9db6bb', '#ffffff', '#eef5f6'],
  scatter: [['lantern', 3], ['pool', 2], ['tree', 2], ['flag', 1]], density: 0.45,
  label: 'WATER TOWN', palette: { a: '#e8405f', b: '#ffd166', c: '#3d8f8a' }, sky: 'linear-gradient(180deg, #ffd9b0, #e88fa0)',
});
const ACADEMY = theme({
  ground: '#e8e2f4', grid: '#d6cdea', side: '#7464a3', road: ['#a597cf', '#ffffff', '#f1edfa'],
  scatter: [['shelf', 2], ['lamp', 2], ['pillar', 2], ['tree', 1]], density: 0.45,
  label: 'MAGIC ACADEMY', palette: { a: '#9b6bff', b: '#ffd166', c: '#e8405f' }, sky: 'linear-gradient(180deg, #d6c8ff, #8e7ad8)',
});
const PARK = theme({
  ground: '#d4f0ec', grid: '#bfe6e0', side: '#4c9c92', road: ['#7cc6bb', '#ffffff', '#e6f8f5'],
  scatter: [['pool', 3], ['umbrella', 2], ['palm', 2], ['flag', 1]], density: 0.45,
  label: 'DRAGON PALACE', palette: { a: '#ff6f61', b: '#ffd166', c: '#3ab0a2' }, sky: 'linear-gradient(180deg, #a8ecff, #5ac8e8)',
});
const ALLEY = theme({
  ground: '#e3dcef', grid: '#cfc4e2', side: '#5a4a7a', road: ['#8a7aab', '#f7f2ff', '#e9e1f7'],
  scatter: [['lamp', 3], ['crate', 2], ['lantern', 2], ['pipe', 1]], density: 0.5,
  label: 'GHOST ALLEY', palette: { a: '#ff9a3c', b: '#8a5aff', c: '#e8405f' }, sky: 'linear-gradient(180deg, #1c1733, #4a3570)',
});
const FOREST = theme({
  ground: '#f1e6cf', grid: '#e3d3b2', side: '#9a6b3c', road: ['#c99a6b', '#fffaf0', '#f6ead3'],
  scatter: [['tree', 4], ['pine', 2], ['rock', 1]], density: 0.55,
  label: 'AUTUMNWOOD', palette: { a: '#e8823c', b: '#c8a03c', c: '#7a9c4a' }, sky: 'linear-gradient(180deg, #ffd9a3, #e8a06b)',
});
const GARDEN = theme({
  ground: '#e9f1df', grid: '#d6e5c6', side: '#6b8a4a', road: ['#a7c08a', '#ffffff', '#f2f8ea'],
  scatter: [['tree', 3], ['pool', 1], ['lantern', 2], ['pillar', 1]], density: 0.45,
  label: 'GARDEN COURTYARD', palette: { a: '#e8405f', b: '#ffb627', c: '#3d8f6a' }, sky: 'linear-gradient(180deg, #fff1d6, #f2c6a0)',
});

// ───────────────────────── 맵 ─────────────────────────

export const AP_BOARDS: ApBoardDef[] = [
  {
    id: 'dreama',
    name: '드리마',
    // 쌍동선: 두 세로 줄기 · 좌우 선체 · 9행 갑판 · 가운데 마름모 · 고물 고리
    grid: `
      . . . . E Q E . . . .
      . . . P X . X P . . .
      . . R . A . A . R . .
      . . W . C . C . W . .
      . . S3 . S2 . S1 . S4 . .
      . . M . H . H . M . .
      . X . . E . E . . X .
      H . . . M . M . . . H
      C M $ E A . A E $ M C
      E . . . X . X . . . E
      . P W . . $ . . W P .
      . . . R . W . R . . .
      . . . . M B M . . . .`,
    paths: [
      'E2 E3 E4 E5 E6 E7 E8 E9',
      'G2 G3 G4 G5 G6 G7 G8 G9',
      'E2 E1 F1 G1 G2',
      'E2 D2 C3 C4 C5 C6 B7 A8 A9',
      'G2 H2 I3 I4 I5 I6 J7 K8 K9',
      'A9 B9 C9 D9 E9',
      'G9 H9 I9 J9 K9',
      'E9 E10 F11 G10 G9',
      'F11 F12 F13',
      'A9 A10 B11 C11 D12 E13 F13 G13 H12 I11 J11 K10 K9',
    ],
    boss: 'F1',
    monsters: ['sharkPirate', 'thief'],
    theme: SEA,
  },
  {
    id: 'soul',
    name: '영혼 축전',
    // 큰 고리(위 · 아래 호 + 양옆 고리) · 안쪽 두 길 · 가운데 보장점 가로줄
    grid: `
      . . . . E X $ A E . . . .
      . . . . H . . . H . . . .
      . . P M S2 . . . S3 M P . .
      . . X . . . . . . . X . .
      A W C H M . . . X R C W A
      R . . . E . . . M . . . X
      Q . . . $ A B A $ . . . Q
      X . . . M . . . E . . . R
      A W C R X . . . M H C W A
      . . X . . . . . . . X . .
      . . P . . . . . . . P . .
      . . M . . A $ X . . M . .
      . . S1 H E . . . E H S4 . .`,
    paths: [
      'C5 C4 C3 D3 E3 E2 E1 F1 G1 H1 I1 I2 I3 J3 K3 K4 K5',
      'C9 C10 C11 C12 C13 D13 E13 F12 G12 H12 I13 J13 K13 K12 K11 K10 K9',
      'C5 B5 A5 A6 A7 A8 A9 B9 C9',
      'K5 L5 M5 M6 M7 M8 M9 L9 K9',
      'C5 D5 E5 E6 E7 E8 E9 D9 C9',
      'K5 J5 I5 I6 I7 I8 I9 J9 K9',
      'E7 F7 G7 H7 I7',
    ],
    boss: 'G7',
    monsters: ['blueSpirit', 'redSpirit', 'thief'],
    theme: FESTIVAL,
  },
  {
    id: 'watertown',
    name: '워터 타운',
    // 안쪽 고리 20칸(네 귀퉁이에 시작) · 바깥 귀퉁이 고리 4개
    grid: `
      B E C R . . P M H Q
      M . . X . . X . . W
      H . S4 P W $ A S3 . A
      $ W R . . . . M X E
      . . E . . . . C . .
      . . C . . . . E . .
      E X M . . . . R W $
      A . S1 A $ W P S2 . H
      W . . X . . X . . M
      Q H M P . . R C E B`,
    paths: [
      'C3 D3 E3 F3 G3 H3 H4 H5 H6 H7 H8 G8 F8 E8 D8 C8 C7 C6 C5 C4 C3',
      'D3 D2 D1 C1 B1 A1 A2 A3 A4 B4 C4',
      'G3 G2 G1 H1 I1 J1 J2 J3 J4 I4 H4',
      'H7 I7 J7 J8 J9 J10 I10 H10 G10 G9 G8',
      'D8 D9 D10 C10 B10 A10 A9 A8 A7 B7 C7',
    ],
    boss: 'A1',
    monsters: ['croak', 'thief'],
    theme: TOWN,
  },
  {
    id: 'academy',
    name: '매직 아카데미',
    // 바깥 마당: 42칸 큰 고리 + 양쪽 3칸 지름길 (θ 모양)
    grid: `
      . . . M H C B C H M . . .
      . . R E . . . . . E R . .
      . . A . . . . . . . A . .
      S1 E $ E X . . . X E $ E S3
      P . . . C . . . C . . . P
      M . . . A X B X A . . . M
      A . . . H . . . H . . . A
      R H W X S2 . . . S4 X W H R`,
    paths: [
      'A4 B4 C4 C3 C2 D2 D1 E1 F1 G1 H1 I1 J1 J2 K2 K3 K4 L4 M4 M5 M6 M7 M8 L8 K8 J8 I8 I7 I6 H6 G6 F6 E6 E7 E8 D8 C8 B8 A8 A7 A6 A5 A4',
      'C4 D4 E4 E5 E6',
      'K4 J4 I4 I5 I6',
    ],
    boss: 'G1',
    monsters: ['teapot', 'mutantTeapot', 'thief'],
    theme: ACADEMY,
  },
  {
    id: 'academy-library',
    name: '마법 도서관',
    // 36칸 바깥 고리 + 가운데 가로줄 + 보장점에서 칩 상점까지 세로줄
    grid: `
      . A M C Q C M A .
      W C . . E . . C W
      M . . . A . . . M
      H . . . H . . . H
      S1 . . . C . . . S3
      W . . . $ . . . W
      $ E M W B W M E $
      A . . . . . . . A
      H . . . . . . . H
      E S2 . . . . . S4 E
      . A A W B W A A .`,
    paths: [
      'B1 C1 D1 E1 F1 G1 H1 H2 I2 I3 I4 I5 I6 I7 I8 I9 I10 H10 H11 G11 F11 E11 D11 C11 B11 B10 A10 A9 A8 A7 A6 A5 A4 A3 A2 B2 B1',
      'A7 B7 C7 D7 E7 F7 G7 H7 I7',
      'E7 E6 E5 E4 E3 E2 E1',
    ],
    boss: 'E7',
    monsters: ['teapot', 'mutantTeapot', 'thief'],
    theme: ACADEMY,
  },
  {
    id: 'academy-dessert',
    name: '디저트 공간',
    grid: `
      . A M C Q C M A .
      . C . . $ . . C .
      M . . . A . . . M
      H . . . H . . . H
      S1 . . . C . . . S3
      W . . . E . . . W
      . $ M W B W M $ .
      A . . . . . . . A
      H . . . . . . . H
      . S2 E . . . E S4 .
      . . A W B W A . .`,
    paths: [
      'B1 C1 D1 E1 F1 G1 H1 H2 I3 I4 I5 I6 H7 I8 I9 H10 G10 G11 F11 E11 D11 C11 C10 B10 A9 A8 B7 A6 A5 A4 A3 B2 B1',
      'B7 C7 D7 E7 F7 G7 H7',
      'E7 E6 E5 E4 E3 E2 E1',
    ],
    boss: 'E7',
    monsters: ['teapot', 'mutantTeapot', 'thief'],
    theme: ACADEMY,
  },
  {
    id: 'dragonpalace',
    name: '드래곤 팰리스 뮤즈먼트 파크',
    // 안쪽 고리 18칸(네 귀퉁이에 시작) · 바깥 고리 34칸 · 위아래 다리 2개
    grid: `
      . Q W H C $ . B . M E H $
      . E . . . . . . . . . . X
      . M . . . . . X . . . . P
      A . . . S4 H M W E R S1 . A
      . . . . A . . . . . C . B
      B . . . C . . . . . A . .
      A . . . S3 R E W M H S2 . A
      . P . . . . . X . . . . M
      . X . . . . . . . . . . E
      . $ W H C M . B . $ E H Q`,
    paths: [
      'K4 K5 K6 K7 J7 I7 H7 G7 F7 E7 E6 E5 E4 F4 G4 H4 I4 J4 K4',
      'H4 H3 H1',
      'H7 H8 H10',
      'H1 J1 K1 L1 M1 M2 M3 M4 M5 M7 M8 M9 M10 L10 K10 J10 H10 F10 E10 D10 C10 B10 B9 B8 A7 A6 A4 B3 B2 B1 C1 D1 E1 F1 H1',
    ],
    facing: ['J4', 'J7', 'F7', 'F4'],
    boss: 'H1',
    monsters: ['sharkPirate', 'crab', 'thief'],
    theme: PARK,
  },
  {
    id: 'ghostalley',
    name: '유령 골목',
    // 바깥 고리 34칸 · 안쪽 T자 (가운데 사탕 기계)
    grid: `
      . . A E B X A . .
      . H . . . . . H .
      . $ . . . . . $ .
      . S1 . . . . . S2 .
      . . W . . . W . .
      . . R M Y M R . .
      X E . . C . . E X
      C . . . E . . . C
      S4 . . . A . . . S3
      . M . . Q . . M .
      . H . . R . . H .
      . $ W E B X W $ .`,
    paths: [
      'B4 B3 B2 C1 D1 E1 F1 G1 H2 H3 H4 G5 G6 H7 I7 I8 I9 H10 H11 H12 G12 F12 E12 D12 C12 B12 B11 B10 A9 A8 A7 B7 C6 C5 B4',
      'G6 F6 E6 D6 C6',
      'E6 E7 E8 E9 E10 E11 E12',
    ],
    facing: ['C5', 'G5', 'I8', 'B10'],
    boss: 'E8',
    monsters: ['monkeyBox', 'thief'],
    theme: ALLEY,
  },
  {
    id: 'autumnwood',
    name: '가을숲 환상경',
    // 바깥 고리 세 호 + 가운데 보장점으로 가는 세 줄기
    grid: `
      . . S1 A H E M X Q A S2 . .
      . . C . . . . . . . W . .
      . . E . . . . . . . H . .
      . R $ M W . . . R M $ W .
      H . . . A . . . C . . . C
      X . . . X . . . E . . . X
      M . . . M . . . X . . . M
      E . . . R C B W A . . . E
      C . . . . . W . . . . . H
      . S4 . . . . H . . . . S3 .
      . . W . . . R . . . W . .
      . . . A Q X M E $ A . . .`,
    paths: [
      'C4 C3 C2 C1 D1 E1 F1 G1 H1 I1 J1 K1 K2 K3 K4',
      'K4 L4 M5 M6 M7 M8 M9 L10 K11 J12 I12 H12 G12',
      'G12 F12 E12 D12 C11 B10 A9 A8 A7 A6 A5 B4 C4',
      'C4 D4 E4 E5 E6 E7 E8 F8 G8',
      'K4 J4 I4 I5 I6 I7 I8 H8 G8',
      'G12 G11 G10 G9 G8',
    ],
    facing: ['C2', 'K2', 'K11', 'C11'],
    buildable: ['F1', 'G1', 'H1', 'M6', 'M7', 'M8', 'F12', 'G12', 'H12', 'A6', 'A7', 'A8', 'E6', 'E7', 'I6', 'I7'],
    boss: 'G1',
    monsters: ['owl', 'thief'],
    theme: FOREST,
  },
  {
    id: 'garden',
    name: '정원 안뜰',
    // 안쪽 고리 18칸(보장점 2) · 바깥 호 2개 · 귀퉁이 재앙 칸끼리 점프 선
    grid: `
      . . . . S2 E H $ . .
      . . . . C . . A W X
      . . . . . . . . . Q
      . . . . R . . . . .
      . . . . . . . . . H
      . . $ M W A B . . .
      . . E . . . C X M S3
      . . R . . . . R . .
      S4 M X C . . . E . .
      . . . B A W M $ . .
      H . . . . . . . . .
      . . . . . R . . . .
      Q . . . . . . . . .
      X W A . . C . . . .
      . . $ H E S1 . . . .`,
    paths: [
      'C9 D9 D10 E10 F10 G10 H10 H9 H8 H7 G7 G6 F6 E6 D6 C6 C7 C8 C9',
      'C9 B9 A9 A11 A13 A14 B14 C14 C15 D15 E15 F15 F14 F12 F10',
      'H7 I7 J7 J5 J3 J2 I2 H2 H1 G1 F1 E1 E2 E4 E6',
    ],
    jumps: [['J2', 'A14']],
    facing: ['F14', 'E2', 'I7', 'B9'],
    boss: 'C6',
    monsters: ['swallow', 'thief'],
    theme: GARDEN,
  },
];

export const AP_BOARD_MAP: Record<string, Board> = Object.fromEntries(AP_BOARDS.map((d) => [d.id, buildApBoard(d)]));
export const AP_THEMES: Record<string, MapTheme> = Object.fromEntries(AP_BOARDS.map((d) => [d.id, d.theme]));

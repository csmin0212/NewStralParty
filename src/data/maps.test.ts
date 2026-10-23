import { describe, expect, it } from 'vitest';
import { validateBoard } from '../engine/game';
import { BOSSES } from './bosses';
import { MAPS, MAP_DEFS } from './maps';

describe('보스 맵', () => {
  it('보스마다 전용 맵이 있다', () => {
    for (const b of BOSSES) expect(MAPS[b.map!], b.id).toBeDefined();
  });

  it.each(MAP_DEFS.map((d) => [d.name, d.id] as const))('%s: 올바르고, 모든 칸에 갈 수 있고, 거점 4 · 소환 칸 · 상점이 있다', (_, id) => {
    const board = MAPS[id];
    expect(validateBoard(board)).toEqual([]);
    expect(board.homeTiles).toHaveLength(4);
    expect(new Set(board.homeTiles).size).toBe(4);
    expect(board.spawnTiles.length).toBeGreaterThanOrEqual(3);
    expect(board.tiles.filter((t) => t.kind === 'shop').length).toBeGreaterThanOrEqual(2);
    expect(board.tiles.length).toBeGreaterThanOrEqual(40);
    // 거점에서 길을 따라 모든 칸에 닿는다 (워프 포함)
    const seen = new Set([board.homeTiles![0]]);
    const queue = [board.homeTiles![0]];
    while (queue.length) {
      const t = board.tiles[queue.shift()!];
      for (const n of [...t.next, ...(t.kind === 'warp' ? [t.warpTo!] : [])]) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size).toBe(board.tiles.length);
    // 워프 칸은 갈림길이면 안 된다 (멈춰야 발동하므로 상관은 없지만 길이 헷갈린다)
    for (const t of board.tiles) if (t.kind === 'warp') expect(t.next).toHaveLength(1);
  });
});

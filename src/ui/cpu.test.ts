import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../data/board';
import { BOSSES } from '../data/bosses';
import { MAPS } from '../data/maps';
import { applyAction, createGame } from '../engine/game';
import { cpuAction } from './cpu';

describe('CPU', () => {
  it.each(BOSSES.map((b) => [b.name, b] as const))('%s: CPU 4명만으로 전용 맵에서 끝까지 막히지 않고 둔다', (_, boss) => {
    for (const seed of [3, 11]) {
      const players = (['mutbyeol', 'soda', 'mona', 'mutbyeol'] as const).map((character, i) => ({
        name: `CPU ${i + 1}`,
        color: '#fff',
        character,
        cpu: true,
      }));
      let s = createGame({ board: MAPS[boss.map!] ?? DEFAULT_BOARD, boss, players, seed });
      for (let i = 0; i < 4000 && s.phase.kind !== 'gameOver'; i++) s = applyAction(s, cpuAction(s));
      expect(s.phase.kind).toBe('gameOver');
    }
  });
});

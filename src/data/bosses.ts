import type { BossDef } from '../engine/types';

/**
 * ⚠ 임시 보스. 시간표는 설계 때 나온 예시 그대로이고, 이름 · 스탯은 자리만 채운 값이다.
 * 진짜 보스가 정해지면 이 파일만 바꾸면 된다.
 */
export const PLACEHOLDER_BOSS: BossDef = {
  name: '임시 보스',
  icon: '👑',
  hpPerPlayer: 6,
  atk: 3,
  def: 1,
  eva: 0,
  counter: true,
  defense: 'block',
  defeatAt: 16,
  timeline: [
    { at: 1, actions: [{ type: 'summon', enemies: ['slime', 'slime', 'bat', 'goblin'] }] },
    { at: 3, actions: [{ type: 'bossAppear' }] },
    {
      at: 6,
      actions: [
        { type: 'summon', enemies: ['slime', 'bat', 'goblin'] },
        { type: 'buffEnemies', atk: 1, def: 1 },
      ],
    },
    {
      at: 9,
      actions: [
        { type: 'summon', enemies: ['bat', 'goblin', 'goblin'] },
        { type: 'buffEnemies', atk: 1, def: 1 },
      ],
    },
  ],
};

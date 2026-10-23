import type { DefenseMode, EnemyKind } from '../engine/types';

export interface EnemyInfo {
  name: string;
  icon: string;
  hp: number;
  atk: number;
  def: number;
  eva: number;
  /** 반격형 여부 */
  counter: boolean;
  defense: DefenseMode;
  reward: number;
}

export const ENEMIES: Record<EnemyKind, EnemyInfo> = {
  slime: { name: '슬라임', icon: '🦠', hp: 3, atk: 1, def: 0, eva: 0, counter: false, defense: 'block', reward: 4 },
  bat: { name: '박쥐', icon: '🦇', hp: 2, atk: 1, def: 0, eva: 2, counter: false, defense: 'evade', reward: 5 },
  goblin: { name: '고블린', icon: '👺', hp: 5, atk: 2, def: 1, eva: 0, counter: true, defense: 'block', reward: 8 },
};

import type { DefenseMode, EnemyKind } from '../engine/types';

export interface EnemyInfo {
  name: string;
  icon: string;
  hp: number;
  atk: number;
  def: number;
  /** 반격형 여부 */
  counter: boolean;
  defense: DefenseMode;
  reward: number;
}

/** 학원 도시의 에너미. icon은 그림이 없을 때 쓰는 임시 아이콘 */
export const ENEMIES: Record<EnemyKind, EnemyInfo> = {
  robot: { name: '경비 로봇', icon: '🤖', hp: 3, atk: 1, def: 0, counter: false, defense: 'block', reward: 4 },
  drone: { name: '정찰 드론', icon: '🛸', hp: 2, atk: 1, def: 0, counter: false, defense: 'evade', reward: 5 },
  delinquent: { name: '불량배', icon: '😼', hp: 5, atk: 2, def: 1, counter: true, defense: 'block', reward: 8 },
};

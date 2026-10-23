/** 난이도 (블루 아카이브 총력전 등급). 보스 체력 배수 · 보스 공격 · 에너미 강화 · 보상 배수 */
export type DifficultyId = 'normal' | 'hard' | 'veryhard' | 'hardcore' | 'extreme';

export interface DifficultyInfo {
  name: string;
  /** 보스 체력 배수 */
  hp: number;
  /** 보스 공격력 + */
  atk: number;
  /** 모든 에너미 공격 · 방어 + (보스 제외) */
  enemyAtk: number;
  enemyDef: number;
  /** 결과 보상 배수 */
  reward: number;
  color: string;
}

export const DIFFICULTY_IDS: DifficultyId[] = ['normal', 'hard', 'veryhard', 'hardcore', 'extreme'];

export const DIFFICULTIES: Record<DifficultyId, DifficultyInfo> = {
  normal: { name: 'NORMAL', hp: 1, atk: 0, enemyAtk: 0, enemyDef: 0, reward: 1, color: '#4fb6f5' },
  hard: { name: 'HARD', hp: 1.25, atk: 0, enemyAtk: 0, enemyDef: 0, reward: 1.5, color: '#f5b03a' },
  veryhard: { name: 'VERY HARD', hp: 1.5, atk: 1, enemyAtk: 1, enemyDef: 0, reward: 2, color: '#ef6a3a' },
  hardcore: { name: 'HARDCORE', hp: 1.75, atk: 1, enemyAtk: 1, enemyDef: 1, reward: 3, color: '#e8405f' },
  extreme: { name: 'EXTREME', hp: 2, atk: 2, enemyAtk: 1, enemyDef: 1, reward: 4, color: '#8a3fd1' },
};

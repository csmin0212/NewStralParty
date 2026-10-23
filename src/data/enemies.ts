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
  /** 보스 차례 뒤에 움직이는 칸 수 (1~roam). 아군이 있는 칸에 들어가면 덮쳐서 공격력만큼 피해를 주고 멈춘다 */
  roam?: number;
  /** 움직일 때 가장 가까운 아군을 쫓는다. 없으면 길을 따라 앞으로 */
  chase?: boolean;
  /** 덮칠 때 피해 대신 코인을 훔쳐 계속 달린다 (AP 小偷). 쓰러뜨리면 훔친 코인을 돌려받는다 */
  steal?: number;
  /** 나오고 이만큼 보스 차례가 지나면 터진다: range칸 안 아군 피해 */
  fuse?: { turns: number; amount: number; range: number };
  /** 이만큼 보스 차례마다 옆에 kind를 부른다 (AP 精锐) */
  calls?: { every: number; kind: EnemyKind };
  /** 받은 피해를 보스도 그대로 받는다 (페로로 미니언 · 묘귀의 조각 · 미사일 유도 장치) */
  link?: boolean;
  /** 분신: 공격받으면 피해 없이 사라진다. 화면에는 보스와 똑같이 보인다 */
  decoy?: boolean;
}

/** 학원 도시의 에너미. icon은 그림이 없을 때 쓰는 임시 아이콘 */
export const ENEMIES: Record<EnemyKind, EnemyInfo> = {
  robot: { name: '경비 로봇', icon: '🤖', hp: 6, atk: 1, def: 0, counter: false, defense: 'block', reward: 4 },
  drone: { name: '정찰 드론', icon: '🛸', hp: 4, atk: 1, def: 0, counter: false, defense: 'evade', reward: 5 },
  delinquent: { name: '불량배', icon: '😼', hp: 10, atk: 2, def: 1, counter: true, defense: 'block', reward: 8 },
  thief: {
    name: '헬멧단 좀도둑', icon: '🪖', hp: 6, atk: 0, def: 0, counter: false, defense: 'evade', reward: 3,
    roam: 3, steal: 4,
  },
  elite: {
    name: '스케반 간부', icon: '🏏', hp: 16, atk: 3, def: 1, counter: true, defense: 'block', reward: 12,
    calls: { every: 3, kind: 'robot' },
  },
  automaton: {
    name: '오토마타 병사', icon: '🦾', hp: 6, atk: 1, def: 1, counter: false, defense: 'block', reward: 3,
    fuse: { turns: 3, amount: 3, range: 1 },
  },
  kaitenger: {
    name: '카이텐저', icon: '🍣', hp: 6, atk: 2, def: 0, counter: true, defense: 'block', reward: 5,
    roam: 2,
  },
  perorominion: {
    name: '페로로 미니언', icon: '🐤', hp: 4, atk: 1, def: 0, counter: false, defense: 'block', reward: 2,
    link: true,
  },
  pillar: { name: '인베이드 필러', icon: '🗼', hp: 6, atk: 0, def: 1, counter: false, defense: 'block', reward: 4 },
  gozClone: {
    name: '고즈', icon: '🎩', hp: 1, atk: 0, def: 0, counter: false, defense: 'block', reward: 0,
    decoy: true,
  },
  slumpia: {
    name: '슬럼피아 병사', icon: '🎪', hp: 4, atk: 1, def: 0, counter: false, defense: 'evade', reward: 3,
    roam: 3,
  },
  missile: {
    name: '미사일 유도 장치', icon: '📡', hp: 10, atk: 0, def: 0, counter: false, defense: 'block', reward: 0,
    link: true,
  },
  myoukiPiece: {
    name: '묘귀의 조각', icon: '🐾', hp: 4, atk: 0, def: 0, counter: false, defense: 'evade', reward: 2,
    link: true,
  },
  teapot: {
    name: '찻주전자 병정', icon: '🫖', hp: 8, atk: 2, def: 1, counter: true, defense: 'block', reward: 6,
  },
  incarnation: {
    name: '묘귀의 화신', icon: '🐈‍⬛', hp: 4, atk: 2, def: 0, counter: false, defense: 'block', reward: 3,
    roam: 3, chase: true, fuse: { turns: 2, amount: 3, range: 1 },
  },
};

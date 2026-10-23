import type { CharacterId } from '../engine/types';

export interface StatGrowth {
  maxHp?: number;
  atk?: number;
  def?: number;
}

export interface SkillText {
  name: string;
  description: string;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  /** 플레이어 색 기본값 */
  color: string;
  hp: number;
  atk: number;
  def: number;
  startCoins: number;
  /** [1성, 2성, 3성]에 도달했을 때 오르는 능력치 */
  stars: [StatGrowth, StatGrowth, StatGrowth];
  active: SkillText & { cooldown: number };
  passive: SkillText;
  potential: SkillText;
}

/**
 * 캐릭터 데이터. 스킬 효과 자체는 engine/skills.ts에서 캐릭터 id별로 처리한다.
 * 그림은 src/ui/assets.ts의 CHARACTER_ART.
 */
export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  mutbyeol: {
    id: 'mutbyeol',
    name: '뭇별',
    color: '#8EDBD9',
    hp: 9,
    atk: 1,
    def: 0,
    startCoins: 9,
    stars: [{ maxHp: 2 }, { maxHp: 1, atk: 1 }, { maxHp: 1, atk: 1 }],
    active: {
      name: '피할만 한데?',
      cooldown: 4,
      description: '사용 후 1라운드 동안, 회피할 때 주사위를 2개 굴려 높은 값을 고른다.',
    },
    passive: {
      name: '기대값이 높다니까?',
      description: '회피에 성공하면 액티브 스킬의 재사용 대기시간 -1.',
    },
    potential: {
      name: '잠재 능력',
      description: '회피에 성공하면 그 몬스터에게 자신의 공격력만큼 피해를 준다.',
    },
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

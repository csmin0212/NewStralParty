import type { CardId, CharacterId } from '../engine/types';

export interface StatGrowth {
  maxHp?: number;
  atk?: number;
  def?: number;
  /** 이동거리: 주사위를 굴릴 때마다 더 가는 칸 수 */
  move?: number;
  /** 별을 딸 때 한 번 받는 코인 */
  coins?: number;
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
  /** 덱 포인트 예산 (100% 오렌지 쥬스 코옵은 10~25) */
  deckPoints: number;
  /** 캐릭터 전용 카드: 상점에서 코인으로 산다. 정해지면 넣는다 */
  hyper?: { card: CardId; price: number };
  /** [1성, 2성, 3성]에 도달했을 때 오르는 능력치 */
  stars: [StatGrowth, StatGrowth, StatGrowth];
  /** 대상을 고르는 액티브: 대상 종류와 사거리 (칸) */
  active: SkillText & { cooldown: number; target?: 'enemy' | 'ally'; range?: number };
  passive: SkillText;
  /** 두 번째 패시브 (모나 팬레터) */
  passive2?: SkillText;
  /** 캐릭터 고유 스택 이름과 최대치 (Soda 연마 · 모나 팬) */
  stack?: { name: string; max: number };
  /** 정해진 캐릭터만 */
  potential?: SkillText;
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
    atk: 2,
    def: 0,
    startCoins: 12,
    deckPoints: 15,
    stars: [{ maxHp: 1, atk: 1, move: 1 }, { atk: 2 }, { atk: 2, move: 1 }],
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
  soda: {
    id: 'soda',
    name: 'Soda',
    color: '#7FA8E8',
    hp: 9,
    atk: 2,
    def: 1,
    startCoins: 12,
    deckPoints: 15,
    stars: [{ atk: 1, maxHp: 2 }, {}, { atk: 1, def: 1, move: 1 }],
    active: {
      name: '조나단 러시',
      cooldown: 3,
      target: 'enemy',
      range: 7,
      description: '7칸 내의 상대를 향해 워프해 배틀한다. 이 배틀 동안 상대는 방어력 2를 잃는다.',
    },
    passive: {
      name: '연마',
      description: '방어력이 0인 적을 처치하면 [연마] 스택 +1 (최대 6). [연마] 2개당 상대 방어력 -1.',
    },
    stack: { name: '연마', max: 6 },
  },
  mona: {
    id: 'mona',
    name: '모나',
    color: '#F28BB5',
    hp: 9,
    atk: 1,
    def: 1,
    startCoins: 12,
    deckPoints: 15,
    stars: [{ coins: 10, maxHp: 2 }, {}, { atk: 1, def: 1, move: 1 }],
    active: {
      name: '역조공',
      cooldown: 3,
      target: 'ally',
      range: 10,
      description: "손패의 카드 1~2장을 10칸 내 아군에게 준 뒤, '팬' 스택만큼 카드를 뽑는다.",
    },
    passive: {
      name: '팬섭 해 버릴거야!',
      description: "아군에게 준 카드를 아군이 사용하면 '팬' +1 (최대 5). 아군에게 준 효과 카드의 피해 + '팬'.",
    },
    passive2: {
      name: '팬레터',
      description: '아군이 받은 효과 카드로 적을 처치하면 카드 1장을 얻는다.',
    },
    stack: { name: '팬', max: 5 },
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

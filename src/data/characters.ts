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

/** 액티브 대상: 에너미 · 다른 아군 · 나를 포함한 아군 */
export type SkillTarget = 'enemy' | 'ally' | 'anyAlly' | 'tile';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  /** 칭호 (원작 한국어판) */
  title?: string;
  /** 원작 이름 · 번호 (아스트랄 파티) */
  origin?: { no: number; name: string; title: string };
  /** 플레이어 색 기본값 */
  color: string;
  hp: number;
  atk: number;
  def: number;
  /** 판 시작 코인 + (원작 협동 Lv3) */
  startBonus?: number;
  /** 캐릭터 전용 카드: 상점에서 코인으로 산다 */
  hyper?: { card: CardId; price: number };
  /** [1성, 2성, 3성]에 도달했을 때 오르는 능력치 (원작 협동 Lv1 · Lv4) */
  stars: [StatGrowth, StatGrowth, StatGrowth];
  /** target: 대상 종류 · range: 사거리 (칸) · cards: 함께 고르는 손패 장수 · value: 고르는 숫자 */
  active: SkillText & { cooldown: number; target?: SkillTarget; range?: number; cards?: [number, number]; value?: [number, number] };
  passive: SkillText;
  /** 두 번째 패시브 (짝 캐릭터 · 팬레터) */
  passive2?: SkillText;
  /** 캐릭터 고유 스택 이름과 최대치 */
  stack?: { name: string; max: number };
  /** 정해진 캐릭터만 */
  potential?: SkillText;
}

// 원작 협동 챌린지 레벨 보상 형 (Lv1 · Lv2: 1성 · Lv3: 2성 또는 시작 코인 · Lv4: 3성). Lv5 · Lv6 유물 재선택은 모두 같다 (game.ts)
const A: CharacterDef['stars'] = [{ coins: 10, maxHp: 2 }, {}, { atk: 1, def: 1, move: 1 }];
const B: CharacterDef['stars'] = [{ atk: 1, maxHp: 2 }, { atk: 2 }, { atk: 1, move: 2 }];
const C: CharacterDef['stars'] = [{ def: 1, maxHp: 2 }, {}, { atk: 1, def: 1, move: 1 }];
const D: CharacterDef['stars'] = [{ atk: 1, maxHp: 2 }, {}, { atk: 1, def: 1, move: 1 }];
const START: Record<'A' | 'B' | 'C' | 'D', number> = { A: 6, B: 0, C: 6, D: 6 };

type Kit = Pick<CharacterDef, 'active' | 'passive'> & Partial<Pick<CharacterDef, 'passive2' | 'stack'>>;

/** 원작 캐릭터 한 명 */
function ap(
  id: CharacterId,
  no: number,
  origin: string,
  title: string,
  name: string,
  color: string,
  [atk, def, hp]: [number, number, number],
  type: 'A' | 'B' | 'C' | 'D' | CharacterDef['stars'],
  kit: Kit & { title?: string; potential?: SkillText },
): CharacterDef {
  const stars = typeof type === 'string' ? { A, B, C, D }[type] : type;
  const startBonus = typeof type === 'string' ? START[type] : 0;
  return { id, name, origin: { no, name: origin, title }, color, hp, atk, def, stars, startBonus, ...kit };
}

/**
 * 캐릭터 데이터. 스킬 효과는 engine/kits.ts (원작) · engine/skills.ts (뭇별 · Soda · 모나).
 * 원작 수치: docs/COOP_DESIGN.md 9번. 그림은 src/ui/assets.ts의 CHARACTER_ART.
 */
export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  mutbyeol: {
    id: 'mutbyeol',
    name: '뭇별',
    color: '#8EDBD9',
    hp: 9,
    atk: 2,
    def: 0,
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
    stars: [{ coins: 10, maxHp: 2 }, {}, { atk: 1, def: 1, move: 1 }],
    active: {
      name: '역조공',
      cooldown: 3,
      target: 'ally',
      range: 10,
      cards: [1, 2],
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
  laurel: {
    id: 'laurel',
    name: '라우엘',
    color: '#8E7CC3',
    hp: 8,
    atk: 2,
    def: 0,
    // 시작 코인 12 (기본 RULES.startCoins + 7)
    startBonus: 7,
    stars: [{ atk: 1, maxHp: 2 }, { atk: 1 }, { maxHp: 1 }],
    active: {
      name: '너 때문이야',
      cooldown: 3,
      target: 'enemy',
      range: 10,
      description: '10칸 이내, 혹은 [불운]이 1스택 이상인 적을 하나 선택한다. 선택한 적에게 [불운]을 1스택 부여하고 전투한다. 그 공격으로 적을 죽였다면 쿨타임이 2 감소한다.',
    },
    passive: {
      name: '형언할 수 없는',
      description:
        '자신과 전투한 캐릭터에게 [불운] 1스택을 준다. 전투 시 상대의 [불운] 스택만큼 방어력이 증가한다. 액티브 스킬로 적을 2명 죽일 때마다 공격력이 1 증가한다. [불운]: 스택당 라우엘에게 받는 피해 +1 (최대 3).',
    },
  },

  // ───────── 아스트랄 파티 (협동 문구) ─────────
  parunan: ap('parunan', 101, '帕露南', '商业之主', '파루난', '#F5B940', [1, 2, 10], 'A', {
    title: '시장의 지배자',
    active: { name: '온라인 쇼핑', cooldown: 2, description: '원격으로 상점을 열어 카드를 구매합니다.' },
    passive: { name: '전설의 상인', description: '상점에서 구매 가능한 전투 카드 수가 1 증가하며, 상점에 입장할 때마다 1코인을 획득합니다.' },
    potential: { name: '잠재 능력', description: '모든 캐릭터 상점의 구매 가능 전투 카드 수 +1, 각 카드가 10% 확률로 1코인으로 할인됩니다. 파루난이 송금한 후, 현재 상점의 카드 한 장을 1코인으로 할인합니다.' },
  }),
  fanny: ap('fanny', 102, '芬妮', '古怪神探', '패니', '#E8A26C', [1, 2, 10], 'A', {
    title: '괴짜 탐정',
    active: { name: '트러블 메이커', cooldown: 3, description: '자신의 턴 종료 시, 이벤트를 추가로 1회 발생시킵니다.' },
    passive: { name: '결정적 단서 발견!', description: '패니가 이벤트를 발동시킨 후, 3코인을 획득합니다.' },
    potential: { name: '잠재 능력', description: '액티브 스킬 사용 시, 2개의 무작위 이벤트 중 하나를 선택하여 발동합니다.' },
  }),
  alana: ap('alana', 103, '阿兰娜', '社恐修女', '알라나', '#6C7BD8', [1, 1, 9], 'B', {
    title: '소심한 수녀',
    active: { name: '아이언 메이든', cooldown: 3, description: '액티브 스킬 사용 후, 1라운드 동안 전투 대상이 되지 않으며, 함정을 무시합니다. 자신의 패시브가 발동되지 않은 상태라면, 즉시 패시브 효과를 획득합니다.' },
    passive: { name: '용기를 내!', description: '이전 라운드에 피해를 입지 않았다면 공격력이 3 증가합니다. (중첩 불가, 피해를 입으면 해제)' },
    potential: { name: '잠재 능력', description: '액티브 스킬 사용 후, 이번 턴 동안 피해를 입지 않으며 반격당하지 않습니다.' },
  }),
  komachi: ap('komachi', 104, '小町', '暗影忍者', '코마치', '#7A5BC4', [1, 1, 9], 'D', {
    title: '그림자 닌자',
    active: { name: '인술 콤보', cooldown: 3, description: '이번 라운드에 카드를 낼 수 있는 횟수가 1회 증가합니다.' },
    passive: { name: '카피 닌자', description: '효과 카드를 3장 사용할 때마다, 마지막으로 사용한 효과 카드를 복사하여 손패에 추가합니다.' },
    potential: { name: '잠재 능력', description: '효과 카드 3장을 사용할 때마다 액티브 스킬 재사용 대기시간 -1, 자신의 효과 카드 피해가 영구적으로 +1 증가합니다.' },
  }),
  padman: ap('padman', 105, '派德曼', '社员叔叔', '패드맨', '#8FA37A', [2, 2, 9], 'B', {
    title: '회사원 아저씨',
    active: { name: '정말로 화났어', cooldown: 3, description: '1라운드 동안 패시브 스킬의 모든 수치가 최댓값으로 고정됩니다.' },
    passive: { name: '줏대 없음', description: '매 라운드마다 능력치가 무작위로 변동합니다. 공격력 -2~+2, 방어력 -2~+2, 이동 거리 -2~+2.' },
    potential: { name: '잠재 능력', description: '공격 주사위 눈이 6일 때 상대의 방어력을 무시합니다. 자신의 주사위 눈이 2 미만일 때 다음 공격 주사위 눈은 반드시 6이 됩니다.' },
  }),
  papara: ap('papara', 106, '帕帕拉', '猩红辣妹', '파파라', '#E2445C', [2, 1, 10], [{ maxHp: 2, atk: 1, move: 1 }, { atk: 2 }, { atk: 1, move: 2 }], {
    title: '진홍빛 갸루',
    active: { name: '한 입만', cooldown: 3, description: '액티브 스킬 사용 시, 현재 HP가 최대 HP의 50%를 초과한 상태라면 HP가 3 감소합니다. 1라운드 동안 전투에서 입힌 피해의 50%만큼 HP를 회복합니다.' },
    passive: { name: '귀여움이 곧 정의', description: '현재 HP가 최대 HP의 50% 이하일 때, 공격력이 3 증가합니다.' },
    potential: { name: '잠재 능력', description: '액티브 스킬 사용 시 더 이상 자신의 HP를 소모하지 않습니다. 액티브 스킬 지속 시간 동안 현재 HP에 관계없이 HP가 절반 미만인 것으로 간주됩니다.' },
  }),
  ren: ap('ren', 107, '恋', '游戏大师', '렌', '#FF7FB0', [2, 1, 8], 'A', {
    title: '게임 마스터',
    active: { name: '말썽꾸러기의 특권', cooldown: 3, target: 'anyAlly', range: 99, description: '캐릭터 한 명을 지정하여 카드 1장을 획득하게 하고 슈슈 쉴드를 부여합니다. 슈슈 쉴드는 대상이 다음에 받는 피해를 99 감소시킵니다.' },
    passive: { name: '도와줘 슈슈!', description: '아군 캐릭터에게 액티브 스킬 사용 시, 대상의 HP가 최대 HP의 50% 이하일 경우 자신도 슈슈 쉴드를 얻고 카드 1장을 획득합니다.' },
    potential: { name: '잠재 능력', description: '캐릭터에게 슈슈 쉴드를 적용할 때, 추가로 대상에게 1중첩의 반격을 부여합니다.' },
  }),
  mimi: ap('mimi', 108, '米米', '看板娘', '미미', '#FFB3C7', [1, 1, 9], 'A', {
    title: '간판 소녀',
    active: { name: '재고 보충', cooldown: 3, description: '모든 손패를 버리고, 버린 손패 수 + 1장의 카드를 획득합니다.' },
    passive: { name: '재활용', description: '전투 카드를 1장 버릴 때마다 1코인을 획득합니다.' },
    potential: { name: '잠재 능력', description: '카드를 누적 25장 획득할 때마다 유물 1개를 획득합니다.' },
  }),
  z3000: ap('z3000', 109, 'Z3000', '垃圾箱', 'Z3000', '#7E8C99', [1, 2, 10], 'B', {
    title: '쓰레기 수거 로봇',
    active: { name: '낚아채기', cooldown: 4, target: 'enemy', range: 7, description: '7칸 이내의 몬스터 하나를 자신의 칸으로 끌어당기고, 5의 피해를 입힙니다.' },
    passive: { name: '재활용', description: '몬스터를 처치하면, 액티브 스킬의 쿨타임이 2 감소합니다.' },
    potential: { name: '잠재 능력', description: '몬스터를 2마리 처치할 때마다 공격력이 영구적으로 +1 증가합니다. 쓰레기통의 공격력이 6보다 클 경우, 액티브 스킬로 끌어온 몬스터에게 도전할 수 있습니다.' },
  }),
  pandaman: ap('pandaman', 110, '潘大猛', '肉弹战车', '판다맨', '#3C3C46', [1, 0, 14], [{ maxHp: 2, def: 1 }, { move: 1, maxHp: 1 }, { atk: 1, def: 1, move: 1 }], {
    title: '육탄 전차',
    active: { name: '폭풍 흡입', cooldown: 3, description: '초콜릿 케이크 또는 햄버거 중 무작위 1장을 획득합니다.' },
    passive: { name: '장단점', description: '햄버거, 초콜릿 케이크 사용 후, 5칸 이내의 모든 아군 캐릭터의 HP를 2 회복시킵니다.' },
    potential: { name: '잠재 능력', description: '음식을 먹을 때 1중첩의 반격을 획득하며, 해당 음식이 햄버거일 경우 최대 HP +2를 추가로 획득합니다. 반격 시 이번에 받은 피해량만큼 공격력이 증가합니다. 액티브 스킬 사용 시 5칸 범위 내의 몬스터를 1턴 동안 도발합니다.' },
  }),
  inkshadow: ap('inkshadow', 111, '墨影', '小猎手', '잉크 섀도우', '#4A4A7A', [2, 1, 10], 'B', {
    title: '견습 사냥꾼',
    active: { name: '그림자 융합', cooldown: 3, target: 'tile', description: '그림자 하나를 선택해 순간이동한 뒤, 모든 그림자를 흡수합니다. 흡수한 그림자 하나당 자신의 공격력이 1 증가하며, 1라운드 동안 지속됩니다.' },
    passive: { name: '쌍둥이 그림자', description: '턴 시작 시와 공격 적중 시, 잉크 섀도우가 있는 칸에 [그림자]를 배치합니다. (2라운드 지속) 적 캐릭터나 몬스터가 그림자 위에 머물면 1의 피해를 입습니다.' },
  }),
  lulu: ap('lulu', 112, '璐璐', '史莱姆', '루루', '#6FD6A8', [2, 2, 9], 'C', {
    title: '슬라임 소녀',
    active: { name: '치유 점액', cooldown: 3, target: 'anyAlly', range: 10, description: '10칸 이내의 아군 한 명을 지정하여 해당 캐릭터에게 [치유] 3중첩을 부여합니다.' },
    passive: { name: '세포 분열', description: '피해를 입은 후, [치유] 1중첩을 얻고, 액티브 스킬의 재사용 대기시간이 1 감소합니다.' },
    potential: { name: '잠재 능력', description: '스킬의 사거리 제한 제거. 스킬 사용 후, 4칸 이내의 몬스터는 다음 행동 때 이동 거리-3. 턴 종료 때 [치유] 중첩을 2 잃을때마다, 3칸 이내 랜덤 칸에 [미니 슬라임]을 1회 생성합니다. (최대 2번). 캐릭터가 [미니 슬라임]을 지나가면 [미니 슬라임] 제거 후 HP+1 회복, [치유]1중첩을 획득.' },
  }),
  fen: ap('fen', 113, '姬梦枫', '旗袍娘', '펭', '#D8436A', [1, 0, 10], [{ maxHp: 2, def: 1 }, { move: 1, atk: 1 }, { atk: 1, def: 1, move: 1 }], {
    title: '치파오 소녀',
    active: { name: '기공 수련', cooldown: 3, description: 'HP를 2 회복합니다. 에너지 보존을 보유하고 있다면, 이번 턴의 공격력이 4 증가합니다.' },
    passive: { name: '에너지 보존', description: '이번 턴에 전투를 하지 않았다면, 턴 종료 시 에너지 보존 1중첩을 획득합니다(최대 1중첩). 에너지 보존 상태일 때는 공격력이 2, 방어력이 2 증가합니다. 자신이 전투를 걸고 전투가 종료되면 에너지 보존 1중첩이 사라집니다.' },
    passive2: { name: '이심전심', description: '액티브 스킬 사용 시 유메가 부적 카드 - 행운을 1장 획득합니다.' },
    potential: { name: '잠재 능력', description: '에너지 보존을 최대 5중첩까지 저장할 수 있으며, 몬스터를 지나칠 때 에너지 보존을 2중첩 획득합니다. 공격 시 에너지 보존이 5중첩이면 추가로 2중첩을 소모하여 근처 2칸 내의 몬스터에게 이번 공격 피해의 88%만큼 피해를 입힙니다.' },
    stack: { name: '에너지 보존', max: 5 },
  }),
  haiqing: ap('haiqing', 114, '蓝海晴', '命运少女', '키이세이', '#3FA9E0', [1, 1, 10], 'A', {
    title: '운명의 소녀',
    active: { name: '허약의 표식', cooldown: 3, target: 'enemy', range: 10, description: '몬스터 하나를 지정하여 받는 피해를 1 증가시키고, 해당 몬스터를 처치하면 키이세이가 3코인을 획득합니다. 2라운드 동안 지속됩니다.' },
    passive: { name: '행운의 번호', description: '자신의 이동 주사위 값이 6일 때 6코인을 획득합니다.' },
    potential: { name: '잠재 능력', description: '허약의 표식을 가진 몬스터가 처치될 때, 처치한 캐릭터에게 운명의 인도 카드 1장을 부여합니다. 액티브 스킬 사용 시 손패의 스마트 주사위 카드를 운명의 인도 카드로 변경합니다.' },
  }),
  misaki: ap('misaki', 115, '美咲', '太刀使', '미사키', '#F29BB2', [0, 2, 9], 'B', {
    title: '소드마스터',
    active: { name: '벚꽃 베기', cooldown: 3, target: 'enemy', range: 4, description: '4칸 이내의 몬스터 하나를 지정하여 2의 피해를 입히고, 검기 1중첩을 획득합니다.' },
    passive: { name: '검기', description: '전투 시 자신의 공격이 적중하거나 회피에 성공하면 검기 1중첩을 획득합니다(최대 3중첩). 중첩당 공격력이 1 증가하며, 3중첩 시 공격력이 추가로 2 증가합니다. 기절하면 모든 검기 중첩이 사라집니다.' },
    potential: { name: '잠재 능력', description: '액티브 스킬 사거리가 6으로 증가하며, 검기가 3중첩일 때 액티브 스킬을 사용하면 검기 2중첩을 소모하고 명검: 가우 베기 카드 1장을 획득합니다. 미사키의 명검: 가우 베기 카드 비용이 1 감소합니다.' },
    stack: { name: '검기', max: 3 },
  }),
  nardis: ap('nardis', 116, '娜蒂斯', '绿洲女王', '나르디스', '#E9C15A', [1, 1, 9], 'D', {
    title: '오아시스 퀸',
    active: { name: '여왕의 특권', cooldown: 3, description: '임시 카드 3장을 획득합니다. 임시 카드는 턴 종료 시 자동으로 버려집니다.' },
    passive: { name: '위압', description: '공격 시 적보다 손패가 많을 경우, 차이 나는 손패 1장당 공격력이 1(최대 3) 증가합니다.' },
  }),
  jasmine: ap('jasmine', 117, '茉莉', '家政机器人', '자스민', '#8CC8E8', [1, 0, 9], [{ maxHp: 2, atk: 1, move: 1 }, { atk: 2 }, { atk: 1, move: 2 }], {
    title: '로봇 메이드',
    active: { name: '오버드라이브', cooldown: 4, description: '액티브 스킬 사용 후, 1라운드 동안 방어력이 3 감소, 이동 거리가 3 증가합니다.' },
    passive: { name: '이동식 충전', description: '누적 이동 거리가 13칸이 될 때마다 공격력이 영구적으로 1 증가, 방어력이 영구적으로 1 증가 효과를 번갈아 획득합니다.' },
    potential: { name: '잠재 능력', description: '액티브 스킬 사용 후, 다음 이동 주사위 값이 10 이상이면 이번 턴 공격력 +2, 그렇지 않으면 방어력 +2를 획득합니다. 대시 타일에 정지하면 액티브 스킬 재사용 대기시간 -2.' },
  }),
  al: ap('al', 118, '阿尔', '暗区少主', 'AL', '#5A5F73', [1, 1, 9], 'D', {
    title: '암흑의 군주',
    active: { name: '강자의 자비', cooldown: 3, target: 'ally', range: 99, cards: [1, 3], description: '카드 1~3장을 선택해 아군 캐릭터 한 명에게 주고, 준 카드 수만큼의 코인을 획득합니다.' },
    passive: { name: '윈윈', description: '아군에게 카드를 주면 양쪽 모두 [스타라이트] 1중첩을 획득합니다. 자신의 [스타라이트]가 6중첩이 될 때마다 공격력이 1, 방어력이 1 증가합니다.' },
  }),
  luka: ap('luka', 119, '星魅琉华', '午夜闪光', '루카', '#B05BE0', [1, 2, 9], 'B', {
    title: '한밤중의 섬광',
    active: { name: '거침없는 질주', cooldown: 3, description: '이번 라운드 이동 주사위가 2개의 6면체 주사위로 변경됩니다. 이동 중에는 전투가 발생하지 않지만, 지나가는 몬스터에게 2 + 자신의 공격력만큼 피해를 입힙니다.' },
    passive: { name: '질주 준비', description: '1라운드에 1번, [체크 포인트]를 지나가거나 멈췄을 때 액티브 스킬의 쿨타임이 2 감소합니다.' },
    potential: { name: '잠재 능력', description: '액티브 스킬 사용 시 배틀 카드 1장을 버릴 수 있습니다. 버리면 이번 턴 동안 공격력이 추가로 +(현재 스타 레벨 + 버린 배틀 카드의 배틀 코스트) 증가합니다. 액티브 스킬 사용 후 이동 방향을 자유롭게 선택할 수 있습니다.' },
  }),
  nancy: ap('nancy', 120, '南希露', '网络魅影', '낸시 루', '#5BE0C8', [1, 1, 9], [{ maxHp: 2, atk: 1 }, { atk: 2 }, { atk: 2, move: 1 }], {
    title: '사이버 팬텀',
    active: { name: '원격 침입', cooldown: 3, target: 'enemy', range: 99, description: '몬스터를 선택한 뒤 전투 합니다. 스킬로 인한 전투에서는 패시브 스킬의 카드 버리기 효과가 발동하지 않습니다. 자신과 대상과의 거리가 2칸을 초과할 경우, 이번 전투에서는 반격을 받지 않습니다.' },
    passive: { name: '방화벽', description: '턴 시작 시 2칸 이내에 몬스터가 없다면 전투 카드 1장을 획득하고 1라운드 동안 공격력이 2, 방어력이 2 증가합니다(1라운드 지속). 자신이 신청한 전투가 종료되면 손패의 전투 카드 1장을 버립니다.' },
    potential: { name: '잠재 능력', description: '스킬을 사용할 때, 목표의 거리가 6칸 보다 멀리 있으면, 1장의 전투 카드를 획득하고, 방화벽을 획득합니다.(1턴 지속). 자신이 시작한 전투가 끝난 뒤, 손패가 5장 이하인 경우 전투 카드를 버리지 않게 됩니다. 방화벽을 보유하고 있을 때, 2칸보다 멀리 떨어진 몬스터에게 받는 피해-1.' },
  }),
  rin: ap('rin', 121, '凛', '新人调查员', '린', '#4F6BD8', [1, 1, 9], 'A', {
    title: '신입 수사관',
    active: { name: '살아있는 페이지', cooldown: 3, description: '리빙 북를 1장 획득하며, 1턴 동안 효과 카드의 사거리가 3 증가합니다.' },
    passive: { name: '조사 결과', description: '이벤트 발생 후 리빙 북를 1장 획득하며, 리빙 북를 사용할 때마다 해당 카드의 피해량이 영구적으로 1 증가합니다.' },
  }),
  megas: ap('megas', 122, '梅加斯', '机械超人', '메가스', '#9AA6B2', [0, 2, 9], 'C', {
    title: '메카 히어로',
    active: { name: '궤도 폭격', cooldown: 3, description: '모든 카드를 버립니다. 버린 카드 2장마다 6칸 이내의 무작위 몬스터에게 3의 피해를 입히는 [궤도 폭격]을 1회 발동합니다. 버린 카드의 코스트가 3코스트가 될 때마다 [궤도 폭격]의 피해량이 1 증가합니다.' },
    passive: { name: '물자 보급', description: '턴 종료 시 자신의 손패가 6장 미만이라면 카드를 1장 획득합니다.' },
    potential: { name: '잠재 능력', description: '액티브 스킬을 사용하면 최대 3칸의 패널을 이동할 수 있습니다. 액티브 스킬을 사용한 후 카드 1장을 뽑습니다. 액티브 스킬이 6장 이상의 카드를 버리면 레일건 1장을 뽑습니다. 레일건을 사용한 후 배틀 카드 1장을 뽑고, 뽑은 카드의 코스트만큼 목표물과 2칸 이내 몬스터에게 동일한 피해를 주고, 정밀 타격을 적용합니다.' },
  }),
  zhao: ap('zhao', 123, '姬梦朝', '风水师', '유메', '#C94A4A', [1, 1, 10], 'C', {
    title: '풍수사',
    active: { name: '바이제의 축복', cooldown: 3, target: 'anyAlly', range: 99, description: '캐릭터 하나를 지정하여 바이제의 축복을 부여합니다. 대상의 공격력이 HP 초과 회복량만큼 증가하며, 1라운드 동안 지속됩니다. 부적 카드 - 행운을 1장 획득하고 손패의 모든 부적 카드 - 불행을 부적 카드 - 행운으로 변환합니다.' },
    passive: { name: '행운과 불행은 이웃', description: '주사위 값이 1일 때 부적 카드 - 불행를 1을 획득하고, 주사위 값이 6일 때 부적 카드 - 행운을 1장 획득합니다.' },
    passive2: { name: '완벽한 조력자', description: '펭에게 부적 카드 - 행운을 사용할 시, 대상은 에너지 보존을 1중첩 획득합니다.' },
  }),
  teru: ap('teru', 124, '照', '三神御主', '테루', '#F08A3C', [2, 1, 9], 'D', {
    title: '삼신교주',
    active: { name: '신내림', cooldown: 3, target: 'ally', range: 99, description: '캐릭터 하나를 지정하여 삼신 빙의를 부여합니다. 이번 턴 동안 자신의 공격력과 방어력이 삼신 빙의 대상의 50%만큼 증가합니다. 삼신 빙의 대상이 공격한 후, 테루가 여우빛 1중첩을 소모하여 추격 공격을 가합니다. 1턴 동안 지속됩니다.' },
    passive: { name: '여우불', description: '자신 또는 삼신 빙의 대상이 2코스트 이상의 공격 카드를 사용하면 자신은 여우빛 1중첩을 획득합니다.' },
    stack: { name: '여우빛', max: 9 },
  }),
  moses: ap('moses', 125, '摩西', '枪匠', '모제스', '#9C7A54', [1, 1, 11], 'B', {
    title: '건스미스',
    active: { name: '약점 반격', cooldown: 2, target: 'enemy', range: 10, description: '몬스터 하나를 지정하여 약점을 부여합니다. 약점상태인 몬스터가 모제스와 전투 시, 전투 주사위 값이 0이 됩니다. 약점상태인 몬스터가 모제스에게 전투를 신청하면 모제스는 반격합니다.' },
    passive: { name: '정밀 기술', description: '회피 혹은 반격에 성공하면 정밀 기술1중첩을 획득합니다(최대 3중첩). 턴 종료 시 중첩이 1씩 감소합니다. 정밀 기술중첩당 자신의 공격력이 2 증가하며, 회피 주사위의 값은 반드시 현재 중첩 수보다 큰 값이 나옵니다.' },
    stack: { name: '정밀 기술', max: 3 },
  }),
  mamushi: ap('mamushi', 126, '真梦梓', '沼之蛟龙', '마무시', '#2E8F7A', [2, 1, 9], 'D', {
    title: '늪의 교룡',
    active: { name: '연쇄 반응', cooldown: 3, description: '자신은 깨물기를 1장 획득하고, 5칸 이내의 모든 아군 캐릭터가 카드 1장을 획득하게 합니다. 대상의 손패가 4장 미만이면 추가로 카드 1장을 더 획득합니다.' },
    passive: { name: '늪의 주인', description: '다른 캐릭터에게 카드를 줄 때마다 마무시는 각성 1중첩을 얻습니다. 각성이 8중첩에 도달하면 마무시는 진룡이 됩니다. 진룡: 공격력이 영구적으로 4 증가하고, 액티브 스킬의 사거리 제한이 사라지며, 손패와 스킬 사용 후 획득하는 깨물기 카드가 용의 포효로 변환됩니다.' },
    stack: { name: '각성', max: 8 },
  }),
  bonnie: ap('bonnie', 127, '邦妮', '毒苹果', '보니', '#B8323A', [2, 1, 9], 'D', {
    title: '독사과',
    active: { name: '비밀 작전', cooldown: 3, target: 'enemy', range: 10, description: '몬스터 하나를 지정하여 조사 대상과 [표식] 1중첩을 부여하고, 대상의 표식 중첩 수 * 2만큼의 코인을 획득합니다.' },
    passive: { name: '핵심 단서', description: '[잠입 조사]를 맵 이벤트 풀에 추가합니다. [표식]이 있는 몬스터를 공격할 때 공격력이 3 증가하며, [표식]이 있는 몬스터를 처치하면 전투 카드를 1장 획득합니다.' },
  }),
  lingling: ap('lingling', 128, '玲玲', '怪力乱神', '링링', '#E04A2E', [2, 2, 10], [{ maxHp: 2, atk: 1 }, { atk: 1, move: 1 }, { atk: 1, def: 1, move: 1 }], {
    title: '괴력난신',
    active: { name: '이판사판 태클', cooldown: 3, value: [1, 7], description: '1-7에서 숫자를 선택하고, 이판사판 태클의 도착지점으로 설정, 그 후 이동 시 태클로 변경 후 발동합니다. 태클 중 지나가는 모든 몬스터를 도착지점까지 튕겨 날려버립니다. 멈춘 후, 튕겨 낸 순서대로 전투를 진행 할 수 있습니다. 태클 중에 금지 표지판을 통과 시, 태클 당한 몬스터의 방어력이 -2, 자신의 공격력을 +2 (2턴 지속).' },
    passive: { name: '방해자', description: '자신의 바리케이드가 금지 표지판으로 변화. 게임 시작 시, 금지 표지판을 2장 획득합니다. 금지 표지판을 지나가면 금지 표지판을 1장 획득합니다.' },
  }),
  sykes: ap('sykes', 129, '赛克斯', '魔渊幼体', '사이크스', '#5B3F8C', [0, 2, 9], 'C', {
    title: '심연의 유체',
    active: { name: '심연 전환', cooldown: 3, target: 'tile', range: 4, description: '4칸 이내 중 한 칸을 선택합니다. 그 칸에 심연 촉수 1마리를 소환하고, 주위 2칸을 어비스 존으로 만듭니다. 그 후에 어비스 존 안에 있는 모든 촉수를 작동시킵니다. 어비스 존 안으로 어떤 방법으로든 침입한 적 몬스터는 다음 이동 거리 -2. 어비스 존은 사이크스의 다음 턴 시작 시 사라집니다.' },
    passive: { name: '분노하는 심연', description: '자신이 피해를 주면, 그 대상에게 심연 침식 인장을 1중첩 부여합니다. (1턴 지속) 턴 종료시, 자신 칸에 「심연 촉수」를 생성하고 「심연 촉수」를 전부 작동시킵니다. 「심연 촉수」 작동: 「심연 촉수」는 주변 2칸 이내의 모든 몬스터에게 1피해를 주고, 이동 거리 감소 효과를 받은 몬스터에게 심연 침식 인장를 1중첩을 부여합니다. (1턴 지속) 「심연 촉수」는 영구적으로 존재하며, 한 칸에 최대 한 개까지 존재합니다.' },
  }),
  kangel: ap('kangel', 301, '超天酱', 'NEEDY STREAMER OVERLOAD', '최고귀염뽀짝천사', '#FF8FD0', [0, 1, 9], 'A', {
    title: '초텐짱',
    active: { name: '인터넷 엔젤', cooldown: 3, description: '1코인을 획득하며, 필드에 [팬]이 있는 몬스터 수 만큼 1코인을 추가로 획득합니다. 스킬 1회당 최대 7코인까지 획득할 수 있습니다. [팬]의 수가 3마리 이상이면 추가로 HP를 3 회복합니다.' },
    passive: { name: '초텐짱 등장!', description: '초텐짱을 공격하거나 초텐짱에게 공격받은 몬스터는 [팬] 상태가 됩니다. [팬] 상태인 몬스터가 초텐짱을 공격할 때 공격력이 1 감소합니다.' },
    passive2: { name: '일심동체', description: '아메와 팀을 이루면 신비로운 일이 일어납니다.' },
    potential: { name: '잠재 능력', description: "액티브 스킬 사용으로 획득하는 스타 코인의 최대 개수가 10개로 증가합니다. 액티브 스킬 사용 시 '팬'이 9명 이상일 경우, 자신을 제외한 모든 아군 캐릭터가 코인 3개를 얻고, 필드 위의 모든 '팬'의 공격력 -1 (영구, 중첩 불가)" },
  }),
  ame: ap('ame', 302, '糖糖', 'NEEDY STREAMER OVERLOAD', '니디 걸', '#9C7BE0', [1, 4, 9], 'B', {
    title: '아메짱',
    active: { name: '사랑 과다 복용', cooldown: 3, description: '현재 사랑 중첩 수만큼 HP를 회복하고, 사랑 중첩 수만큼 이동 거리가 증가합니다. 1라운드 동안 지속됩니다. 라운드 종료 시 사랑 4중첩이 감소합니다.' },
    passive: { name: '감당할 수 없는 사랑', description: '피해를 입을 때마다 사랑 1중첩을 얻습니다(최대 4중첩). 사랑 중첩당 공격력이 1 증가, 방어력이 1 감소합니다. 게임 시작 시 사랑은 2중첩인 상태로 시작합니다.' },
    passive2: { name: '일심동체', description: '초텐짱과 팀을 이루면 신비로운 일이 일어납니다.' },
    potential: { name: '잠재 능력', description: '액티브 스킬 사용 후 사랑 중첩이 4개 이상일 경우, 최대 HP+1(영구), 사랑 최대 중첩 상한+1.' },
    stack: { name: '사랑', max: 4 },
  }),
  jill: ap('jill', 303, '吉尔', 'VA-11 Hall-A', '질', '#D0466A', [1, 1, 10], 'A', {
    active: { name: '음료 조제', cooldown: 3, target: 'anyAlly', range: 99, cards: [3, 3], description: '손패 3장으로 캐릭터 1명: 효과 카드 체력 +1 · 공격 카드 공격력 +1 · 방어 카드 방어력 +1 (1차례). 버리고 3장.' },
    passive: { name: '인생을 바꾸다', description: '3장 종류가 다 다르면 코인 +3 · 다 같으면 대상 이동 +3.' },
  }),
  dorothy: ap('dorothy', 304, '多萝西', 'VA-11 Hall-A', '도로시', '#E8708A', [1, 0, 8], 'C', {
    active: { name: '진짜 나', cooldown: 2, target: 'ally', range: 99, description: '아군 칸으로 순간이동 · 둘 다 체력 +1. 온기 5층이면 다 써서 이번 차례 공격력 + 방어력.' },
    passive: { name: '사교계의 꽃', description: '회복하면 온기 1 (방어력 +1, 최대 5). 다른 캐릭터를 지나면 둘 다 체력 +1.' },
    stack: { name: '온기', max: 5 },
  }),
  hanna: ap('hanna', 305, '远野汉娜', '魔法少女的魔女审判', '토노 한나', '#F2C14E', [1, 2, 9], 'A', {
    title: '한나',
    active: { name: '부유 마법', cooldown: 3, description: '부유를 획득합니다. (1라운드 지속).' },
    passive: { name: '공상 영애', description: '최종 이동 거리 수치가 6이상일 때, 스타 코인 1개를 획득합니다. 아군 캐릭터를 통과하면 스타 코인 1개와 1중첩의 인형 제작을 획득합니다. 이때 부유를 보유하고 있고 스타 코인이 충분하면, 해당 아군 캐릭터에게 스타 코인 3개를 송금합니다. 인형 제작이 7중첩에 도달하면 토노 한나는 인형 완성을 획득합니다: 아군 캐릭터를 통과하면 해당 아군 캐릭터에게 다음 이동 시 이동 거리 +2를 부여합니다.' },
    passive2: { name: '절친의 축복', description: '타치바나 세리를 통과 할 경우, 타치바나 세리는 다음 이동 거리+2와 추리 시간 1중첩을 얻습니다.' },
  }),
  sherry: ap('sherry', 306, '橘雪莉', '魔法少女的魔女审判', '타치바나 세리', '#F28C38', [2, 1, 10], 'D', {
    title: '세리',
    active: { name: '괴력 마법', cooldown: 2, target: 'tile', range: 7, description: '3칸 이내의 모든 몬스터를 7칸 이내의 지정한 칸으로 던진 후, 해당 칸의 모든 몬스터에게 2피해를 줍니다.' },
    passive: { name: '탐정님 출격', description: '몬스터에게 직접 도전한 후 추리 시간을 1중첩 획득합니다. (최대 4중첩)' },
    passive2: { name: '절친의 수호', description: '토노 한나가 타치바나 세리의 4칸 이내에 있을 때, 토노 한나는 받는 피해 -1.' },
    stack: { name: '추리 시간', max: 4 },
  }),
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

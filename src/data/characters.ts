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
export type SkillTarget = 'enemy' | 'ally' | 'anyAlly';

export interface CharacterDef {
  id: CharacterId;
  name: string;
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

// 원작 협동 레벨 보상 형 (1성 · 2성 · 3성 · 시작 코인)
const A: CharacterDef['stars'] = [{ coins: 10 }, {}, { atk: 1, def: 1, move: 1 }];
const B: CharacterDef['stars'] = [{ atk: 1 }, { atk: 2 }, { atk: 1, move: 2 }];
const C: CharacterDef['stars'] = [{ def: 1 }, {}, { atk: 1, def: 1, move: 1 }];
const D: CharacterDef['stars'] = [{ atk: 1 }, {}, { atk: 1, def: 1, move: 1 }];
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
  kit: Kit,
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

  // ───────── 아스트랄 파티 (협동 문구) ─────────
  parunan: ap('parunan', 101, '帕露南', '商业之主', '파루난', '#F5B940', [1, 2, 10], 'A', {
    active: { name: '온라인 쇼핑', cooldown: 2, description: '어디서든 상점을 연다.' },
    passive: { name: '전설의 상인', description: '상점 전투 카드 +1장 · 상점에 들어가면 코인 +1.' },
  }),
  fanny: ap('fanny', 102, '芬妮', '古怪神探', '페니', '#E8A26C', [1, 2, 10], 'A', {
    active: { name: '말썽꾼', cooldown: 3, description: '이번 차례에 멈춘 뒤 이벤트를 1번 더 일으킨다.' },
    passive: { name: '포인트 발견!', description: '페니가 일으킨 이벤트마다 코인 +3.' },
  }),
  alana: ap('alana', 103, '阿兰娜', '社恐修女', '알라나', '#6C7BD8', [1, 1, 9], 'B', {
    active: { name: '철의 처녀', cooldown: 3, description: '1라운드 동안 몬스터가 걸어오지 않고 재앙 · 함정을 받지 않는다. 그동안 용기도 켜진다.' },
    passive: { name: '용기를 내!', description: '지난 차례 뒤로 피해를 받지 않았으면 공격력 +3.' },
  }),
  komachi: ap('komachi', 104, '小町', '暗影忍者', '코마치', '#7A5BC4', [1, 1, 9], 'D', {
    active: { name: '인술 연격', cooldown: 3, description: '이번 차례 효과 카드 +1장.' },
    passive: { name: '복제 닌자', description: '효과 카드 3장마다 마지막에 쓴 효과 카드를 손패에 복제.' },
  }),
  padman: ap('padman', 105, '派德曼', '社员叔叔', '패드맨', '#8FA37A', [2, 2, 9], 'B', {
    active: { name: '진짜 화났다', cooldown: 3, description: '1라운드 동안 변동치가 모두 +2.' },
    passive: { name: '줏대 없음', description: '차례마다 공격력 · 방어력 · 이동 -2~+2 무작위.' },
  }),
  papara: ap('papara', 106, '帕帕拉', '猩红辣妹', '파파라', '#E2445C', [2, 1, 10], [{ atk: 1, move: 1 }, { atk: 2 }, { atk: 1, move: 2 }], {
    active: { name: '쪽 한 입', cooldown: 3, description: '체력이 절반보다 많으면 3 피해. 1라운드 동안 전투 피해의 50% 회복.' },
    passive: { name: '귀여움이 정의', description: '체력 50% 이하: 공격력 +3.' },
  }),
  ren: ap('ren', 107, '恋', '游戏大师', '렌', '#FF7FB0', [2, 1, 8], 'A', {
    active: { name: '말썽쟁이 특권', cooldown: 3, target: 'anyAlly', range: 99, description: '캐릭터 1명에게 카드 1장 + 쥐쥐 보호막 (다음 피해 -99).' },
    passive: { name: '쥐쥐야 살려줘!', description: '대상 체력이 50% 이하면 렌도 쥐쥐 보호막 + 카드 1장.' },
  }),
  mimi: ap('mimi', 108, '米米', '看板娘', '미미', '#FFB3C7', [1, 1, 9], 'A', {
    active: { name: '상품 보충', cooldown: 3, description: '손패를 모두 버리고 버린 수 +1장.' },
    passive: { name: '기한 지난 회수', description: '전투 카드를 버릴 때마다 코인 +1.' },
  }),
  z3000: ap('z3000', 109, 'Z3000', '垃圾箱', 'Z3000', '#7E8C99', [1, 2, 10], 'B', {
    active: { name: '이리 와', cooldown: 3, target: 'enemy', range: 7, description: '7칸 안 몬스터를 끌어와 5 피해.' },
    passive: { name: '분리수거', description: '몬스터를 쓰러뜨리면 액티브 재사용 대기 -2.' },
  }),
  pandaman: ap('pandaman', 110, '潘大猛', '肉弹战车', '판다맨', '#3C3C46', [1, 0, 14], [{ def: 1 }, { move: 1, maxHp: 1 }, { atk: 1, def: 1, move: 1 }], {
    active: { name: '일 벌이기', cooldown: 3, description: '초코 케이크 · 붕대 중 1장.' },
    passive: { name: '좋은 점 나쁜 점', description: '붕대 · 초코 케이크를 쓰면 5칸 안 모든 아군 체력 +2.' },
  }),
  inkshadow: ap('inkshadow', 111, '墨影', '小猎手', '묵영', '#4A4A7A', [2, 1, 10], 'B', {
    active: { name: '그림자 융합', cooldown: 3, description: '그림자로 순간이동 · 그림자를 모두 흡수 · 1개마다 이번 차례 공격력 +1.' },
    passive: { name: '쌍둥이 그림자', description: '차례 시작 · 공격 명중마다 묵영의 칸에 그림자 (2차례). 그림자 위 몬스터 라운드 끝에 1 피해.' },
  }),
  lulu: ap('lulu', 112, '璐璐', '史莱姆', '루루', '#6FD6A8', [2, 2, 9], 'C', {
    active: { name: '점액 부착', cooldown: 3, target: 'anyAlly', range: 10, description: '10칸 안 캐릭터 1명에게 힐 3.' },
    passive: { name: '세포 분열', description: '피해를 받으면 힐 1 · 액티브 재사용 대기 -1.' },
  }),
  fen: ap('fen', 113, '姬梦枫', '旗袍娘', '희몽풍', '#D8436A', [1, 0, 10], [{ def: 1 }, { move: 1, atk: 1 }, { atk: 1, def: 1, move: 1 }], {
    active: { name: '운공', cooldown: 3, description: '체력 +2. 기력이 있으면 이번 차례 공격력 +4.' },
    passive: { name: '기력 비축', description: '도전하지 않은 차례 끝에 기력 (공격력 +2 · 방어력 +2). 내가 건 전투가 끝나면 사라진다.' },
    passive2: { name: '마음이 이어짐', description: '액티브를 쓰면 희몽조가 부적-복 1장.' },
    stack: { name: '기력', max: 1 },
  }),
  haiqing: ap('haiqing', 114, '蓝海晴', '命运少女', '남해청', '#3FA9E0', [1, 1, 10], 'A', {
    active: { name: '숙명의 메아리', cooldown: 3, target: 'enemy', range: 10, description: '몬스터 1마리 받는 피해 +1 (2차례) · 그동안 쓰러지면 코인 +3.' },
    passive: { name: '행운의 눈', description: '이동이 정확히 6이면 코인 +6.' },
  }),
  misaki: ap('misaki', 115, '美咲', '太刀使', '미사키', '#F29BB2', [0, 2, 9], 'B', {
    active: { name: '벚꽃 열공참', cooldown: 3, target: 'enemy', range: 4, description: '4칸 안 몬스터 2 피해 + 검기 1.' },
    passive: { name: '검기', description: '명중 · 회피마다 검기 1 (최대 3). 1층마다 공격력 +1, 3층이면 +2 더. 쓰러지면 사라진다.' },
    stack: { name: '검기', max: 3 },
  }),
  nardis: ap('nardis', 116, '娜蒂斯', '绿洲女王', '나디스', '#E9C15A', [1, 1, 9], 'D', {
    active: { name: '여왕의 특권', cooldown: 3, description: '임시 카드 3장 (차례 끝에 버린다).' },
    passive: { name: '위압', description: '공격할 때 손패 1장마다 공격력 +1 (최대 3).' },
  }),
  jasmine: ap('jasmine', 117, '茉莉', '家政机器人', '자스민', '#8CC8E8', [1, 0, 9], [{ atk: 1, move: 1 }, { atk: 2 }, { atk: 1, move: 2 }], {
    active: { name: '에너지 과부하', cooldown: 4, description: '1라운드 동안 방어력 -3 · 이동 +3.' },
    passive: { name: '이동 충전', description: '이동 13칸마다 공격력 +1 · 방어력 +1 번갈아 (계속).' },
  }),
  al: ap('al', 118, '阿尔', '暗区少主', '알', '#5A5F73', [1, 1, 9], 'D', {
    active: { name: '강자의 연민', cooldown: 3, target: 'ally', range: 99, cards: [1, 3], description: '아군에게 카드 1~3장 · 준 수만큼 코인.' },
    passive: { name: '윈윈', description: '아군에게 카드를 주면 둘 다 스타라이트 +1. 스타라이트 6마다 공격력 · 방어력 +1.' },
  }),
  luka: ap('luka', 119, '星魅琉华', '午夜闪光', '루카', '#B05BE0', [1, 2, 9], 'B', {
    active: { name: '막을 수 없음', cooldown: 3, description: '이번 이동: 6면 주사위 2개 · 전투 없음 · 지나는 몬스터에게 2 + 공격력 피해.' },
    passive: { name: '만반의 준비', description: '차례마다 1번, 확인 지점을 지나면 액티브 재사용 대기 -2.' },
  }),
  nancy: ap('nancy', 120, '南希露', '网络魅影', '낸시', '#5BE0C8', [1, 1, 9], [{ atk: 1 }, { atk: 2 }, { atk: 2, move: 1 }], {
    active: { name: '원격 침입', cooldown: 3, target: 'enemy', range: 99, description: '몬스터 1마리에게 원격 도전 · 2칸보다 멀면 반격을 받지 않는다.' },
    passive: { name: '패시브 방화벽', description: '차례 시작에 2칸 안 몬스터가 없으면 전투 카드 1장 + 방화벽 (공격력 · 방어력 +2, 1라운드). 내가 건 전투 뒤 전투 카드 1장 버림.' },
  }),
  rin: ap('rin', 121, '凛', '新人调查员', '린', '#4F6BD8', [1, 1, 9], 'A', {
    active: { name: '살아있는 책장', cooldown: 3, description: '살아있는 책장 1장 · 이번 차례 효과 카드 사거리 +3.' },
    passive: { name: '조사 발견', description: '이벤트 뒤 살아있는 책장 1장 · 쓸 때마다 책장 피해 +1 (계속).' },
  }),
  megas: ap('megas', 122, '梅加斯', '机械超人', '메가스', '#9AA6B2', [0, 2, 9], 'C', {
    active: { name: '궤도 폭격', cooldown: 3, description: '손패를 모두 버리고 2장마다 6칸 안 무작위 몬스터에게 (3 + 버린 전투 코스트 / 3) 피해.' },
    passive: { name: '물자 보충', description: '차례 끝 손패가 6장 미만이면 1장.' },
  }),
  zhao: ap('zhao', 123, '姬梦朝', '风水师', '희몽조', '#C94A4A', [1, 1, 10], 'C', {
    active: { name: '백택의 축복', cooldown: 3, target: 'anyAlly', range: 99, description: '캐릭터 1명: 1차례 동안 넘친 회복만큼 공격력 + · 부적-복 1장 · 손패의 부적-화 → 부적-복.' },
    passive: { name: '화복은 서로 기댄다', description: '전투 주사위 1 → 부적-화 · 6 → 부적-복.' },
    passive2: { name: '완벽한 조수', description: '희몽풍에게 부적-복을 쓰면 희몽풍 기력 +1.' },
  }),
  teru: ap('teru', 124, '照', '三神御主', '테루', '#F08A3C', [2, 1, 9], 'D', {
    active: { name: '강신', cooldown: 3, target: 'ally', range: 99, description: '아군 1명의 공격력 · 방어력 50%를 1차례 받는다. 그 아군이 공격하면 호광 1을 써서 추격.' },
    passive: { name: '여우불', description: '나 · 강신 대상이 2코스트 이상 공격 카드를 쓰면 호광 +1.' },
    stack: { name: '호광', max: 9 },
  }),
  moses: ap('moses', 125, '摩西', '枪匠', '모세', '#9C7A54', [1, 1, 11], 'B', {
    active: { name: '약점 반격', cooldown: 2, target: 'enemy', range: 10, description: '몬스터 1마리에 빈틈: 모세와 교전할 때 그 몬스터 주사위 0.' },
    passive: { name: '정밀 기교', description: '회피 성공 · 반격 뒤 정밀 1 (공격력 +2, 최대 3, 차례 끝 -1).' },
    stack: { name: '정밀', max: 3 },
  }),
  mamushi: ap('mamushi', 126, '真梦梓', '沼之蛟龙', '마무시', '#2E8F7A', [2, 1, 9], 'D', {
    active: { name: '연쇄 반응', cooldown: 3, description: '물어뜯기 1장 · 5칸 안 모든 아군 카드 1장 (손패 4장 미만이면 1장 더).' },
    passive: { name: '늪의 왕', description: '아군에게 카드를 줄 때 각성 1. 8층이면 진룡 (공격력 +4).' },
    stack: { name: '각성', max: 8 },
  }),
  bonnie: ap('bonnie', 127, '邦妮', '毒苹果', '보니', '#B8323A', [2, 1, 9], 'D', {
    active: { name: '은밀 행동', cooldown: 3, target: 'enemy', range: 10, description: '몬스터 1마리에 조사 대상 + 표식 1 · 표식 × 2 코인.' },
    passive: { name: '결정적 단서', description: '표식이 있는 몬스터를 공격할 때 공격력 +3 · 쓰러뜨리면 전투 카드 1장.' },
  }),
  lingling: ap('lingling', 128, '玲玲', '怪力乱神', '링링', '#E04A2E', [2, 2, 10], [{ atk: 1 }, { atk: 1, move: 1 }, { atk: 1, def: 1, move: 1 }], {
    active: { name: '가로막기 돌진', cooldown: 3, value: [1, 7], description: '1~7 중 고른 만큼 돌진 · 지나는 몬스터를 붙잡아 멈춘 칸으로 데려간다 · 붙잡은 몬스터 방어력 -2 (2라운드).' },
    passive: { name: '요격자', description: '붙잡은 몬스터와 싸울 때 공격력 +2.' },
  }),
  sykes: ap('sykes', 129, '赛克斯', '魔渊幼体', '사이크스', '#5B3F8C', [0, 2, 9], 'C', {
    active: { name: '마역 전환', cooldown: 3, description: '사이크스 2칸 안을 마역으로 · 마역의 몬스터 이동 -2 (다음 차례까지).' },
    passive: { name: '촉수의 심연', description: '피해를 준 대상에 침식 1. 라운드 끝 사이크스 2칸 안 몬스터 1 + 침식 피해.' },
  }),
  kangel: ap('kangel', 301, '超天酱', 'NEEDY STREAMER OVERLOAD', '초텐짱', '#FF8FD0', [0, 1, 9], 'A', {
    active: { name: '인터넷 엔젤', cooldown: 3, description: '코인 1 + 팬 몬스터마다 1 (최대 7). 팬 3 이상이면 체력 +3.' },
    passive: { name: '꼬마 천사 인사', description: '초텐짱과 싸운 몬스터 → 팬. 팬이 공격할 때 공격력 -1.' },
    passive2: { name: '일심동체', description: '아메짱도 팬을 만든다 · 초텐짱이 피해를 받으면 아메짱 사랑 +1.' },
  }),
  ame: ap('ame', 302, '糖糖', 'NEEDY STREAMER OVERLOAD', '아메짱', '#9C7BE0', [1, 4, 9], 'B', {
    active: { name: '감정 과다 섭취', cooldown: 3, description: '사랑만큼 체력 + · 이번 차례 사랑만큼 이동 +. 차례 끝 사랑 -4.' },
    passive: { name: '감당할 수 없는 사랑', description: '피해를 받으면 사랑 1 (공격력 +1 · 방어력 -1, 최대 4). 시작 2.' },
    passive2: { name: '일심동체', description: '초텐짱 항목.' },
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
  hanna: ap('hanna', 305, '远野汉娜', '魔法少女的魔女审判', '한나', '#F2C14E', [1, 2, 9], 'A', {
    active: { name: '부유 마법', cooldown: 3, description: '1라운드 동안 부유: 이동 +2 · 재앙 · 함정 없음 · 몬스터가 걸어오지 않는다.' },
    passive: { name: '환상의 아가씨', description: '이동 6 이상 → 코인 +1. 아군을 지나면 코인 +1 · 인형 1 (7층: 지나간 아군 다음 이동 +2).' },
    passive2: { name: '절친의 축복', description: '셰리를 지나면 셰리 다음 이동 +2 · 추리 1.' },
  }),
  sherry: ap('sherry', 306, '橘雪莉', '魔法少女的魔女审判', '셰리', '#F28C38', [2, 1, 10], 'D', {
    active: { name: '괴력 투척', cooldown: 2, description: '3칸 안 몬스터를 모두 7칸 앞으로 던지고 2 피해.' },
    passive: { name: '탐정 출동', description: '몬스터에게 먼저 도전하면 추리 1 (공격력 +1, 최대 4, 차례 끝 -1).' },
    passive2: { name: '절친 수호', description: '한나가 4칸 안에 있으면 한나가 받는 피해 -1.' },
    stack: { name: '추리', max: 4 },
  }),
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

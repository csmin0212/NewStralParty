// 게임 상태와 행동 타입. 전부 JSON으로 직렬화 가능해야 한다 (네트워크로 통째로 보낼 것이므로).

import type { RelicId } from '../data/relics';
import type { DifficultyId } from '../data/difficulty';
import type { EventId } from '../data/events';

/** 맵 기믹이 주는 자원 */
export type MapRes = 'evidence' | 'overclock' | 'mind' | 'problem';

export type TileKind =
  | 'empty'
  /** 횡재: 코인 2 · 3 · 4 · 5 · 10 (원작 天降横财) */
  | 'windfall'
  /** 재앙: 2 피해 (天降横祸) */
  | 'calamity'
  /** 확인 지점: 누구나 멈춰서 회복 · 성 오름 (保障点) */
  | 'checkpoint'
  /** 칩 상점: 지나가며 유물 (筹码商店) */
  | 'chipShop'
  /** 질주: 한 번 더 굴린다 (疾行) */
  | 'haste'
  | 'card'
  /** 몬스터: 멈추면 맵 몬스터가 나와 바로 전투 (怪物) */
  | 'monster'
  | 'heal'
  | 'warp'
  | 'shop'
  /** 멈추면 무작위 이벤트 (data/events.ts) */
  | 'event'
  /** 유사: 멈추면 다음 이동 -2 (아비도스) */
  | 'sand'
  /** 가속: 지나가면 +2칸 (원작 加速) */
  | 'boost'
  /** 컨베이어 · 해류: 멈추면 3칸 앞으로 밀린다 */
  | 'conveyor'
  | 'current'
  /** 돌격문: 멈추면 옆 칸에 에너미, 코인 +3 (원작 突击门) */
  | 'assault'
  /** 함정: 멈추면 2 피해 */
  | 'trap'
  /** 빙판: 멈추면 빙판이 끝날 때까지 미끄러진다 */
  | 'ice'
  /** 단서: 코인 +2 · 증거 +1 (도서관) */
  | 'clue'
  /** 시계탑: 오버클럭 +1 (백귀야행) */
  | 'clock'
  /** 스포트라이트: 마인드 +1 (결승 무대) */
  | 'stage'
  /** 사탕 자판기: 코인 5 → 사탕 카드 (백귀야행) */
  | 'candy'
  /** 반성실: 2턴 문제아 (공격 +2 · 방어 -2) */
  | 'detention'
  | 'base';

export interface Tile {
  id: number;
  kind: TileKind;
  /** 이동 방향으로 이어진 칸. 2개 이상이면 갈림길 */
  next: number[];
  /** 화면 배치용 격자 좌표 */
  x: number;
  y: number;
  /** warp 칸의 도착 칸. 없으면 다른 포털 중 무작위 (원작 传送门) */
  warpTo?: number;
  /** 원작 맵 칸 이름 ('F1') */
  cell?: string;
}

export interface Board {
  /** 맵 id (보스 맵 · 맵 전용 유물) */
  id?: string;
  name: string;
  tiles: Tile[];
  /** 본부 칸: 시작 · 레벨업 지점 */
  baseTile: number;
  /** 플레이어 거점 (자리 순서대로). 게임을 시작하는 칸이자 레벨업 · 덱 정비 칸. 없으면 모두 본부 */
  homeTiles?: number[];
  /** 에너미가 소환되는 지점. 다 차 있으면 다른 빈 칸에 나온다 */
  spawnTiles: number[];
  /** 보스가 나타나는 칸 */
  bossTile: number;
  /** 돌격문에서 나오는 에너미 */
  assault?: EnemyKind;
  /** 몬스터 칸에서 나오는 에너미 (없으면 기본 셋) */
  monsters?: EnemyKind[];
  /** 양방향 길 (원작 맵): next는 이웃 칸 전부, 지나온 칸으로는 되돌아가지 않는다 */
  twoWay?: boolean;
  /** 칸 이름 → 칸 id */
  cells?: Record<string, number>;
  /** 시작 칸에서 처음 나아가는 칸 (자리 순서) */
  facing?: number[];
  /** 건물을 지을 수 있는 칸 */
  buildable?: number[];
}

/** 카드 목록과 효과 글은 data/cards.ts, 효과는 engine/cards.ts */
export type CardId =
  | 'dash'
  | 'doubleDice'
  | 'tripleDice'
  | 'remoteDice'
  | 'portal'
  | 'cookie'
  | 'cake'
  | 'bandage'
  | 'pudding'
  | 'poisonCure'
  | 'notes'
  | 'extend'
  | 'kingPower'
  | 'immovable'
  | 'hurry'
  | 'feast'
  | 'share'
  | 'backup'
  | 'dinner'
  | 'allOut'
  | 'revival'
  | 'slingshot'
  | 'laser'
  | 'brick'
  | 'blast'
  | 'railgun'
  | 'atkM'
  | 'atkL'
  | 'atkG'
  | 'onFire'
  | 'magnum'
  | 'shadowRaid'
  | 'gawu'
  | 'charge'
  | 'fullAttack'
  | 'accel'
  | 'defM'
  | 'defL'
  | 'defG'
  | 'rainbow'
  | 'retreat'
  | 'shieldCounter'
  // 캐릭터 · 원작 협동 카드
  | 'livingPage'
  | 'talismanFu'
  | 'talismanHuo'
  | 'bite'
  | 'dragonRoar'
  | 'banSign'
  | 'fateGuide'
  // 원작 협동 맵 카드
  | 'firecracker'
  | 'hisFault'
  | 'poisonFang'
  | 'gourd'
  | 'supportGum'
  | 'energyBar'
  | 'smartGummy'
  | 'hasteMushroom'
  | 'starfruit'
  | 'peach'
  | 'moneyTree'
  | 'feather'
  | 'ashenFeather';

export interface HandCard {
  card: CardId;
  /** 상점에서 산 카드: 쓰면 사라지고 덱으로 돌아가지 않는다 */
  shop?: boolean;
  /** 다른 플레이어가 준 카드 (모나 역조공): 준 사람 id */
  from?: number;
  /** 임시 카드: 차례 끝에 버린다 (나르디스) */
  temp?: boolean;
}

export type CharacterId =
  | 'mutbyeol'
  | 'soda'
  | 'mona'
  // 아스트랄 파티
  | 'parunan' | 'fanny' | 'alana' | 'komachi' | 'padman' | 'papara' | 'ren' | 'mimi' | 'z3000' | 'pandaman'
  | 'inkshadow' | 'lulu' | 'fen' | 'haiqing' | 'misaki' | 'nardis' | 'jasmine' | 'al' | 'luka' | 'nancy'
  | 'rin' | 'megas' | 'zhao' | 'teru' | 'moses' | 'mamushi' | 'bonnie' | 'lingling' | 'sykes'
  | 'kangel' | 'ame' | 'jill' | 'dorothy' | 'hanna' | 'sherry';

export interface Player {
  id: number;
  name: string;
  color: string;
  character: CharacterId;
  /** 잠재 능력 해방 여부 (게임 시작 때 정한다) */
  potential: boolean;
  tile: number;
  /** 지나온 칸 (prevTile에 서 있을 때만 뜻이 있다. 순간이동하면 방향을 새로 고른다) */
  prev?: number | null;
  prevTile?: number;
  /** 원작 맵 상태 (중독 · 개조 · 주목 · 연리 · 온염 · 개병 · 문제아) */
  ap?: Partial<Record<ApStatus, number>>;
  coins: number;
  /** 스타(성). 0성에서 시작해 본부에서 코인을 내고 올린다 */
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  /** 주사위를 굴릴 때마다 더 가는 칸 수 (이동거리) */
  move: number;
  /** 내 거점 칸: 여기서 시작하고, 지나가거나 멈추면 레벨업 · 덱 정비 */
  home: number;
  /** 스킨 (그림만 바뀐다) */
  skin?: string;
  /** 유물 (한 판 동안) */
  relics: RelicId[];
  /** 고를 유물 후보 (tier: 확률표 줄). 고르기 전에는 주사위를 굴릴 수 없다 */
  relicOffer: { ids: RelicId[]; tier: number } | null;
  /** 밀린 유물 고르기 (tier) */
  relicQueue: number[];
  /** 유물이 세는 값 (이동 누적 · 효과 카드 수 · 다시 뽑기 …) */
  relicVars: Record<string, number>;
  /** 힐 · 스타라이트 · 에너지 스택 (유물 키워드) */
  healStacks: number;
  starlight: number;
  energy: number;
  /** 유물 상점에서 산 수 (값이 오른다) */
  relicBuys: number;
  /** 맵 자원 (증거 · 오버클럭 · 마인드 · 문제아 남은 차례) */
  mapRes: Partial<Record<MapRes, number>>;
  /** 캐릭터 스킬이 세는 값 (engine/kits.ts) */
  charVars: Record<string, number>;
  /** 캐릭터가 깔아 둔 칸 (잉크 섀도우 그림자 · 링링 표지판 · 루루 미니 슬라임 · 사이크스 촉수): 칸 → 남은 차례 */
  charTiles: Record<number, number>;
  /** 지금 임무 (base: 받을 때 값) · 끝낸 임무 */
  task: { id: string; base: number } | null;
  tasksDone: string[];
  /** CPU 자리 */
  cpu?: boolean;
  /** 카드 효과로 붙은 상태 */
  status: PlayerStatus;
  hand: HandCard[];
  /** 액티브 스킬 재사용 대기 (라운드). 0이면 쓸 수 있다 */
  skillCooldown: number;
  /** 액티브 스킬 효과가 이 라운드의 자기 차례 시작까지 유지된다 (뭇별: 회피 주사위 2개) */
  skillActiveUntil: number | null;
  /** 캐릭터 고유 스택 (Soda 연마 · 모나 팬) */
  stacks: number;
  /** KO 상태. 쓰러진 자리에 누워 있다 */
  ko: boolean;
  /** KO 상태일 때, 이 라운드의 자기 차례에 부활한다 */
  reviveRound: number | null;
}

export type EnemyKind =
  | 'robot'
  | 'delinquent'
  | 'drone'
  /** 헬멧단 좀도둑: 코인을 훔쳐 달아난다 (AP 小偷) */
  | 'thief'
  /** 스케반 간부: 반격하고 졸개를 부른다 (AP 精锐) */
  | 'elite'
  | 'automaton'
  | 'kaitenger'
  | 'perorominion'
  | 'pillar'
  | 'gozClone'
  | 'slumpia'
  | 'missile'
  | 'myoukiPiece'
  | 'incarnation'
  /** 찻주전자 병정 (지하 대성당 학원, 원작 魔法学院 茶壶) */
  | 'teapot'
  // ── 원작 협동 맵 (data/apMaps.ts) ──
  | 'sharkPirate' | 'elitePirate'
  | 'blueSpirit' | 'redSpirit' | 'swordSpirit' | 'spearSpirit'
  | 'croak' | 'ambientRobot' | 'snakeDragon' | 'platform'
  | 'jellyFighter' | 'jellyGuard' | 'jellyWizard' | 'mutantTeapot'
  | 'crab' | 'prawn' | 'goldfish' | 'loudmouth' | 'trainee' | 'mamushiAlly' | 'souriAlly'
  | 'monkeyBox' | 'sawMonkey' | 'madApe' | 'pinata' | 'synth1' | 'synth2' | 'synth3'
  | 'owl' | 'bear' | 'dino'
  | 'swallow' | 'waiter' | 'crane' | 'peacock' | 'lovebirdChalice';

/** 원작 몬스터 · 보스 액티브 (engine/ap.ts). cd: 재사용 대기 (라운드) */
export interface ApSkill {
  id: ApSkillId;
  name: string;
  text: string;
  cd: number;
  range?: number;
  amount?: number;
  kind?: EnemyKind;
  max?: number;
}

export type ApSkillId =
  /** kind를 곁에 소환 (max마리까지) */
  | 'summon'
  /** range칸 안 체력이 가장 높은 캐릭터에게 amount (없으면 공격력) 피해 */
  | 'shootTop'
  /** range칸 밖 체력이 가장 높은 캐릭터에게 amount 피해 */
  | 'shootFar'
  /** range칸 안 체력이 가장 높은 캐릭터에게 amount 피해 + 중독 3 */
  | 'poisonTop'
  /** range칸 안 몬스터 공격력 · 방어력 +1 (분위기) */
  | 'buffNear'
  /** range칸 안 무작위 몬스터 방어력 +9 (다음 피해까지) */
  | 'guard'
  /** range칸 안 모든 캐릭터에게 amount 피해 */
  | 'aoe'
  /** aoe + 맞힌 수만큼 공격력 (장난감 공룡) */
  | 'noise'
  /** 가장 가까운 range칸 안 캐릭터 amount 피해 + 주목 2 (채집 곰) */
  | 'mushroom'
  /** range칸 안 개조 없는 캐릭터 체력 +1 · 개조 3 (톱날 원숭이) */
  | 'saw'
  /** 자기에게 개조 4 (사탕 피냐타, 한 번) */
  | 'pinata'
  /** 개조 캐릭터 체력 -2, 그만큼 회복 (인공생명체) */
  | 'chain'
  /** 소우리 금린 +1 (금붕어) */
  | 'scale'
  /** 검 · 창 영혼 중 하나 소환 (텐노지 마사오) */
  | 'masao'
  /** 찻주전자 흡수 · 없으면 소환 (대행 학장) */
  | 'tea'
  /** 가장 가까운 캐릭터에게 그놈 탓이야! (학원 안전관) */
  | 'indicate'
  /** 5칸 안 효과 카드 1장 버리기 · 손패 4장 미만이면 3 피해 (아마카와 마무시) */
  | 'mamushiChain'
  /** 가장 가까운 캐릭터 개조 3 · 주변 2칸 독안개 (과학 괴인) */
  | 'scientist'
  /** 자기 · 체력이 가장 높은 캐릭터에게 공작 개병 (청동 공작) */
  | 'display'
  /** 가장 가까운 캐릭터 연리 3 (청동 원앙) */
  | 'bond'
  /** 무작위 2명 연리 3 (펭 원앙 의식) */
  | 'fenBond'
  /** 6칸 밖 캐릭터 손패 1장 → 잿빛 깃털 · 모두 연리 (폭주한 봉황) */
  | 'wings';

/** 원작 맵 과제 (모두 함께). 다 채우면 보상 */
export interface MapTask {
  id: string;
  name: string;
  count: number;
  /** 쓰러뜨리면 세는 몬스터 */
  kill?: EnemyKind[];
  /** 그 밖의 셈 (s.ap.counts) */
  counter?: 'gourd' | 'scale' | 'build' | 'egg' | 'star';
  /** 이 갈래에서만 */
  branch?: string;
  reward: {
    /** 모두 유물 고르기 (확률표 줄 1~3) */
    chip?: number;
    progress?: number;
    coins?: number;
    /** 모두 받는 카드 */
    card?: CardId | 'building';
    /** 맵 진행 (engine/ap.ts) */
    event?: string;
  };
}

/** 원작 맵 보스 규칙 */
export interface ApBossDef {
  /** 보드 id (data/apBoards.ts) */
  board: string;
  tasks: MapTask[];
  skill?: ApSkill;
  /** 깨어나기 전에는 움직이지도 스킬을 쓰지도 않는다 */
  sleeps?: boolean;
  /** 깨어나면 움직이는 칸 수 · 쫓기 */
  roam?: number;
  /** 보스 고유 규칙 id (engine/ap.ts) */
  rules?: string[];
  /** 체력 (인원과 무관, 원작 협동은 4인) */
  hp: number;
}

/** 원작 맵 진행 상태 */
export interface ApState {
  /** 과제 진행 · 끝낸 과제 */
  tasks: Record<string, number>;
  done: string[];
  /** 그 밖의 셈 (호리병 · 건물 · 알 …) */
  counts: Record<string, number>;
  /** 갈래 (변종 · 투표 · 루트) */
  branch?: string;
  /** 고르기를 기다리는 선택 */
  choice?: { id: string; options: { id: string; label: string }[] };
  /** 깨어남 */
  awake: boolean;
  /** 맵 단계 (매직 아카데미 2단) */
  stage: number;
  /** 정해진 라운드에 일어날 일 */
  later: { round: number; event: string }[];
  /** 그 밖의 값 */
  vars: Record<string, number>;
}

/** 원작 맵에서 캐릭터에게 붙는 상태 (값: 남은 턴 · 층) */
export type ApStatus =
  /** 赤红之毒: 차례 끝마다 체력 -1 */
  | 'poison'
  /** 青之诅咒: 방어력 -2 */
  | 'curse'
  /** 改造: 차례 끝마다 -1, 0이 되면 지금 체력만큼 피해 */
  | 'overclock'
  /** 嘎呜的关注: 방어력 -1 · 이동 -1 */
  | 'attention'
  /** 鸳鸯连理: 차례 시작마다 공격력 · 방어력 -1. 연리인 아군을 만나면 풀리고 체력 +2 */
  | 'bond'
  /** 연리로 깎인 공격력 · 방어력 */
  | 'bondDown'
  /** 温焰: 차례 끝에 2 피해. 회복하면 1층 줄고 1라운드 공격력 +1 */
  | 'flame'
  /** 孔雀开屏 층 */
  | 'display'
  /** 问题学生: 학원 안전관이 쫓는다 */
  | 'problem'
  /** 금지 표지판 · 질주 버섯: 다음 이동 + */
  | 'moveUp';

export type DefenseMode = 'block' | 'evade';

/** 보드 위의 에너미 또는 보스. 스탯은 데이터에서 복사해 오고, 기믹 등으로 바뀔 수 있다 */
export interface Enemy {
  id: number;
  kind: EnemyKind | 'boss';
  name: string;
  icon: string;
  isBoss: boolean;
  tile: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  /** 반격형이면 공격받고 살아남았을 때 1회 반격한다 */
  counter: boolean;
  /** 공격받을 때 쓰는 방어 방식 */
  defense: DefenseMode;
  reward: number;
  /** 도둑이 훔친 코인. 쓰러뜨린 사람이 가져간다 */
  loot?: number;
  /** 자폭 · 소환까지 남은 보스 차례 */
  timer?: number;
  /** 표식: 있으면 모든 피해 +1, 보스 차례마다 -1 */
  mark?: number;
  /** 캐릭터 스킬이 붙인 상태 (engine/kits.ts): 받는 피해 + · 팬 · 약점 · 조사 · 붙잡힘 · 침식 · 마역 */
  tags?: Partial<Record<'vuln' | 'fan' | 'flaw' | 'probe' | 'grab' | 'erode' | 'abyss' | 'taunt' | 'slow' | 'roar' | 'fanDown', number>>;
  /** tags를 건 플레이어 */
  tagBy?: Partial<Record<'vuln' | 'flaw' | 'probe' | 'taunt', number>>;
  /** 지나온 칸 (양방향 맵) */
  prev?: number;
  /** 원작 스킬 재사용 대기 (남은 라운드) */
  cd?: number;
  /** 원작 몬스터 상태 (분노 · 금린 · 역린 · 정력 · 개조 …) */
  st?: Record<string, number>;
}

/** 보드 위의 표식. 플레이어가 그 칸에 멈추면 발동한다 */
export type MarkKind =
  /** 시한폭탄: timer가 0이 되는 보스 차례에 터진다. 멈추면 해체 */
  | 'bomb'
  /** 성유물 (초록): 멈추면 보스가 받는 피해 +1 */
  | 'relicGreen'
  /** 성유물 (빨강): 멈추면 보스의 다음 행동을 끊는다 */
  | 'relicRed'
  /** 모자: 하나에만 코인이 들었다. 멈추면 열린다 */
  | 'hat'
  /** 파이프 오르간: 멈추면 성가 방향이 아군 쪽으로 */
  | 'organ'
  /** 난로: 멈추면 불을 지핀다 */
  | 'heater'
  /** 불길: 멈추면 피해, 몇 차례 뒤 꺼진다 */
  | 'fire'
  /** 원작 맵: 신비한 알 · 호리병 (지나가면 줍는다) · 독안개 (멈추면 2 피해, 개조면 회복) · 건물 */
  | 'egg'
  | 'gourd'
  | 'mist'
  | 'mushroom'
  | 'starfruit'
  | 'peach'
  | 'moneyTree';

export interface Mark {
  id: number;
  tile: number;
  kind: MarkKind;
  /** 폭탄 · 불길 · 모자: 남은 보스 차례 (놓은 차례도 센다. 2면 다음 보스 차례에 터진다) */
  timer?: number;
  /** 폭탄 · 불길 피해 */
  power?: number;
  /** 모자: 코인이 든 모자 (화면에는 안 보인다) */
  coin?: boolean;
}

/** 보스 행동이 노리는 아군 */
export type BossTarget =
  | 'all'
  /** 보스에서 range칸 안 */
  | 'near'
  /** 보스 앞 range칸 (진행 방향) */
  | 'line'
  /** 보스와 가까운 순서로 count명 */
  | 'closest'
  | 'farthest'
  /** 체력이 가장 높은 count명 (AP 보스 포격) */
  | 'highestHp'
  | 'lowestHp'
  /** 코인이 가장 많은 count명 */
  | 'richest'
  | 'random';

export type DebuffKind =
  /** 방어력 -amount */
  | 'defDown'
  /** 공격력 -amount */
  | 'atkDown'
  /** 다음 차례를 쉰다 */
  | 'stun'
  /** 위압: 차례 시작마다 체력 -1. 회복을 받으면 풀린다 */
  | 'erode'
  /** 저주: 다음 보스 차례에 터진다. 체력이 가득 차 있으면 풀린다 */
  | 'curse'
  /** 다음 이동 -amount칸 */
  | 'slow';

export type BossEffect =
  | { type: 'damage'; target: BossTarget; amount: number; range?: number; count?: number }
  /** 보스와 가까운 순서로 amounts[0], amounts[1], … 피해 (비나 대도의 겁화) */
  | { type: 'damageRanked'; amounts: number[] }
  | { type: 'debuff'; target: BossTarget; status: DebuffKind; amount?: number; turns?: number; range?: number; count?: number }
  /** 보스가 가까운 아군 쪽으로 steps칸 돌진. 지나간 칸의 아군에게 피해, push칸 밀어낸다 */
  | { type: 'charge'; steps: number; amount: number; push?: number }
  /** 보스가 땅속으로 사라진다. 다음 warp까지 공격받지 않는다. then: 다음 라운드에 꼭 쓰는 행동 */
  | { type: 'hide'; then?: string }
  /** 보스가 아군이 모인 곳(crowd) 또는 아무 칸으로 옮겨 가고, 도착한 곳 range칸 안에 피해 */
  | { type: 'warp'; where: 'crowd' | 'random'; amount?: number; range?: number }
  /** perPlayer: enemies[0]을 인원수만큼 */
  | { type: 'summon'; enemies: EnemyKind[]; near?: 'boss' | 'players'; perPlayer?: boolean }
  | { type: 'buffEnemies'; atk: number; def: number }
  /** 보스 능력치 영구 상승 (호드 영광의 광채) */
  | { type: 'buffSelf'; atk?: number; def?: number }
  | { type: 'heal'; amount: number }
  /** kind 에너미를 흡수: 남은 수 × heal 회복, 그 사이 쓰러진 수만큼 그로기 (페로로지라) */
  | { type: 'absorb'; kind: EnemyKind; heal: number }
  | { type: 'marks'; kind: MarkKind; count: number; near: 'players' | 'boss' | 'random'; power?: number; timer?: number }
  | { type: 'stealCoins'; target: BossTarget; amount: number; range?: number; count?: number }
  /** 아군의 강화 효과를 지운다 */
  | { type: 'cleanse' }
  /** 보스가 사라지고 분신과 섞여 다른 칸에 나타난다 (고즈) */
  | { type: 'clones'; count: number }
  /** kind 에너미가 터진다: 그 자리 range칸 안 아군 피해 */
  | { type: 'detonate'; kind: EnemyKind; amount: number; range: number }
  /** 오르간이 향한 쪽에 성가 (그레고리오) */
  | { type: 'chant' }
  /** 진행도 +amount */
  | { type: 'progress'; amount: number };

/** 보스 행동 카드. 라운드가 시작될 때 공개하고, 라운드 끝 보스 차례에 쓴다 (OJ 코옵 보스 덱) */
export interface BossMove {
  name: string;
  /** 공개될 때 보이는 효과 글 */
  text: string;
  effects: BossEffect[];
  /** 공개된 뒤 보스 차례까지 이만큼 피해를 주면 행동이 끊기고 보스가 그로기 (블루 아카이브 그로기) */
  breakAt?: number;
}

/** 보스 고유 규칙 */
export interface BossPassive {
  /** kind 에너미 1마리마다 보스 방어력 +def (호드 인베이드 필러 · AP 정예) */
  guard?: { kind: EnemyKind; def: number };
  /** 차지 게이지: 보스 차례마다 perRound, perMinion이 살아 있으면 마리당 +1. max에 닿으면 다음 행동은 release.
   *  perMinion이 모두 쓰러지면 게이지가 비고 보스가 그로기 (케세드) */
  gauge?: { max: number; perRound?: number; perMinion?: EnemyKind; release: string };
  /** 부위 순환: 라운드마다 다음 부위가 켜진다. 켜진 부위에 breakAt 피해를 주면 부서진다 (카이텐) */
  parts?: { id: 'pink' | 'red' | 'green'; name: string; text: string; breakAt: number }[];
  /** kind 에너미 range칸 안 아군은 보스 차례마다 코인 -amount (호드 침식 영역) */
  drain?: { kind: EnemyKind; range: number; amount: number };
  /** kind 에너미가 모두 쓰러지면 진행도를 기다리지 않고 등장 (카이텐저) */
  appearWhenCleared?: EnemyKind;
  /** 리조트 체력. kind 에너미가 있는 동안 보스 차례마다 -1, 0이면 패배 (와카모 미사일 프렌지) */
  resort?: { hp: number; kind: EnemyKind };
  /** 난로 체력: 보스 차례마다 -decay. 0이면 저체온 (게부라) */
  heater?: { hp: number; decay: number };
  /** 오르간: 성가를 부르고 나면 보스 쪽으로 돌아간다. 아군이 멈추면 아군 쪽으로 (그레고리오) */
  organ?: boolean;
}

/** 체력이 at(비율) 아래로 떨어지면 바뀌는 모습 */
export interface BossPhase2 {
  at: number;
  name: string;
  icon: string;
  atk: number;
  def: number;
  counter?: boolean;
  defense?: DefenseMode;
  deck: string[];
  /** 바뀌는 순간 쓰는 효과 */
  enter: BossEffect[];
}

export type GimmickAction =
  /** tiles: 원작 칸 이름 (없으면 무작위) */
  | { type: 'summon'; enemies: EnemyKind[]; tiles?: string[] }
  | { type: 'bossAppear'; tile?: string }
  /** 잠든 보스가 움직이기 시작한다 */
  | { type: 'wake' }
  /** 원작 맵 이벤트 (engine/ap.ts) */
  | { type: 'apEvent'; event: string }
  /** 지금 있는 에너미와 앞으로 소환될 에너미 모두 강화 (보스 제외) */
  | { type: 'buffEnemies'; atk: number; def: number }
  /** 보스 행동 하나를 바로 쓴다 */
  | { type: 'move'; move: string };

/** 진행도가 at에 닿으면 actions를 순서대로 실행한다 */
export interface Gimmick {
  at: number;
  actions: GimmickAction[];
}

/** 보스 한 판의 정의: 보스 스탯 + 진행도 시간표 + 행동 덱 */
export interface BossDef {
  id: string;
  name: string;
  /** 총력전 부제 (데카그라마톤 · 슬럼피아 …) */
  title?: string;
  icon: string;
  /** 고르기 화면 한 줄 */
  summary?: string;
  /** 난이도 ★ (1~3) */
  stars?: number;
  /** 참고한 원작 보스 */
  ref?: string;
  /** 보스 전용 맵 id (data/maps.ts). 없으면 중앙 학원가 */
  map?: string;
  /** 보스 HP = hpPerPlayer × 플레이어 수 */
  hpPerPlayer: number;
  atk: number;
  def: number;
  counter: boolean;
  defense: DefenseMode;
  /** 진행도가 여기에 닿으면 패배 */
  defeatAt: number;
  timeline: Gimmick[];
  /** 행동 카드. 없으면 보스 차례에 아무것도 안 한다 */
  moves?: Record<string, BossMove>;
  /** 덱에 넣는 행동 id. 같은 id를 여러 번 넣을 수 있다 */
  deck?: string[];
  /** cycle: 적힌 순서대로 돈다 (총력전처럼 정해진 패턴) · shuffle: 섞어서 뽑는다 (OJ 보스 덱) */
  deckOrder?: 'cycle' | 'shuffle';
  passive?: BossPassive;
  phase2?: BossPhase2;
  /** 원작 협동 맵 보스 (engine/ap.ts) */
  ap?: ApBossDef;
}

/** 진행 중인 보스의 상태 */
export interface BossState {
  /** 남은 행동 카드 (앞에서부터 뽑는다) */
  drawPile: string[];
  /** 이번 라운드에 공개된 행동. dealt: 공개된 뒤 보스가 받은 피해 */
  intent: { move: string; dealt: number; broken: boolean } | null;
  gauge: number;
  phase: 1 | 2;
  /** 그로기: 남은 보스 차례. 방어력 0, 받는 피해 +1 */
  groggy: number;
  /** 받는 피해 + (히에로니무스 성유물) */
  vuln: number;
  /** 땅속 · 사라짐: 공격받지 않는다 */
  hidden: boolean;
  /** 카이텐: 남은 부위 id와 켜진 부위 순번, 이번 라운드 그 부위가 받은 피해 */
  parts: string[];
  part: number;
  partDealt: number;
  resort: number;
  heater: number;
  /** 오르간이 향한 쪽 */
  organ: 'boss' | 'players';
  /** 마지막 소환 뒤 쓰러진 미니언 (페로로지라 흡수) */
  felled: number;
}

/** 보스 차례 한 번의 기록. 화면은 이걸로 연출한다 */
export interface BossTurn {
  seq: number;
  /** 쓴 행동 이름. 없으면 미니언만 움직였다 */
  move: string | null;
  text: string;
  broken: boolean;
  /** 아군이 받은 피해 · 효과 */
  hits: { player: number; amount: number; note?: string }[];
  /** 움직인 에너미 (보스 포함): 지나간 칸 */
  moved: { enemy: number; path: number[] }[];
  lines: string[];
}

export interface AttackResult {
  mode: DefenseMode;
  /** 공격 주사위 눈 */
  attackRoll: number;
  /** 공격값 = 공격력 + 주사위 */
  attackValue: number;
  /** 방어 · 회피에 쓴 주사위 눈 (여러 개 굴렸으면 그중 고른 값) */
  defenseRoll: number;
  /** 굴린 주사위 전부 (뭇별 액티브처럼 2개 굴려 높은 값을 고를 때) */
  defenseRolls: number[];
  /** 방어: 방어력 + 주사위, 회피: 주사위 (공격 주사위와 비교) */
  defenseValue: number;
  damage: number;
}

export type BattleEvent =
  | { type: 'attack'; attacker: 'player' | 'enemy'; result: AttackResult; targetHp: number }
  | { type: 'enemyDefeated'; reward: number }
  | { type: 'playerKO' }
  | { type: 'release' }
  /** 회피에 성공해서 발동한 캐릭터 효과 (뭇별 패시브 · 잠재 능력) */
  | { type: 'skill'; name: string; damage?: number; targetHp?: number }
  /** 전투 카드 사용. value는 굴린 강화 수치, damage가 있으면 그 카드로 에너미가 피해를 입었다 (실드 카운터) */
  | { type: 'card'; card: CardId; value?: number; damage?: number; targetHp?: number }
  /** 연막탄으로 반격을 받지 않고 빠졌다 */
  | { type: 'escape' }
  /** 반격하는 에너미가 먼저 굴린 공격 주사위 */
  | { type: 'enemyRoll'; roll: number; value: number };

/** 인카운터 한 번의 기록. 화면은 events를 순서대로 연출한다 */
export interface Battle {
  seq: number;
  player: number;
  /** 인카운터 시작 시점의 에너미 */
  enemy: Enemy;
  events: BattleEvent[];
  done: boolean;
}

export type Phase =
  | { kind: 'preRoll' }
  | { kind: 'choosePath'; stepsLeft: number; options: number[] }
  | { kind: 'encounter'; enemy: number; stepsLeft: number }
  /** 반격: 에너미가 먼저 굴린 공격 주사위(attackRoll)를 보고 방어 · 회피와 카드를 고른다 (원작 순서) */
  | { kind: 'defend'; enemy: number; stepsLeft: number; attackRoll: number }
  /** 상점 칸: 지나가거나 멈추면 연다. 멈췄으면 첫 구매가 무료 */
  | { kind: 'shop'; stepsLeft: number; offers: ShopOffer[]; free: boolean; chips?: boolean; sent?: boolean }
  /** 내 거점 · 확인 지점을 지나갈 때: 멈출지 고른다 */
  | { kind: 'stopChoice'; stepsLeft: number }
  /** 이벤트 2개 중 하나 (패니 잠재) */
  | { kind: 'eventPick'; options: EventId[] }
  /** 원작 맵 선택 (투표 · 루트) */
  | { kind: 'mapChoice'; id: string; options: { id: string; label: string }[] }
  | { kind: 'endTurn' }
  | { kind: 'gameOver'; result: 'victory' | 'defeat' };

/** 카드로 붙는 상태. turns는 자기 차례가 시작될 때마다 1씩 준다 */
export interface PlayerStatus {
  regen: { amount: number; turns: number } | null;
  atkUp: { amount: number; turns: number } | null;
  defUp: { amount: number; turns: number } | null;
  /** 쓰러지면 다음 차례에 부활 (보충 수업) */
  extend: boolean;
  /** 다음 전투 공격력 (총공격) */
  nextBattleAtk: number;
  /** 다음 이동 주사위 수 (서둘러). 0이면 없음 */
  nextMoveDice: number;
  /** 다음 차례를 쉰다 (트리플 주사위) */
  skipTurn: boolean;
  /** 보스가 건 약화 */
  defDown: { amount: number; turns: number } | null;
  atkDown: { amount: number; turns: number } | null;
  /** 위압: 차례 시작마다 체력 -1, 회복을 받으면 풀린다 */
  erode: boolean;
  /** 저주: 남은 보스 차례. 0이 되면 터진다, 그때 체력이 가득 차 있으면 풀린다 */
  curse: number;
  /** 다음 이동 -칸 */
  slow: number;
}

/** 인카운터 한 번 동안만 가는 전투 카드 효과 */
export interface BattleMods {
  /** 이번 인카운터의 전투 코스트 (3 + 성) 중 쓴 만큼 */
  costUsed: number;
  atk: number;
  def: number;
  evadeDice: number;
  /** 공격 주사위 수 (높은 눈, sumDice면 합) */
  attackDice: number;
  /** 공격 주사위를 더한다 (액셀) */
  sumDice: boolean;
  /** 최종 공격력 배수 (전력 공격) */
  atkMult: number;
  /** 이번 전투 동안 에너미 방어력 감소 (Soda 조나단 러시) */
  enemyDefDown: number;
  noCounter: boolean;
  /** 보스도 반격하지 못한다 (독니) */
  noCounterAll?: boolean;
}

/** 현재 턴의 임시 값 */
export interface TurnInfo {
  /** 질주 칸: 이번 차례 한 번 더 굴린다 */
  haste?: boolean;
  /** 멈춘 칸의 효과를 이미 받았다 */
  landed?: boolean;
  /** 이동 주사위를 6면으로 (루카 액티브) */
  sixDice?: boolean;
  /** 이동 중 전투 없음 (루카 · 링링 돌진) */
  noBattle?: boolean;
  /** 링링 돌진 · 붙잡은 몬스터 */
  charge?: boolean;
  grabbed?: number[];
  /** 태클 중 금지 표지판을 지났다 · 멈춘 뒤 싸울 순서 */
  signPassed?: boolean;
  tackleQueue?: number[];
  /** 멈춘 뒤 이벤트 1번 더 (패니) */
  extraEvent?: boolean;
  /** 이번 차례 몬스터에게 도전했다 (펭) */
  challenged?: boolean;
  /** 원격 도전 중 (낸시): 끝나면 주사위 전으로 · 멀면 반격 없음 */
  remote?: boolean;
  remoteFar?: boolean;
  /** 차례마다 1번 */
  lukaCut?: boolean;
  sherryDone?: boolean;
  /** 원격 상점 (파루난): 나가면 주사위 전으로 */
  remoteShop?: boolean;
  /** 주사위 전 카드(부스트 · 지원 · 이벤트)를 썼는지 */
  /** 이번 차례에 쓴 주사위 전 카드 수 */
  cardsPlayed: number;
  /** 카드 사용 + (유물 효과로 이번 차례만) */
  extraPlays: number;
  candyUsed: boolean;
  quiverUsed: boolean;
  skillUsed: boolean;
  diceCount: number;
  extraSteps: number;
  /** 정해 둔 이동 칸 (스마트 주사위 · 운명의 인도) */
  fixedMove: number | null;
  dice: number[];
  battle: BattleMods;
}

export interface ShopOffer {
  card: CardId;
  price: number;
  sold: boolean;
}

/** 화면 연출용: 마지막으로 쓴 카드 */
export interface CardPlay {
  seq: number;
  player: number;
  card: CardId;
}

/** 화면 연출용: 마지막으로 말이 지나간 칸들 (시작 칸 포함) */
export interface Move {
  seq: number;
  player: number;
  path: number[];
}

/** 화면에 크게 띄울 알림 (기믹 발동 등) */
export interface Notice {
  seq: number;
  text: string;
}

/** 한 판 동안의 플레이어 기록 (결과 화면 · 보상) */
export interface PlayerStats {
  /** 에너미 · 보스에게 준 피해 */
  damage: number;
  bossDamage: number;
  kills: number;
  /** 저지 · 부위 파괴 */
  breaks: number;
  kos: number;
  damageTaken: number;
  cardsUsed: number;
}

export interface GameState {
  board: Board;
  boss: BossDef;
  /** 난이도 id (data/difficulty.ts) */
  difficulty: DifficultyId;
  stats: PlayerStats[];
  players: Player[];
  enemies: Enemy[];
  nextEnemyId: number;
  bossState: BossState;
  marks: Mark[];
  nextMarkId: number;
  /** 마지막 보스 차례 기록 */
  bossTurn: BossTurn | null;
  /** 기믹으로 쌓인 에너미 강화치. 새로 소환되는 에너미에도 더한다 */
  enemyBonus: { atk: number; def: number };
  current: number;
  /** 진짜 라운드. 라운드 쿨타임은 이것만 따른다 */
  round: number;
  /** 보스 기믹이 따라가는 시계. 라운드마다 +1, KO마다 +1 */
  progress: number;
  /** 기믹을 어디까지 실행했는지 (진행도 기준) */
  gimmicksDone: number;
  phase: Phase;
  turn: TurnInfo;
  lastMove: Move | null;
  lastCard: CardPlay | null;
  /** 최근 인카운터 기록 (한 행동 안에서 전투가 끝나고 다음 전투가 시작될 수 있어서 몇 개 남겨 둔다) */
  battles: Battle[];
  notices: Notice[];
  log: string[];
  /** 시드 기반 RNG의 현재 상태. 주사위·랜덤은 전부 여기서 나온다 */
  rngState: number;
  seq: number;
  /** 원작 협동 맵 상태 */
  ap?: ApState;
}

export type Action =
  /** target: 아군이면 플레이어 id, 에너미면 에너미 id · value: 고른 숫자 (스마트 주사위 · 금지 표지판) */
  | { type: 'PLAY_CARD'; player: number; handIndex: number; target?: number; value?: number }
  | { type: 'BUY_CARD'; player: number; offer: number }
  /** 상점에서 아군에게 코인 송금 (한 번에 5) */
  | { type: 'SEND_COINS'; player: number; to: number }
  | { type: 'LEAVE_SHOP'; player: number }
  /** 받은 유물 후보 중 하나 */
  | { type: 'PICK_RELIC'; player: number; relic: RelicId }
  /** 유물 후보 다시 뽑기 (무한 순환) */
  | { type: 'REROLL_RELIC'; player: number }
  /** 상점에서 유물 고르기를 산다 */
  | { type: 'BUY_RELIC'; player: number }
  | { type: 'ROLL'; player: number }
  | { type: 'CHOOSE_PATH'; player: number; to: number }
  | { type: 'ENCOUNTER'; player: number; choice: 'attack' | 'release' }
  | { type: 'DEFEND'; player: number; mode: DefenseMode }
  /** target: 대상을 고르는 액티브의 대상 (Soda: 에너미 id · 모나: 아군 id) · cards: 모나가 줄 손패 번호 */
  | { type: 'USE_SKILL'; player: number; target?: number; cards?: number[]; value?: number }
  /** 거점 · 확인 지점에서 멈출지 */
  | { type: 'STOP_HERE'; player: number; stop: boolean }
  /** 고른 이벤트 (패니 잠재) */
  | { type: 'PICK_EVENT'; player: number; event: EventId }
  /** 원작 맵 선택 (투표 · 루트) */
  | { type: 'MAP_CHOICE'; player: number; choice: string }
  | { type: 'END_TURN'; player: number };

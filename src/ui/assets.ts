import { RELIC_IDS, relicFamily, type RelicId } from '../data/relics';
import type { CardId, CharacterId, Enemy, MarkKind, TileKind } from '../engine/types';

const root = `${import.meta.env.BASE_URL}assets/`;

/** 화면 전체 배경. CSS에서 절대 경로를 쓰면 GitHub Pages 하위 경로에서 깨지므로 BASE_URL을 붙여 변수로 넘긴다 */
export const BACKGROUND_ART = `${root}board/background.webp`;

export const TILE_ART: Partial<Record<TileKind, string>> = {
  base: `${root}tiles/base.webp`,
  coinPlus: `${root}tiles/coin-plus.webp`,
  spawn: `${root}tiles/spawn.webp`,
  coinMinus: `${root}tiles/coin-minus.webp`,
  card: `${root}tiles/card.webp`,
  heal: `${root}tiles/heal.webp`,
  warp: `${root}tiles/warp.webp`,
  empty: `${root}tiles/empty.webp`,
  shop: `${root}tiles/shop.webp`,
};

export const ENEMY_ART: Partial<Record<Enemy['kind'], string>> = {
  robot: `${root}enemies/robot/idle.webp`,
  drone: `${root}enemies/drone/idle.webp`,
  delinquent: `${root}enemies/delinquent/idle.webp`,
};

/**
 * 보스 그림 (docs/ASSETS.md 보스 요청). 보스 id별로
 *   token: 보드 위 둥근 배지 · portrait: 고르기 화면 · HUD 얼굴 · encounter: 인카운터 화면 · phase2: 2페이즈 모습
 * 없으면 이모지 아이콘으로 그린다
 */
export const BOSS_ART: Record<string, { token?: string; portrait?: string; encounter?: string; phase2?: string }> = {};

/** 유물 아이콘 (docs/ASSETS.md 유물 요청). 없으면 이모지 */
const RELIC_FILES: string[] = [];
export const RELIC_ART: Partial<Record<RelicId, string>> = Object.fromEntries(
  RELIC_IDS.filter((id) => RELIC_FILES.includes(relicFamily(id))).map((id) => [id, `${root}relics/${relicFamily(id)}.webp`]),
);

/** 보드 표식 아이콘 (폭탄 · 성유물 · 모자 · 오르간 · 난로 · 불길). 없으면 이모지 */
export const MARK_ART: Partial<Record<MarkKind, string>> = {};

/** 인카운터 화면 가득 나오는 큰 그림 (docs/ASSETS.md 3차 요청). 없으면 idle 그림을 크게 쓴다 */
export const ENEMY_ENCOUNTER_ART: Partial<Record<Enemy['kind'], string>> = {
  robot: `${root}enemies/robot/encounter.webp`,
  drone: `${root}enemies/drone/encounter.webp`,
  delinquent: `${root}enemies/delinquent/encounter.webp`,
};

/** 전투 화면 그림 (docs/ASSETS.md 3차 요청). 없는 건 CSS로 그린 임시 모양을 쓴다 */
export const BATTLE_ART: { stage?: string; background?: string; impact?: string; smoke?: string } = {
  stage: `${root}battle/stage.webp`,
  background: `${root}battle/background.webp`,
  impact: `${root}fx/impact.webp`,
  smoke: `${root}fx/smoke.webp`,
};

export type EnemyPose = 'idle' | 'attack' | 'hit' | 'evade';
export const ENEMY_POSES: Partial<Record<Enemy['kind'], Partial<Record<EnemyPose, string>>>> = {
  robot: { idle: ENEMY_ART.robot, hit: `${root}enemies/robot/hit.webp` },
  drone: { idle: ENEMY_ART.drone, hit: `${root}enemies/drone/hit.webp`, evade: `${root}enemies/drone/evade.webp` },
  delinquent: { idle: ENEMY_ART.delinquent, attack: `${root}enemies/delinquent/attack.webp`, hit: `${root}enemies/delinquent/hit.webp` },
};

/** 카드 그림 (docs/ASSETS.md 5차 요청). 없는 카드는 아이콘으로 그린다 */
export const CARD_ART: Partial<Record<CardId, string>> = {
  dash: `${root}cards/dash.webp`,
  doubleDice: `${root}cards/double-dice.webp`,
  bandage: `${root}cards/bandage.webp`,
  tripleDice: `${root}cards/triple-dice.webp`,
  remoteDice: `${root}cards/remote-dice.webp`,
  portal: `${root}cards/portal.webp`,
  cookie: `${root}cards/cookie.webp`,
  cake: `${root}cards/cake.webp`,
  pudding: `${root}cards/pudding.webp`,
  poisonCure: `${root}cards/poison-cure.webp`,
  notes: `${root}cards/notes.webp`,
  extend: `${root}cards/extend.webp`,
  kingPower: `${root}cards/king-power.webp`,
  immovable: `${root}cards/immovable.webp`,
  hurry: `${root}cards/hurry.webp`,
  feast: `${root}cards/feast.webp`,
  share: `${root}cards/share.webp`,
  backup: `${root}cards/backup.webp`,
  dinner: `${root}cards/dinner.webp`,
  allOut: `${root}cards/all-out.webp`,
  revival: `${root}cards/revival.webp`,
  slingshot: `${root}cards/slingshot.webp`,
  laser: `${root}cards/laser.webp`,
  brick: `${root}cards/brick.webp`,
  blast: `${root}cards/blast.webp`,
  railgun: `${root}cards/railgun.webp`,
  atkM: `${root}cards/atk-m.webp`,
  atkL: `${root}cards/atk-l.webp`,
  atkG: `${root}cards/atk-g.webp`,
  onFire: `${root}cards/on-fire.webp`,
  magnum: `${root}cards/magnum.webp`,
  shadowRaid: `${root}cards/shadow-raid.webp`,
  gawu: `${root}cards/gawu.webp`,
  charge: `${root}cards/charge.webp`,
  fullAttack: `${root}cards/full-attack.webp`,
  accel: `${root}cards/accel.webp`,
  defM: `${root}cards/def-m.webp`,
  defL: `${root}cards/def-l.webp`,
  defG: `${root}cards/def-g.webp`,
  rainbow: `${root}cards/rainbow.webp`,
  retreat: `${root}cards/retreat.webp`,
  shieldCounter: `${root}cards/shield-counter.webp`,
};

export const UI_ART = {
  coin: `${root}ui/coin.webp`,
  heart: `${root}ui/heart.webp`,
  star: `${root}ui/star.webp`,
  cardBack: `${root}ui/card-back.webp`,
  logo: `${root}ui/logo.webp`,
};

/** 현재 보행로는 SVG로 이어 그린다. 이 그림은 다른 맵에서 사용할 수 있다. */
export const PATH_ART = `${root}board/path.webp`;

/** 로비와 캐릭터 목록·상세 화면 배경. */
export const LOBBY_ART = {
  background: `${root}lobby/background.webp`,
  room: `${root}lobby/room.webp`,
};

/** 승인한 밤 도시 시안의 레이어. public/memorial.html에서 시연한다. */
export const MEMORIAL_ART = {
  mutbyeol: {
    background: `${root}characters/mutbyeol/memorial/night-v3/background.webp`,
    character: `${root}characters/mutbyeol/memorial/night-v3/body.webp`,
    hairBack: `${root}characters/mutbyeol/memorial/night-v3/hair-back.webp`,
    eyesClosed: `${root}characters/mutbyeol/memorial/night-v3/eyes-closed.webp`,
    original: `${root}characters/mutbyeol/memorial/night-v3/original.webp`,
  },
};

export const CHARACTER_MEMORIAL_ART: Record<CharacterId, string> = {
  mutbyeol: `${root}characters/mutbyeol/memorial/night-v3/original.webp`,
  soda: `${root}characters/soda/memorial/scene-v6-swim.webp`,
  mona: `${root}characters/mona/memorial/scene-v4.webp`,
};

export const CHARACTER_MEMORIAL_ANIMATION: Partial<Record<CharacterId, string>> = {
  mutbyeol: `${import.meta.env.BASE_URL}memorial.html`,
  soda: `${import.meta.env.BASE_URL}memorial-soda.html`,
  mona: `${import.meta.env.BASE_URL}memorial-mona.html`,
};

/** 제작된 캐릭터 그림. 캐릭터 선택·플레이어 배정 시스템에서 id로 참조한다. */
export type CharacterPose = 'idle' | 'attack' | 'hit' | 'block' | 'evade' | 'down';
export interface CharacterArt {
  name: string;
  color: string;
  main: string;
  token: string;
  portrait: string;
  /** 스킬 아이콘. 없으면 글자 아이콘 */
  skillActive?: string;
  skillPassive?: string;
  skillPassive2?: string;
  potential?: string;
  poses: Record<CharacterPose, string>;
}

export const CHARACTER_ART: Record<CharacterId, CharacterArt> = {
  mutbyeol: {
    name: '뭇별',
    color: '#8EDBD9',
    main: `${root}characters/mutbyeol/main.webp`,
    token: `${root}characters/mutbyeol/token.webp`,
    portrait: `${root}characters/mutbyeol/portrait.webp`,
    skillActive: `${root}characters/mutbyeol/skill-active.webp`,
    skillPassive: `${root}characters/mutbyeol/skill-passive.webp`,
    potential: `${root}characters/mutbyeol/potential.webp`,
    poses: {
      idle: `${root}characters/mutbyeol/battle-idle.webp`,
      attack: `${root}characters/mutbyeol/battle-attack.webp`,
      hit: `${root}characters/mutbyeol/battle-hit.webp`,
      block: `${root}characters/mutbyeol/battle-block.webp`,
      evade: `${root}characters/mutbyeol/battle-evade.webp`,
      down: `${root}characters/mutbyeol/battle-down.webp`,
    },
  },
  soda: {
    name: 'Soda',
    color: '#7FA8E8',
    main: `${root}characters/soda/main.webp`,
    token: `${root}characters/soda/token.webp`,
    portrait: `${root}characters/soda/portrait.webp`,
    skillActive: `${root}characters/soda/skill-active.webp`,
    skillPassive: `${root}characters/soda/skill-passive.webp`,
    poses: {
      idle: `${root}characters/soda/battle-idle.webp`,
      attack: `${root}characters/soda/battle-attack.webp`,
      hit: `${root}characters/soda/battle-hit.webp`,
      block: `${root}characters/soda/battle-block.webp`,
      evade: `${root}characters/soda/battle-evade.webp`,
      down: `${root}characters/soda/battle-down.webp`,
    },
  },
  mona: {
    name: '모나',
    color: '#F28BB5',
    main: `${root}characters/mona/main.webp`,
    token: `${root}characters/mona/token.webp`,
    portrait: `${root}characters/mona/portrait.webp`,
    skillActive: `${root}characters/mona/skill-active.webp`,
    skillPassive: `${root}characters/mona/skill-passive.webp`,
    skillPassive2: `${root}characters/mona/skill-passive-2.webp`,
    poses: {
      idle: `${root}characters/mona/battle-idle.webp`,
      attack: `${root}characters/mona/battle-attack.webp`,
      hit: `${root}characters/mona/battle-hit.webp`,
      block: `${root}characters/mona/battle-block.webp`,
      evade: `${root}characters/mona/battle-evade.webp`,
      down: `${root}characters/mona/battle-down.webp`,
    },
  },
};

const sodaRiderRoot = `${root}characters/soda/skins/rider/`;
export const CHARACTER_SKINS: Partial<Record<CharacterId, Record<string, { name: string; art: CharacterArt }>>> = {
  soda: {
    default: { name: '마법사', art: CHARACTER_ART.soda },
    rider: {
      name: '라이더',
      art: {
        ...CHARACTER_ART.soda,
        main: `${sodaRiderRoot}main.webp`,
        token: `${sodaRiderRoot}token.webp`,
        portrait: `${sodaRiderRoot}portrait.webp`,
        skillActive: `${sodaRiderRoot}skill-active.webp`,
        skillPassive: `${sodaRiderRoot}skill-passive.webp`,
        poses: {
          idle: `${sodaRiderRoot}battle-idle.webp`,
          attack: `${sodaRiderRoot}battle-attack.webp`,
          hit: `${sodaRiderRoot}battle-hit.webp`,
          block: `${sodaRiderRoot}battle-block.webp`,
          evade: `${sodaRiderRoot}battle-evade.webp`,
          down: `${sodaRiderRoot}battle-down.webp`,
        },
      },
    },
  },
};

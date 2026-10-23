import type { CardId, Enemy, TileKind } from '../engine/types';

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
};

export const ENEMY_ART: Partial<Record<Enemy['kind'], string>> = {
  robot: `${root}enemies/robot/idle.webp`,
  drone: `${root}enemies/drone/idle.webp`,
  delinquent: `${root}enemies/delinquent/idle.webp`,
};

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

export const CARD_ART: Record<CardId, string> = {
  dash: `${root}cards/dash.webp`,
  doubleDice: `${root}cards/double-dice.webp`,
  bandage: `${root}cards/bandage.webp`,
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

/** 제작된 캐릭터 그림. 캐릭터 선택·플레이어 배정 시스템에서 id로 참조한다. */
export type CharacterPose = 'idle' | 'attack' | 'hit' | 'block' | 'evade' | 'down';
export const CHARACTER_ART = {
  mutbyeol: {
    name: '뭇별',
    color: '#8EDBD9',
    main: `${root}characters/mutbyeol/main.webp`,
    token: `${root}characters/mutbyeol/token.webp`,
    portrait: `${root}characters/mutbyeol/portrait.webp`,
    poses: {
      idle: `${root}characters/mutbyeol/battle-idle.webp`,
      attack: `${root}characters/mutbyeol/battle-attack.webp`,
      hit: `${root}characters/mutbyeol/battle-hit.webp`,
      block: `${root}characters/mutbyeol/battle-block.webp`,
      evade: `${root}characters/mutbyeol/battle-evade.webp`,
      down: `${root}characters/mutbyeol/battle-down.webp`,
    } satisfies Record<CharacterPose, string>,
  },
} as const;

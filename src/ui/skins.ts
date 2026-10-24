// 캐릭터 스킨: 목록은 assets.ts의 CHARACTER_SKINS, 고른 스킨은 계정(학생 기록)에 둔다.
// 게임 안에서는 시작할 때 정한 스킨(Player.skin)을 쓴다.

import type { CharacterId } from '../engine/types';
import { loadAccount } from '../meta/account';
import { CHARACTER_ART, CHARACTER_SKINS, type CharacterArt } from './assets';

export const DEFAULT_SKIN = 'default';

export interface SkinInfo {
  id: string;
  name: string;
  art: CharacterArt;
}

/** 캐릭터의 스킨들 (스킨이 따로 없으면 기본 하나) */
export function skinsOf(id: CharacterId): SkinInfo[] {
  const list = CHARACTER_SKINS[id];
  if (!list) return [{ id: DEFAULT_SKIN, name: '기본', art: CHARACTER_ART[id] }];
  return Object.entries(list).map(([skin, s]) => ({ id: skin, ...s }));
}

/** 스킨 그림. 없는 스킨이면 기본 그림 */
export function skinArt(id: CharacterId, skin?: string): CharacterArt {
  return (skin && CHARACTER_SKINS[id]?.[skin]?.art) || CHARACTER_ART[id];
}

/** 계정에서 고른 스킨 */
export function chosenSkin(id: CharacterId): string {
  const skin = loadAccount().students[id]?.skin;
  return skin && CHARACTER_SKINS[id]?.[skin] ? skin : DEFAULT_SKIN;
}

/** 게임 밖 화면 (로비 · 캐릭터 · 모집 · 시작)에서 쓰는 그림 */
export function myArt(id: CharacterId): CharacterArt {
  return skinArt(id, chosenSkin(id));
}

import { CARDS, DEFAULT_PRESETS, type DeckPreset } from '../data/cards';
import type { CardId } from '../engine/types';

const KEY = 'newparty.decks.v2';

/** 저장된 덱 슬롯 5개. 없거나 깨진 칸은 처음 값으로 */
export function loadDecks(): DeckPreset[] {
  let saved: unknown = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    // 저장소를 못 쓰면 처음 값
  }
  return DEFAULT_PRESETS.map((fallback, i) => {
    const slot = Array.isArray(saved) ? (saved[i] as Partial<DeckPreset> | undefined) : undefined;
    if (!slot || !Array.isArray(slot.cards)) return structuredClone(fallback);
    return {
      name: typeof slot.name === 'string' && slot.name.trim() ? slot.name.slice(0, 12) : fallback.name,
      cards: slot.cards.filter((id): id is CardId => typeof id === 'string' && (CARDS[id as CardId]?.limit ?? 0) > 0),
    };
  });
}

export function saveDecks(decks: DeckPreset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(decks));
  } catch {
    // 저장소를 못 쓰면 이번 실행 동안만 유지된다
  }
}

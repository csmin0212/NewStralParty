import { DEFAULT_PRESETS, type DeckPreset } from '../data/cards';
import { validateDeck } from '../engine/cards';

const KEY = 'newparty.decks.v1';

/** 저장된 덱 프리셋. 없거나 깨져 있으면 기본값 */
export function loadPresets(): DeckPreset[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as DeckPreset[] | null;
    if (Array.isArray(saved) && saved.length === DEFAULT_PRESETS.length) {
      return saved.map((p, i) =>
        p && Array.isArray(p.cards) && validateDeck(p.cards).length === 0
          ? { name: String(p.name || DEFAULT_PRESETS[i].name), cards: p.cards }
          : structuredClone(DEFAULT_PRESETS[i]),
      );
    }
  } catch {
    // 저장소를 못 쓰면 기본값
  }
  return structuredClone(DEFAULT_PRESETS);
}

export function savePresets(presets: DeckPreset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets));
  } catch {
    // 저장소를 못 쓰면 이번 실행 동안만 유지된다
  }
}

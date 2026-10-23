import { CARD_IDS, CARD_TYPE_NAMES, CARDS, DEFAULT_PRESETS, type CardType } from '../data/cards';
import { canAddToDeck } from '../engine/cards';
import { RULES } from '../engine/rules';
import type { CardId } from '../engine/types';
import { LOBBY_ART } from './assets';
import { cardFace } from './cardView';
import { loadPresets, savePresets } from './deckStore';
import { esc } from './html';

type Filter = 'all' | CardType;
const FILTERS: [Filter, string][] = [
  ['all', '전체'],
  ['boost', CARD_TYPE_NAMES.boost],
  ['battle', CARD_TYPE_NAMES.battle],
  ['support', CARD_TYPE_NAMES.support],
  ['event', CARD_TYPE_NAMES.event],
];

/** 덱 편성: 왼쪽은 프리셋과 지금 덱, 오른쪽은 전체 카드. 누르면 넣고, 덱의 카드를 누르면 뺀다 */
export function renderDeckScreen(root: HTMLElement, onBack: () => void) {
  const presets = loadPresets();
  let current = 0;
  let filter: Filter = 'all';

  const render = () => {
    const deck = presets[current].cards;
    const counts = new Map<CardId, number>();
    for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    const deckCards = CARD_IDS.filter((id) => counts.has(id));

    const tabs = presets
      .map((p, i) => `<button class="ba-tab ${i === current ? 'on' : ''}" data-preset="${i}">${esc(p.name)}</button>`)
      .join('');
    const filters = FILTERS.map(
      ([f, label]) => `<button class="ba-tab ${f === filter ? 'on' : ''}" data-filter="${f}">${label}</button>`,
    ).join('');
    const pool = CARD_IDS.filter((id) => filter === 'all' || CARDS[id].type === filter)
      .map((id) => {
        const n = counts.get(id) ?? 0;
        const ok = canAddToDeck(deck, id);
        // 장수 제한에 걸린 카드만 흐리게. 덱이 꽉 찼을 때는 누를 수만 없다
        const maxed = n >= CARDS[id].limit;
        return `<button class="deck-card ${maxed ? 'off' : ''}" data-add="${id}" ${ok ? '' : 'disabled'}>${cardFace(id, { tag: `${n} / ${CARDS[id].limit}` })}</button>`;
      })
      .join('');
    const mine = deckCards
      .map(
        (id) =>
          `<button class="deck-card" data-remove="${id}" ${deck.length <= RULES.deckMin ? 'disabled' : ''}>${cardFace(id, { count: counts.get(id) })}</button>`,
      )
      .join('');

    root.innerHTML = `
      <div class="chars deck-screen">
        <img class="chars-bg" src="${LOBBY_ART.room}" alt="" draggable="false">
        <div class="stage">
          <header class="ba-top">
            <button class="ba-back" data-act="back" title="뒤로"><i></i></button>
            <h2>덱 편성</h2>
          </header>

          <section class="ba-panel deck-mine">
            <nav class="ba-tabs">${tabs}</nav>
            <div class="ba-band">덱 <b>${deck.length}</b> / ${RULES.deckSize}</div>
            <div class="deck-grid">${mine}</div>
            <div class="panel-foot">
              <button class="ba-btn ba-btn--sky" data-act="reset">기본값</button>
            </div>
          </section>

          <section class="ba-panel deck-pool">
            <nav class="ba-tabs">${filters}</nav>
            <div class="deck-grid deck-grid--pool">${pool}</div>
          </section>
        </div>
      </div>`;
  };

  root.oninput = null;
  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!el || el.disabled) return;
    const deck = presets[current].cards;
    const { preset, filter: f, add, remove, act } = el.dataset;
    if (act === 'back') return onBack();
    if (preset !== undefined) current = Number(preset);
    else if (f) filter = f as Filter;
    else if (add && canAddToDeck(deck, add as CardId)) deck.push(add as CardId);
    else if (remove && deck.length > RULES.deckMin) deck.splice(deck.indexOf(remove as CardId), 1);
    else if (act === 'reset') presets[current] = structuredClone(DEFAULT_PRESETS[current]);
    else return;
    savePresets(presets);
    render();
  };

  render();
}

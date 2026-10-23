import { CARD_TYPE_NAMES, CARDS, DECK_CARD_IDS, type CardType, type DeckPreset } from '../data/cards';
import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import { canAddToDeck, deckPoints, validateDeck } from '../engine/cards';
import { RULES } from '../engine/rules';
import type { CardId } from '../engine/types';
import { LOBBY_ART } from './assets';
import { cardFace } from './cardView';
import { loadDecks, saveDecks } from './deckStore';
import { esc } from './html';

type Filter = 'all' | CardType;
const FILTERS: [Filter, string][] = [
  ['all', '전체'],
  ['boost', CARD_TYPE_NAMES.boost],
  ['support', CARD_TYPE_NAMES.support],
  ['event', CARD_TYPE_NAMES.event],
  ['battle', CARD_TYPE_NAMES.battle],
];

/**
 * 덱 편성: 슬롯 5개 (100% 오렌지 쥬스처럼). 왼쪽은 고른 슬롯의 덱, 오른쪽은 전체 카드.
 * 고친 내용은 저장을 눌러야 남는다. 덱 포인트 예산은 캐릭터 기준.
 */
export function renderDeckScreen(root: HTMLElement, onBack: () => void) {
  let saved = loadDecks();
  const work: DeckPreset[] = structuredClone(saved);
  let current = 0;
  let filter: Filter = 'all';
  const character = CHARACTER_IDS[0];
  const budget = CHARACTERS[character].deckPoints;

  const dirty = (i: number) => JSON.stringify(work[i]) !== JSON.stringify(saved[i]);

  const render = () => {
    const deck = work[current].cards;
    const counts = new Map<CardId, number>();
    for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    const points = deckPoints(deck);
    const problems = validateDeck(deck, budget);

    const tabs = work
      .map(
        (d, i) =>
          `<button class="ba-tab ${i === current ? 'on' : ''}" data-slot="${i}">${esc(d.name)}${dirty(i) ? ' •' : ''}</button>`,
      )
      .join('');
    const filters = FILTERS.map(
      ([f, label]) => `<button class="ba-tab ${f === filter ? 'on' : ''}" data-filter="${f}">${label}</button>`,
    ).join('');
    const pool = DECK_CARD_IDS.filter((id) => filter === 'all' || CARDS[id].type === filter)
      .map((id) => {
        const n = counts.get(id) ?? 0;
        const ok = canAddToDeck(deck, id, budget);
        // 장수 제한 · 포인트 초과로 넣을 수 없는 카드만 흐리게 (덱이 꽉 찬 것만으로는 흐리게 하지 않는다)
        const off = n >= CARDS[id].limit || points + CARDS[id].points > budget;
        return `<button class="deck-card ${off ? 'off' : ''}" data-add="${id}" ${ok ? '' : 'disabled'}>${cardFace(id, { tag: `${n} / ${CARDS[id].limit}` })}</button>`;
      })
      .join('');
    const mine = DECK_CARD_IDS.filter((id) => counts.has(id))
      .map((id) => `<button class="deck-card" data-remove="${id}">${cardFace(id, { count: counts.get(id) })}</button>`)
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
            <nav class="ba-tabs deck-slots">${tabs}</nav>
            <div class="deck-head">
              <input class="deck-name" maxlength="12" value="${esc(work[current].name)}" aria-label="덱 이름">
              <span class="deck-meter ${deck.length > RULES.deckSize ? 'over' : ''}"><small>카드</small><b>${deck.length}</b>/${RULES.deckSize}</span>
              <span class="deck-meter ${points > budget ? 'over' : ''}" title="${CHARACTERS[character].name} 덱 포인트"><small>포인트</small><b>${points}</b>/${budget}</span>
            </div>
            <div class="deck-grid">${mine}</div>
            <div class="deck-foot">
              <span class="deck-problem">${problems.length ? esc(problems[0]) : ''}</span>
              <button class="ba-btn ba-btn--white" data-act="random">랜덤</button>
              <button class="ba-btn ba-btn--white" data-act="revert" ${dirty(current) ? '' : 'disabled'}>되돌리기</button>
              <button class="ba-btn ba-btn--yellow" data-act="save" ${dirty(current) && problems.length === 0 ? '' : 'disabled'}>저장</button>
            </div>
          </section>

          <section class="ba-panel deck-pool">
            <nav class="ba-tabs">${filters}</nav>
            <div class="deck-grid deck-grid--pool">${pool}</div>
          </section>
        </div>
      </div>`;
  };

  /** 예산 안에서 무작위로 10장 채우기 */
  const randomDeck = (): CardId[] => {
    const cards: CardId[] = [];
    for (let tries = 0; tries < 400 && cards.length < RULES.deckSize; tries++) {
      const id = DECK_CARD_IDS[Math.floor(Math.random() * DECK_CARD_IDS.length)];
      if (canAddToDeck(cards, id, budget)) cards.push(id);
    }
    return cards;
  };

  root.onclick = (e) => {
    const el = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!el || el.disabled) return;
    const deck = work[current].cards;
    const { slot, filter: f, add, remove, act } = el.dataset;
    if (act === 'back') {
      if (work.some((_, i) => dirty(i)) && !confirm('저장하지 않은 덱이 있어요. 나갈까요?')) return;
      return onBack();
    }
    if (slot !== undefined) current = Number(slot);
    else if (f) filter = f as Filter;
    else if (add && canAddToDeck(deck, add as CardId, budget)) deck.push(add as CardId);
    else if (remove) deck.splice(deck.indexOf(remove as CardId), 1);
    else if (act === 'random') work[current].cards = randomDeck();
    else if (act === 'revert') work[current] = structuredClone(saved[current]);
    else if (act === 'save') {
      saved[current] = structuredClone(work[current]);
      saveDecks(saved);
      saved = loadDecks();
      work[current] = structuredClone(saved[current]);
    } else return;
    render();
  };
  root.oninput = (e) => {
    const input = e.target as HTMLInputElement;
    if (!input.classList.contains('deck-name')) return;
    work[current].name = input.value;
    // 이름을 고치는 동안 입력칸을 다시 그리지 않고 탭 이름과 버튼만 바꾼다
    const tab = root.querySelector(`[data-slot="${current}"]`);
    if (tab) tab.textContent = `${input.value}${dirty(current) ? ' •' : ''}`;
    const save = root.querySelector<HTMLButtonElement>('[data-act="save"]');
    const revert = root.querySelector<HTMLButtonElement>('[data-act="revert"]');
    const ok = validateDeck(work[current].cards, budget).length === 0;
    if (save) save.disabled = !(dirty(current) && ok && input.value.trim() !== '');
    if (revert) revert.disabled = !dirty(current);
  };

  render();
}

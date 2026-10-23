import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import type { PlayerSetup } from '../engine/game';
import type { CharacterId } from '../engine/types';
import { CHARACTER_ART, LOBBY_ART, UI_ART } from './assets';
import { validateDeck } from '../engine/cards';
import { loadDecks } from './deckStore';
import { esc, PLAYER_COLORS } from './html';

interface Seat {
  name: string;
  character: CharacterId;
  potential: boolean;
  /** 덱 프리셋 번호 */
  deck: number;
}

export function renderSetup(root: HTMLElement, onStart: (players: PlayerSetup[]) => void, onBack: () => void) {
  let count = 4;
  const decks = loadDecks();
  /** 이 캐릭터가 들고 갈 수 있는 슬롯 (규칙에 맞는 덱만) */
  const usable = (character: CharacterId) =>
    decks.map((_, i) => i).filter((i) => validateDeck(decks[i].cards, CHARACTERS[character].deckPoints).length === 0);
  const seats: Seat[] = PLAYER_COLORS.map((_, i) => ({
    name: `플레이어 ${i + 1}`,
    character: CHARACTER_IDS[0],
    potential: false,
    deck: usable(CHARACTER_IDS[0])[0] ?? 0,
  }));

  const seatRow = (seat: Seat, i: number) => {
    const c = CHARACTERS[seat.character];
    const art = CHARACTER_ART[seat.character];
    // 캐릭터가 하나뿐이면 고르는 버튼 대신 이름만 보인다
    const pick =
      CHARACTER_IDS.length > 1
        ? `<button class="seat-char" data-cycle="${i}" title="캐릭터 바꾸기"><img src="${art.portrait}" alt=""><b>${c.name}</b> ▾</button>`
        : `<span class="seat-char"><img src="${art.portrait}" alt=""><b>${c.name}</b></span>`;
    return `
      <li style="--c:${PLAYER_COLORS[i]}">
        <span class="dot"></span>
        <input data-name="${i}" maxlength="10" value="${esc(seat.name)}" />
        ${pick}
        <button class="seat-deck" data-deck="${i}" title="덱 바꾸기">${esc(decks[seat.deck].name)}</button>
        ${
          c.potential
            ? `<label class="seat-potential" title="${esc(c.potential.description)}">
          <input type="checkbox" data-potential="${i}" ${seat.potential ? 'checked' : ''} />
          <span>잠재 능력</span>
        </label>`
            : '<span class="seat-potential"></span>'
        }
      </li>`;
  };

  const render = () => {
    root.innerHTML = `
      <div class="setup-screen">
      <img class="chars-bg" src="${LOBBY_ART.background}" alt="" draggable="false">
      <div class="stage">
      <button class="ba-back" data-back title="로비로"><i></i></button>
      <div class="setup">
        <h1><img class="game-logo" src="${UI_ART.logo}" alt="NewParty"></h1>
        <div class="count">
          ${[2, 3, 4]
            .map((n) => `<button data-count="${n}" class="${n === count ? 'selected' : ''}">${n}명</button>`)
            .join('')}
        </div>
        <ol class="names">${seats.slice(0, count).map(seatRow).join('')}</ol>
        <button class="primary start">게임 시작</button>
      </div>
      </div>
      </div>`;
  };

  root.onclick = (e) => {
    const target = e.target as HTMLElement;
    const countBtn = target.closest<HTMLElement>('[data-count]');
    const cycle = target.closest<HTMLElement>('[data-cycle]');
    const deckBtn = target.closest<HTMLElement>('[data-deck]');
    if (target.closest('[data-back]')) {
      root.onclick = null;
      root.oninput = null;
      onBack();
    } else if (countBtn) {
      count = Number(countBtn.dataset.count);
      render();
    } else if (deckBtn) {
      const seat = seats[Number(deckBtn.dataset.deck)];
      const options = usable(seat.character);
      seat.deck = options[(options.indexOf(seat.deck) + 1) % options.length] ?? seat.deck;
      render();
    } else if (cycle) {
      const seat = seats[Number(cycle.dataset.cycle)];
      seat.character = CHARACTER_IDS[(CHARACTER_IDS.indexOf(seat.character) + 1) % CHARACTER_IDS.length];
      render();
    } else if (target.closest('.start')) {
      root.onclick = null;
      root.oninput = null;
      onStart(
        seats.slice(0, count).map((seat, i) => ({
          name: seat.name.trim() || `플레이어 ${i + 1}`,
          color: PLAYER_COLORS[i],
          character: seat.character,
          potential: seat.potential && !!CHARACTERS[seat.character].potential,
          deck: decks[seat.deck].cards,
        })),
      );
    }
  };
  root.oninput = (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.name !== undefined) seats[Number(input.dataset.name)].name = input.value;
    if (input.dataset.potential !== undefined) seats[Number(input.dataset.potential)].potential = input.checked;
  };

  render();
}

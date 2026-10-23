import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import type { PlayerSetup } from '../engine/game';
import type { BossDef, CharacterId } from '../engine/types';
import { DIFFICULTIES, type DifficultyId } from '../data/difficulty';
import { loadAccount } from '../meta/account';
import { bossFace } from './bossHud';
import { CHARACTER_ART, LOBBY_ART, UI_ART } from './assets';
import { validateDeck } from '../engine/cards';
import { loadDecks } from './deckStore';
import { esc, PLAYER_COLORS } from './html';

interface Seat {
  name: string;
  character: CharacterId;
  potential: boolean;
  cpu: boolean;
  /** 덱 프리셋 번호 */
  deck: number;
}

export function renderSetup(
  root: HTMLElement,
  boss: BossDef,
  difficulty: DifficultyId,
  onStart: (players: PlayerSetup[]) => void,
  onBack: () => void,
) {
  let count = 4;
  const decks = loadDecks();
  const acc = loadAccount();
  /** 가진 학생만 고를 수 있다 */
  const owned = CHARACTER_IDS.filter((id) => acc.students[id].owned);
  /** 이 캐릭터가 들고 갈 수 있는 슬롯 (규칙에 맞는 덱만) */
  const usable = (character: CharacterId) =>
    decks
      .map((_, i) => i)
      .filter((i) => validateDeck(decks[i].cards, CHARACTERS[character].deckPoints).length === 0);
  const seats: Seat[] = PLAYER_COLORS.map((_, i) => ({
    name: `플레이어 ${i + 1}`,
    character: owned[0],
    potential: false,
    cpu: false,
    deck: usable(owned[0])[0] ?? 0,
  }));

  const seatRow = (seat: Seat, i: number) => {
    const c = CHARACTERS[seat.character];
    const art = CHARACTER_ART[seat.character];
    // 캐릭터가 하나뿐이면 고르는 버튼 대신 이름만 보인다
    const pick =
      owned.length > 1
        ? `<button class="seat-char" data-cycle="${i}" title="캐릭터 바꾸기"><img src="${art.portrait}" alt=""><b>${c.name}</b> ▾</button>`
        : `<span class="seat-char"><img src="${art.portrait}" alt=""><b>${c.name}</b></span>`;
    return `
      <li style="--c:${PLAYER_COLORS[i]}">
        <span class="dot"></span>
        <input data-name="${i}" maxlength="10" value="${esc(seat.name)}" />
        ${pick}
        <button class="seat-deck" data-deck="${i}" title="덱 바꾸기">${esc(decks[seat.deck].name)}</button>
        <button class="seat-cpu ${seat.cpu ? 'on' : ''}" data-cpu="${i}" title="CPU">CPU</button>
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
        <button class="setup-boss" data-back title="보스 바꾸기">
          <span class="bt-face">${bossFace(boss)}</span>
          <span class="bt-text"><small>${esc(boss.title ?? 'BOSS')}</small><b>${esc(boss.name)}</b></span>
          <span class="rs-level" style="--lv:${DIFFICULTIES[difficulty].color}">${DIFFICULTIES[difficulty].name}</span>
          <em>변경</em>
        </button>
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
    const cpuBtn = target.closest<HTMLElement>('[data-cpu]');
    if (target.closest('[data-back]')) {
      root.onclick = null;
      root.oninput = null;
      onBack();
    } else if (countBtn) {
      count = Number(countBtn.dataset.count);
      render();
    } else if (cpuBtn) {
      const seat = seats[Number(cpuBtn.dataset.cpu)];
      seat.cpu = !seat.cpu;
      render();
    } else if (deckBtn) {
      const seat = seats[Number(deckBtn.dataset.deck)];
      const options = usable(seat.character);
      seat.deck = options[(options.indexOf(seat.deck) + 1) % options.length] ?? seat.deck;
      render();
    } else if (cycle) {
      const seat = seats[Number(cycle.dataset.cycle)];
      seat.character = owned[(owned.indexOf(seat.character) + 1) % owned.length];
      if (!usable(seat.character).includes(seat.deck)) seat.deck = usable(seat.character)[0] ?? seat.deck;
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
          cpu: seat.cpu,
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

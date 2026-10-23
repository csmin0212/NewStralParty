import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import type { PlayerSetup } from '../engine/game';
import type { CharacterId } from '../engine/types';
import { CHARACTER_ART, UI_ART } from './assets';
import { esc, PLAYER_COLORS } from './html';

interface Seat {
  name: string;
  character: CharacterId;
  potential: boolean;
}

export function renderSetup(root: HTMLElement, onStart: (players: PlayerSetup[]) => void) {
  let count = 4;
  const seats: Seat[] = PLAYER_COLORS.map((_, i) => ({
    name: `플레이어 ${i + 1}`,
    character: CHARACTER_IDS[0],
    potential: false,
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
        <label class="seat-potential" title="${esc(c.potential.description)}">
          <input type="checkbox" data-potential="${i}" ${seat.potential ? 'checked' : ''} />
          <span>잠재 능력</span>
        </label>
      </li>`;
  };

  const render = () => {
    root.innerHTML = `
      <div class="setup">
        <h1><img class="game-logo" src="${UI_ART.logo}" alt="NewParty"></h1>
        <p class="subtitle">한 화면에서 돌아가며 하는 핫시트 모드</p>
        <div class="count">
          ${[2, 3, 4]
            .map((n) => `<button data-count="${n}" class="${n === count ? 'selected' : ''}">${n}명</button>`)
            .join('')}
        </div>
        <ol class="names">${seats.slice(0, count).map(seatRow).join('')}</ol>
        <button class="primary start">게임 시작</button>
      </div>`;
  };

  root.onclick = (e) => {
    const target = e.target as HTMLElement;
    const countBtn = target.closest<HTMLElement>('[data-count]');
    const cycle = target.closest<HTMLElement>('[data-cycle]');
    if (countBtn) {
      count = Number(countBtn.dataset.count);
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
          potential: seat.potential,
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

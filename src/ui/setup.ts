import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import type { PlayerSetup } from '../engine/game';
import type { BossDef, CharacterId } from '../engine/types';
import { DIFFICULTIES, type DifficultyId } from '../data/difficulty';
import { bossFace } from './bossHud';
import { LOBBY_ART, UI_ART } from './assets';
import { chosenSkin, myArt } from './skins';
import { esc, PLAYER_COLORS } from './html';
import { askConfirm } from './modal';
import { loadGame } from './saveGame';

interface Seat {
  name: string;
  character: CharacterId;
  potential: boolean;
  cpu: boolean;
}

export function renderSetup(
  root: HTMLElement,
  boss: BossDef,
  difficulty: DifficultyId,
  onStart: (players: PlayerSetup[]) => void,
  onBack: () => void,
) {
  let count = 4;
  const owned = CHARACTER_IDS;
  /** 캐릭터를 고르는 자리 (목록 창) */
  let picking: number | null = null;
  const seats: Seat[] = PLAYER_COLORS.map((_, i) => ({
    name: `플레이어 ${i + 1}`,
    // 원작: 한 판에 캐릭터당 1명
    character: owned[i % owned.length],
    potential: false,
    cpu: false,
  }));

  const seatRow = (seat: Seat, i: number) => {
    const c = CHARACTERS[seat.character];
    const art = myArt(seat.character);
    const pick = `<button class="seat-char" data-cycle="${i}" title="캐릭터 바꾸기"><img src="${art.portrait}" alt=""><b>${c.name}</b> ▾</button>`;
    return `
      <li style="--c:${PLAYER_COLORS[i]}">
        <span class="dot"></span>
        <input data-name="${i}" maxlength="10" value="${esc(seat.name)}" />
        ${pick}
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
      ${picking !== null ? charPicker(picking) : ''}
      </div>`;
  };

  /** 캐릭터 목록: 다른 자리가 고른 캐릭터는 못 고른다 */
  const charPicker = (seatIndex: number) => {
    const taken = new Set(seats.slice(0, count).filter((_, i) => i !== seatIndex).map((x) => x.character));
    const cards = owned
      .map((id) => {
        const c = CHARACTERS[id];
        const art = myArt(id);
        const on = seats[seatIndex].character === id;
        return `
          <button class="cp-card ${on ? 'on' : ''}" data-char="${id}" style="--c:${c.color}" ${taken.has(id) ? 'disabled' : ''} title="${esc(`${c.name} · 공 ${c.atk} · 방 ${c.def} · 체 ${c.hp}`)}">
            <span class="cp-face"><img src="${art.portrait}" alt="" draggable="false"></span>
            <b>${esc(c.name)}</b>
            <small>⚔${c.atk} 🛡${c.def} ♥${c.hp}</small>
          </button>`;
      })
      .join('');
    return `
      <div class="cp-overlay" data-close-pick>
        <div class="cp-panel">
          <div class="ba-band">${esc(seats[seatIndex].name)} · 캐릭터 ${owned.length}</div>
          <div class="cp-grid">${cards}</div>
        </div>
      </div>`;
  };

  root.onclick = (e) => {
    const target = e.target as HTMLElement;
    const countBtn = target.closest<HTMLElement>('[data-count]');
    const cycle = target.closest<HTMLElement>('[data-cycle]');
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
    } else if (cycle) {
      picking = Number(cycle.dataset.cycle);
      render();
    } else if (target.closest<HTMLButtonElement>('[data-char]') && picking !== null) {
      const btn = target.closest<HTMLButtonElement>('[data-char]')!;
      if (btn.disabled) return;
      seats[picking].character = btn.dataset.char as CharacterId;
      seats[picking].potential = false;
      picking = null;
      render();
    } else if (target.closest('[data-close-pick]') && !target.closest('.cp-panel')) {
      picking = null;
      render();
    } else if (target.closest('.start')) void start();
  };
  /** 새 판은 이어하기 기록을 덮어쓴다 */
  const start = async () => {
    const saved = loadGame();
    if (saved && !(await askConfirm('새 게임', `이어하기 · ${saved.state.boss.name} ROUND ${saved.state.round} 삭제`, '시작'))) return;
    root.onclick = null;
    root.oninput = null;
    onStart(
      seats.slice(0, count).map((seat, i) => ({
        name: seat.name.trim() || `플레이어 ${i + 1}`,
        color: PLAYER_COLORS[i],
        character: seat.character,
        potential: seat.potential && !!CHARACTERS[seat.character].potential,
        cpu: seat.cpu,
        skin: chosenSkin(seat.character),
      })),
    );
  };
  root.oninput = (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.name !== undefined) seats[Number(input.dataset.name)].name = input.value;
    if (input.dataset.potential !== undefined) seats[Number(input.dataset.potential)].potential = input.checked;
  };

  render();
}

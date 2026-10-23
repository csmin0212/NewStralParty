import type { PlayerSetup } from '../engine/game';
import { esc, PLAYER_COLORS } from './html';

export function renderSetup(root: HTMLElement, onStart: (players: PlayerSetup[]) => void) {
  let count = 4;
  const names = PLAYER_COLORS.map((_, i) => `플레이어 ${i + 1}`);

  const render = () => {
    root.innerHTML = `
      <div class="setup">
        <h1>NewParty</h1>
        <p class="subtitle">한 화면에서 돌아가며 하는 핫시트 모드</p>
        <div class="count">
          ${[2, 3, 4]
            .map((n) => `<button data-count="${n}" class="${n === count ? 'selected' : ''}">${n}명</button>`)
            .join('')}
        </div>
        <ol class="names">
          ${names
            .slice(0, count)
            .map(
              (name, i) => `
              <li>
                <span class="dot" style="--c:${PLAYER_COLORS[i]}"></span>
                <input data-name="${i}" maxlength="10" value="${esc(name)}" />
              </li>`,
            )
            .join('')}
        </ol>
        <button class="primary start">게임 시작</button>
      </div>`;
  };

  root.onclick = (e) => {
    const target = e.target as HTMLElement;
    const countBtn = target.closest<HTMLElement>('[data-count]');
    if (countBtn) {
      count = Number(countBtn.dataset.count);
      render();
    } else if (target.closest('.start')) {
      root.onclick = null;
      root.oninput = null;
      onStart(
        names.slice(0, count).map((name, i) => ({
          name: name.trim() || `플레이어 ${i + 1}`,
          color: PLAYER_COLORS[i],
        })),
      );
    }
  };
  root.oninput = (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.name !== undefined) names[Number(input.dataset.name)] = input.value;
  };

  render();
}

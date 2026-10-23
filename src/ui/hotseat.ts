import { DEFAULT_BOARD } from '../data/board';
import { PLACEHOLDER_BOSS } from '../data/bosses';
import { applyAction, createGame, RuleError, type PlayerSetup } from '../engine/game';
import type { Action, GameState } from '../engine/types';
import { BattleView } from './battleView';
import { BoardView } from './boardView';
import { esc } from './html';
import { renderHud, type HudHandlers } from './hud';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 핫시트: 한 화면에서 모두가 돌아가며 조작한다.
 * 상태는 여기 하나뿐이고, 행동은 전부 applyAction을 거친다 (온라인 모드에서는 이 자리에 네트워크가 들어간다).
 * 화면: 맵이 화면을 꽉 채우고, 그 위에 HUD → 배너 → 전투 화면 순으로 겹친다.
 */
export function startHotseat(root: HTMLElement, players: PlayerSetup[], onExit: () => void) {
  let state: GameState = createGame({
    board: DEFAULT_BOARD,
    boss: PLACEHOLDER_BOSS,
    players,
    seed: (Math.random() * 2 ** 32) >>> 0,
  });
  let busy = false;
  let logOpen = false;
  const cleanup = new AbortController();

  root.innerHTML = `<div class="game"><main class="board-area"></main><div class="hud"></div></div>`;
  const gameEl = root.querySelector<HTMLElement>('.game')!;
  const hud = root.querySelector<HTMLElement>('.hud')!;
  const board = new BoardView(root.querySelector<HTMLElement>('.board-area')!, state.board, state);
  const battle = new BattleView(gameEl);
  battle.onChoice = (choice) => dispatch({ ...choice, player: state.current });

  // 기믹 발동 같은 큰 알림은 화면 위쪽 배너로 하나씩 띄운다
  const banner = document.createElement('div');
  banner.className = 'banner';
  gameEl.append(banner);
  let lastNotice = 0;
  async function showNotices(s: GameState) {
    for (const n of s.notices) {
      if (n.seq <= lastNotice) continue;
      lastNotice = n.seq;
      banner.textContent = n.text;
      banner.classList.remove('show');
      void banner.offsetWidth; // 애니메이션 재시작
      banner.classList.add('show');
      await sleep(1800);
    }
  }

  // 말이 도착할 때까지는 이전 상태를 보여 준다 (결과 스포 방지)
  let shownState = state;
  const draw = (s: GameState, isBusy: boolean) => {
    shownState = s;
    renderHud(hud, s, isBusy, logOpen, handlers);
  };

  const handlers: HudHandlers = {
    dispatch,
    newGame() {
      cleanup.abort();
      onExit();
    },
    toggleLog() {
      logOpen = !logOpen;
      draw(shownState, busy);
    },
  };

  async function dispatch(action: Action) {
    if (busy) return;
    let next: GameState;
    try {
      next = applyAction(state, action);
    } catch (e) {
      if (e instanceof RuleError) {
        console.warn(e.message);
        return;
      }
      throw e;
    }

    const prev = state;
    state = next;
    busy = true;
    draw(prev, true);
    battle.renderChoices(state, true);
    if (action.type === 'ROLL') board.showDice(state.turn.dice, state.turn.extraSteps);

    // 연출 순서: 진행 중이던 전투 마무리 → 말 이동 → 기믹 알림 → 새로 만난 에너미와 전투 시작
    await battle.playPending(state);
    await board.show(state);
    await showNotices(state);
    await battle.openIfNew(state);

    busy = false;
    draw(state, false);
    battle.renderChoices(state, false);

    if (state.phase.kind === 'gameOver') {
      board.showMessage(
        state.phase.result === 'victory'
          ? `<div>🎉</div>${esc(state.boss.name)} 처치!<small>모두의 승리</small>`
          : `<div>💫</div>진행도가 다 찼다…<small>패배</small>`,
      );
    }
  }

  board.onTileClick = (tileId) => {
    if (state.phase.kind === 'choosePath' && state.phase.options.includes(tileId)) {
      dispatch({ type: 'CHOOSE_PATH', player: state.current, to: tileId });
    }
  };

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      root.querySelector<HTMLButtonElement>('[data-primary]:not(:disabled)')?.click();
    },
    { signal: cleanup.signal },
  );

  // 시작하자마자 발동한 기믹(진행도 1)도 보여 준다
  busy = true;
  draw(state, true);
  showNotices(state).then(() => {
    busy = false;
    draw(state, false);
  });
}

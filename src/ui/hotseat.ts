import { DEFAULT_BOARD } from '../data/board';
import { applyAction, createGame, RuleError, type PlayerSetup } from '../engine/game';
import type { Action, GameState } from '../engine/types';
import { BattleView } from './battleView';
import { BoardView } from './boardView';
import { esc } from './html';
import { renderPanel, type PanelHandlers } from './panel';

/**
 * 핫시트: 한 화면에서 모두가 돌아가며 조작한다.
 * 상태는 여기 하나뿐이고, 행동은 전부 applyAction을 거친다 (온라인 모드에서는 이 자리에 네트워크가 들어간다).
 */
export function startHotseat(root: HTMLElement, players: PlayerSetup[], onExit: () => void) {
  let state: GameState = createGame({
    board: DEFAULT_BOARD,
    players,
    seed: (Math.random() * 2 ** 32) >>> 0,
  });
  let busy = false;
  const cleanup = new AbortController();

  root.innerHTML = `<div class="game"><main class="board-area"></main><aside class="panel"></aside></div>`;
  const panel = root.querySelector<HTMLElement>('.panel')!;
  const boardArea = root.querySelector<HTMLElement>('.board-area')!;
  const board = new BoardView(boardArea, state.board, state);
  const battle = new BattleView(boardArea);
  battle.onChoice = (choice) => dispatch({ ...choice, player: state.current });

  const handlers: PanelHandlers = {
    dispatch,
    newGame() {
      cleanup.abort();
      onExit();
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

    // 말이 도착할 때까지는 이전 정보를 보여 준다 (결과 스포 방지)
    const prev = state;
    state = next;
    busy = true;
    renderPanel(panel, prev, true, handlers);
    battle.renderChoices(state, true);
    if (action.type === 'ROLL') board.showDice(state.turn.dice, state.turn.extraSteps);

    // 연출 순서: 진행 중이던 전투 마무리 → 말 이동 → 새로 만난 에너미와 전투 시작
    await battle.playPending(state);
    await board.show(state);
    await battle.openIfNew(state);

    busy = false;
    renderPanel(panel, state, false, handlers);
    battle.renderChoices(state, false);

    if (state.phase.kind === 'gameOver') {
      const winner = state.players[state.phase.winner];
      board.showMessage(`<div>🏆</div><b style="color:${winner.color}">${esc(winner.name)}</b> 승리!`);
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

  renderPanel(panel, state, false, handlers);
}

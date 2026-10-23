import { DEFAULT_BOARD } from '../data/board';
import { PLACEHOLDER_BOSS } from '../data/bosses';
import { applyAction, createGame, RuleError, type PlayerSetup } from '../engine/game';
import type { Action, GameState } from '../engine/types';
import { CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { CHARACTER_ART } from './assets';
import { BattleView } from './battleView';
import { cardFace } from './cardView';
import { BoardView } from './boardView';
import { FxLayer } from './fx';
import { deltaEvents, resultEvents, turnEvents, type FxEvent } from './fxEvents';
import { esc } from './html';
import { renderHud, type HudHandlers } from './hud';

/**
 * 핫시트: 한 화면에서 모두가 돌아가며 조작한다.
 * 상태는 여기 하나뿐이고, 행동은 전부 applyAction을 거친다 (온라인 모드에서는 이 자리에 네트워크가 들어간다).
 * 화면: 맵이 화면을 꽉 채우고, 그 위에 HUD → 전투 화면 → 연출(컷인 · 띠) 순으로 겹친다.
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
  let deckOpen = false;
  const cleanup = new AbortController();

  root.innerHTML = `<div class="game"><main class="board-area"></main><div class="hud"></div></div>`;
  const gameEl = root.querySelector<HTMLElement>('.game')!;
  const hud = root.querySelector<HTMLElement>('.hud')!;
  const board = new BoardView(root.querySelector<HTMLElement>('.board-area')!, state.board, state);
  const battle = new BattleView(gameEl);
  const fx = new FxLayer(gameEl);
  // 개발 중에만: 콘솔에서 window.__fx.play({ kind: 'levelup', text: 'LEVEL UP!' })로 연출을 바로 볼 수 있다
  if (import.meta.env.DEV) {
    Object.assign(window, { __fx: fx, __battle: battle, __state: () => state });
  }
  battle.onChoice = (choice) => dispatch({ ...choice, player: state.current });

  // ───────── 연출 ─────────

  /** 숫자 변화는 말 머리 위로 띄우고 기다리지 않는다. 같은 말에 여러 개면 조금씩 늦춰 겹치지 않게 */
  function floats(events: FxEvent[]) {
    const perPlayer = new Map<number, number>();
    for (const ev of events) {
      if (ev.type !== 'coins' && ev.type !== 'hp') continue;
      const n = perPlayer.get(ev.player) ?? 0;
      perPlayer.set(ev.player, n + 1);
      const sign = ev.delta > 0 ? '+' : '';
      const point = board.tokenPoint(ev.player);
      if (ev.type === 'coins') fx.float(point, `${sign}${ev.delta} 코인`, 'coin', n * 220);
      else fx.float(point, `${sign}${ev.delta} HP`, ev.delta > 0 ? 'heal' : 'hurt', n * 220);
    }
  }

  async function present(s: GameState, ev: FxEvent) {
    const p = 'player' in ev ? s.players[ev.player] : undefined;
    switch (ev.type) {
      case 'round':
        await fx.play({
          kind: 'round',
          text: `ROUND ${String(ev.round).padStart(2, '0')}`,
          sub: `진행도 ${s.progress} / ${s.boss.defeatAt}`,
        });
        break;
      case 'turn':
        fx.ping(board.tokenPoint(ev.player), p!.color);
        await fx.play({
          kind: 'turn',
          text: p!.name,
          sub: `ROUND ${String(s.round).padStart(2, '0')}`,
          color: p!.color,
          face: { label: String(ev.player + 1), image: CHARACTER_ART[p!.character].portrait },
        });
        break;
      case 'skill':
        await fx.play({
          kind: 'skill',
          text: CHARACTERS[p!.character].active.name,
          sub: 'SKILL',
          color: CHARACTER_ART[p!.character].color,
          art: CHARACTER_ART[p!.character].main,
        });
        break;
      case 'revive':
        fx.float(board.tokenPoint(ev.player), '부활!', 'heal');
        break;
      case 'levelUp':
        await fx.play({ kind: 'levelup', text: 'LEVEL UP!', sub: `${p!.name} · ${CHARACTERS[p!.character].name} ${ev.level}성` });
        break;
      case 'ko':
        await fx.play({ kind: 'ko', text: 'K.O.', sub: `${p!.name} · 진행도 +1` });
        break;
      case 'gameOver':
        await fx.play(
          ev.result === 'victory'
            ? { kind: 'victory', text: 'VICTORY', sub: `${s.boss.name} 처치` }
            : { kind: 'defeat', text: 'DEFEATED', sub: `진행도 ${s.progress} / ${s.boss.defeatAt}` },
        );
        break;
      case 'coins':
      case 'hp':
        break; // floats()에서 처리
    }
  }

  /** 기믹 알림: 보스 등장은 경고 연출, 나머지는 가로 띠. 승패 알림은 gameOver 연출이 대신한다 */
  let lastNotice = 0;
  async function showNotices(s: GameState) {
    for (const n of s.notices) {
      if (n.seq <= lastNotice) continue;
      lastNotice = n.seq;
      if (s.phase.kind === 'gameOver' && !n.text.startsWith('⚠')) continue;
      if (n.text.includes(`${s.boss.name} 등장`)) {
        await fx.play({ kind: 'warning', text: 'WARNING', sub: n.text.replace(/^⚠\s*/, '') });
      } else {
        await fx.play({ kind: 'banner', text: n.text });
      }
    }
  }

  /** 보스와 만나면 인카운터 화면 전에 BOSS BATTLE 컷인 (일반 에너미는 원작처럼 바로 FIGHT 화면) */
  async function encounterCutin(prev: GameState, s: GameState) {
    const b = s.battles.at(-1);
    if (!b || b.done || b.seq === prev.battles.at(-1)?.seq || !b.enemy.isBoss) return;
    await fx.play({ kind: 'encounter', text: 'BOSS BATTLE', sub: `${b.enemy.name} 등장`, color: '#ffb627' });
  }

  // ───────── 진행 ─────────

  // 말이 도착할 때까지는 이전 상태를 보여 준다 (결과 스포 방지)
  let shownState = state;
  const draw = (s: GameState, isBusy: boolean) => {
    shownState = s;
    renderHud(hud, s, isBusy, logOpen, deckOpen, handlers);
  };

  const handlers: HudHandlers = {
    dispatch,
    newGame() {
      cleanup.abort();
      onExit();
    },
    toggleDeck() {
      deckOpen = !deckOpen;
      draw(shownState, busy);
    },
    refresh() {
      draw(shownState, busy);
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
    if (action.type === 'USE_SKILL') await present(state, { type: 'skill', player: action.player });
    // 주사위 전 카드는 가운데에 크게 보여 준다 (전투 카드는 전투 화면에서)
    const played = state.lastCard;
    if (played && played.seq !== prev.lastCard?.seq && CARDS[played.card].type !== 'battle') {
      await fx.play({ kind: 'card', text: CARDS[played.card].name, html: cardFace(played.card) });
    }

    // 연출 순서: 진행 중이던 전투 마무리 → 말 이동 → 숫자 · 레벨업 · KO → 기믹 알림
    //          → 승패 → 라운드 · 차례 컷인 → 새로 만난 에너미와 전투 시작
    await battle.playPending(state);
    await board.show(state);
    floats(deltaEvents(prev, state));
    for (const ev of resultEvents(prev, state)) {
      if (ev.type !== 'gameOver') await present(state, ev);
    }
    await showNotices(state);
    for (const ev of resultEvents(prev, state)) {
      if (ev.type === 'gameOver') await present(state, ev);
    }
    for (const ev of turnEvents(prev, state)) await present(state, ev);
    await encounterCutin(prev, state);
    await battle.openIfNew(state);

    busy = false;
    draw(state, false);
    battle.renderChoices(state, false);

    if (state.phase.kind === 'gameOver') {
      board.showMessage(
        state.phase.result === 'victory'
          ? `<div>🎉</div>VICTORY<small>${esc(state.boss.name)} 처치</small>`
          : `<div>💫</div>DEFEATED<small>진행도 ${state.progress} / ${state.boss.defeatAt}</small>`,
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

  // 게임 시작: 시작하자마자 발동한 기믹(진행도 1) → ROUND 01 → 첫 차례
  busy = true;
  draw(state, true);
  (async () => {
    await showNotices(state);
    await present(state, { type: 'round', round: state.round });
    await present(state, { type: 'turn', player: state.current });
    busy = false;
    draw(state, false);
  })();
}

import { DEFAULT_BOARD } from '../data/board';
import { MAPS } from '../data/maps';
import { currentIntent } from '../engine/boss';
import { applyAction, createGame, currentPlayer, RuleError, type PlayerSetup } from '../engine/game';
import type { DifficultyId } from '../data/difficulty';
import type { Action, BossDef, BossTurn, EnemyKind, GameState } from '../engine/types';
import { loadAccount, saveAccount } from '../meta/account';
import { applyMatch, matchRewards } from '../meta/rules';
import { bossFace } from './bossHud';
import { showResult } from './resultView';
import { clearGame, saveGame } from './saveGame';
import { wait } from './settings';
import { cpuAction } from './cpu';
import { CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { skinArt } from './skins';
import { BattleView } from './battleView';
import { cardFace } from './cardView';
import { diceHtml } from './dice';
import { BoardView } from './boardView';
import { FxLayer } from './fx';
import { deltaEvents, resultEvents, turnEvents, type FxEvent } from './fxEvents';
import { renderHud, type HudHandlers } from './hud';

/**
 * 핫시트: 한 화면에서 모두가 돌아가며 조작한다.
 * 상태는 여기 하나뿐이고, 행동은 전부 applyAction을 거친다 (온라인 모드에서는 이 자리에 네트워크가 들어간다).
 * 화면: 맵이 화면을 꽉 채우고, 그 위에 HUD → 전투 화면 → 연출(컷인 · 띠) 순으로 겹친다.
 */
export interface HotseatOptions {
  players: PlayerSetup[];
  boss: BossDef;
  difficulty: DifficultyId;
  /** 이어하기: 저장해 둔 판 */
  resume?: GameState;
}

export function startHotseat(root: HTMLElement, opts: HotseatOptions, on: { exit: () => void; retry: () => void }) {
  const { players } = opts;
  const onExit = on.exit;
  let state: GameState =
    opts.resume ??
    createGame({
      board: (opts.boss.map && MAPS[opts.boss.map]) || DEFAULT_BOARD,
      boss: opts.boss,
      players,
      difficulty: opts.difficulty,
      seed: (Math.random() * 2 ** 32) >>> 0,
    });
  let busy = false;
  let logOpen = false;
  const cleanup = new AbortController();

  root.innerHTML = `<div class="game"><main class="board-area"></main><div class="hud"></div></div>`;
  const gameEl = root.querySelector<HTMLElement>('.game')!;
  const hud = root.querySelector<HTMLElement>('.hud')!;
  let board = new BoardView(root.querySelector<HTMLElement>('.board-area')!, state.board, state);
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
      if (ev.type !== 'coins' && ev.type !== 'hp' && ev.type !== 'cards') continue;
      const n = perPlayer.get(ev.player) ?? 0;
      perPlayer.set(ev.player, n + 1);
      const sign = ev.delta > 0 ? '+' : '';
      const point = board.tokenPoint(ev.player);
      if (ev.type === 'coins') fx.float(point, `${sign}${ev.delta} 코인`, 'coin', n * 220);
      else if (ev.type === 'cards') fx.float(point, `+${ev.delta} 카드`, 'card', n * 220);
      else fx.float(point, `${sign}${ev.delta} HP`, ev.delta > 0 ? 'heal' : 'hurt', n * 220);
    }
  }

  async function present(s: GameState, ev: FxEvent) {
    const p = 'player' in ev ? s.players[ev.player] : undefined;
    switch (ev.type) {
      case 'round': {
        const next = currentIntent(s);
        await fx.play({
          kind: 'round',
          text: `ROUND ${String(ev.round).padStart(2, '0')}`,
          sub: `진행도 ${s.progress} / ${s.boss.defeatAt}${next ? ` · 보스 다음 행동 「${next.name}」` : ''}`,
        });
        break;
      }
      case 'turn':
        fx.ping(board.tokenPoint(ev.player), p!.color);
        await fx.play({
          kind: 'turn',
          text: p!.name,
          sub: `ROUND ${String(s.round).padStart(2, '0')}`,
          color: p!.color,
          face: { label: String(ev.player + 1), image: skinArt(p!.character, p!.skin).portrait },
        });
        break;
      case 'skill':
        await fx.play({
          kind: 'skill',
          text: CHARACTERS[p!.character].active.name,
          sub: 'SKILL',
          color: skinArt(p!.character, p!.skin).color,
          art: skinArt(p!.character, p!.skin).main,
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
      case 'cards':
        break; // floats()에서 처리
    }
  }

  /** 기믹 알림: 보스 등장은 경고 연출, 나머지는 가로 띠. 승패 알림은 gameOver 연출이 대신한다 */
  // 이어하기: 이미 본 알림은 다시 띄우지 않는다
  let lastNotice = opts.resume ? Math.max(0, ...state.notices.map((n) => n.seq)) : 0;
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

  /** 보스 차례: 행동 컷인 → 에너미 이동 · 맞은 말 → 결과 한 줄 */
  let lastBossTurn = state.bossTurn?.seq ?? 0;
  async function playBossTurn(s: GameState, turn: BossTurn) {
    lastBossTurn = turn.seq;
    if (turn.move) {
      await fx.play({
        kind: 'boss',
        text: turn.move,
        sub: turn.broken ? '저지됨 · 그로기' : turn.text,
        face: { label: turn.broken ? 'BREAK' : 'BOSS SKILL' },
        html: bossFace(s.boss, s.bossState.phase),
      });
    }
    await board.playBossTurn(s, turn);
    if (turn.lines.length) fx.toast(turn.lines.join(' · '));
  }

  /** 보스와 만나면 인카운터 화면 전에 BOSS BATTLE 컷인 (일반 에너미는 원작처럼 바로 FIGHT 화면) */
  async function encounterCutin(prev: GameState, s: GameState) {
    const b = s.battles.at(-1);
    if (!b || b.done || b.seq === prev.battles.at(-1)?.seq || !b.enemy.isBoss) return;
    await fx.play({ kind: 'encounter', text: 'BOSS BATTLE', sub: `${b.enemy.name} 등장`, color: '#ffb627' });
  }

  // ───────── 진행 ─────────

  /** 도감: 처음 본 에너미 · 보스를 계정에 적는다 */
  const seen = new Set<string>();
  function noteSeen(s: GameState) {
    const fresh = s.enemies.filter((e) => !seen.has(e.isBoss ? `boss:${s.boss.id}` : e.kind));
    if (fresh.length === 0) return;
    const acc = loadAccount();
    for (const e of fresh) {
      seen.add(e.isBoss ? `boss:${s.boss.id}` : e.kind);
      if (e.isBoss) {
        if (!acc.seenBosses.includes(s.boss.id)) acc.seenBosses.push(s.boss.id);
      } else if (!acc.seenEnemies.includes(e.kind as EnemyKind)) acc.seenEnemies.push(e.kind as EnemyKind);
    }
    saveAccount(acc);
  }

  /** 끝난 판: 보상을 한 번만 넣고 결과 화면 */
  let finished = false;
  function finish(s: GameState) {
    if (finished) return;
    finished = true;
    clearGame();
    const acc = loadAccount();
    const before = Object.fromEntries(Object.entries(acc.students).map(([id, x]) => [id, x.affection]));
    const rewards = matchRewards(s, acc);
    applyMatch(acc, s, rewards);
    saveAccount(acc);
    showResult(gameEl, s, rewards, before, {
      lobby: () => {
        cleanup.abort();
        onExit();
      },
      retry: () => {
        cleanup.abort();
        on.retry();
      },
    });
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
    if (action.type === 'USE_SKILL') await present(state, { type: 'skill', player: action.player });
    // 주사위: 화면 가운데에서 굴린 뒤 말이 움직인다
    if (action.type === 'ROLL') {
      await fx.play({
        kind: 'dice',
        text: '',
        html: diceHtml(state.turn.dice, state.turn.extraSteps, state.turn.fixedMove !== null),
      });
    }
    // 주사위 전 카드는 가운데에 크게 보여 준다 (전투 카드는 전투 화면에서)
    const played = state.lastCard;
    if (played && played.seq !== prev.lastCard?.seq && CARDS[played.card].type !== 'battle') {
      await fx.play({ kind: 'card', text: CARDS[played.card].name, html: cardFace(played.card) });
    }

    // 연출 순서: 진행 중이던 전투 마무리 → 말 이동 → 숫자 · 레벨업 · KO → 기믹 알림
    //          → 승패 → 라운드 · 차례 컷인 → 새로 만난 에너미와 전투 시작
    await battle.playPending(state);
    if (state.bossTurn && state.bossTurn.seq > lastBossTurn) await playBossTurn(state, state.bossTurn);
    if (!board.isFor(state.board)) {
      // 원작 매직 아카데미: 젤리 전사를 쓰러뜨리면 둘째 맵으로
      const area = root.querySelector<HTMLElement>('.board-area')!;
      area.innerHTML = '';
      const onTile = board.onTileClick;
      board = new BoardView(area, state.board, state);
      board.onTileClick = onTile;
    }
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
    noteSeen(state);
    if (state.phase.kind !== 'gameOver') saveGame(state, players);
    if (cpuTurn()) return;

    // 원작처럼 이동이 끝나고 할 일이 없으면 턴을 알아서 넘긴다
    if (state.phase.kind === 'endTurn' && !currentPlayer(state).relicOffer) {
      await wait(700);
      if (state.phase.kind === 'endTurn' && !busy) dispatch({ type: 'END_TURN', player: state.current });
    }

    if (state.phase.kind === 'gameOver') finish(state);
  }

  /** CPU 차례면 화면을 잠그고 잠깐 뒤 대신 고른다 */
  function cpuTurn(): boolean {
    const p = currentPlayer(state);
    if (!p.cpu || state.phase.kind === 'gameOver' || cleanup.signal.aborted) return false;
    draw(state, true);
    battle.renderChoices(state, true);
    void wait(650).then(() => {
      if (busy || cleanup.signal.aborted || state.phase.kind === 'gameOver') return;
      dispatch(cpuAction(state));
    });
    return true;
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
    noteSeen(state);
    saveGame(state, players);
    cpuTurn();
  })();
}

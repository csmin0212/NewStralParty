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
import { boardPick, pickBoardTile, renderHud, type HudHandlers } from './hud';
import { ambienceOf, bossTrack, mapTrack, playAmbience, playBgm } from './bgm';
import { announce, growl, preloadVoices, say } from './voice';
import { sfx, type SfxId } from './sound';
import { openEnemyInfo, openPlayerInfo } from './playerInfo';

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

  // ───────── 소리 ─────────

  /** 맵 곡 → 보스가 깨어나면 보스 곡 */
  function syncBgm(s: GameState) {
    if (s.phase.kind === 'gameOver') return;
    const boss = s.enemies.some((e) => e.isBoss) && (!s.ap || s.ap.awake);
    playBgm(boss ? bossTrack(s.board.id) : mapTrack(s.board.id));
    playAmbience(ambienceOf(s.board.id));
  }
  syncBgm(state);
  preloadVoices(state.players.map((p) => p.character));
  board.onHit = (id) => say(state.players[id].character, 'hurt', id);

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
      else {
        fx.float(point, `${sign}${ev.delta} HP`, ev.delta > 0 ? 'heal' : 'hurt', n * 220);
        if (ev.delta > 0) say(state.players[ev.player].character, 'healed', ev.player);
      }
    }
  }

  async function present(s: GameState, ev: FxEvent) {
    const p = 'player' in ev ? s.players[ev.player] : undefined;
    switch (ev.type) {
      case 'round': {
        const next = currentIntent(s);
        if (s.boss.defeatAt - s.progress <= 3) announce('hurry_up');
        else announce('round', ev.round);
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
        say(p!.character, 'skill', p!.id);
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
        announce('level_up');
        await fx.play({ kind: 'levelup', text: 'LEVEL UP!', sub: `${p!.name} · ${CHARACTERS[p!.character].name} ${ev.level}성` });
        break;
      case 'ko':
        await fx.play({ kind: 'ko', text: 'K.O.', sub: `${p!.name} · 진행도 +1` });
        break;
      case 'gameOver':
        playBgm(null);
        playAmbience(null);
        announce(ev.result === 'victory' ? 'mission_completed' : 'mission_failed');
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
        announce('war_look_out');
        growl({ kind: 'boss', isBoss: true }, 'attack');
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
    announce('fight');
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
    playBgm('result');
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
    board.setPickable(isBusy ? null : (boardPick(s)?.tiles ?? null));
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
    const sound = ACTION_SOUND[action.type];
    if (sound) sfx(sound);
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
      const { onTileClick, onTokenClick, onEnemyClick, onHit } = board;
      board = new BoardView(area, state.board, state);
      Object.assign(board, { onTileClick, onTokenClick, onEnemyClick, onHit });
    }
    await board.show(state);
    syncBgm(state);
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
    if (!busy && pickBoardTile(state, tileId, handlers)) return;
    if (state.phase.kind === 'choosePath' && state.phase.options.includes(tileId)) {
      dispatch({ type: 'CHOOSE_PATH', player: state.current, to: tileId });
    }
  };
  // 말을 누르면 그 캐릭터 정보 (갈림길에서 고를 칸 위의 말이면 그 칸으로)
  board.onTokenClick = (player) => {
    const tile = state.players[player].tile;
    if ((state.phase.kind === 'choosePath' && state.phase.options.includes(tile)) || boardPick(state)?.tiles.includes(tile)) board.onTileClick(tile);
    else openPlayerInfo(state, player);
  };
  board.onEnemyClick = (id) => {
    const e = state.enemies.find((x) => x.id === id);
    if (e) openEnemyInfo(state, e);
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
  cameraInput(root.querySelector<HTMLElement>('.board-area')!, () => board, cleanup.signal);

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

/** 고르기 · 사기 소리 (나머지 행동은 연출이 소리를 낸다) */
const ACTION_SOUND: Partial<Record<Action['type'], SfxId>> = {
  PICK_RELIC: 'relic',
  REROLL_RELIC: 'shuffle',
  BUY_CARD: 'buy',
  BUY_RELIC: 'buy',
  SEND_COINS: 'chips',
  CHOOSE_PATH: 'click',
  STOP_HERE: 'click',
  PICK_EVENT: 'click',
  MAP_CHOICE: 'click',
};

/** 맵 시점: 휠 · +/- 확대, 끌기 · WASD · 화살표 이동, F 지금 차례, R 전체 */
function cameraInput(area: HTMLElement, board: () => BoardView, signal: AbortSignal) {
  const on = { signal };
  area.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      board().zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    },
    { signal, passive: false },
  );

  // 끌기: 6px 넘게 움직이면 시점 이동, 그때는 놓을 때의 클릭을 먹는다
  let drag: { x: number; y: number; moved: boolean } | null = null;
  area.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      if ((e.target as HTMLElement).closest('.cam-ctl')) return;
      drag = { x: e.clientX, y: e.clientY, moved: false };
    },
    on,
  );
  window.addEventListener(
    'pointermove',
    (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
      area.classList.add('panning');
      board().panBy(dx, dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
    },
    on,
  );
  const eat = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener(
    'pointerup',
    () => {
      if (drag?.moved) {
        area.addEventListener('click', eat, { capture: true, once: true });
        setTimeout(() => area.removeEventListener('click', eat, { capture: true }), 0);
      }
      drag = null;
      area.classList.remove('panning');
    },
    on,
  );

  // 키보드: 누르고 있는 동안 계속 움직인다
  const DIRS: Record<string, [number, number]> = {
    KeyW: [0, 1],
    ArrowUp: [0, 1],
    KeyS: [0, -1],
    ArrowDown: [0, -1],
    KeyA: [1, 0],
    ArrowLeft: [1, 0],
    KeyD: [-1, 0],
    ArrowRight: [-1, 0],
  };
  const held = new Set<string>();
  let frame = 0;
  let last = 0;
  const tick = (now: number) => {
    const dt = Math.min(50, now - last);
    last = now;
    let x = 0;
    let y = 0;
    for (const k of held) {
      x += DIRS[k][0];
      y += DIRS[k][1];
    }
    if (x || y) board().panBy(x * dt * 0.7, y * dt * 0.7);
    frame = held.size ? requestAnimationFrame(tick) : 0;
  };
  const typing = (e: KeyboardEvent) =>
    e.ctrlKey || e.metaKey || e.altKey || (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]') !== null);
  document.addEventListener(
    'keydown',
    (e) => {
      if (typing(e) || document.querySelector('.ba-modal')) return;
      if (DIRS[e.code]) {
        e.preventDefault();
        if (!held.has(e.code)) board().panBy(DIRS[e.code][0] * 24, DIRS[e.code][1] * 24);
        held.add(e.code);
        if (!frame) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }
      } else if (e.code === 'Equal' || e.code === 'NumpadAdd') board().zoomAt(1.25);
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') board().zoomAt(0.8);
      else if (e.code === 'KeyR' && !e.repeat) board().resetCamera();
      else if (e.code === 'KeyF' && !e.repeat) area.querySelector<HTMLElement>('[data-cam="me"]')?.click();
    },
    on,
  );
  document.addEventListener('keyup', (e) => held.delete(e.code), on);
  window.addEventListener('blur', () => held.clear(), on);
}

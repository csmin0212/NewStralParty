// 순수 규칙 로직. UI · 네트워크 코드에 의존하지 않는다.
// applyAction(state, action) → 새 state. 입력 state는 건드리지 않는다.

import { CARD_IDS } from '../data/cards';
import { resolveAttack } from './combat';
import { createRng, type Rng } from './rng';
import { RULES } from './rules';
import type { Action, Board, CardId, GameState, Player, TurnInfo } from './types';

export class RuleError extends Error {}

export interface PlayerSetup {
  name: string;
  color: string;
}

export interface GameOptions {
  board: Board;
  players: PlayerSetup[];
  seed: number;
}

export function createGame({ board, players, seed }: GameOptions): GameState {
  if (players.length < 1 || players.length > 4) {
    throw new RuleError('플레이어는 1~4명이어야 합니다');
  }
  const problems = validateBoard(board);
  if (problems.length > 0) {
    throw new RuleError(`잘못된 보드: ${problems.join(', ')}`);
  }

  const { hp, atk, def, eva } = RULES.baseStats;
  const state: GameState = {
    board,
    players: players.map((p, id) => ({
      id,
      name: p.name,
      color: p.color,
      tile: board.baseTile,
      coins: RULES.startCoins,
      level: 1,
      hp,
      maxHp: hp,
      atk,
      def,
      eva,
      hand: [],
      ko: false,
    })),
    current: 0,
    round: 1,
    phase: { kind: 'preRoll' },
    turn: freshTurn(),
    lastMove: null,
    log: [],
    rngState: seed >>> 0,
    seq: 0,
  };
  log(state, '── 1라운드 ──');
  beginTurn(state);
  return state;
}

export function applyAction(state: GameState, action: Action): GameState {
  if (state.phase.kind === 'gameOver') {
    throw new RuleError('게임이 이미 끝났습니다');
  }
  if (action.player !== state.current) {
    throw new RuleError('지금은 이 플레이어의 차례가 아닙니다');
  }

  const s = structuredClone(state);
  const rng = createRng(s.rngState);

  switch (action.type) {
    case 'PLAY_CARD':
      playCard(s, action.handIndex);
      break;
    case 'ROLL':
      roll(s, rng);
      break;
    case 'CHOOSE_PATH':
      choosePath(s, rng, action.to);
      break;
    case 'END_TURN':
      endTurn(s);
      break;
  }

  s.rngState = rng.state;
  return s;
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.current];
}

/** 보드 데이터 오류 목록. 비어 있으면 정상 */
export function validateBoard(board: Board): string[] {
  const problems: string[] = [];
  const exists = (id: number | undefined) => id !== undefined && board.tiles[id] !== undefined;

  board.tiles.forEach((tile, index) => {
    if (tile.id !== index) problems.push(`${index}번 칸의 id가 ${tile.id}`);
    if (tile.next.length === 0) problems.push(`${tile.id}번 칸에 다음 칸이 없음`);
    for (const n of tile.next) {
      if (!exists(n)) problems.push(`${tile.id}번 칸의 다음 칸 ${n}이 없음`);
    }
    if (tile.kind === 'warp' && !exists(tile.warpTo)) {
      problems.push(`${tile.id}번 워프의 도착 칸이 없음`);
    }
  });
  if (!exists(board.baseTile)) problems.push('본부 칸이 없음');
  else if (board.tiles[board.baseTile].kind !== 'base') problems.push('본부 칸의 종류가 base가 아님');
  return problems;
}

// ───────────────────────── 행동 ─────────────────────────

function playCard(s: GameState, handIndex: number) {
  if (s.phase.kind !== 'preRoll') throw new RuleError('주사위를 굴리기 전에만 카드를 쓸 수 있습니다');
  if (s.turn.cardPlayed) throw new RuleError('카드는 턴마다 1장만 쓸 수 있습니다');
  const p = currentPlayer(s);
  const card = p.hand[handIndex];
  if (card === undefined) throw new RuleError('그런 카드가 없습니다');

  p.hand.splice(handIndex, 1);
  s.turn.cardPlayed = true;

  switch (card) {
    case 'dash':
      s.turn.extraSteps += RULES.dashSteps;
      log(s, `${p.name}: 질주 카드! 이동 +${RULES.dashSteps}`);
      break;
    case 'doubleDice':
      s.turn.diceCount = 2;
      log(s, `${p.name}: 더블 주사위 카드!`);
      break;
    case 'bandage': {
      const healed = heal(p, RULES.bandageHeal);
      log(s, `${p.name}: 붕대 카드! HP +${healed}`);
      break;
    }
  }
}

function roll(s: GameState, rng: Rng) {
  if (s.phase.kind !== 'preRoll') throw new RuleError('지금은 주사위를 굴릴 수 없습니다');
  const p = currentPlayer(s);
  const dice = Array.from({ length: s.turn.diceCount }, () => rng.d6());
  const steps = dice.reduce((a, b) => a + b, 0) + s.turn.extraSteps;
  s.turn.dice = dice;

  const bonus = s.turn.extraSteps > 0 ? ` + ${s.turn.extraSteps}` : '';
  log(s, `${p.name}: 🎲 ${dice.join(' + ')}${bonus} → ${steps}칸 이동`);
  move(s, rng, steps, [p.tile]);
}

function choosePath(s: GameState, rng: Rng, to: number) {
  if (s.phase.kind !== 'choosePath') throw new RuleError('지금은 길을 고를 수 없습니다');
  if (!s.phase.options.includes(to)) throw new RuleError('갈 수 없는 방향입니다');
  const p = currentPlayer(s);
  const path = [p.tile];
  const stepsLeft = s.phase.stepsLeft;

  s.phase = { kind: 'preRoll' }; // move()가 다시 정한다
  stepTo(s, to);
  path.push(to);
  move(s, rng, stepsLeft - 1, path);
}

function endTurn(s: GameState) {
  if (s.phase.kind !== 'endTurn') throw new RuleError('아직 턴을 끝낼 수 없습니다');
  s.current = (s.current + 1) % s.players.length;
  if (s.current === 0) {
    s.round += 1;
    log(s, `── ${s.round}라운드 ──`);
  }
  beginTurn(s);
}

// ───────────────────────── 진행 ─────────────────────────

function freshTurn(): TurnInfo {
  return { cardPlayed: false, diceCount: 1, extraSteps: 0, dice: [] };
}

function beginTurn(s: GameState) {
  const p = currentPlayer(s);
  s.turn = freshTurn();
  s.phase = { kind: 'preRoll' };
  log(s, `${p.name}의 차례`);

  if (p.ko) {
    p.ko = false;
    p.hp = p.maxHp;
    log(s, `${p.name}: 본부에서 부활! (HP ${p.hp})`);
  }
  p.coins += RULES.turnIncome;
}

/** steps칸 이동. 갈림길에서 멈추면 choosePath 단계로 넘어간다 */
function move(s: GameState, rng: Rng, steps: number, path: number[]) {
  const p = currentPlayer(s);
  let left = steps;

  while (left > 0 && s.phase.kind !== 'gameOver') {
    const tile = s.board.tiles[p.tile];
    if (tile.next.length > 1) {
      s.phase = { kind: 'choosePath', stepsLeft: left, options: [...tile.next] };
      recordMove(s, path);
      return;
    }
    stepTo(s, tile.next[0]);
    path.push(p.tile);
    left -= 1;
  }

  // 이동 도중 레벨 3을 달성하면 그 자리에서 게임 끝
  if (s.phase.kind !== 'gameOver') {
    land(s, rng, path);
    s.phase = { kind: 'endTurn' };
  }
  recordMove(s, path);
}

/** 한 칸 이동. 본부는 지나가기만 해도 레벨업 판정 */
function stepTo(s: GameState, tileId: number) {
  const p = currentPlayer(s);
  p.tile = tileId;
  if (tileId === s.board.baseTile) tryLevelUp(s, p);
}

function tryLevelUp(s: GameState, p: Player) {
  const cost = RULES.levelUpCost[p.level];
  if (cost === undefined) return;
  if (p.coins < cost) {
    log(s, `${p.name}: 본부 도착 — 레벨업까지 코인 ${cost - p.coins} 부족`);
    return;
  }
  p.coins -= cost;
  p.level += 1;
  log(s, `${p.name}: ⭐ 코인 ${cost}개로 레벨 ${p.level} 달성!`);
  if (p.level >= RULES.winLevel) {
    s.phase = { kind: 'gameOver', winner: p.id };
    log(s, `🏆 ${p.name} 승리!`);
  }
}

/** 도착한 칸의 효과. 워프하면 path에 도착 칸을 덧붙인다 */
function land(s: GameState, rng: Rng, path: number[]) {
  const p = currentPlayer(s);
  const tile = s.board.tiles[p.tile];

  switch (tile.kind) {
    case 'empty':
    case 'base':
      break;
    case 'coinPlus':
      p.coins += RULES.coinPlus;
      log(s, `${p.name}: 🪙 코인 +${RULES.coinPlus}`);
      break;
    case 'coinMinus': {
      const lost = Math.min(p.coins, RULES.coinMinus);
      p.coins -= lost;
      log(s, `${p.name}: 💸 코인 -${lost}`);
      break;
    }
    case 'card':
      drawCard(s, p, rng.pick(CARD_IDS));
      break;
    case 'monster':
      fightMonster(s, p, rng);
      break;
    case 'heal': {
      const healed = heal(p, RULES.heal);
      log(s, `${p.name}: ❤️ HP +${healed}`);
      break;
    }
    case 'warp': {
      const dest = tile.warpTo!;
      p.tile = dest;
      path.push(dest);
      log(s, `${p.name}: 🌀 워프! ${dest}번 칸으로`);
      break;
    }
  }
}

function drawCard(s: GameState, p: Player, card: CardId) {
  if (p.hand.length >= RULES.handLimit) {
    log(s, `${p.name}: 🃏 카드를 뽑았지만 손패가 가득 차서 버렸다`);
    return;
  }
  p.hand.push(card);
  log(s, `${p.name}: 🃏 카드 1장 획득`);
}

/** 몬스터와 한 번씩 주고받는다. 3단계(전투) 전까지는 플레이어 방어를 자동으로 '방어'로 처리 */
function fightMonster(s: GameState, p: Player, rng: Rng) {
  const m = RULES.monster;
  log(s, `${p.name}: 👾 ${m.name} 등장! (HP ${m.hp})`);

  const hit = resolveAttack(p, m, 'block', rng);
  log(s, `  공격 ${hit.attackValue} vs 방어 ${hit.defenseValue} → ${hit.damage} 피해`);
  if (hit.damage >= m.hp) {
    p.coins += m.reward;
    log(s, `  ${m.name} 처치! 코인 +${m.reward}`);
    return;
  }

  const back = resolveAttack(m, p, 'block', rng);
  log(s, `  ${m.name}의 반격 ${back.attackValue} vs 방어 ${back.defenseValue} → ${back.damage} 피해`);
  damage(s, p, back.damage);
}

function damage(s: GameState, p: Player, amount: number) {
  p.hp = Math.max(0, p.hp - amount);
  if (p.hp > 0) return;

  const lost = Math.floor(p.coins / 2);
  p.coins -= lost;
  p.ko = true;
  p.tile = s.board.baseTile;
  log(s, `${p.name}: 💀 KO! 코인 ${lost}개를 잃고 본부로 돌아간다`);
}

function heal(p: Player, amount: number): number {
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  return p.hp - before;
}

function recordMove(s: GameState, path: number[]) {
  if (path.length < 2) return;
  s.seq += 1;
  s.lastMove = { seq: s.seq, player: s.current, path };
}

function log(s: GameState, text: string) {
  s.log.push(text);
  if (s.log.length > RULES.logLimit) s.log.splice(0, s.log.length - RULES.logLimit);
}

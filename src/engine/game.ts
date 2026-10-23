// 순수 규칙 로직. UI · 네트워크 코드에 의존하지 않는다.
// applyAction(state, action) → 새 state. 입력 state는 건드리지 않는다.

import { CARD_IDS } from '../data/cards';
import { ENEMIES } from '../data/enemies';
import { resolveAttack } from './combat';
import { createRng, type Rng } from './rng';
import { RULES } from './rules';
import type {
  Action,
  Battle,
  Board,
  CardId,
  DefenseMode,
  Enemy,
  GameState,
  Player,
  TurnInfo,
} from './types';

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
    enemies: [],
    nextEnemyId: 0,
    current: 0,
    round: 1,
    phase: { kind: 'preRoll' },
    turn: freshTurn(),
    lastMove: null,
    battles: [],
    log: [],
    rngState: seed >>> 0,
    seq: 0,
  };
  log(state, '── 1라운드 ──');
  respawnEnemies(state);
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
    case 'ENCOUNTER':
      encounter(s, rng, action.choice);
      break;
    case 'DEFEND':
      defend(s, rng, action.mode);
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

  const spawnTiles = board.enemySpawns.map((sp) => sp.tile);
  for (const tile of spawnTiles) {
    if (!exists(tile)) problems.push(`에너미 스폰 칸 ${tile}이 없음`);
  }
  if (new Set(spawnTiles).size !== spawnTiles.length) problems.push('에너미 스폰 칸이 겹침');
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
  const path = [currentPlayer(s).tile];
  const left = s.phase.stepsLeft - 1;

  s.phase = { kind: 'preRoll' }; // enter() / move()가 다시 정한다
  if (enter(s, to, path, left)) {
    recordMove(s, path);
    return;
  }
  move(s, rng, left, path);
}

/** 인카운터: 공격하거나 놓아준다 */
function encounter(s: GameState, rng: Rng, choice: 'attack' | 'release') {
  if (s.phase.kind !== 'encounter') throw new RuleError('지금은 인카운터 중이 아닙니다');
  const { stepsLeft } = s.phase;
  const enemy = findEnemy(s, s.phase.enemy);
  const battle = currentBattle(s);
  const p = currentPlayer(s);
  const name = ENEMIES[enemy.kind].name;

  if (choice === 'release') {
    battle.events.push({ type: 'release' });
    log(s, `  ${name} 놓아주기`);
    finishBattle(s, rng, stepsLeft);
    return;
  }

  const hit = resolveAttack(p, enemy, enemy.defense, rng);
  enemy.hp = Math.max(0, enemy.hp - hit.damage);
  battle.events.push({ type: 'attack', attacker: 'player', result: hit, targetHp: enemy.hp });
  log(s, `  ${p.name}의 공격 ${hit.attackValue} vs ${defenseName(hit.mode)} ${hit.defenseValue} → ${hit.damage} 피해`);

  if (enemy.hp === 0) {
    s.enemies = s.enemies.filter((e) => e.id !== enemy.id);
    p.coins += enemy.reward;
    battle.events.push({ type: 'enemyDefeated', reward: enemy.reward });
    log(s, `  ${name} 처치! 코인 +${enemy.reward}`);
    finishBattle(s, rng, stepsLeft);
    return;
  }

  if (enemy.counter) {
    s.phase = { kind: 'defend', enemy: enemy.id, stepsLeft };
    log(s, `  ${name}의 반격이 온다!`);
    return;
  }
  finishBattle(s, rng, stepsLeft);
}

/** 반격을 방어 또는 회피로 받는다 */
function defend(s: GameState, rng: Rng, mode: DefenseMode) {
  if (s.phase.kind !== 'defend') throw new RuleError('지금은 반격을 받을 때가 아닙니다');
  const { stepsLeft } = s.phase;
  const enemy = findEnemy(s, s.phase.enemy);
  const battle = currentBattle(s);
  const p = currentPlayer(s);

  const hit = resolveAttack(enemy, p, mode, rng);
  battle.events.push({
    type: 'attack',
    attacker: 'enemy',
    result: hit,
    targetHp: Math.max(0, p.hp - hit.damage),
  });
  log(
    s,
    `  ${ENEMIES[enemy.kind].name}의 반격 ${hit.attackValue} vs ${defenseName(mode)} ${hit.defenseValue} → ${hit.damage} 피해`,
  );

  const coinsBefore = p.coins;
  damage(s, p, hit.damage);
  if (p.ko) {
    // KO 되면 이동도 끝
    battle.events.push({ type: 'playerKO', coinsLost: coinsBefore - p.coins });
    battle.done = true;
    s.phase = { kind: 'endTurn' };
    return;
  }
  finishBattle(s, rng, stepsLeft);
}

function endTurn(s: GameState) {
  if (s.phase.kind !== 'endTurn') throw new RuleError('아직 턴을 끝낼 수 없습니다');
  s.current = (s.current + 1) % s.players.length;
  if (s.current === 0) {
    s.round += 1;
    log(s, `── ${s.round}라운드 ──`);
    respawnEnemies(s);
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

/** steps칸 이동. 갈림길이나 에너미를 만나면 멈추고 해당 단계로 넘어간다 */
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
    left -= 1;
    if (enter(s, tile.next[0], path, left)) {
      recordMove(s, path);
      return;
    }
  }

  // 이동 도중 레벨 3을 달성하면 그 자리에서 게임 끝
  if (s.phase.kind !== 'gameOver') {
    land(s, rng, path);
    s.phase = { kind: 'endTurn' };
  }
  recordMove(s, path);
}

/** 한 칸 들어간다. 그 칸에 에너미가 있으면 인카운터를 시작하고 true */
function enter(s: GameState, tileId: number, path: number[], stepsLeft: number): boolean {
  stepTo(s, tileId);
  path.push(tileId);
  if (s.phase.kind === 'gameOver') return false;

  const enemy = s.enemies.find((e) => e.tile === tileId);
  if (!enemy) return false;
  startEncounter(s, enemy, stepsLeft);
  return true;
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
    case 'spawn':
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

// ───────────────────────── 에너미 · 전투 ─────────────────────────

/**
 * 빈 스폰 지점에 에너미를 놓는다.
 * 임시 규칙: 라운드가 바뀔 때마다 다시 채운다. 보스 기믹 시간표가 생기면 그쪽으로 옮긴다.
 */
function respawnEnemies(s: GameState) {
  for (const spawn of s.board.enemySpawns) {
    if (s.enemies.some((e) => e.tile === spawn.tile)) continue;
    const info = ENEMIES[spawn.enemy];
    s.enemies.push({
      id: s.nextEnemyId++,
      kind: spawn.enemy,
      tile: spawn.tile,
      hp: info.hp,
      maxHp: info.hp,
      atk: info.atk,
      def: info.def,
      eva: info.eva,
      counter: info.counter,
      defense: info.defense,
      reward: info.reward,
    });
    log(s, `${info.icon} ${info.name} 등장`);
  }
}

function startEncounter(s: GameState, enemy: Enemy, stepsLeft: number) {
  s.phase = { kind: 'encounter', enemy: enemy.id, stepsLeft };
  s.seq += 1;
  s.battles.push({ seq: s.seq, player: s.current, enemy: structuredClone(enemy), events: [], done: false });
  if (s.battles.length > RULES.battleHistory) s.battles.shift();
  log(s, `${currentPlayer(s).name}: ⚔ ${ENEMIES[enemy.kind].name} 인카운터!`);
}

/** 전투를 마치고 남은 칸만큼 이어서 이동 */
function finishBattle(s: GameState, rng: Rng, stepsLeft: number) {
  currentBattle(s).done = true;
  s.phase = { kind: 'preRoll' }; // move()가 다시 정한다
  move(s, rng, stepsLeft, [currentPlayer(s).tile]);
}

function findEnemy(s: GameState, id: number): Enemy {
  const enemy = s.enemies.find((e) => e.id === id);
  if (!enemy) throw new Error(`에너미 ${id}가 없음`);
  return enemy;
}

function currentBattle(s: GameState): Battle {
  return s.battles[s.battles.length - 1];
}

function defenseName(mode: DefenseMode): string {
  return mode === 'block' ? '방어' : '회피';
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

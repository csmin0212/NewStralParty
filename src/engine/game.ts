// 순수 규칙 로직. UI · 네트워크 코드에 의존하지 않는다.
// applyAction(state, action) → 새 state. 입력 state는 건드리지 않는다.

import { CARDS, DECK_CARD_IDS, DEFAULT_PRESETS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import {
  canAddToDeck,
  canEditDeck,
  cardBlocker,
  cardTargets,
  deckBudget,
  distances,
  freshBattleMods,
  freshStatus,
  shuffle,
  validateDeck,
} from './cards';
import { ENEMIES } from '../data/enemies';
import { resolveAttack } from './combat';
import { createRng, type Rng } from './rng';
import { RULES } from './rules';
import {
  activateSkill,
  enemyDefAgainst,
  evadeDice,
  giftDamageBonus,
  onEnemyDefeated,
  onEvadeSuccess,
  onGiftUsed,
  skillTargets,
} from './skills';
import type {
  Action,
  Battle,
  BossDef,
  Board,
  CardId,
  CharacterId,
  DefenseMode,
  Enemy,
  EnemyKind,
  GameState,
  GimmickAction,
  Player,
  ShopOffer,
  TurnInfo,
} from './types';

export class RuleError extends Error {}

export interface PlayerSetup {
  name: string;
  color: string;
  character: CharacterId;
  /** 잠재 능력 해방 */
  potential?: boolean;
  /** 가져가는 덱. 없으면 기본 덱 */
  deck?: CardId[];
}

export interface GameOptions {
  board: Board;
  boss: BossDef;
  players: PlayerSetup[];
  seed: number;
}

export function createGame({ board, boss, players, seed }: GameOptions): GameState {
  if (players.length < 1 || players.length > 4) {
    throw new RuleError('플레이어는 1~4명이어야 합니다');
  }
  const problems = validateBoard(board);
  if (problems.length > 0) {
    throw new RuleError(`잘못된 보드: ${problems.join(', ')}`);
  }
  for (const p of players) {
    const deckProblems = validateDeck(p.deck ?? DEFAULT_PRESETS[0].cards, CHARACTERS[p.character].deckPoints);
    if (deckProblems.length > 0) throw new RuleError(`${p.name}의 덱: ${deckProblems.join(', ')}`);
  }

  const state: GameState = {
    board,
    boss,
    players: players.map((p, id) => {
      const c = CHARACTERS[p.character];
      return {
        id,
        name: p.name,
        color: p.color,
        character: p.character,
        potential: p.potential ?? false,
        tile: board.baseTile,
        coins: c.startCoins,
        level: 0,
        hp: c.hp,
        maxHp: c.hp,
        atk: c.atk,
        def: c.def,
        move: 0,
        status: freshStatus(),
        deck: [...(p.deck ?? DEFAULT_PRESETS[0].cards)],
        drawPile: [],
        discard: [],
        hand: [],
        skillCooldown: 0,
        skillActiveUntil: null,
        stacks: 0,
        ko: false,
        reviveRound: null,
      };
    }),
    enemies: [],
    nextEnemyId: 0,
    enemyBonus: { atk: 0, def: 0 },
    current: 0,
    round: 1,
    progress: 1,
    gimmicksDone: 0,
    phase: { kind: 'preRoll' },
    turn: freshTurn(),
    lastMove: null,
    lastCard: null,
    battles: [],
    notices: [],
    log: [],
    rngState: seed >>> 0,
    seq: 0,
  };

  const rng = createRng(state.rngState);
  for (const p of state.players) {
    p.drawPile = shuffle(p.deck, rng);
    drawCards(state, p, rng, RULES.startHand);
  }
  log(state, '── 1라운드 ──');
  runGimmicks(state, rng);
  beginTurn(state, rng);
  state.rngState = rng.state;
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
      playCard(s, rng, action.handIndex, action.target, action.value);
      break;
    case 'BUY_CARD':
      buyCard(s, action.offer);
      break;
    case 'LEAVE_SHOP':
      leaveShop(s, rng);
      break;
    case 'EDIT_DECK':
      editDeck(s, rng, action.add, action.remove);
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
    case 'USE_SKILL':
      useSkill(s, rng, action.target, action.cards);
      break;
    case 'END_TURN':
      endTurn(s, rng);
      break;
  }

  s.rngState = rng.state;
  return s;
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.current];
}

/** 아직 실행되지 않은 다음 기믹 */
export function nextGimmick(state: GameState) {
  return state.boss.timeline.find((g) => g.at > state.gimmicksDone);
}

/** 기믹 한 줄 설명 (로그 · 화면 공용) */
export function describeGimmick(state: GameState, actions: GimmickAction[]): string {
  return actions
    .map((a) => {
      switch (a.type) {
        case 'summon':
          return `에너미 ${a.enemies.length}마리 소환`;
        case 'bossAppear':
          return `${state.boss.name} 등장`;
        case 'buffEnemies':
          return `모든 에너미 공격 +${a.atk} · 방어 +${a.def}`;
      }
    })
    .join(', ');
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

  for (const tile of board.spawnTiles) {
    if (!exists(tile)) problems.push(`에너미 소환 칸 ${tile}이 없음`);
  }
  if (!exists(board.bossTile)) problems.push('보스 칸이 없음');
  else if (board.bossTile === board.baseTile) problems.push('보스 칸이 본부와 같음');
  return problems;
}

// ───────────────────────── 행동 ─────────────────────────

function playCard(s: GameState, rng: Rng, handIndex: number, target?: number, value?: number) {
  const p = currentPlayer(s);
  const hand = p.hand[handIndex];
  if (hand === undefined) throw new RuleError('그런 카드가 없습니다');
  const blocker = cardBlocker(s, p, hand);
  if (blocker) throw new RuleError(blocker);
  const info = CARDS[hand.card];
  const targets = cardTargets(s, p, hand.card);
  if (targets && (target === undefined || !targets.includes(target))) throw new RuleError('대상을 골라야 합니다');
  if (hand.card === 'remoteDice' && !(Number.isInteger(value) && value! >= 1 && value! <= 6)) {
    throw new RuleError('1~6 중에서 골라야 합니다');
  }

  p.hand.splice(handIndex, 1);
  // 덱 카드는 (받은 카드면 준 사람의) 버린 더미로 가서 다시 돈다. 상점 · 생성 카드는 쓰면 사라진다
  const giver = hand.from !== undefined ? s.players[hand.from] : undefined;
  if (!hand.shop) (giver ?? p).discard.push(hand.card);
  if (info.cost) p.coins -= info.cost;
  if (info.type === 'battle') s.turn.battle.costUsed += info.battleCost!;
  else s.turn.cardPlayed = true;

  s.seq += 1;
  s.lastCard = { seq: s.seq, player: s.current, card: hand.card };
  log(s, `${p.name}: 🃏 「${info.name}」${info.cost ? ` (코인 ${info.cost})` : ''}`);
  cardEffect(s, rng, p, hand.card, target, value, giver);
  // 모나 패시브: 준 카드를 아군이 쓰면 팬 +1 (피해는 쓰기 전 팬으로 계산)
  if (giver && onGiftUsed(giver, p)) {
    log(s, `  ${giver.name}: 「${CHARACTERS[giver.character].passive.name}」 팬 ${giver.stacks}`);
  }
}

/** 카드 효과 (data/cards.ts의 글과 맞춘다) */
function cardEffect(s: GameState, rng: Rng, p: Player, card: CardId, target?: number, value?: number, giver?: Player) {
  const bonus = giftDamageBonus(giver);
  const strike = (e: Enemy, amount: number) => strikeEnemy(s, rng, p, e, amount, giver);
  const t = s.turn;
  const b = t.battle;
  const st = p.status;
  const ally = target !== undefined ? s.players[target] : undefined;
  const enemy = target !== undefined ? s.enemies.find((e) => e.id === target) : undefined;
  const battleEvent = (extra: { value?: number; damage?: number; targetHp?: number } = {}) =>
    currentBattle(s).events.push({ type: 'card', card, ...extra });
  const boost = (key: 'atk' | 'def', max: number) => {
    const v = rng.int(1, max);
    b[key] += v;
    battleEvent({ value: v });
    log(s, `  ${key === 'atk' ? '공격력' : '방어력'} +${v}`);
  };

  switch (card) {
    // 부스트
    case 'dash':
      t.extraSteps += 2;
      break;
    case 'doubleDice':
      t.diceCount = Math.max(t.diceCount, 2);
      break;
    case 'tripleDice':
      t.diceCount = 3;
      st.skipTurn = true;
      break;
    case 'remoteDice':
      t.fixedMove = value!;
      break;
    case 'portal': {
      const warps = s.board.tiles.filter((x) => x.kind === 'warp' && x.id !== p.tile);
      const from = p.tile;
      p.tile = rng.pick(warps).id;
      recordMove(s, [from, p.tile]);
      break;
    }
    case 'cookie':
      heal(p, 1);
      break;
    case 'cake':
      heal(p, 2);
      break;
    case 'bandage':
      heal(p, 4);
      break;
    case 'pudding':
      heal(p, p.maxHp);
      break;
    case 'poisonCure':
      p.hp -= 2;
      st.regen = { amount: 3, turns: 2 };
      break;
    case 'notes':
      drawCards(s, p, rng, 2);
      break;
    case 'extend':
      st.extend = true;
      break;
    case 'kingPower':
      p.hp -= 4;
      st.atkUp = { amount: 5, turns: 3 };
      break;
    case 'immovable':
      st.defUp = { amount: 6, turns: 2 };
      break;

    // 지원
    case 'hurry':
      ally!.status.nextMoveDice = 2;
      break;
    case 'feast': {
      const dist = distances(s.board, ally!.tile);
      for (const o of s.players) {
        if (!o.ko && (dist.get(o.tile) ?? Infinity) <= 3) heal(o, 3);
      }
      break;
    }
    case 'share':
      drawCards(s, p, rng, 1);
      drawCards(s, ally!, rng, 1);
      break;
    case 'backup': {
      const from = p.tile;
      p.tile = ally!.tile;
      recordMove(s, [from, p.tile]);
      if (p.tile === s.board.baseTile) tryLevelUp(s, p);
      break;
    }

    // 이벤트
    case 'dinner':
      for (const o of s.players) if (!o.ko) heal(o, 3);
      notice(s, '🍲 단체 급식 — 모든 아군 체력 +3');
      break;
    case 'allOut':
      for (const o of s.players) o.status.nextBattleAtk += 2;
      notice(s, '📣 총공격 — 모든 아군 다음 전투 공격력 +2');
      break;
    case 'revival':
      for (const o of s.players) {
        if (!o.ko) continue;
        o.ko = false;
        o.reviveRound = null;
        o.hp = Math.ceil(o.maxHp / 2);
        log(s, `  ${o.name} 부활! (체력 ${o.hp})`);
      }
      notice(s, '📞 긴급 호출 — 쓰러진 아군 부활');
      break;
    // bonus: 모나가 준 카드면 + 팬
    case 'slingshot':
      strike(enemy!, 2 + bonus);
      break;
    case 'laser':
      strike(enemy!, 3 + bonus);
      break;
    case 'brick':
      strike(enemy!, 5 + bonus);
      break;
    case 'railgun':
      strike(enemy!, 6 + bonus);
      break;
    case 'blast': {
      const dist = distances(s.board, enemy!.tile);
      for (const e of [...s.enemies]) {
        if ((dist.get(e.tile) ?? Infinity) <= 2 && !isOver(s)) strike(e, 4 + bonus);
      }
      break;
    }

    // 전투: 공격할 때
    case 'atkM':
      boost('atk', 3);
      break;
    case 'atkL':
      boost('atk', 6);
      break;
    case 'atkG':
      boost('atk', 10);
      break;
    case 'gawu':
      boost('atk', 20);
      break;
    case 'onFire':
      b.atk += 1;
      b.def -= 1;
      battleEvent({ value: 1 });
      break;
    case 'magnum':
      p.hp -= 1;
      b.atk += 2;
      battleEvent({ value: 2 });
      break;
    case 'shadowRaid':
      b.atk += 3;
      b.noCounter = true;
      battleEvent({ value: 3 });
      break;
    case 'charge':
      b.atk += 5;
      battleEvent({ value: 5 });
      if (p.hand.length < RULES.handLimit) p.hand.push({ card: 'fullAttack', shop: true });
      break;
    case 'fullAttack':
      b.atk += 6;
      b.atkMult = 1.5;
      battleEvent({ value: 6 });
      break;
    case 'accel':
      b.attackDice = 2;
      battleEvent();
      break;

    // 전투: 반격을 받을 때
    case 'defM':
      boost('def', 3);
      break;
    case 'defL':
      boost('def', 6);
      break;
    case 'defG':
      boost('def', 10);
      break;
    case 'rainbow':
      b.evadeDice += 1;
      battleEvent();
      break;
    case 'retreat': {
      if (s.phase.kind !== 'defend') break;
      const { stepsLeft } = s.phase;
      battleEvent();
      currentBattle(s).events.push({ type: 'escape' });
      log(s, '  반격을 받지 않고 빠져나갔다');
      finishBattle(s, rng, stepsLeft);
      break;
    }
    case 'shieldCounter': {
      if (s.phase.kind !== 'defend') break;
      const { stepsLeft } = s.phase;
      const foe = findEnemy(s, s.phase.enemy);
      const dmg = Math.max(1, foe.atk - (p.def + statusDef(p) + b.def));
      foe.hp = Math.max(0, foe.hp - dmg);
      battleEvent({ damage: dmg, targetHp: foe.hp });
      log(s, `  실드 카운터 — ${foe.name}에게 ${dmg} 피해`);
      if (foe.hp === 0 && defeatEnemy(s, p, foe, currentBattle(s))) return;
      finishBattle(s, rng, stepsLeft);
      break;
    }
  }
}

/** 전투 밖에서 에너미에게 피해 (이벤트 카드). 쓰러뜨리면 보상, 보스면 승리. giver: 모나가 준 카드면 팬레터 */
function strikeEnemy(s: GameState, rng: Rng, p: Player, enemy: Enemy, amount: number, giver?: Player) {
  enemy.hp = Math.max(0, enemy.hp - amount);
  log(s, `  ${enemy.name}에게 ${amount} 피해 (체력 ${enemy.hp})`);
  if (enemy.hp > 0) return;
  const def = enemyDefAgainst(s, p, enemy);
  s.enemies = s.enemies.filter((e) => e.id !== enemy.id);
  p.coins += enemy.reward;
  if (onEnemyDefeated(p, def)) log(s, `  ${p.name}: 「${CHARACTERS[p.character].passive.name}」 ${p.stacks}스택`);
  // 모나 팬레터: 아군이 받은 효과 카드로 처치하면 모나가 카드 1장
  if (giver?.character === 'mona' && giver.id !== p.id) {
    drawCards(s, giver, rng, 1);
    log(s, `  ${giver.name}: 「${CHARACTERS[giver.character].passive2!.name}」 카드 1장`);
  }
  if (enemy.isBoss) {
    s.phase = { kind: 'gameOver', result: 'victory' };
    log(s, `🎉 ${enemy.name} 처치! 모두의 승리!`);
    notice(s, `🎉 ${enemy.name} 처치!`);
    return;
  }
  log(s, `  ${enemy.name} 처치! 코인 +${enemy.reward}`);
}

function statusAtk(p: Player): number {
  return p.status.atkUp?.amount ?? 0;
}

function statusDef(p: Player): number {
  return p.status.defUp?.amount ?? 0;
}

/** 본부에서 덱 정비: 카드 1장 넣기 / 빼기. 넣은 카드는 뽑을 더미 아무 데나 섞여 들어간다 */
function editDeck(s: GameState, rng: Rng, add?: CardId, remove?: CardId) {
  const p = currentPlayer(s);
  if (!canEditDeck(s, p)) throw new RuleError('덱 정비는 본부에서만 할 수 있습니다');
  if (add) {
    if (!canAddToDeck(p.deck, add, deckBudget(p))) throw new RuleError('더 넣을 수 없는 카드입니다');
    p.deck.push(add);
    p.drawPile.splice(rng.int(0, p.drawPile.length), 0, add);
    log(s, `${p.name}: 덱에 「${CARDS[add].name}」 추가`);
  }
  if (remove) {
    if (p.deck.length <= RULES.deckMin) throw new RuleError(`덱은 ${RULES.deckMin}장 이상이어야 합니다`);
    const pile = p.drawPile.includes(remove) ? p.drawPile : p.discard.includes(remove) ? p.discard : null;
    if (!pile) throw new RuleError('손에 든 카드는 뺄 수 없습니다');
    pile.splice(pile.indexOf(remove), 1);
    p.deck.splice(p.deck.indexOf(remove), 1);
    log(s, `${p.name}: 덱에서 「${CARDS[remove].name}」 제거`);
  }
}

/** 상점 열기: 카드 3장 + (있으면) 내 캐릭터 전용 카드 */
function openShop(s: GameState, rng: Rng, stepsLeft: number) {
  const p = currentPlayer(s);
  // 지금 성으로 곧 쓸 수 있는 카드만 (한 단계 위까지)
  const usable = DECK_CARD_IDS.filter((id) => CARDS[id].level <= p.level + 1);
  const pool = shuffle(usable, rng).slice(0, RULES.shopOffers);
  const offers: ShopOffer[] = pool.map((card) => ({ card, price: RULES.shopPrice, sold: false }));
  const hyper = CHARACTERS[p.character].hyper;
  if (hyper) offers.push({ card: hyper.card, price: hyper.price, sold: false });
  s.phase = { kind: 'shop', stepsLeft, offers, free: stepsLeft === 0 };
  log(s, `${p.name}: 🛒 상점${stepsLeft === 0 ? ' (멈춤: 첫 구매 무료)' : ''}`);
}

/** 상점에서 산 카드는 손패로. 쓰면 사라진다 */
function buyCard(s: GameState, offerIndex: number) {
  if (s.phase.kind !== 'shop') throw new RuleError('상점이 아닙니다');
  const p = currentPlayer(s);
  const offer = s.phase.offers[offerIndex];
  if (!offer || offer.sold) throw new RuleError('살 수 없는 카드입니다');
  const price = s.phase.free ? 0 : offer.price;
  if (p.coins < price) throw new RuleError(`코인 ${price} 필요`);
  if (p.hand.length >= RULES.handLimit) throw new RuleError('손패가 가득 찼습니다');
  p.coins -= price;
  offer.sold = true;
  s.phase.free = false;
  p.hand.push({ card: offer.card, shop: true });
  log(s, `${p.name}: 「${CARDS[offer.card].name}」 구매${price ? ` (코인 ${price})` : ' (무료)'}`);
}

function leaveShop(s: GameState, rng: Rng) {
  if (s.phase.kind !== 'shop') throw new RuleError('상점이 아닙니다');
  const { stepsLeft } = s.phase;
  if (stepsLeft > 0) {
    s.phase = { kind: 'preRoll' }; // move()가 다시 정한다
    move(s, rng, stepsLeft, [currentPlayer(s).tile]);
  } else {
    s.phase = { kind: 'endTurn' };
  }
}

function roll(s: GameState, rng: Rng) {
  if (s.phase.kind !== 'preRoll') throw new RuleError('지금은 주사위를 굴릴 수 없습니다');
  const p = currentPlayer(s);
  if (p.status.nextMoveDice > 0) {
    s.turn.diceCount = Math.max(s.turn.diceCount, p.status.nextMoveDice);
    p.status.nextMoveDice = 0;
  }
  const dice =
    s.turn.fixedMove !== null ? [s.turn.fixedMove] : Array.from({ length: s.turn.diceCount }, () => rng.d6());
  s.turn.extraSteps += p.move;
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
  if (enter(s, rng, to, path, left)) {
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

  if (choice === 'release') {
    battle.events.push({ type: 'release' });
    log(s, `  ${enemy.name} 놓아주기`);
    finishBattle(s, rng, stepsLeft);
    return;
  }

  const mods = s.turn.battle;
  const atk = Math.floor((p.atk + statusAtk(p) + mods.atk) * mods.atkMult);
  const foe = { atk: enemy.atk, def: enemyDefAgainst(s, p, enemy) };
  const hit = resolveAttack({ atk, def: p.def }, foe, enemy.defense, rng, 1, { attackDice: mods.attackDice });
  enemy.hp = Math.max(0, enemy.hp - hit.damage);
  battle.events.push({ type: 'attack', attacker: 'player', result: hit, targetHp: enemy.hp });
  log(s, `  ${p.name}의 공격 ${hit.attackValue} vs ${defenseName(hit.mode)} ${hit.defenseValue} → ${hit.damage} 피해`);

  if (enemy.hp === 0) {
    if (defeatEnemy(s, p, enemy, battle)) return;
    finishBattle(s, rng, stepsLeft);
    return;
  }

  if (enemy.counter && !mods.noCounter) {
    s.phase = { kind: 'defend', enemy: enemy.id, stepsLeft };
    log(s, `  ${enemy.name}의 반격이 온다!`);
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

  const mods = s.turn.battle;
  const me = { atk: p.atk, def: p.def + statusDef(p) + mods.def };
  const dice = evadeDice(p) + mods.evadeDice;
  const hit = resolveAttack(enemy, me, mode, rng, mode === 'evade' ? dice : 1);
  battle.events.push({
    type: 'attack',
    attacker: 'enemy',
    result: hit,
    targetHp: Math.max(0, p.hp - hit.damage),
  });
  const rolls = hit.defenseRolls.length > 1 ? ` (주사위 ${hit.defenseRolls.join('·')} 중 높은 값)` : '';
  log(s, `  ${enemy.name}의 반격 ${hit.attackValue} vs ${defenseName(mode)} ${hit.defenseValue}${rolls} → ${hit.damage} 피해`);

  damage(s, rng, p, hit.damage);
  if (p.ko) {
    // KO 되면 이동도 끝. 진행도가 올라 패배했을 수도 있다
    battle.events.push({ type: 'playerKO' });
    battle.done = true;
    if (!isOver(s)) s.phase = { kind: 'endTurn' };
    return;
  }

  if (mode === 'evade' && hit.damage === 0) {
    if (evadeSucceeded(s, p, enemy, battle)) return;
  }
  finishBattle(s, rng, stepsLeft);
}

/** 회피 성공 시 캐릭터 효과 (패시브 · 잠재 능력). 그걸로 보스를 쓰러뜨려 게임이 끝나면 true */
function evadeSucceeded(s: GameState, p: Player, enemy: Enemy, battle: Battle): boolean {
  const c = CHARACTERS[p.character];
  const effects = onEvadeSuccess(p);

  if (effects.cooldownCut > 0 && p.skillCooldown > 0) {
    p.skillCooldown = Math.max(0, p.skillCooldown - effects.cooldownCut);
    battle.events.push({ type: 'skill', name: c.passive.name });
    log(s, `  ${p.name}: 「${c.passive.name}」 액티브 재사용 대기 -${effects.cooldownCut} (남은 ${p.skillCooldown})`);
  }

  if (effects.counterDamage > 0) {
    enemy.hp = Math.max(0, enemy.hp - effects.counterDamage);
    const name = c.potential?.name ?? '잠재 능력';
    battle.events.push({ type: 'skill', name, damage: effects.counterDamage, targetHp: enemy.hp });
    log(s, `  ${p.name}: 「${name}」 ${enemy.name}에게 ${effects.counterDamage} 피해`);
    if (enemy.hp === 0) return defeatEnemy(s, p, enemy, battle);
  }
  return false;
}

/** 에너미 처치: 보상을 주고 판에서 치운다. 보스면 모두의 승리로 게임이 끝나고 true */
function defeatEnemy(s: GameState, p: Player, enemy: Enemy, battle: Battle): boolean {
  const reward = enemy.reward;
  const def = enemyDefAgainst(s, p, enemy);
  s.enemies = s.enemies.filter((e) => e.id !== enemy.id);
  p.coins += reward;
  battle.events.push({ type: 'enemyDefeated', reward });
  if (onEnemyDefeated(p, def)) {
    const name = CHARACTERS[p.character].passive.name;
    battle.events.push({ type: 'skill', name });
    log(s, `  ${p.name}: 「${name}」 ${p.stacks}스택`);
  }

  if (enemy.isBoss) {
    battle.done = true;
    s.phase = { kind: 'gameOver', result: 'victory' };
    log(s, `🎉 ${enemy.name} 처치! 모두의 승리!`);
    notice(s, `🎉 ${enemy.name} 처치!`);
    return true;
  }
  log(s, `  ${enemy.name} 처치! 코인 +${reward}`);
  return false;
}

/** 액티브 스킬: 주사위를 굴리기 전에, 재사용 대기가 끝났을 때만 */
function useSkill(s: GameState, rng: Rng, target?: number, cards?: number[]) {
  if (s.phase.kind !== 'preRoll') throw new RuleError('스킬은 주사위를 굴리기 전에만 쓸 수 있습니다');
  const p = currentPlayer(s);
  if (s.turn.skillUsed) throw new RuleError('스킬은 턴마다 한 번만 쓸 수 있습니다');
  if (p.skillCooldown > 0) throw new RuleError(`재사용까지 ${p.skillCooldown}라운드 남았습니다`);
  const targets = skillTargets(s, p);
  if (targets && (target === undefined || !targets.includes(target))) throw new RuleError('사거리 안의 대상을 골라야 합니다');
  if (p.character === 'mona') {
    const picked = [...new Set(cards ?? [])];
    if (picked.length < 1 || picked.length > 2 || picked.some((i) => !p.hand[i])) throw new RuleError('줄 카드를 1~2장 골라야 합니다');
    if (s.players[target!].hand.length + picked.length > RULES.handLimit) throw new RuleError('아군 손패에 자리가 없습니다');
  }

  activateSkill(s, p);
  s.turn.skillUsed = true;
  const name = CHARACTERS[p.character].active.name;
  log(s, `${p.name}: ✨ 액티브 스킬 「${name}」!`);

  if (p.character === 'soda') {
    // 조나단 러시: 상대 칸으로 워프해 전투. 이 전투 동안 상대 방어력 -2, 전투가 끝나면 그 칸에서 차례를 마친다
    const enemy = findEnemy(s, target!);
    const from = p.tile;
    p.tile = enemy.tile;
    recordMove(s, [from, p.tile]);
    startEncounter(s, enemy, 0);
    s.turn.battle.enemyDefDown += 2;
    currentBattle(s).events.push({ type: 'skill', name });
  }

  if (p.character === 'mona') {
    // 역조공: 고른 카드를 아군에게 주고, 팬만큼 뽑는다
    const ally = s.players[target!];
    const picked = [...new Set(cards!)].sort((a, b) => b - a);
    for (const i of picked) {
      const [given] = p.hand.splice(i, 1);
      ally.hand.push({ ...given, from: given.from ?? p.id });
      log(s, `  ${ally.name}에게 「${CARDS[given.card].name}」`);
    }
    drawCards(s, p, rng, p.stacks);
  }
}

function endTurn(s: GameState, rng: Rng) {
  if (s.phase.kind !== 'endTurn') throw new RuleError('아직 턴을 끝낼 수 없습니다');
  nextPlayer(s, rng);
  beginTurn(s, rng);
}

// ───────────────────────── 진행 ─────────────────────────

function freshTurn(): TurnInfo {
  return {
    cardPlayed: false,
    skillUsed: false,
    diceCount: 1,
    extraSteps: 0,
    fixedMove: null,
    dice: [],
    battle: freshBattleMods(),
  };
}

/** 다음 플레이어로. 한 바퀴 돌면 라운드 +1, 진행도 +1, 스킬 재사용 대기 -1 */
function nextPlayer(s: GameState, rng: Rng) {
  s.current = (s.current + 1) % s.players.length;
  if (s.current !== 0) return;
  s.round += 1;
  log(s, `── ${s.round}라운드 ──`);
  // 재사용 대기는 진짜 라운드만 센다 (KO로 오르는 진행도에는 줄지 않는다)
  for (const p of s.players) p.skillCooldown = Math.max(0, p.skillCooldown - 1);
  advanceProgress(s, rng, '라운드');
  // 라운드 보상 (아스트랄 파티 코옵): 모두 코인 + 카드 1장
  if (s.round % RULES.roundRewardEvery === 0 && !isOver(s)) {
    for (const p of s.players) {
      p.coins += RULES.roundRewardCoins;
      drawCards(s, p, rng, 1);
    }
    log(s, `🎁 라운드 보상: 모두 코인 +${RULES.roundRewardCoins} · 카드 1장`);
    notice(s, `🎁 라운드 보상 — 코인 +${RULES.roundRewardCoins} · 카드 1장`);
  }
}

/** 차례 시작. 쉬어야 하는 KO 플레이어는 건너뛴다 */
function beginTurn(s: GameState, rng: Rng) {
  // 모두 누워 있어도 라운드가 흐르다 보면 부활하거나 패배하므로 끝난다
  while (s.phase.kind !== 'gameOver') {
    const p = currentPlayer(s);
    s.turn = freshTurn();
    s.phase = { kind: 'preRoll' };

    if (p.ko && s.round < p.reviveRound!) {
      log(s, `${p.name}: 💤 쓰러져서 이번 차례는 쉰다`);
      nextPlayer(s, rng);
      continue;
    }
    if (p.status.skipTurn && !p.ko) {
      p.status.skipTurn = false;
      log(s, `${p.name}: 💤 이번 차례는 쉰다`);
      nextPlayer(s, rng);
      continue;
    }

    log(s, `${p.name}의 차례`);
    // 액티브 스킬의 "1라운드 동안"은 다음 자기 차례가 시작되면 끝난다
    if (p.skillActiveUntil !== null && s.round >= p.skillActiveUntil) p.skillActiveUntil = null;
    if (p.ko) {
      p.ko = false;
      p.reviveRound = null;
      p.hp = p.maxHp;
      log(s, `${p.name}: ✨ 부활! (HP ${p.hp})`);
    }
    p.coins += RULES.turnIncome;
    tickStatus(s, p);
    return;
  }
}

/** 자기 차례 시작: 지속 효과를 한 번씩 적용하고 남은 턴을 줄인다 */
function tickStatus(s: GameState, p: Player) {
  const st = p.status;
  if (st.regen) {
    const healed = heal(p, st.regen.amount);
    if (healed) log(s, `${p.name}: 체력 +${healed}`);
    st.regen.turns -= 1;
    if (st.regen.turns <= 0) st.regen = null;
  }
  for (const key of ['atkUp', 'defUp'] as const) {
    const buff = st[key];
    if (!buff) continue;
    buff.turns -= 1;
    if (buff.turns <= 0) st[key] = null;
  }
}

/** 진행도 +1. 그 진행도의 기믹은 바로 발동하고, 한계에 닿으면 패배 */
function advanceProgress(s: GameState, rng: Rng, reason: '라운드' | 'KO') {
  if (s.phase.kind === 'gameOver') return;
  s.progress += 1;
  log(s, `⏳ 진행도 ${s.progress}${reason === 'KO' ? ' (KO)' : ''}`);
  runGimmicks(s, rng);

  if (s.progress >= s.boss.defeatAt && !isOver(s)) {
    s.phase = { kind: 'gameOver', result: 'defeat' };
    log(s, `💫 진행도가 다 찼다… 패배`);
    notice(s, '💫 진행도가 다 찼다…');
  }
}

/** 지금 진행도까지 아직 실행 안 한 기믹을 순서대로 실행 */
function runGimmicks(s: GameState, rng: Rng) {
  for (const gimmick of s.boss.timeline) {
    if (gimmick.at <= s.gimmicksDone || gimmick.at > s.progress) continue;
    for (const action of gimmick.actions) {
      switch (action.type) {
        case 'summon':
          for (const kind of action.enemies) summon(s, rng, kind);
          break;
        case 'bossAppear':
          bossAppear(s);
          break;
        case 'buffEnemies':
          s.enemyBonus.atk += action.atk;
          s.enemyBonus.def += action.def;
          for (const e of s.enemies) {
            if (e.isBoss) continue;
            e.atk += action.atk;
            e.def += action.def;
          }
          break;
      }
    }
    const text = describeGimmick(s, gimmick.actions);
    log(s, `⚠ 기믹: ${text}`);
    notice(s, `⚠ 진행도 ${gimmick.at} — ${text}`);
  }
  s.gimmicksDone = Math.max(s.gimmicksDone, s.progress);
}

/** steps칸 이동. 갈림길이나 에너미를 만나면 멈추고 해당 단계로 넘어간다 */
function move(s: GameState, rng: Rng, steps: number, path: number[]) {
  const p = currentPlayer(s);
  let left = steps;

  while (left > 0) {
    const tile = s.board.tiles[p.tile];
    if (tile.next.length > 1) {
      s.phase = { kind: 'choosePath', stepsLeft: left, options: [...tile.next] };
      recordMove(s, path);
      return;
    }
    left -= 1;
    if (enter(s, rng, tile.next[0], path, left)) {
      recordMove(s, path);
      return;
    }
  }

  land(s, rng, path);
  s.phase = { kind: 'endTurn' };
  recordMove(s, path);
}

/** 한 칸 들어간다. 그 칸에 에너미가 있으면 인카운터, 상점이면 상점을 열고 true */
function enter(s: GameState, rng: Rng, tileId: number, path: number[], stepsLeft: number): boolean {
  const p = currentPlayer(s);
  p.tile = tileId;
  path.push(tileId);
  if (tileId === s.board.baseTile) tryLevelUp(s, p);

  const enemy = s.enemies.find((e) => e.tile === tileId);
  if (enemy) {
    startEncounter(s, enemy, stepsLeft);
    return true;
  }
  if (s.board.tiles[tileId].kind === 'shop') {
    openShop(s, rng, stepsLeft);
    return true;
  }
  return false;
}

/** 본부를 지나가거나 도착하면 코인을 내고 레벨업 */
function tryLevelUp(s: GameState, p: Player) {
  const cost = RULES.levelUpCost[p.level];
  if (cost === undefined) return;
  if (p.coins < cost) {
    log(s, `${p.name}: 본부 도착 — ${p.level + 1}성까지 코인 ${cost - p.coins} 부족`);
    return;
  }
  p.coins -= cost;
  p.level += 1;

  // 캐릭터마다 별을 딸 때 오르는 능력치. 최대 HP가 오르면 지금 HP도 같이 오른다
  const growth = CHARACTERS[p.character].stars[p.level - 1] ?? {};
  const gains: string[] = [];
  if (growth.maxHp) {
    p.maxHp += growth.maxHp;
    p.hp += growth.maxHp;
    gains.push(`최대 HP +${growth.maxHp}`);
  }
  if (growth.atk) {
    p.atk += growth.atk;
    gains.push(`공격력 +${growth.atk}`);
  }
  if (growth.def) {
    p.def += growth.def;
    gains.push(`방어력 +${growth.def}`);
  }
  if (growth.move) {
    p.move += growth.move;
    gains.push(`이동거리 +${growth.move}`);
  }
  if (growth.coins) {
    p.coins += growth.coins;
    gains.push(`코인 +${growth.coins}`);
  }
  log(s, `${p.name}: ⭐ 코인 ${cost}개로 ${p.level}성 달성!${gains.length ? ` (${gains.join(', ')})` : ''}`);
}

/** 도착한 칸의 효과. 워프하면 path에 도착 칸을 덧붙인다 */
function land(s: GameState, rng: Rng, path: number[]) {
  const p = currentPlayer(s);
  const tile = s.board.tiles[p.tile];

  switch (tile.kind) {
    case 'empty':
    case 'base':
    case 'spawn':
    case 'shop':
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
      drawCards(s, p, rng, 1);
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

/** 내 덱에서 n장 뽑는다. 뽑을 더미가 비면 버린 더미를 섞어 다시 쓴다. 손패가 가득 차면 바로 버린 더미로 */
function drawCards(s: GameState, p: Player, rng: Rng, n: number) {
  for (let i = 0; i < n; i++) {
    if (p.drawPile.length === 0) {
      if (p.discard.length === 0) return;
      p.drawPile = shuffle(p.discard, rng);
      p.discard = [];
      log(s, `${p.name}: 🔀 버린 카드를 섞어 덱으로`);
    }
    const card = p.drawPile.pop()!;
    if (p.hand.length >= RULES.handLimit) {
      p.discard.push(card);
      log(s, `${p.name}: 🃏 손패가 가득 차서 「${CARDS[card].name}」 버림`);
    } else {
      p.hand.push({ card });
    }
  }
}

// ───────────────────────── 에너미 · 전투 ─────────────────────────

/** 빈 소환 칸에 에너미를 놓는다. 소환 칸이 다 차면 본부 · 보스 칸 · 워프를 뺀 빈 칸 아무 데나 */
function summon(s: GameState, rng: Rng, kind: EnemyKind) {
  const occupied = new Set(s.enemies.map((e) => e.tile));
  let candidates = s.board.spawnTiles.filter((t) => !occupied.has(t));
  if (candidates.length === 0) {
    candidates = s.board.tiles
      .filter((t) => t.kind !== 'base' && t.kind !== 'warp' && t.id !== s.board.bossTile && !occupied.has(t.id))
      .map((t) => t.id);
  }
  if (candidates.length === 0) return;

  const info = ENEMIES[kind];
  s.enemies.push({
    id: s.nextEnemyId++,
    kind,
    name: info.name,
    icon: info.icon,
    isBoss: false,
    tile: rng.pick(candidates),
    hp: info.hp,
    maxHp: info.hp,
    atk: info.atk + s.enemyBonus.atk,
    def: info.def + s.enemyBonus.def,
    counter: info.counter,
    defense: info.defense,
    reward: info.reward,
  });
}

function bossAppear(s: GameState) {
  if (s.enemies.some((e) => e.isBoss)) return;
  const b = s.boss;
  const hp = b.hpPerPlayer * s.players.length;
  // 보스 칸에 에너미가 있으면 보스에게 자리를 내준다
  s.enemies = s.enemies.filter((e) => e.tile !== s.board.bossTile);
  s.enemies.push({
    id: s.nextEnemyId++,
    kind: 'boss',
    name: b.name,
    icon: b.icon,
    isBoss: true,
    tile: s.board.bossTile,
    hp,
    maxHp: hp,
    atk: b.atk,
    def: b.def,
    counter: b.counter,
    defense: b.defense,
    reward: 0,
  });
}

function startEncounter(s: GameState, enemy: Enemy, stepsLeft: number) {
  s.phase = { kind: 'encounter', enemy: enemy.id, stepsLeft };
  s.turn.battle = freshBattleMods();
  // 총공격: 다음 전투 한 번만
  const p = currentPlayer(s);
  s.turn.battle.atk += p.status.nextBattleAtk;
  p.status.nextBattleAtk = 0;
  s.seq += 1;
  s.battles.push({ seq: s.seq, player: s.current, enemy: structuredClone(enemy), events: [], done: false });
  if (s.battles.length > RULES.battleHistory) s.battles.shift();
  log(s, `${currentPlayer(s).name}: ⚔ ${enemy.name} 인카운터!`);
}

/** 전투를 마치고 남은 칸만큼 이어서 이동 */
function finishBattle(s: GameState, rng: Rng, stepsLeft: number) {
  currentBattle(s).done = true;
  s.phase = { kind: 'preRoll' }; // move()가 다시 정한다
  move(s, rng, stepsLeft, [currentPlayer(s).tile]);
}

/** 함수 호출 뒤에도 TS가 좁혀 둔 phase 타입을 믿지 않게, 매번 새로 읽는다 */
function isOver(s: GameState): boolean {
  return s.phase.kind === 'gameOver';
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

/** 피해. HP 0이면 그 자리에 KO — 다음 라운드를 쉬고, 진행도 +1 (기믹 즉시 발동) */
function damage(s: GameState, rng: Rng, p: Player, amount: number) {
  p.hp = Math.max(0, p.hp - amount);
  if (p.hp > 0) return;

  p.ko = true;
  // 보충 수업: 쉬지 않고 다음 차례에 부활
  p.reviveRound = s.round + (p.status.extend ? 1 : RULES.reviveAfterRounds);
  p.status = freshStatus();
  log(s, `${p.name}: 💀 KO! ${p.reviveRound}라운드에 부활`);
  advanceProgress(s, rng, 'KO');
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

function notice(s: GameState, text: string) {
  s.seq += 1;
  s.notices.push({ seq: s.seq, text });
  if (s.notices.length > RULES.noticeHistory) s.notices.shift();
}

function log(s: GameState, text: string) {
  s.log.push(text);
  if (s.log.length > RULES.logLimit) s.log.splice(0, s.log.length - RULES.logLimit);
}

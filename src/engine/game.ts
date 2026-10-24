// 순수 규칙 로직. UI · 네트워크 코드에 의존하지 않는다.
// applyAction(state, action) → 새 state. 입력 state는 건드리지 않는다.

import { CARDS, DECK_CARD_IDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import {
  cardBlocker,
  cardCoinCost,
  cardTargets,
  distances,
  freshBattleMods,
  freshStatus,
  handLimit,
  randomCard,
  shuffle,
  statusAtk,
  statusDef,
  targetable,
} from './cards';
import {
  bossTurn,
  freshBossState,
  hurtEnemy,
  landOnMark,
  onBossAppear,
  onEnemyGone,
  revealIntent,
  runTimelineMove,
} from './boss';
import { DIFFICULTIES, type DifficultyId } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { EVENT_IDS, EVENTS } from '../data/events';
import { RELIC_SHOP, type RelicId } from '../data/relics';
import {
  afterChallenge,
  assignTask,
  checkTasks,
  gainRelic,
  offerRelic,
  onAttackStart,
  onAttacked,
  onBoostTile,
  onCardsGained,
  onDamage,
  onEffectCard,
  onEvaded,
  onHealAlly,
  onHitMonster,
  onMove,
  onSkillUsed,
  onSpare,
  onTransfer,
  onTurnEnd,
  onTurnStart,
  gainRes,
  hasRelic,
  onKill,
  onKO,
  relicAttack,
  relicAttackRoll,
  relicCardDamage,
  relicDefense,
  useOverclock,
  relicMoveBonus,
  relicNoCounter,
  relicShopDiscount,
  rerollRelic,
  roundRewardBonus,
} from './relics';
import { resolveAttack } from './combat';
import {
  isKit,
  kitActive,
  kitAtk,
  kitBattleCard,
  kitBattleEnd,
  kitBeforeDamage,
  kitCreate,
  kitDamaged,
  kitDef,
  kitDiscard,
  kitEnemyAtk,
  kitEvaded,
  kitEvent,
  kitFlaw,
  kitFought,
  kitGive,
  kitHealed,
  kitHit,
  kitKO,
  kitMoveBonus,
  kitMoved,
  kitNoCounter,
  kitPass,
  kitRoundEnd,
  kitShop,
  kitTrapImmune,
} from './kits';
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
  /** CPU 자리 (화면이 대신 고른다. 규칙은 같다) */
  cpu?: boolean;
  skin?: string;
}

export interface GameOptions {
  board: Board;
  boss: BossDef;
  players: PlayerSetup[];
  seed: number;
  difficulty?: DifficultyId;
}

export function createGame({ board, boss, players, seed, difficulty = 'normal' }: GameOptions): GameState {
  const level = DIFFICULTIES[difficulty];
  if (players.length < 1 || players.length > 4) {
    throw new RuleError('플레이어는 1~4명이어야 합니다');
  }
  const problems = validateBoard(board);
  if (problems.length > 0) {
    throw new RuleError(`잘못된 보드: ${problems.join(', ')}`);
  }

  const state: GameState = {
    board,
    boss,
    difficulty,
    stats: players.map(() => ({ damage: 0, bossDamage: 0, kills: 0, breaks: 0, kos: 0, damageTaken: 0, cardsUsed: 0 })),
    players: players.map((p, id) => {
      const c = CHARACTERS[p.character];
      const home = board.homeTiles?.[id] ?? board.baseTile;
      return {
        id,
        name: p.name,
        color: p.color,
        character: p.character,
        skin: p.skin,
        potential: p.potential ?? false,
        tile: home,
        home,
        coins: RULES.startCoins + (c.startBonus ?? 0),
        relics: [],
        relicOffer: null,
        relicQueue: [],
        relicVars: {},
        healStacks: 0,
        starlight: 0,
        energy: 0,
        relicBuys: 0,
        mapRes: {},
        charVars: {},
        charTiles: {},
        task: null,
        tasksDone: [],
        cpu: p.cpu ?? false,
        level: 0,
        hp: c.hp,
        maxHp: c.hp,
        atk: c.atk,
        def: c.def,
        move: 0,
        status: freshStatus(),
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
    bossState: freshBossState(boss),
    marks: [],
    nextMarkId: 0,
    bossTurn: null,
    enemyBonus: { atk: level.enemyAtk, def: level.enemyDef },
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
    kitCreate(p);
    drawCards(state, p, rng, RULES.startHand);
    assignTask(state, rng, p);
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
    case 'SEND_COINS':
      sendCoins(s, rng, action.to);
      break;
    case 'LEAVE_SHOP':
      leaveShop(s, rng);
      break;
    case 'PICK_RELIC':
      pickRelic(s, rng, action.relic);
      break;
    case 'REROLL_RELIC':
      if (!rerollRelic(s, rng, currentPlayer(s))) throw new RuleError('다시 뽑을 수 없습니다');
      break;
    case 'BUY_RELIC':
      buyRelic(s, rng);
      break;
    case 'STOP_HERE':
      stopHere(s, rng, action.stop);
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
      useSkill(s, rng, action.target, action.cards, action.value);
      break;
    case 'END_TURN':
      endTurn(s, rng);
      break;
  }

  if (s.phase.kind !== 'gameOver') checkTasks(s, rng);
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
        case 'move':
          return state.boss.moves?.[a.move]?.name ?? a.move;
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
  for (const tile of board.homeTiles ?? []) {
    if (!exists(tile)) problems.push(`거점 칸 ${tile}이 없음`);
    else if (board.tiles[tile].kind !== 'base') problems.push(`거점 칸 ${tile}의 종류가 base가 아님`);
  }
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
  s.stats[p.id].cardsUsed += 1;
  // 쓴 카드는 사라진다 (원작: 덱이 없다)
  const giver = hand.from !== undefined ? s.players[hand.from] : undefined;
  const cost = cardCoinCost(hand.card, p);
  p.coins -= cost;
  if (info.type === 'battle') {
    s.turn.battle.costUsed += info.battleCost!;
    kitBattleCard(s, p, hand.card);
  } else s.turn.cardsPlayed += 1;

  s.seq += 1;
  s.lastCard = { seq: s.seq, player: s.current, card: hand.card };
  log(s, `${p.name}: 🃏 「${info.name}」${cost ? ` (코인 ${cost})` : ''}`);
  const targetEnemy = target !== undefined && info.target === 'enemy' ? s.enemies.find((e) => e.id === target) : undefined;
  const hpBefore = targetEnemy?.hp ?? 0;
  cardEffect(s, rng, p, hand.card, target, value, giver);
  if (info.type !== 'battle' && !isOver(s)) onEffectCard(s, rng, p, hand, targetEnemy, hpBefore - (targetEnemy?.hp ?? 0));
  // 모나 패시브: 준 카드를 아군이 쓰면 팬 +1 (피해는 쓰기 전 팬으로 계산)
  if (giver && onGiftUsed(giver, p)) {
    log(s, `  ${giver.name}: 「${CHARACTERS[giver.character].passive.name}」 팬 ${giver.stacks}`);
  }
}

/** 카드 효과 (data/cards.ts의 글과 맞춘다) */
function cardEffect(s: GameState, rng: Rng, p: Player, card: CardId, target?: number, value?: number, giver?: Player) {
  // 모나가 준 카드면 + 팬, 책갈피 · 닌자 표창
  const bonus = giftDamageBonus(giver);
  const strike = (e: Enemy, amount: number) => strikeEnemy(s, rng, p, e, amount + relicCardDamage(p, e), giver);
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
        if (!o.ko && (dist.get(o.tile) ?? Infinity) <= 3 && heal(o, 3) > 0) onHealAlly(p, o);
      }
      break;
    }
    case 'share':
      drawCards(s, p, rng, 1);
      drawCards(s, ally!, rng, 1);
      kitGive(s, p, ally!, 1);
      break;
    case 'talismanFu':
      heal(ally!, 2);
      // 희몽조 → 희몽풍: 기력
      if (p.character === 'zhao' && ally!.character === 'fen') ally!.stacks = 1;
      break;
    case 'talismanHuo':
      damage(s, rng, p, 1);
      break;
    case 'livingPage':
      strike(enemy!, 2 + (p.charVars.page ?? 0) + bonus);
      break;
    case 'bite':
      b.atk += 2;
      b.noCounter = true;
      battleEvent({ value: 2 });
      break;
    case 'backup': {
      const from = p.tile;
      p.tile = ally!.tile;
      recordMove(s, [from, p.tile]);
      if (p.tile === p.home) tryLevelUp(s, rng, p);
      break;
    }

    // 이벤트
    case 'dinner':
      for (const o of s.players) if (!o.ko && heal(o, 3) > 0) onHealAlly(p, o);
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
        if (targetable(s, e) && s.enemies.includes(e) && (dist.get(e.tile) ?? Infinity) <= 2 && !isOver(s)) strike(e, 4 + bonus);
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
      if (p.hand.length < handLimit(p)) p.hand.push({ card: 'fullAttack', shop: true });
      break;
    case 'fullAttack':
      b.atk += 6;
      b.atkMult = 1.5;
      battleEvent({ value: 6 });
      break;
    case 'accel':
      b.attackDice = 2;
      b.sumDice = true;
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
      const dmg = hurtEnemy(s, rng, foe, Math.max(1, foe.atk - (p.def + statusDef(p) + relicDefense(p) + kitDef(s, p) + b.def)));
      battleEvent({ damage: dmg, targetHp: foe.hp });
      log(s, `  실드 카운터 — ${foe.name}에게 ${dmg} 피해`);
      if (isOver(s)) {
        currentBattle(s).done = true;
        return;
      }
      if (foe.hp === 0 && defeatEnemy(s, rng, p, foe, currentBattle(s))) return;
      finishBattle(s, rng, stepsLeft);
      break;
    }
  }
}

/** 전투 밖에서 에너미에게 피해 (이벤트 카드). 쓰러뜨리면 보상, 보스면 승리. giver: 모나가 준 카드면 팬레터 */
export function strikeEnemy(s: GameState, rng: Rng, p: Player, enemy: Enemy, amount: number, giver?: Player) {
  const dealt = hurtEnemy(s, rng, enemy, amount);
  log(s, `  ${enemy.name}에게 ${dealt} 피해 (체력 ${enemy.hp})`);
  if (enemy.hp > 0 || isOver(s)) return;
  const def = enemyDefAgainst(s, p, enemy);
  s.enemies = s.enemies.filter((e) => e.id !== enemy.id);
  s.stats[p.id].kills += 1;
  p.coins += enemy.reward + (enemy.loot ?? 0);
  onKill(s, rng, p, enemy);
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
  log(s, `  ${enemy.name} 처치! 코인 +${enemy.reward + (enemy.loot ?? 0)}`);
  onEnemyGone(s, rng, enemy);
}

/** 상점 열기: 카드 3장 + (있으면) 내 캐릭터 전용 카드. 칩 상점은 유물만 */
function openShop(s: GameState, rng: Rng, stepsLeft: number, chips = false) {
  const p = currentPlayer(s);
  if (chips) {
    s.phase = { kind: 'shop', stepsLeft, offers: [], free: false, chips: true };
    log(s, `${p.name}: 🔷 칩 상점`);
    return;
  }
  // 지금 성으로 곧 쓸 수 있는 카드만 (한 단계 위까지)
  const usable = DECK_CARD_IDS.filter((id) => CARDS[id].level <= p.level + 1);
  const pool = shuffle(usable, rng).slice(0, RULES.shopOffers);
  const offers: ShopOffer[] = pool.map((card) => ({ card, price: Math.max(0, RULES.shopPrice - relicShopDiscount(p)), sold: false }));
  const hyper = CHARACTERS[p.character].hyper;
  if (hyper) offers.push({ card: hyper.card, price: hyper.price, sold: false });
  const extra = kitShop(s, rng, p);
  if (extra) offers.push({ card: extra, price: Math.max(0, RULES.shopPrice - relicShopDiscount(p)), sold: false });
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
  p.coins -= price;
  offer.sold = true;
  s.phase.free = false;
  p.hand.push({ card: offer.card, shop: true });
  onCardsGained(p, 1);
  log(s, `${p.name}: 「${CARDS[offer.card].name}」 구매${price ? ` (코인 ${price})` : ' (무료)'}`);
}

/** 상점에서 유물 고르기 (원작 칩 상점: 10코인, 살 때마다 +5) */
export function relicPrice(p: Player): number {
  return RELIC_SHOP.base + RELIC_SHOP.step * p.relicBuys;
}

function buyRelic(s: GameState, rng: Rng) {
  if (s.phase.kind !== 'shop' || !s.phase.chips) throw new RuleError('칩 상점이 아닙니다');
  const p = currentPlayer(s);
  if (p.relicOffer) throw new RuleError('먼저 유물을 고르세요');
  const price = relicPrice(p);
  if (p.coins < price) throw new RuleError(`코인 ${price} 필요`);
  p.coins -= price;
  p.relicBuys += 1;
  offerRelic(s, rng, p, p.level, `유물 상점 · 코인 ${price}`);
}

/** 유물 후보 중 하나를 고른다. 밀린 고르기가 있으면 다음 후보 */
function pickRelic(s: GameState, rng: Rng, id: RelicId) {
  const p = currentPlayer(s);
  if (!p.relicOffer?.ids.includes(id)) throw new RuleError('고를 수 있는 유물이 아닙니다');
  p.relicOffer = null;
  gainRelic(s, rng, p, id);
  const next = p.relicQueue.shift();
  if (next !== undefined) offerRelic(s, rng, p, next, '이어서');
}

/** 상점에서 아군에게 코인 5 송금 */
function sendCoins(s: GameState, rng: Rng, to: number) {
  if (s.phase.kind !== 'shop' || s.phase.chips) throw new RuleError('송금은 상점에서만 할 수 있습니다');
  if (s.phase.sent) throw new RuleError('송금은 상점마다 한 번');
  const p = currentPlayer(s);
  const ally = s.players[to];
  if (!ally || ally.id === p.id) throw new RuleError('보낼 아군을 골라야 합니다');
  if (p.coins < RULES.transferCoins) throw new RuleError(`코인 ${RULES.transferCoins} 필요`);
  p.coins -= RULES.transferCoins;
  ally.coins += RULES.transferCoins;
  s.phase.sent = true;
  onTransfer(s, rng, p, ally);
  log(s, `${p.name}: 💌 ${ally.name}에게 코인 ${RULES.transferCoins} 송금`);
}

function leaveShop(s: GameState, rng: Rng) {
  if (s.phase.kind !== 'shop') throw new RuleError('상점이 아닙니다');
  const { stepsLeft } = s.phase;
  // 원격 상점 (파루난): 주사위 전으로
  if (s.turn.remoteShop) {
    s.turn.remoteShop = false;
    s.phase = { kind: 'preRoll' };
    return;
  }
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
  if (p.relicOffer) throw new RuleError('유물을 먼저 고르세요');
  s.turn.landed = false;
  if (p.status.nextMoveDice > 0) {
    s.turn.diceCount = Math.max(s.turn.diceCount, p.status.nextMoveDice);
    p.status.nextMoveDice = 0;
  }
  const dice =
    s.turn.fixedMove !== null ? [s.turn.fixedMove] : Array.from({ length: s.turn.diceCount }, () => (s.turn.sixDice ? rng.d6() : rng.d10()));
  s.turn.extraSteps += p.move - p.status.slow + relicMoveBonus(p) + useOverclock(s, p) + kitMoveBonus(s, p);
  p.status.slow = 0;
  // 원작: 합이 0 이하면 제자리, 한 번 이동은 최대 10
  const steps = Math.min(RULES.moveCap, Math.max(0, dice.reduce((a, b) => a + b, 0) + s.turn.extraSteps));
  s.turn.dice = dice;
  onMove(s, p, steps);
  kitMoved(s, p, steps);

  const bonus = s.turn.extraSteps > 0 ? ` + ${s.turn.extraSteps}` : '';
  log(s, `${p.name}: 🎲 ${dice.join(' + ')}${bonus} → ${steps}칸 이동`);
  move(s, rng, steps, [p.tile]);
}

function choosePath(s: GameState, rng: Rng, to: number) {
  if (s.phase.kind !== 'choosePath') throw new RuleError('지금은 길을 고를 수 없습니다');
  if (!s.phase.options.includes(to)) throw new RuleError('갈 수 없는 방향입니다');
  const path = [currentPlayer(s).tile];
  let left = s.phase.stepsLeft - 1;

  s.phase = { kind: 'preRoll' }; // enter() / move()가 다시 정한다
  if (enter(s, rng, to, path, left)) {
    recordMove(s, path);
    return;
  }
  left += passBonus(s, currentPlayer(s));
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
    onSpare(s, rng, p, enemy);
    if (isOver(s)) {
      battle.done = true;
      return;
    }
    finishBattle(s, rng, stepsLeft);
    return;
  }

  const mods = s.turn.battle;
  s.turn.challenged = true;
  const surge = onAttackStart(s, p, enemy);
  const atk = Math.ceil((p.atk + statusAtk(p) + mods.atk + relicAttack(p, enemy) + kitAtk(s, p, enemy) + surge) * mods.atkMult);
  const foe = { atk: enemy.atk, def: enemyDefAgainst(s, p, enemy) };
  const hit = resolveAttack({ atk, def: p.def }, foe, enemy.defense, rng, 1, {
    attackDice: mods.attackDice,
    sumDice: mods.sumDice,
    attackRoll: relicAttackRoll(rng, p),
    defenseRoll: kitFlaw(enemy, p) ? 0 : undefined,
  });
  const decoy = !enemy.isBoss && ENEMIES[enemy.kind as EnemyKind].decoy;
  hit.damage = hurtEnemy(s, rng, enemy, hit.damage);
  battle.events.push({ type: 'attack', attacker: 'player', result: hit, targetHp: enemy.hp });
  log(s, `  ${p.name}의 공격 ${hit.attackValue} vs ${defenseName(hit.mode)} ${hit.defenseValue} → ${hit.damage} 피해`);
  if (isOver(s)) {
    battle.done = true;
    return;
  }
  if (decoy) battle.events.push({ type: 'skill', name: '분신이었다!' });
  if (hit.damage > 0) onHitMonster(p);
  kitFought(s, p, enemy);
  kitHit(s, rng, p, enemy, hit.damage);
  if (isOver(s)) {
    battle.done = true;
    return;
  }
  afterChallenge(s, rng, p, enemy, atk);
  if (isOver(s)) {
    battle.done = true;
    return;
  }

  if (enemy.hp === 0) {
    if (defeatEnemy(s, rng, p, enemy, battle)) return;
    finishBattle(s, rng, stepsLeft);
    return;
  }

  // 그림자 습격의 반격 없음은 보스에게는 통하지 않는다
  if (enemy.counter && !(mods.noCounter && !enemy.isBoss) && !relicNoCounter(p) && !kitNoCounter(s)) {
    // 원작처럼 반격하는 쪽이 먼저 굴린다. 플레이어는 이 값을 보고 방어 · 회피와 카드를 고른다
    const attackRoll = kitFlaw(enemy, p) ? 0 : rng.d6();
    s.phase = { kind: 'defend', enemy: enemy.id, stepsLeft, attackRoll };
    battle.events.push({ type: 'enemyRoll', roll: attackRoll, value: attackRoll + enemy.atk });
    log(s, `  ${enemy.name}의 반격이 온다!`);
    return;
  }
  finishBattle(s, rng, stepsLeft);
}

/** 반격을 방어 또는 회피로 받는다 */
function defend(s: GameState, rng: Rng, mode: DefenseMode) {
  if (s.phase.kind !== 'defend') throw new RuleError('지금은 반격을 받을 때가 아닙니다');
  const { stepsLeft, attackRoll } = s.phase;
  const enemy = findEnemy(s, s.phase.enemy);
  const battle = currentBattle(s);
  const p = currentPlayer(s);

  const mods = s.turn.battle;
  const me = { atk: p.atk, def: p.def + statusDef(p) + relicDefense(p) + kitDef(s, p) + mods.def };
  const dice = evadeDice(p) + mods.evadeDice;
  const foe = { atk: Math.max(0, enemy.atk + kitEnemyAtk(enemy, p)), def: enemy.def };
  const hit = resolveAttack(foe, me, mode, rng, mode === 'evade' ? dice : 1, { attackRoll });
  battle.events.push({
    type: 'attack',
    attacker: 'enemy',
    result: hit,
    targetHp: Math.max(0, p.hp - hit.damage),
  });
  const rolls = hit.defenseRolls.length > 1 ? ` (주사위 ${hit.defenseRolls.join('·')} 중 높은 값)` : '';
  log(s, `  ${enemy.name}의 반격 ${hit.attackValue} vs ${defenseName(mode)} ${hit.defenseValue}${rolls} → ${hit.damage} 피해`);

  onAttacked(p);
  damage(s, rng, p, hit.damage);
  if (p.ko) {
    // KO 되면 이동도 끝. 진행도가 올라 패배했을 수도 있다
    battle.events.push({ type: 'playerKO' });
    battle.done = true;
    if (!isOver(s)) s.phase = { kind: 'endTurn' };
    return;
  }

  if (mode === 'evade' && hit.damage === 0) {
    onEvaded(p);
    kitEvaded(p);
    if (evadeSucceeded(s, rng, p, enemy, battle)) return;
  }
  finishBattle(s, rng, stepsLeft);
}

/** 회피 성공 시 캐릭터 효과 (패시브 · 잠재 능력). 그걸로 보스를 쓰러뜨려 게임이 끝나면 true */
function evadeSucceeded(s: GameState, rng: Rng, p: Player, enemy: Enemy, battle: Battle): boolean {
  const c = CHARACTERS[p.character];
  const effects = onEvadeSuccess(p);

  if (effects.cooldownCut > 0 && p.skillCooldown > 0) {
    p.skillCooldown = Math.max(0, p.skillCooldown - effects.cooldownCut);
    battle.events.push({ type: 'skill', name: c.passive.name });
    log(s, `  ${p.name}: 「${c.passive.name}」 액티브 재사용 대기 -${effects.cooldownCut} (남은 ${p.skillCooldown})`);
  }

  if (effects.counterDamage > 0) {
    const dealt = hurtEnemy(s, rng, enemy, effects.counterDamage);
    const name = c.potential?.name ?? '잠재 능력';
    battle.events.push({ type: 'skill', name, damage: dealt, targetHp: enemy.hp });
    log(s, `  ${p.name}: 「${name}」 ${enemy.name}에게 ${dealt} 피해`);
    if (isOver(s)) {
      battle.done = true;
      return true;
    }
    if (enemy.hp === 0) return defeatEnemy(s, rng, p, enemy, battle);
  }
  return false;
}

/** 에너미 처치: 보상을 주고 판에서 치운다. 보스면 모두의 승리로 게임이 끝나고 true */
function defeatEnemy(s: GameState, rng: Rng, p: Player, enemy: Enemy, battle: Battle): boolean {
  const reward = enemy.reward + (enemy.loot ?? 0);
  const def = enemyDefAgainst(s, p, enemy);
  s.enemies = s.enemies.filter((e) => e.id !== enemy.id);
  s.stats[p.id].kills += 1;
  p.coins += reward;
  onKill(s, rng, p, enemy);
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
  onEnemyGone(s, rng, enemy);
  return false;
}

/** 액티브 스킬: 주사위를 굴리기 전에, 재사용 대기가 끝났을 때만 */
function useSkill(s: GameState, rng: Rng, target?: number, cards?: number[], value?: number) {
  if (s.phase.kind !== 'preRoll') throw new RuleError('스킬은 주사위를 굴리기 전에만 쓸 수 있습니다');
  const p = currentPlayer(s);
  if (s.turn.skillUsed) throw new RuleError('스킬은 턴마다 한 번만 쓸 수 있습니다');
  if (p.skillCooldown > 0) throw new RuleError(`재사용까지 ${p.skillCooldown}라운드 남았습니다`);
  const def = CHARACTERS[p.character].active;
  const targets = skillTargets(s, p);
  if (targets && (target === undefined || !targets.includes(target))) throw new RuleError('사거리 안의 대상을 골라야 합니다');
  if (def.cards) {
    const picked = [...new Set(cards ?? [])];
    const [min, max] = def.cards;
    if (picked.length < min || picked.length > max || picked.some((i) => !p.hand[i])) throw new RuleError(`줄 카드를 ${min === max ? min : `${min}~${max}`}장 골라야 합니다`);
  }
  if (def.value && !(Number.isInteger(value) && value! >= def.value[0] && value! <= def.value[1])) {
    throw new RuleError(`${def.value[0]}~${def.value[1]} 중에서 골라야 합니다`);
  }

  activateSkill(s, p);
  s.turn.skillUsed = true;
  onSkillUsed(s, rng, p);
  log(s, `${p.name}: ✨ 액티브 스킬 「${def.name}」!`);

  if (isKit(p.character)) {
    const follow = kitActive(s, rng, p, { target, cards, value });
    if (!follow || isOver(s)) return;
    if (follow.kind === 'shop') {
      s.turn.remoteShop = true;
      openShop(s, rng, 0);
      const shop = s.phase as GameState['phase'];
      if (shop.kind === 'shop') shop.free = false;
    } else if (follow.kind === 'teleport') {
      const from = p.tile;
      p.tile = follow.tile;
      recordMove(s, [from, p.tile]);
    } else if (follow.kind === 'challenge') {
      const enemy = findEnemy(s, follow.enemy);
      s.turn.remote = true;
      s.turn.remoteFar = follow.far;
      startEncounter(s, enemy, 0);
      currentBattle(s).events.push({ type: 'skill', name: def.name });
    }
    return;
  }

  if (p.character === 'soda') {
    // 조나단 러시: 상대 칸으로 워프해 전투. 이 전투 동안 상대 방어력 -2, 전투가 끝나면 그 칸에서 차례를 마친다
    const enemy = findEnemy(s, target!);
    const from = p.tile;
    p.tile = enemy.tile;
    recordMove(s, [from, p.tile]);
    startEncounter(s, enemy, 0);
    s.turn.battle.enemyDefDown += 2;
    currentBattle(s).events.push({ type: 'skill', name: def.name });
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
  const p = currentPlayer(s);
  onTurnEnd(s, rng, p);
  if (isOver(s)) return;
  // 손패 한도를 넘으면 늦게 얻은 카드부터 버린다
  if (p.hand.length > handLimit(p)) {
    const dropped = p.hand.splice(handLimit(p));
    kitDiscard(s, p, dropped);
    log(s, `${p.name}: 🃏 손패 한도 — ${dropped.map((h) => CARDS[h.card].name).join(', ')} 버림`);
  }
  nextPlayer(s, rng);
  beginTurn(s, rng);
}

// ───────────────────────── 진행 ─────────────────────────

function freshTurn(): TurnInfo {
  return {
    cardsPlayed: 0,
    extraPlays: 0,
    candyUsed: false,
    quiverUsed: false,
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
  // 모두 움직인 뒤 보스와 미니언 차례 (OJ: 보스는 5번째 유닛)
  bossTurn(s, rng);
  if (isOver(s)) return;
  kitRoundEnd(s, rng);
  if (isOver(s)) return;
  s.round += 1;
  log(s, `── ${s.round}라운드 ──`);
  // 재사용 대기는 진짜 라운드만 센다 (KO로 오르는 진행도에는 줄지 않는다)
  for (const p of s.players) p.skillCooldown = Math.max(0, p.skillCooldown - 1);
  advanceProgress(s, rng, '라운드');
  // 라운드 보상 (아스트랄 파티 코옵): 모두 코인 + 카드 1장
  if (s.round % RULES.roundRewardEvery === 0 && !isOver(s)) {
    for (const p of s.players) {
      const extra = roundRewardBonus(s, p);
      p.coins += RULES.roundRewardCoins + extra.coins;
      drawCards(s, p, rng, 1 + extra.cards);
      if (extra.coins) log(s, `  ${p.name}: ✦ 스타라이트 코인 +${extra.coins}`);
    }
    log(s, `🎁 라운드 보상: 모두 코인 +${RULES.roundRewardCoins} · 카드 1장`);
    notice(s, `🎁 라운드 보상 — 코인 +${RULES.roundRewardCoins} · 카드 1장`);
  }
  revealIntent(s, rng);
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
    tickStatus(s, p);
    onTurnStart(s, rng, p);
    return;
  }
}

/** 자기 차례 시작: 지속 효과를 한 번씩 적용하고 남은 턴을 줄인다 */
function tickStatus(s: GameState, p: Player) {
  const st = p.status;
  if (st.erode && p.hp > 1) {
    p.hp -= 1;
    log(s, `${p.name}: 위압 — 체력 -1`);
  }
  if (st.regen) {
    const healed = heal(p, st.regen.amount);
    if (healed) log(s, `${p.name}: 체력 +${healed}`);
    st.regen.turns -= 1;
    if (st.regen.turns <= 0) st.regen = null;
  }
  for (const key of ['atkUp', 'defUp', 'atkDown', 'defDown'] as const) {
    const buff = st[key];
    if (!buff) continue;
    buff.turns -= 1;
    if (buff.turns <= 0) st[key] = null;
  }
}

/** 진행도 +1. 그 진행도의 기믹은 바로 발동하고, 한계에 닿으면 패배 */
export function advanceProgress(s: GameState, rng: Rng, reason: '라운드' | 'KO' | '보스') {
  if (s.phase.kind === 'gameOver') return;
  s.progress += 1;
  log(s, `⏳ 진행도 ${s.progress}${reason === '라운드' ? '' : ` (${reason})`}`);
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
          bossAppear(s, rng);
          break;
        case 'move':
          runTimelineMove(s, rng, action.move);
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
    left += passBonus(s, p);
  }

  arrive(s, rng, path);
}

/** 이동이 끝난 칸: 칸 효과 → (전투 · 질주가 없으면) 차례 끝 */
function arrive(s: GameState, rng: Rng, path: number[]) {
  const p = currentPlayer(s);
  s.turn.noBattle = false;
  // 링링 돌진: 멈춘 칸에서 붙잡은 몬스터와 싸울지
  if (s.turn.charge) {
    s.turn.charge = false;
    const grabbed = s.enemies.find((e) => e.tile === p.tile && targetable(s, e));
    if (grabbed) {
      startEncounter(s, grabbed, 0);
      recordMove(s, path);
      return;
    }
  }
  // 멈춘 칸에서 전투가 있었으면 전투 뒤에 돌아와도 칸 효과는 한 번만
  if (!s.turn.landed) {
    s.turn.landed = true;
    land(s, rng, path);
    if (s.turn.extraEvent && !isOver(s)) {
      s.turn.extraEvent = false;
      runEvent(s, rng, p, path);
    }
  }
  if (s.turn.haste) {
    s.turn.haste = false;
    s.turn.landed = false;
    s.phase = { kind: 'preRoll' };
  } else if (s.phase.kind === 'preRoll') {
    s.phase = { kind: 'endTurn' };
  }
  recordMove(s, path);
}

/** 지나가던 거점 · 확인 지점에서 멈출지 */
function stopHere(s: GameState, rng: Rng, stop: boolean) {
  if (s.phase.kind !== 'stopChoice') throw new RuleError('지금은 고를 수 없습니다');
  const { stepsLeft } = s.phase;
  const p = currentPlayer(s);
  s.phase = { kind: 'preRoll' };
  if (stop) arrive(s, rng, [p.tile]);
  else move(s, rng, stepsLeft, [p.tile]);
}

/** 가속 칸: 지나가거나 멈추면 1칸 더 (멈출 수 없다) */
function passBonus(s: GameState, p: Player): number {
  if (s.board.tiles[p.tile].kind !== 'boost') return 0;
  onBoostTile(p);
  return 1;
}

/** 한 칸 들어간다. 그 칸에 에너미가 있으면 인카운터, 상점이면 상점을 열고 true */
function enter(s: GameState, rng: Rng, tileId: number, path: number[], stepsLeft: number): boolean {
  const p = currentPlayer(s);
  p.tile = tileId;
  path.push(tileId);
  kitPass(s, rng, p, tileId);
  if (isOver(s)) return true;

  const enemy = s.turn.noBattle ? undefined : s.enemies.find((e) => e.tile === tileId && targetable(s, e));
  if (enemy) {
    startEncounter(s, enemy, stepsLeft);
    return true;
  }
  const kind = s.board.tiles[tileId].kind;
  if (kind === 'shop' || kind === 'chipShop') {
    openShop(s, rng, stepsLeft, kind === 'chipShop');
    return true;
  }
  // 내 거점 · 확인 지점: 성을 올리거나 회복할 수 있으면 멈출지 묻는다
  if (stepsLeft > 0 && (tileId === p.home || kind === 'checkpoint') && canRest(p)) {
    s.phase = { kind: 'stopChoice', stepsLeft };
    return true;
  }
  return false;
}

/** 거점에 멈추면 할 일이 있는지 (성 오름 · 회복) */
export function canRest(p: Player): boolean {
  const cost = RULES.levelUpCost[p.level];
  return (cost !== undefined && p.coins >= cost) || p.hp < p.maxHp;
}

/** 멈춘 칸에 맵 몬스터 1마리 → 바로 전투 */
function monsterTile(s: GameState, rng: Rng, p: Player) {
  const kind = rng.pick(s.board.monsters ?? DEFAULT_MONSTERS);
  const e = spawnEnemy(s, kind, p.tile);
  log(s, `${p.name}: 👾 몬스터 칸 — ${e.name}`);
  startEncounter(s, e, 0);
}

const DEFAULT_MONSTERS: EnemyKind[] = ['robot', 'drone', 'delinquent'];

/** 정한 칸에 에너미 1마리 */
export function spawnEnemy(s: GameState, kind: EnemyKind, tile: number): Enemy {
  const info = ENEMIES[kind];
  const e: Enemy = {
    id: s.nextEnemyId++,
    kind,
    name: info.name,
    icon: info.icon,
    isBoss: false,
    tile,
    hp: info.hp,
    maxHp: info.hp,
    atk: info.atk + s.enemyBonus.atk,
    def: info.def + s.enemyBonus.def,
    counter: info.counter,
    defense: info.defense,
    reward: info.reward,
  };
  s.enemies.push(e);
  return e;
}

/** 거점 · 확인 지점에 멈추면 코인을 내고 1성 오름 */
function tryLevelUp(s: GameState, rng: Rng, p: Player) {
  const cost = RULES.levelUpCost[p.level];
  if (cost === undefined) return;
  if (p.coins < cost) {
    log(s, `${p.name}: 거점 도착 — ${p.level + 1}성까지 코인 ${cost - p.coins} 부족`);
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
  // 원작처럼 성이 오르면 유물 3개 중 1개 (확률표는 성 기준)
  offerRelic(s, rng, p, p.level, `${p.level}성`);
}

/** 도착한 칸의 효과. 워프 · 밀려남은 path에 지나간 칸을 덧붙인다 */
function land(s: GameState, rng: Rng, path: number[]) {
  const p = currentPlayer(s);
  tileEffect(s, rng, p, path, 0);
  if (!isOver(s) && !p.ko) landOnMark(s, rng, p);
}

/** 칸을 따라 밀려난다 (컨베이어 · 해류 · 빙판). 에너미 · 상점 앞에서 멈춘다 */
function slide(s: GameState, p: Player, path: number[], n: number, untilOffIce = false): number {
  let moved = 0;
  for (let i = 0; i < n; i++) {
    const next = s.board.tiles[s.board.tiles[p.tile].next[0]];
    if (!next || next.kind === 'shop' || s.enemies.some((e) => e.tile === next.id && targetable(s, e))) break;
    p.tile = next.id;
    path.push(next.id);
    moved += 1;
    if (untilOffIce && next.kind !== 'ice') break;
  }
  return moved;
}

const CANDY_CARDS: CardId[] = ['cookie', 'cake', 'pudding'];

function tileEffect(s: GameState, rng: Rng, p: Player, path: number[], depth: number) {
  const tile = s.board.tiles[p.tile];
  // 밀려난 칸의 효과도 받는다 (한 번만)
  const after = () => {
    if (depth < 1 && !isOver(s)) tileEffect(s, rng, p, path, depth + 1);
  };

  switch (tile.kind) {
    case 'empty':
    case 'shop':
    case 'chipShop':
    case 'boost':
      break;
    case 'base':
    case 'checkpoint': {
      const healed = heal(p, RULES.heal);
      if (healed) log(s, `${p.name}: ❤️ HP +${healed}`);
      tryLevelUp(s, rng, p);
      break;
    }
    case 'monster':
      monsterTile(s, rng, p);
      break;
    case 'haste':
      s.turn.haste = true;
      log(s, `${p.name}: 💨 질주 — 한 번 더`);
      notice(s, `💨 질주`);
      break;
    case 'sand':
      p.status.slow += 2;
      log(s, `${p.name}: ⏳ 유사 — 다음 이동 -2`);
      break;
    case 'conveyor':
    case 'current': {
      const n = slide(s, p, path, tile.kind === 'conveyor' ? 3 : 2);
      if (tile.kind === 'current') heal(p, 1);
      log(s, `${p.name}: ${tile.kind === 'conveyor' ? '⏭️ 컨베이어' : '🌊 해류'} — ${n}칸 밀려났다`);
      if (n) after();
      break;
    }
    case 'ice': {
      const n = slide(s, p, path, 8, true);
      log(s, `${p.name}: 🧊 빙판 — ${n}칸 미끄러졌다`);
      if (n && s.board.tiles[p.tile].kind !== 'ice') after();
      break;
    }
    case 'assault': {
      const kind = s.board.assault ?? 'delinquent';
      summon(s, rng, kind, 'players');
      p.coins += 3;
      onBoostTile(p);
      log(s, `${p.name}: 🚪 돌격문 — ${ENEMIES[kind].name} 등장 · 코인 +3`);
      notice(s, `🚪 돌격문 — ${ENEMIES[kind].name}`);
      break;
    }
    case 'trap':
      if (kitTrapImmune(s, p)) break;
      log(s, `${p.name}: ⚠️ 함정 — 2 피해`);
      damage(s, rng, p, 2);
      break;
    case 'clue':
      p.coins += 2;
      gainRes(s, rng, p, 'evidence', 1);
      break;
    case 'clock':
      gainRes(s, rng, p, 'overclock', 1);
      break;
    case 'stage':
      gainRes(s, rng, p, 'mind', 2);
      break;
    case 'candy': {
      const price = hasRelic(p, 'candyCard') ? 0 : 5;
      if (p.coins < price || p.hand.length >= handLimit(p)) break;
      p.coins -= price;
      const card = rng.pick(CANDY_CARDS);
      p.hand.push({ card, shop: true });
      onCardsGained(p, 1);
      log(s, `${p.name}: 🍭 사탕 자판기 — 코인 ${price} · ${CARDS[card].name}`);
      break;
    }
    case 'detention':
      p.mapRes.problem = 2;
      log(s, `${p.name}: 📝 반성실 — 문제아 (공격력 +2 · 방어력 -2)`);
      notice(s, `📝 ${p.name} 문제아`);
      break;
    case 'windfall': {
      const n = rng.pick(RULES.windfall);
      p.coins += n;
      log(s, `${p.name}: 🪙 횡재 — 코인 +${n}`);
      break;
    }
    case 'calamity':
      if (kitTrapImmune(s, p)) break;
      log(s, `${p.name}: ⚡ 재앙 — ${RULES.calamity} 피해`);
      damage(s, rng, p, RULES.calamity);
      break;
    case 'card':
      drawCards(s, p, rng, RULES.cardTile);
      break;
    case 'event':
      runEvent(s, rng, p, path);
      break;
    case 'heal': {
      const healed = heal(p, RULES.heal);
      log(s, `${p.name}: ❤️ HP +${healed}`);
      break;
    }
    case 'warp': {
      onBoostTile(p);
      const dest = tile.warpTo!;
      p.tile = dest;
      path.push(dest);
      log(s, `${p.name}: 🌀 워프! ${dest}번 칸으로`);
      break;
    }
  }
}

/** 이벤트 칸: 무작위 이벤트 하나 (data/events.ts의 글과 맞춘다) */
function runEvent(s: GameState, rng: Rng, p: Player, path: number[]) {
  const id = rng.pick(EVENT_IDS);
  const ev = EVENTS[id];
  log(s, `${p.name}: ${ev.icon} 이벤트 「${ev.name}」 ${ev.text}`);
  notice(s, `${ev.icon} ${ev.name} — ${ev.text}`);
  kitEvent(s, p);
  switch (id) {
    case 'vending':
      p.coins += 6;
      break;
    case 'lostFound':
      drawCards(s, p, rng, 1);
      break;
    case 'lunch':
      heal(p, 3);
      break;
    case 'training':
      p.status.nextBattleAtk += 2;
      break;
    case 'cheer':
      for (const o of s.players) if (!o.ko) heal(o, 1);
      break;
    case 'shortcut': {
      const warps = s.board.tiles.filter((t) => t.kind === 'warp' && t.id !== p.tile);
      if (warps.length === 0) break;
      p.tile = rng.pick(warps).id;
      path.push(p.tile);
      break;
    }
    case 'delivery':
      damage(s, rng, p, 2);
      break;
    case 'wallet':
      p.coins -= Math.min(p.coins, 4);
      break;
    case 'drill':
      for (const o of s.players) if (!o.ko && !isOver(s)) damage(s, rng, o, 1);
      break;
    case 'ambush': {
      const occupied = new Set(s.enemies.map((e) => e.tile));
      const spots = distanceTiles(s, p.tile, 1).filter((t) => {
        const kind = s.board.tiles[t].kind;
        return t !== p.tile && !occupied.has(t) && kind !== 'base' && kind !== 'warp';
      });
      if (spots.length === 0) break;
      const tile = rng.pick(spots);
      const info = ENEMIES.delinquent;
      s.enemies.push({
        id: s.nextEnemyId++,
        kind: 'delinquent',
        name: info.name,
        icon: info.icon,
        isBoss: false,
        tile,
        hp: info.hp,
        maxHp: info.hp,
        atk: info.atk + s.enemyBonus.atk,
        def: info.def + s.enemyBonus.def,
        counter: info.counter,
        defense: info.defense,
        reward: info.reward,
      });
      break;
    }
  }
}

function distanceTiles(s: GameState, from: number, range: number): number[] {
  const dist = distances(s.board, from);
  return [...dist].filter(([, d]) => d <= range).map(([t]) => t);
}

/** 공용 카드에서 n장. 손패 한도는 차례가 끝날 때 본다 */
export function drawCards(_s: GameState, p: Player, rng: Rng, n: number) {
  for (let i = 0; i < n; i++) {
    p.hand.push({ card: randomCard(rng) });
    onCardsGained(p, 1);
  }
}

// ───────────────────────── 에너미 · 전투 ─────────────────────────

/** 빈 소환 칸에 에너미를 놓는다. 소환 칸이 다 차면 본부 · 보스 칸 · 워프를 뺀 빈 칸 아무 데나.
 *  near: 보스 곁(2칸 안) 또는 아군 곁(1~2칸)에 놓는다 */
export function summon(s: GameState, rng: Rng, kind: EnemyKind, near?: 'boss' | 'players') {
  const occupied = new Set(s.enemies.map((e) => e.tile));
  const open = (t: Board['tiles'][number]) =>
    t.kind !== 'base' && t.kind !== 'warp' && t.id !== s.board.bossTile && !occupied.has(t.id);
  let candidates: number[] = [];
  if (near) {
    const from = near === 'boss' ? [s.enemies.find((e) => e.isBoss)?.tile ?? s.board.bossTile] : s.players.filter((p) => !p.ko).map((p) => p.tile);
    const maps = from.map((t) => distances(s.board, t));
    const lo = near === 'boss' ? 1 : 1;
    candidates = s.board.tiles
      .filter((t) => open(t) && maps.some((d) => (d.get(t.id) ?? 99) >= lo && (d.get(t.id) ?? 99) <= 2))
      .map((t) => t.id);
  }
  if (candidates.length === 0) candidates = s.board.spawnTiles.filter((t) => !occupied.has(t));
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

export function bossAppear(s: GameState, rng: Rng) {
  if (s.enemies.some((e) => e.isBoss)) return;
  const b = s.boss;
  const level = DIFFICULTIES[s.difficulty];
  const hp = Math.round(b.hpPerPlayer * s.players.length * level.hp);
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
    atk: b.atk + level.atk,
    def: b.def,
    counter: b.counter,
    defense: b.defense,
    reward: 0,
  });
  onBossAppear(s, rng);
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
  kitBattleEnd(s, currentPlayer(s));
  // 원격 도전 (낸시): 제자리에서 주사위 전으로
  if (s.turn.remote) {
    s.turn.remote = false;
    s.turn.remoteFar = false;
    s.phase = { kind: 'preRoll' };
    return;
  }
  s.phase = { kind: 'preRoll' }; // move()가 다시 정한다
  move(s, rng, stepsLeft, [currentPlayer(s).tile]);
}

/** 함수 호출 뒤에도 TS가 좁혀 둔 phase 타입을 믿지 않게, 매번 새로 읽는다 */
export function isOver(s: GameState): boolean {
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
export function damage(s: GameState, rng: Rng, p: Player, amount: number) {
  amount = onDamage(s, p, kitBeforeDamage(s, p, amount));
  s.stats[p.id].damageTaken += Math.min(p.hp, amount);
  p.hp = Math.max(0, p.hp - amount);
  kitDamaged(s, p, amount);
  if (p.hp > 0) return;
  kitKO(p);
  s.stats[p.id].kos += 1;

  p.ko = true;
  // 보충 수업: 쉬지 않고 다음 차례에 부활
  p.reviveRound = s.round + (p.status.extend ? 1 : RULES.reviveAfterRounds);
  p.status = freshStatus();
  log(s, `${p.name}: 💀 KO! ${p.reviveRound}라운드에 부활`);
  if (!onKO(s, p)) advanceProgress(s, rng, 'KO');
}

/** 회복. 회복을 받으면 위압이 풀린다 */
export function heal(p: Player, amount: number): number {
  if (amount > 0) p.status.erode = false;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  const healed = p.hp - before;
  kitHealed(p, healed, Math.max(0, amount - healed));
  return healed;
}

function recordMove(s: GameState, path: number[]) {
  if (path.length < 2) return;
  s.seq += 1;
  s.lastMove = { seq: s.seq, player: s.current, path };
}

export function notice(s: GameState, text: string) {
  s.seq += 1;
  s.notices.push({ seq: s.seq, text });
  if (s.notices.length > RULES.noticeHistory) s.notices.shift();
}

export function log(s: GameState, text: string) {
  s.log.push(text);
  if (s.log.length > RULES.logLimit) s.log.splice(0, s.log.length - RULES.logLimit);
}

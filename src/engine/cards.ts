// 카드 · 덱 규칙 중 상태를 바꾸지 않는 부분 (검사 · 섞기 · 거리). 효과 자체는 game.ts의 cardEffect.

import { CARDS, DECK_CARD_IDS } from '../data/cards';
import { cardPlayLimit, relicRange } from './relics';
import { kitBattleCost, kitRange } from './kits';
import type { Rng } from './rng';
import { RULES } from './rules';
import type { BattleMods, Board, CardId, Enemy, GameState, HandCard, Player, PlayerStatus } from './types';

export function freshBattleMods(): BattleMods {
  return {
    costUsed: 0,
    atk: 0,
    def: 0,
    evadeDice: 0,
    attackDice: 1,
    sumDice: false,
    atkMult: 1,
    enemyDefDown: 0,
    noCounter: false,
  };
}

export function freshStatus(): PlayerStatus {
  return {
    regen: null,
    atkUp: null,
    defUp: null,
    extend: false,
    nextBattleAtk: 0,
    nextMoveDice: 0,
    skipTurn: false,
    defDown: null,
    atkDown: null,
    erode: false,
    curse: 0,
    slow: 0,
  };
}

/** 카드 · 보스 약화로 바뀐 공격력 / 방어력 */
export function statusAtk(p: Player): number {
  const res = p.mapRes ?? {};
  return (p.status.atkUp?.amount ?? 0) - (p.status.atkDown?.amount ?? 0) + (res.problem ? 2 : 0) + ((res.mind ?? 0) >= 3 ? 1 : 0);
}

export function statusDef(p: Player): number {
  return (p.status.defUp?.amount ?? 0) - (p.status.defDown?.amount ?? 0) - (p.mapRes?.problem ? 2 : 0);
}

/** 손패 한도 */
export function handLimit(_p: Player): number {
  return RULES.handLimit;
}

/** 고르거나 부딪힐 수 있는 에너미인지 (땅속에 숨은 보스는 안 된다) */
export function targetable(s: GameState, e: Enemy): boolean {
  return !(e.isBoss && s.bossState.hidden);
}

export function shuffle<T>(list: T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 공용 카드에서 무작위 1장 (원작: 덱이 없다). 무게 = 카드 limit */
export function randomCard(rng: Rng): CardId {
  let r = rng.next() * POOL_TOTAL;
  for (const [id, w] of POOL) if ((r -= w) < 0) return id;
  return POOL[POOL.length - 1][0];
}
const POOL: [CardId, number][] = DECK_CARD_IDS.map((id) => [id, CARDS[id].limit]);
const POOL_TOTAL = POOL.reduce((a, [, w]) => a + w, 0);

/** 카드를 쓸 때 내는 코인. 성에 따라 오르는 카드도 있다 (전술적 후퇴) */
export function cardCoinCost(id: CardId, p: Player): number {
  const info = CARDS[id];
  if (!info.cost) return 0;
  return Math.max(info.cost, (info.costPerLevel ?? 0) * p.level);
}

/** 이번 인카운터의 전투 코스트 (아스트랄 파티 코옵: 3 + 성) */
export function battleBudget(p: Player): number {
  return RULES.battleCostBase + p.level;
}

/** from 칸에서 모든 칸까지 걸어서 몇 칸인지 (길 방향은 따지지 않는다) */
export function distances(board: Board, from: number): Map<number, number> {
  const near = new Map<number, number[]>();
  for (const t of board.tiles) {
    for (const n of t.next) {
      near.set(t.id, [...(near.get(t.id) ?? []), n]);
      near.set(n, [...(near.get(n) ?? []), t.id]);
    }
  }
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of near.get(cur) ?? []) {
      if (dist.has(n)) continue;
      dist.set(n, dist.get(cur)! + 1);
      queue.push(n);
    }
  }
  return dist;
}

/** 이 카드로 고를 수 있는 대상 (아군이면 플레이어 id, 에너미면 에너미 id). 대상이 없는 카드는 null */
export function cardTargets(s: GameState, p: Player, id: CardId): number[] | null {
  const info = CARDS[id];
  if (!info.target) return null;
  if (info.target === 'enemy') {
    const dist = distances(s.board, p.tile);
    const range = info.range! + (relicRange(p) + kitRange(p));
    return s.enemies.filter((e) => targetable(s, e) && (dist.get(e.tile) ?? Infinity) <= range).map((e) => e.id);
  }
  return s.players.filter((o) => !o.ko && (info.target === 'ally' || o.id !== p.id)).map((o) => o.id);
}

/** 지금 이 카드를 못 쓰는 이유. 쓸 수 있으면 null */
export function cardBlocker(s: GameState, p: Player, hand: HandCard): string | null {
  const info = CARDS[hand.card];
  const phase = s.phase.kind;

  if (info.type === 'battle') {
    if (info.timing === 'attack' && phase !== 'encounter') return '공격할 때 쓰는 카드';
    if (info.timing === 'defend' && phase !== 'defend') return '반격을 받을 때 쓰는 카드';
    if (s.turn.battle.costUsed + kitBattleCost(p, hand.card) > battleBudget(p)) return '전투 코스트 부족';
  } else {
    if (phase !== 'preRoll') return '주사위 전에 쓰는 카드';
    const limit = cardPlayLimit(s, p);
    if (s.turn.cardsPlayed >= limit) return `턴마다 ${limit}장`;
  }
  if (p.level < info.level) return `${info.level}성 필요`;
  const cost = cardCoinCost(hand.card, p);
  if (cost && p.coins < cost) return `코인 ${cost} 필요`;

  const targets = cardTargets(s, p, hand.card);
  if (targets && targets.length === 0) return info.target === 'enemy' ? `${info.range}칸 안에 에너미 없음` : '대상 없음';

  switch (hand.card) {
    case 'portal':
      if (!s.board.tiles.some((t) => t.kind === 'warp' && t.id !== p.tile)) return '워프 칸 없음';
      break;
    case 'magnum':
      if (p.hp <= 1) return '체력 부족';
      break;
    case 'kingPower':
      if (p.hp <= 4) return '체력 부족';
      break;
    case 'poisonCure':
      if (p.hp <= 2) return '체력 부족';
      break;
    case 'revival':
      if (!s.players.some((o) => o.ko)) return '쓰러진 아군 없음';
      break;
  }
  return null;
}


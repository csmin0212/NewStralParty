// 카드 · 덱 규칙 중 상태를 바꾸지 않는 부분 (검사 · 섞기 · 거리). 효과 자체는 game.ts의 cardEffect.

import { CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import type { Rng } from './rng';
import { RULES } from './rules';
import type { BattleMods, Board, CardId, GameState, HandCard, Player, PlayerStatus } from './types';

export function freshBattleMods(): BattleMods {
  return { costUsed: 0, atk: 0, def: 0, evadeDice: 0, attackDice: 1, atkMult: 1, noCounter: false };
}

export function freshStatus(): PlayerStatus {
  return { regen: null, atkUp: null, defUp: null, extend: false, nextBattleAtk: 0, nextMoveDice: 0, skipTurn: false };
}

export function shuffle<T>(list: T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function deckPoints(cards: CardId[]): number {
  return cards.reduce((sum, id) => sum + (CARDS[id]?.points ?? 0), 0);
}

/** 덱 구성 오류 목록. 비어 있으면 정상 */
export function validateDeck(cards: CardId[], budget: number): string[] {
  const problems: string[] = [];
  if (cards.length > RULES.deckSize) problems.push(`덱은 ${RULES.deckSize}장까지`);
  if (cards.length < RULES.deckMin) problems.push(`덱은 ${RULES.deckMin}장 이상`);
  const counts = new Map<CardId, number>();
  for (const id of cards) {
    if (!CARDS[id]) {
      problems.push(`없는 카드: ${id}`);
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, n] of counts) {
    if (n > CARDS[id].limit) problems.push(CARDS[id].limit === 0 ? `${CARDS[id].name}는 덱에 못 넣는다` : `${CARDS[id].name}는 ${CARDS[id].limit}장까지`);
  }
  const points = deckPoints(cards);
  if (points > budget) problems.push(`덱 포인트 ${points} / ${budget}`);
  return problems;
}

/** 덱에 이 카드를 1장 더 넣을 수 있는지 */
export function canAddToDeck(cards: CardId[], id: CardId, budget: number): boolean {
  const info = CARDS[id];
  return (
    cards.length < RULES.deckSize &&
    cards.filter((c) => c === id).length < info.limit &&
    deckPoints(cards) + info.points <= budget
  );
}

export function deckBudget(p: Player): number {
  return CHARACTERS[p.character].deckPoints;
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
    return s.enemies.filter((e) => (dist.get(e.tile) ?? Infinity) <= info.range!).map((e) => e.id);
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
    if (s.turn.battle.costUsed + info.battleCost! > battleBudget(p)) return '전투 코스트 부족';
  } else {
    if (phase !== 'preRoll') return '주사위 전에 쓰는 카드';
    if (s.turn.cardPlayed) return '턴마다 1장';
  }
  if (p.level < info.level) return `${info.level}성 필요`;
  if (info.cost && p.coins < info.cost) return `코인 ${info.cost} 필요`;

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

/** 덱 정비는 본부 칸에서, 주사위 전이나 턴을 끝내기 전에만 */
export function canEditDeck(s: GameState, p: Player): boolean {
  return p.tile === s.board.baseTile && (s.phase.kind === 'preRoll' || s.phase.kind === 'endTurn');
}

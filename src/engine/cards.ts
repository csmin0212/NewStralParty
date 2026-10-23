// 카드 · 덱 규칙 중 상태를 바꾸지 않는 부분 (검사 · 섞기). 효과 자체는 game.ts의 playCard.

import { CARD_IDS, CARDS } from '../data/cards';
import type { Rng } from './rng';
import { RULES } from './rules';
import type { BattleMods, CardId, GameState, HandCard, Player } from './types';

export function freshBattleMods(): BattleMods {
  return {
    atk: 0,
    def: 0,
    evadeDice: 0,
    attackDice: 1,
    pierce: false,
    noCounter: false,
    lifeSteal: false,
    bounty: false,
    autoEvade: false,
    reflect: false,
    attackCard: false,
    defendCard: false,
  };
}

export function shuffle<T>(list: T[], rng: Rng): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 덱 구성 오류 목록. 비어 있으면 정상 */
export function validateDeck(cards: CardId[]): string[] {
  const problems: string[] = [];
  if (cards.length > RULES.deckSize) problems.push(`덱은 ${RULES.deckSize}장까지`);
  if (cards.length < RULES.deckMin) problems.push(`덱은 ${RULES.deckMin}장 이상`);
  const counts = new Map<CardId, number>();
  for (const id of cards) {
    if (!CARD_IDS.includes(id)) {
      problems.push(`없는 카드: ${id}`);
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, n] of counts) {
    if (n > CARDS[id].limit) problems.push(`${CARDS[id].name}는 ${CARDS[id].limit}장까지`);
  }
  return problems;
}

/** 덱에 이 카드를 1장 더 넣을 수 있는지 */
export function canAddToDeck(cards: CardId[], id: CardId): boolean {
  return cards.length < RULES.deckSize && cards.filter((c) => c === id).length < CARDS[id].limit;
}

/** 지금 이 카드를 못 쓰는 이유. 쓸 수 있으면 null */
export function cardBlocker(s: GameState, p: Player, hand: HandCard): string | null {
  const info = CARDS[hand.card];
  const phase = s.phase.kind;

  if (info.type === 'battle') {
    const battle = s.turn.battle;
    if (info.timing === 'attack') {
      if (phase !== 'encounter') return '공격할 때 쓰는 카드';
      if (battle.attackCard) return '공격 때 1장';
    } else {
      if (phase !== 'defend') return '반격을 받을 때 쓰는 카드';
      if (battle.defendCard) return '반격 때 1장';
    }
  } else {
    if (phase !== 'preRoll') return '주사위 전에 쓰는 카드';
    if (s.turn.cardPlayed) return '턴마다 1장';
  }
  if (info.cost && p.coins < info.cost) return `코인 ${info.cost} 필요`;

  const normal = s.enemies.filter((e) => !e.isBoss);
  switch (hand.card) {
    case 'recall':
      if (p.tile === s.board.baseTile) return '이미 본부';
      break;
    case 'refresh':
      if (p.skillCooldown === 0) return '재사용 대기 없음';
      break;
    case 'emergencyCall':
      if (!s.players.some((o) => o.ko)) return '쓰러진 아군 없음';
      break;
    case 'bossBreak':
      if (!s.enemies.some((e) => e.isBoss)) return '보스 없음';
      break;
    case 'airStrike':
    case 'curfew':
    case 'expel':
      if (normal.length === 0) return '에너미 없음';
      break;
  }
  return null;
}

/** 덱 정비는 본부 칸에서, 주사위 전이나 턴을 끝내기 전에만 */
export function canEditDeck(s: GameState, p: Player): boolean {
  return p.tile === s.board.baseTile && (s.phase.kind === 'preRoll' || s.phase.kind === 'endTurn');
}

// 게임 밖 기록 규칙: 인연 랭크 · 선생님 레벨 · 판 기록. 재화는 없다.

import type { CharacterId, GameState } from '../engine/types';
import type { Account } from './account';

// ───────── 인연 ─────────

export const MAX_BOND = 20;

/** 인연 랭크 r → r+1에 필요한 호감도 */
export function bondStep(rank: number): number {
  return 15 + rank * 15;
}

/** 호감도 → 인연 랭크 (1부터) · 이번 랭크에서 모은 양 · 다음까지 필요한 양 */
export function bondRank(affection: number): { rank: number; into: number; need: number } {
  let rank = 1;
  let left = affection;
  while (rank < MAX_BOND && left >= bondStep(rank)) {
    left -= bondStep(rank);
    rank += 1;
  }
  return { rank, into: rank >= MAX_BOND ? 0 : left, need: rank >= MAX_BOND ? 0 : bondStep(rank) };
}

// ───────── 선생님 레벨 ─────────

/** 경험치 → 레벨 (레벨 n → n+1에 100 × n) */
export function teacherLevel(exp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = exp;
  while (left >= level * 100) {
    left -= level * 100;
    level += 1;
  }
  return { level, into: left, need: level * 100 };
}

// ───────── 한 판의 기록 ─────────

export interface MatchRewards {
  victory: boolean;
  exp: number;
  /** 처음 처치한 보스 · 난이도 */
  firstClear: boolean;
  /** 자리별 호감도 (같은 캐릭터를 여럿이 쓰면 합친다) */
  affection: { player: number; character: CharacterId; amount: number }[];
  mvp: number | null;
}

/** 끝난 판의 경험치 · 호감도 (계정은 바꾸지 않는다) */
export function matchRewards(s: GameState, acc: Account): MatchRewards {
  const victory = s.phase.kind === 'gameOver' && s.phase.result === 'victory';
  const firstClear = victory && !(acc.records[s.boss.id]?.[s.difficulty]?.clears ?? 0);
  // MVP: 보스 피해가 가장 큰 사람 (2인 이상, 보스 피해가 있을 때만)
  const top = s.stats.reduce((best, x, i) => (x.bossDamage > s.stats[best].bossDamage ? i : best), 0);
  const mvp = s.stats.length > 1 && s.stats[top].bossDamage > 0 ? top : null;
  return {
    victory,
    exp: victory ? 120 : 50,
    firstClear,
    affection: s.players.map((p, i) => ({
      player: i,
      character: p.character,
      amount: (victory ? 30 : 15) + (mvp === i ? 10 : 0),
    })),
    mvp,
  };
}

/** 경험치 · 호감도 · 기록을 계정에 넣는다 */
export function applyMatch(acc: Account, s: GameState, r: MatchRewards) {
  acc.exp += r.exp;
  for (const a of r.affection) acc.students[a.character].affection += a.amount;
  const rec = ((acc.records[s.boss.id] ??= {})[s.difficulty] ??= { clears: 0, bestRound: null, tries: 0 });
  rec.tries += 1;
  if (r.victory) {
    rec.clears += 1;
    rec.bestRound = rec.bestRound === null ? s.round : Math.min(rec.bestRound, s.round);
  }
  const t = acc.totals;
  t.games += 1;
  if (r.victory) t.wins += 1;
  for (const x of s.stats) {
    t.kills += x.kills;
    t.bossDamage += x.bossDamage;
    t.cards += x.cardsUsed;
    t.breaks += x.breaks;
  }
}

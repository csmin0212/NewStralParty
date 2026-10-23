import { CARDS, type BattleBonus } from '../data/cards';
import { enemyDefAgainst, evadeDice } from '../engine/skills';
import { statusAtk, statusDef } from '../engine/cards';
import { markBonus, relicAttack } from '../engine/relics';
import type { CardId, Enemy, GameState, Player } from '../engine/types';

/** 원작처럼 카드를 내기 전에 보여 주는 예상 범위 */
export interface Preview {
  /** 내 쪽 값 (공격값 또는 방어값) 범위 */
  mine: { label: string; range: [number, number] } | null;
  /** 상대 쪽 값 */
  theirs: { label: string; text: string };
  /** 결과 줄: 예상 피해 · 명중 · 회피 확률 */
  result: string[];
}

/** n개 굴려 높은 눈을 쓸 때, 그 눈이 r 이하일 확률 */
const atMost = (r: number, n: number) => (Math.max(0, Math.min(6, r)) / 6) ** n;

/** n개 굴린 높은 눈의 분포 [눈, 확률] */
function bestOf(n: number): [number, number][] {
  return [1, 2, 3, 4, 5, 6].map((r) => [r, atMost(r, n) - atMost(r - 1, n)]);
}

/** 주사위 2개 합의 분포 [합, 확률] (액셀) */
function sumOfTwo(): [number, number][] {
  return Array.from({ length: 11 }, (_, i) => [i + 2, (6 - Math.abs(i + 2 - 7)) / 36]);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const span = ([a, b]: [number, number]) => (a === b ? `${a}` : `${a}~${b}`);

function extra(card: CardId | null): BattleBonus {
  return (card && CARDS[card].battle) || {};
}

/** 공격할 때: 내 공격값 범위 vs 적 방어 · 회피 → 예상 피해 / 명중률 */
export function attackPreview(s: GameState, p: Player, enemy: Enemy, card: CardId | null): Preview {
  const b = s.turn.battle;
  const e = extra(card);
  const mult = e.mult ?? b.atkMult;
  const baseAtk = p.atk + statusAtk(p) + b.atk + relicAttack(p, enemy);
  const [lo, hi] = e.atk ?? [0, 0];
  const atkLo = Math.floor((baseAtk + lo) * mult);
  const atkHi = Math.floor((baseAtk + hi) * mult);
  const dice = b.attackDice + (e.attackDice ?? 0);
  const sum = b.sumDice || !!e.sumDice;
  const mine: [number, number] = sum ? [atkLo + 2, atkHi + 12] : [atkLo + 1, atkHi + 6];
  const result: string[] = [];

  if (enemy.defense === 'block') {
    const def = enemyDefAgainst(s, p, enemy);
    const mark = markBonus(enemy);
    const dmg: [number, number] = [Math.max(1, mine[0] - (def + 6)) + mark, Math.max(1, mine[1] - (def + 1)) + mark];
    result.push(`예상 피해 <b>${span(dmg)}</b>`);
    return { mine: { label: '내 공격', range: mine }, theirs: { label: '적 방어', text: span([def + 1, def + 6]) }, result };
  }
  // 회피형: 적 주사위가 내 공격 주사위보다 크거나 6이면 빗나간다
  const rolls = sum ? sumOfTwo() : bestOf(dice);
  const hit = rolls.reduce((acc, [r, pr]) => acc + pr * atMost(Math.min(r, 5), 1), 0);
  result.push(`명중 <b>${pct(hit)}</b>`, `피해 <b>${span(mine)}</b>`);
  return { mine: { label: '내 공격', range: mine }, theirs: { label: '적 회피', text: '주사위' }, result };
}

/** 반격을 받을 때: 적이 이미 굴린 공격값을 보고 방어 · 회피 결과를 미리 본다 */
export function defendPreview(s: GameState, p: Player, enemy: Enemy, attackRoll: number, card: CardId | null): Preview {
  const b = s.turn.battle;
  const e = extra(card);
  const value = attackRoll + enemy.atk;
  const def = p.def + statusDef(p) + b.def;
  const [lo, hi] = e.def ?? [0, 0];
  const block: [number, number] = [def + lo + 1, def + hi + 6];
  const taken: [number, number] = [Math.max(1, value - block[1]), Math.max(1, value - block[0])];
  const dice = evadeDice(p) + b.evadeDice + (e.evadeDice ?? 0);
  // 내 주사위가 상대 눈보다 크거나 6이면 회피
  const evade = 1 - atMost(Math.min(attackRoll, 5), dice);
  const result = e.escape
    ? ['반격을 받지 않는다']
    : [`방어하면 <b>${span(taken)}</b> 피해`, `회피 <b>${pct(evade)}</b> · 실패하면 <b>${value}</b>`];
  return { mine: { label: '내 방어', range: block }, theirs: { label: '적 공격', text: `${value}` }, result };
}

export function previewHtml(pv: Preview): string {
  return `
    <div class="bp-side bp-mine"><small>${pv.mine?.label ?? ''}</small><b>${pv.mine ? span(pv.mine.range) : ''}</b></div>
    <em class="bp-vs">VS</em>
    <div class="bp-side bp-theirs"><small>${pv.theirs.label}</small><b>${pv.theirs.text}</b></div>
    <div class="bp-result">${pv.result.map((r) => `<span>${r}</span>`).join('')}</div>`;
}

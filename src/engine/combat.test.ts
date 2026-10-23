import { describe, expect, it } from 'vitest';
import { resolveAttack } from './combat';
import { createRng, type Rng } from './rng';

/** d6가 정해진 순서로 나오는 가짜 RNG */
function fixedDice(...rolls: number[]): Rng {
  const queue = [...rolls];
  return { ...createRng(0), d6: () => queue.shift()! };
}

const fighter = (atk: number, def: number) => ({ atk, def });

describe('resolveAttack', () => {
  it('방어: 피해 = (공격력 + 주사위) - (방어력 + 주사위), 최소 1', () => {
    // 공격력 2 + 주사위 3 = 5 vs 방어력 0 + 주사위 4 = 4 → 1 피해
    expect(resolveAttack(fighter(2, 0), fighter(0, 0), 'block', fixedDice(3, 4)).damage).toBe(1);
    // 5 vs 5 → 0이지만 최소 1
    expect(resolveAttack(fighter(2, 0), fighter(0, 0), 'block', fixedDice(3, 5)).damage).toBe(1);
    expect(resolveAttack(fighter(2, 0), fighter(0, 1), 'block', fixedDice(5, 2)).damage).toBe(4);
  });

  it('회피: 상대 공격 주사위 눈보다 크면 0, 아니면 공격값 전부 (공격력은 비교에 안 들어간다)', () => {
    // 공격력 2 + 주사위 3 → 4 · 5 · 6이면 회피
    expect(resolveAttack(fighter(2, 0), fighter(0, 0), 'evade', fixedDice(3, 4)).damage).toBe(0);
    expect(resolveAttack(fighter(2, 0), fighter(0, 0), 'evade', fixedDice(3, 3)).damage).toBe(5);
    expect(resolveAttack(fighter(2, 0), fighter(0, 0), 'evade', fixedDice(3, 1)).damage).toBe(5);
  });

  it('회피: 6은 상대가 6이어도 피한다 (원작), 5는 5를 못 피한다', () => {
    expect(resolveAttack(fighter(2, 0), fighter(0, 0), 'evade', fixedDice(6, 6)).damage).toBe(0);
    expect(resolveAttack(fighter(2, 0), fighter(0, 0), 'evade', fixedDice(5, 5)).damage).toBe(7);
  });

  it('회피 주사위를 여러 개 굴리면 가장 높은 눈을 쓴다', () => {
    const r = resolveAttack(fighter(2, 0), fighter(0, 0), 'evade', fixedDice(3, 2, 5), 2);
    expect(r.defenseRolls).toEqual([2, 5]);
    expect(r.defenseRoll).toBe(5);
    expect(r.damage).toBe(0);
  });
});

describe('createRng', () => {
  it('같은 시드면 같은 수열, d6는 1~6', () => {
    const a = createRng(123);
    const b = createRng(123);
    const rolls = Array.from({ length: 200 }, () => a.d6());
    expect(rolls).toEqual(Array.from({ length: 200 }, () => b.d6()));
    expect(new Set(rolls)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });
});

import { describe, expect, it } from 'vitest';
import { resolveAttack } from './combat';
import { createRng, type Rng } from './rng';

/** d6가 정해진 순서로 나오는 가짜 RNG */
function fixedDice(...rolls: number[]): Rng {
  const queue = [...rolls];
  return { ...createRng(0), d6: () => queue.shift()! };
}

const fighter = (atk: number, def: number, eva: number) => ({ atk, def, eva });

describe('resolveAttack', () => {
  it('방어: 피해 = 공격값 - 방어값, 최소 1', () => {
    expect(resolveAttack(fighter(2, 0, 0), fighter(0, 1, 0), 'block', fixedDice(5, 2)).damage).toBe(4);
    expect(resolveAttack(fighter(0, 0, 0), fighter(0, 3, 0), 'block', fixedDice(1, 6)).damage).toBe(1);
  });

  it('회피: 회피값이 공격값보다 크면 0, 아니면 공격값 그대로', () => {
    expect(resolveAttack(fighter(1, 0, 0), fighter(0, 0, 2), 'evade', fixedDice(3, 3)).damage).toBe(0);
    expect(resolveAttack(fighter(1, 0, 0), fighter(0, 0, 1), 'evade', fixedDice(3, 3)).damage).toBe(4);
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

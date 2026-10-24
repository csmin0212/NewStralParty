import type { Rng } from './rng';
import type { AttackResult, DefenseMode } from './types';

export interface Fighter {
  atk: number;
  def: number;
}

/**
 * 공격 1회 판정.
 * - 공격값: 공격력 + 주사위
 * - 방어: 피해 = max(1, 공격값 - (방어력 + 주사위))
 * - 회피: 내 주사위 > 상대 공격 주사위(공격력 빼고 눈만)이거나 내 주사위가 6이면 피해 0, 아니면 공격값 그대로
 *   (원작처럼 6은 상대가 6이어도 피한다)
 *   예) 공격력 2 + 주사위 3 → 4 · 5 · 6이 나오면 회피 성공
 * evadeDice: 회피할 때 굴릴 주사위 수. 여러 개면 가장 높은 눈을 쓴다 (뭇별 액티브)
 * opts.attackDice: 공격 주사위 수, 높은 눈을 쓴다. opts.sumDice면 더한다 (액셀)
 * opts.attackRoll: 이미 굴려 둔 공격 주사위 (반격은 에너미가 먼저 굴린다)
 */
export function resolveAttack(
  attacker: Fighter,
  defender: Fighter,
  mode: DefenseMode,
  rng: Rng,
  evadeDice = 1,
  opts: { attackDice?: number; sumDice?: boolean; attackRoll?: number; defenseRoll?: number } = {},
): AttackResult {
  const rolls = () => Array.from({ length: Math.max(1, opts.attackDice ?? 1) }, () => rng.d6());
  const attackRoll =
    opts.attackRoll ?? (opts.sumDice ? rolls().reduce((a, b) => a + b, 0) : Math.max(...rolls()));
  const attackValue = attackRoll + attacker.atk;

  if (mode === 'block') {
    const defenseRoll = opts.defenseRoll ?? rng.d6();
    const defenseValue = defenseRoll + defender.def;
    return {
      mode,
      attackRoll,
      attackValue,
      defenseRoll,
      defenseRolls: [defenseRoll],
      defenseValue,
      damage: Math.max(1, attackValue - defenseValue),
    };
  }

  const defenseRolls = Array.from({ length: Math.max(1, evadeDice) }, () => rng.d6());
  const defenseRoll = Math.max(...defenseRolls);
  return {
    mode,
    attackRoll,
    attackValue,
    defenseRoll,
    defenseRolls,
    defenseValue: defenseRoll,
    damage: defenseRoll > attackRoll || defenseRoll === 6 ? 0 : attackValue,
  };
}

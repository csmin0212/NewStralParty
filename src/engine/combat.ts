import type { Rng } from './rng';

export interface Fighter {
  atk: number;
  def: number;
  eva: number;
}

export type DefenseMode = 'block' | 'evade';

export interface AttackResult {
  mode: DefenseMode;
  attackRoll: number;
  attackValue: number;
  defenseRoll: number;
  defenseValue: number;
  damage: number;
}

/**
 * 공격 1회 판정.
 * - 공격값: d6 + ATK
 * - 방어: 피해 = max(1, 공격값 - (d6 + DEF))
 * - 회피: d6 + EVA > 공격값 이면 피해 0, 아니면 공격값 그대로
 */
export function resolveAttack(
  attacker: Fighter,
  defender: Fighter,
  mode: DefenseMode,
  rng: Rng,
): AttackResult {
  const attackRoll = rng.d6();
  const attackValue = attackRoll + attacker.atk;
  const defenseRoll = rng.d6();

  if (mode === 'block') {
    const defenseValue = defenseRoll + defender.def;
    return {
      mode,
      attackRoll,
      attackValue,
      defenseRoll,
      defenseValue,
      damage: Math.max(1, attackValue - defenseValue),
    };
  }

  const defenseValue = defenseRoll + defender.eva;
  return {
    mode,
    attackRoll,
    attackValue,
    defenseRoll,
    defenseValue,
    damage: defenseValue > attackValue ? 0 : attackValue,
  };
}

// 캐릭터 스킬 효과. 캐릭터가 늘어나면 여기에 id별로 추가한다.
// 문구 · 수치는 data/characters.ts, 상태 변화(피해 · 처치 · 보상)는 game.ts가 맡는다.

import { CHARACTERS } from '../data/characters';
import { distances, handLimit, targetable } from './cards';
import { hasRelic } from './relics';
import type { Enemy, GameState, Player } from './types';

/** Soda 연마: 스택 몇 개당 방어력 -1 */
export const POLISH_PER_DEF = 2;

function addStack(p: Player): boolean {
  const max = CHARACTERS[p.character].stack?.max ?? 0;
  if (p.stacks >= max) return false;
  p.stacks += 1;
  return true;
}

/** 액티브 스킬을 쓴다. 재사용 대기시간을 걸고 효과를 켠다 */
export function activateSkill(s: GameState, p: Player) {
  // 보조 배터리: 재사용 대기 -1
  p.skillCooldown = Math.max(0, CHARACTERS[p.character].active.cooldown - (hasRelic(p, 'battery') ? 1 : 0));
  switch (p.character) {
    case 'mutbyeol':
      // 1라운드 동안 = 다음 자기 차례가 시작될 때까지
      p.skillActiveUntil = s.round + 1;
      break;
    case 'soda': // 조나단 러시: 워프 · 전투는 game.ts
    case 'mona': // 역조공: 카드 주기 · 뽑기는 game.ts
      break;
  }
}

/** 대상을 골라야 하는 액티브의 대상 (에너미 id 또는 아군 id). 대상이 필요 없는 스킬은 null */
export function skillTargets(s: GameState, p: Player): number[] | null {
  const { target, range } = CHARACTERS[p.character].active;
  if (!target || range === undefined) return null;
  const dist = distances(s.board, p.tile);
  const near = (tile: number) => (dist.get(tile) ?? Infinity) <= range;
  if (target === 'enemy') return s.enemies.filter((e) => targetable(s, e) && near(e.tile)).map((e) => e.id);
  // 모나 역조공: 손패에 자리가 있는 다른 아군
  return s.players
    .filter((o) => o.id !== p.id && !o.ko && near(o.tile) && o.hand.length < handLimit(o))
    .map((o) => o.id);
}

/** 이 플레이어와 싸울 때 에너미의 방어력 (Soda: 연마 · 조나단 러시로 깎인다). 그로기인 보스는 0 */
export function enemyDefAgainst(s: GameState, p: Player, enemy: Enemy): number {
  if (enemy.isBoss && s.bossState.groggy > 0) return 0;
  let down = s.turn.battle.enemyDefDown;
  if (p.character === 'soda') down += Math.floor(p.stacks / POLISH_PER_DEF);
  return Math.max(0, enemy.def + bossDefBonus(s, enemy) - down);
}

/** 보스 규칙으로 오르는 방어력: 지켜 주는 미니언 (호드 필러) · 꺼진 난로 (게부라) */
export function bossDefBonus(s: GameState, enemy: Enemy): number {
  if (!enemy.isBoss) return 0;
  const passive = s.boss.passive;
  let bonus = 0;
  if (passive?.guard) bonus += passive.guard.def * s.enemies.filter((e) => e.kind === passive.guard!.kind).length;
  if (passive?.heater && s.bossState.heater === 0) bonus += 2;
  return bonus;
}

/** 보스가 실제로 받는 피해: 성유물 +vuln · 그로기 +1 · 방패 부위(초록) 절반 */
export function bossDamageTaken(s: GameState, amount: number): number {
  if (amount <= 0) return 0;
  const st = s.bossState;
  let dmg = amount + st.vuln + (st.groggy > 0 ? 1 : 0);
  const partId = st.parts.length ? st.parts[st.part % st.parts.length] : null;
  if (partId === 'green') dmg = Math.ceil(dmg / 2);
  return dmg;
}

/** 에너미를 쓰러뜨렸을 때 오르는 캐릭터 스택. 올랐으면 true (Soda 연마: 방어력 0인 적) */
export function onEnemyDefeated(p: Player, enemyDef: number): boolean {
  if (p.character !== 'soda' || enemyDef > 0) return false;
  return addStack(p);
}

/** 모나가 준 카드를 아군이 썼다: 팬 +1. 올랐으면 true */
export function onGiftUsed(giver: Player, user: Player): boolean {
  if (giver.character !== 'mona' || giver.id === user.id) return false;
  return addStack(giver);
}

/** 모나가 준 효과 카드의 추가 피해 = 팬 */
export function giftDamageBonus(giver: Player | undefined): number {
  return giver?.character === 'mona' ? giver.stacks : 0;
}

/** 회피할 때 굴릴 주사위 수 (높은 눈을 고른다) */
export function evadeDice(p: Player): number {
  if (p.character === 'mutbyeol' && p.skillActiveUntil !== null) return 2;
  return 1;
}

/** 회피에 성공했을 때 발동하는 효과 */
export interface EvadeEffects {
  /** 액티브 재사용 대기시간 감소량 (패시브) */
  cooldownCut: number;
  /** 공격한 몬스터에게 주는 피해 (잠재 능력) */
  counterDamage: number;
}

export function onEvadeSuccess(p: Player): EvadeEffects {
  switch (p.character) {
    case 'mutbyeol':
      return {
        cooldownCut: 1, // 패시브: 기대값이 높다니까?
        counterDamage: p.potential ? p.atk : 0, // 잠재 능력: 공격력만큼 피해
      };
    default:
      return { cooldownCut: 0, counterDamage: 0 };
  }
}

// 캐릭터 스킬 효과. 캐릭터가 늘어나면 여기에 id별로 추가한다.
// 문구 · 수치는 data/characters.ts, 상태 변화(피해 · 처치 · 보상)는 game.ts가 맡는다.

import { CHARACTERS } from '../data/characters';
import type { GameState, Player } from './types';

/** 액티브 스킬을 쓴다. 재사용 대기시간을 걸고 효과를 켠다 */
export function activateSkill(s: GameState, p: Player) {
  p.skillCooldown = CHARACTERS[p.character].active.cooldown;
  switch (p.character) {
    case 'mutbyeol':
      // 1라운드 동안 = 다음 자기 차례가 시작될 때까지
      p.skillActiveUntil = s.round + 1;
      break;
  }
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
  }
}

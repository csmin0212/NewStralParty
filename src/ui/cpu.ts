// CPU 자리: 사람 대신 행동을 고른다 (아스트랄 파티 인공지능 자리). 규칙은 엔진이 검사하니 여기서는 고르기만 한다.

import { CARDS } from '../data/cards';
import { RELICS } from '../data/relics';
import { bossEnemy } from '../engine/boss';
import { cardBlocker, cardTargets, distances, handLimit } from '../engine/cards';
import { applyAction, currentPlayer, RuleError } from '../engine/game';
import type { Action, GameState, Player } from '../engine/types';

/** 이 행동이 지금 통하는지 */
function ok(s: GameState, a: Action): boolean {
  try {
    applyAction(s, a);
    return true;
  } catch (e) {
    if (e instanceof RuleError) return false;
    throw e;
  }
}

/** 가고 싶은 칸: 위급하면 회복 · 표식, 아니면 연결된 미니언 · 보스 */
function goal(s: GameState, p: Player): number {
  const st = s.bossState;
  if (p.hp <= 3) {
    const heal = s.board.tiles.find((t) => t.kind === 'heal');
    if (heal) return heal.id;
  }
  const mark = s.marks.find(
    (m) =>
      (m.kind === 'heater' && st.heater <= 3) ||
      (m.kind === 'organ' && st.organ === 'boss' && st.intent?.move === 'chant') ||
      m.kind === 'relicGreen' ||
      m.kind === 'relicRed' ||
      m.kind === 'bomb',
  );
  if (mark) return mark.tile;
  const boss = bossEnemy(s);
  const target = s.enemies.find((e) => !e.isBoss && ['perorominion', 'myoukiPiece', 'missile', 'automaton', 'pillar'].includes(e.kind));
  return (target ?? (boss && !st.hidden ? boss : undefined))?.tile ?? p.home;
}

/** 지금 CPU가 할 행동 하나 */
export function cpuAction(s: GameState): Action {
  const p = currentPlayer(s);
  const me = p.id;
  if (p.relicOffer) {
    // 높은 등급, 가진 키워드, 공격 · 생존 순
    const held = new Set(p.relics.map((id) => RELICS[id].keyword).filter(Boolean));
    const score = (id: keyof typeof RELICS) => {
      const r = RELICS[id];
      return (r.rarity === 'gold' ? 30 : r.rarity === 'purple' ? 15 : 0) + (r.keyword && held.has(r.keyword) ? 10 : 0) + (r.pool === 'attack' ? 5 : r.pool === 'sustain' && p.hp <= 4 ? 8 : 0);
    };
    const relic = [...p.relicOffer.ids].sort((a, b) => score(b) - score(a))[0];
    return { type: 'PICK_RELIC', player: me, relic };
  }
  switch (s.phase.kind) {
    case 'preRoll': {
      // 쓸 수 있는 주사위 전 카드 하나 (대상이 있으면 보스 우선)
      const boss = bossEnemy(s);
      for (let i = 0; i < p.hand.length; i++) {
        const card = p.hand[i].card;
        if (CARDS[card].type === 'battle' || cardBlocker(s, p, p.hand[i])) continue;
        if ((card === 'cookie' || card === 'cake' || card === 'bandage' || card === 'pudding') && p.hp >= p.maxHp - 1) continue;
        const targets = cardTargets(s, p, card);
        const target = targets ? (boss && targets.includes(boss.id) ? boss.id : targets[0]) : undefined;
        const a: Action = { type: 'PLAY_CARD', player: me, handIndex: i, target, value: 6 };
        if (ok(s, a)) return a;
      }
      return { type: 'ROLL', player: me };
    }
    case 'choosePath': {
      const dist = distances(s.board, goal(s, p));
      const to = [...s.phase.options].sort((a, b) => (dist.get(a) ?? 99) - (dist.get(b) ?? 99))[0];
      return { type: 'CHOOSE_PATH', player: me, to };
    }
    case 'encounter': {
      const enemy = s.enemies.find((e) => e.id === (s.phase as { enemy: number }).enemy)!;
      // 공격 카드 하나 (코스트가 되면)
      const i = p.hand.findIndex((h) => CARDS[h.card].timing === 'attack' && !cardBlocker(s, p, h));
      if (i >= 0 && ok(s, { type: 'PLAY_CARD', player: me, handIndex: i })) return { type: 'PLAY_CARD', player: me, handIndex: i };
      const risky = enemy.counter && !enemy.isBoss && p.hp <= enemy.atk + 3;
      return { type: 'ENCOUNTER', player: me, choice: risky ? 'release' : 'attack' };
    }
    case 'defend': {
      const roll = s.phase.attackRoll;
      const i = p.hand.findIndex((h) => CARDS[h.card].timing === 'defend' && !cardBlocker(s, p, h));
      if (i >= 0 && roll >= 4 && ok(s, { type: 'PLAY_CARD', player: me, handIndex: i })) return { type: 'PLAY_CARD', player: me, handIndex: i };
      // 상대 눈이 낮으면 회피가 유리하다
      return { type: 'DEFEND', player: me, mode: roll <= 3 ? 'evade' : 'block' };
    }
    case 'shop': {
      const shop = s.phase;
      if (p.coins >= 30 && ok(s, { type: 'BUY_RELIC', player: me })) return { type: 'BUY_RELIC', player: me };
      if (p.hand.length < handLimit(p)) {
        const offer = shop.offers.findIndex((o) => !o.sold && (shop.free || p.coins - o.price >= 15));
        if (offer >= 0 && ok(s, { type: 'BUY_CARD', player: me, offer })) return { type: 'BUY_CARD', player: me, offer };
      }
      return { type: 'LEAVE_SHOP', player: me };
    }
    default:
      return { type: 'END_TURN', player: me };
  }
}

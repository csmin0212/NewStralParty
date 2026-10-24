// CPU 자리: 사람 대신 행동을 고른다 (아스트랄 파티 인공지능 자리). 규칙은 엔진이 검사하니 여기서는 고르기만 한다.

import { CARDS } from '../data/cards';
import { RELICS } from '../data/relics';
import { bossEnemy } from '../engine/boss';
import { CHARACTERS } from '../data/characters';
import { skillTargets } from '../engine/skills';
import { skillCardOk, skillCards } from '../engine/kits';
import { cardBlocker, cardTargets, distances, handLimit } from '../engine/cards';
import { applyAction, currentPlayer, relicPrice, RuleError } from '../engine/game';
import { RULES } from '../engine/rules';
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

/** 원작 맵에서 먼저 잡을 몬스터 (맵 진행 · 보스 약화) */
const KEY_MONSTERS: string[] = ['jellyFighter', 'synth1', 'synth2', 'synth3', 'loudmouth', 'trainee', 'waiter', 'elitePirate', 'swordSpirit', 'spearSpirit'];

/** 원작 맵 카드 대상: 개조 치료는 개조된 아군 · 그놈 탓이야!는 체력이 가장 높은 아군. 쓰지 않을 카드면 null */
function apCardTarget(s: GameState, p: Player, card: string, targets: number[] | null): number | undefined | null {
  const allies = s.players.filter((o) => !o.ko);
  if (card === 'supportGum' || card === 'smartGummy') {
    const sick = allies.filter((o) => o.ap?.overclock).sort((a, b) => (a.ap!.overclock ?? 0) - (b.ap!.overclock ?? 0))[0];
    if (sick) return sick.id;
    if (card === 'supportGum' && p.hp <= p.maxHp - 2) return p.id;
    return null;
  }
  if (card === 'energyBar') return null;
  if (card === 'feather' && p.hp > p.maxHp - 3) return null;
  if (card === 'hisFault') return targets?.slice().sort((a, b) => s.players[b].hp - s.players[a].hp)[0];
  return undefined;
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
  // 원작 맵: 알 · 호리병을 줍고 과제 몬스터부터
  if (s.ap) {
    const pick = s.marks.find((m) => m.kind === 'egg' || m.kind === 'gourd');
    if (pick) return pick.tile;
    const key = s.enemies.find((e) => !e.isBoss && KEY_MONSTERS.includes(e.kind));
    if (key) return key.tile;
  }
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
      const skill = skillAction(s, p);
      if (skill) return skill;
      // 쓸 수 있는 주사위 전 카드 하나 (대상이 있으면 보스 우선)
      const boss = bossEnemy(s);
      for (let i = 0; i < p.hand.length; i++) {
        const card = p.hand[i].card;
        if (CARDS[card].type === 'battle' || cardBlocker(s, p, p.hand[i])) continue;
        if ((card === 'cookie' || card === 'cake' || card === 'bandage' || card === 'pudding') && p.hp >= p.maxHp - 1) continue;
        const targets = cardTargets(s, p, card);
        const special = apCardTarget(s, p, card, targets);
        if (special === null) continue;
        const target = special ?? (targets ? (boss && targets.includes(boss.id) ? boss.id : targets[0]) : undefined);
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
    case 'eventPick':
      return { type: 'PICK_EVENT', player: me, event: s.phase.options[0] };
    case 'mapChoice':
      return { type: 'MAP_CHOICE', player: me, choice: s.phase.options[0].id };
        case 'stopChoice': {
      // 성을 올릴 수 있거나 체력이 깎였으면 멈춘다
      const cost = RULES.levelUpCost[p.level];
      const stop = (cost !== undefined && p.coins >= cost) || p.hp <= p.maxHp - 2;
      return { type: 'STOP_HERE', player: me, stop };
    }
    case 'shop': {
      const shop = s.phase;
      if (shop.chips) {
        // 성 오름 돈은 남기고 산다
        const keep = RULES.levelUpCost[p.level] ?? 0;
        if (p.coins - relicPrice(p) >= Math.min(keep, 10) && ok(s, { type: 'BUY_RELIC', player: me })) return { type: 'BUY_RELIC', player: me };
        return { type: 'LEAVE_SHOP', player: me };
      }
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

/** 액티브 스킬: 쓸 수 있으면 쓴다 (대상은 보스 · 체력이 가장 낮은 아군 우선) */
function skillAction(s: GameState, p: Player): Action | null {
  if (s.turn.skillUsed || p.skillCooldown > 0) return null;
  const def = CHARACTERS[p.character].active;
  const targets = skillTargets(s, p);
  if (targets && targets.length === 0) return null;
  let target: number | undefined;
  if (targets) {
    if (def.target === 'enemy') {
      const boss = bossEnemy(s);
      target = boss && targets.includes(boss.id) ? boss.id : targets[0];
    } else {
      target = [...targets].sort((a, b) => s.players[a].hp / s.players[a].maxHp - s.players[b].hp / s.players[b].maxHp)[0];
    }
  }
  const range = skillCards(p);
  const cards = range ? p.hand.map((h, i) => (skillCardOk(p, h.card) ? i : -1)).filter((i) => i >= 0).slice(0, range[1]) : undefined;
  if (range && (cards?.length ?? 0) < range[0]) return null;
  const value = def.value ? def.value[1] : undefined;
  const a: Action = { type: 'USE_SKILL', player: p.id, target, cards, value };
  return ok(s, a) ? a : null;
}

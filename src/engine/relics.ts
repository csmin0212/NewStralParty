// 유물 규칙 (아스트랄 파티 강화 칩). 데이터 · 글: data/relics.ts
// 얻기 · 고르기 · 다시 뽑기와, 게임 곳곳에서 부르는 효과 (onXxx)를 여기 모은다.

import { CHARACTERS } from '../data/characters';
import {
  ENERGY_MAX,
  KEYWORD_WEIGHT,
  RARITY_ODDS,
  RELIC_IDS,
  RELICS,
  type RelicId,
  type RelicKeyword,
  type RelicPool,
  type RelicRarity,
} from '../data/relics';
import { distances, targetable } from './cards';
import { drawCards, heal, log, notice, strikeEnemy } from './game';
import type { Rng } from './rng';
import type { CharacterId, Enemy, GameState, MapRes, Player } from './types';
import { MAP_RES_INFO } from '../data/board';
import { kitEffectCard, kitHealLost, kitKill, kitTurnEnd, kitTurnStart } from './kits';

export function hasRelic(p: Player, id: RelicId): boolean {
  return p.relics?.includes(id) ?? false;
}

/** 키워드 (가진 유물 기준) */
export function heldKeywords(p: Player): Set<RelicKeyword> {
  const out = new Set<RelicKeyword>();
  for (const id of p.relics) {
    const k = RELICS[id].keyword;
    if (k) out.add(k);
  }
  return out;
}

/** 캐릭터 성향 무게 (원작 Character Chip Classes, 기본 15) */
const CLASS_WEIGHTS: Partial<Record<CharacterId, Partial<Record<RelicPool, number>>>> = {
  mutbyeol: { attack: 100 },
  soda: { attack: 100 },
  mona: { support: 80, cards: 30 },
};

function classWeight(c: CharacterId, pool: RelicPool): number {
  return CLASS_WEIGHTS[c]?.[pool] ?? 15;
}

function pickWeighted<T>(rng: Rng, items: T[], weight: (x: T) => number): T | undefined {
  const total = items.reduce((a, x) => a + weight(x), 0);
  if (total <= 0) return items[0];
  let roll = rng.next() * total;
  for (const x of items) {
    roll -= weight(x);
    if (roll < 0) return x;
  }
  return items[items.length - 1];
}

/**
 * 유물 후보 3개. tier: 확률표의 줄 (성 0~3 · 임무 등급).
 * 맨 왼쪽은 캐릭터 성향 묶음에서, 가진 키워드는 더 잘 나오고, 키워드가 둘이면 나머지 키워드는 빠진다.
 */
export function rollOffer(s: GameState, rng: Rng, p: Player, tier: number): RelicId[] {
  const odds = (s.difficulty === 'normal' ? RARITY_ODDS.normal : RARITY_ODDS.hard)[Math.max(0, Math.min(3, tier))];
  const held = heldKeywords(p);
  const mapId = s.board.id ?? 'campus';
  const allowed = (id: RelicId) => {
    const info = RELICS[id];
    if (p.relics.includes(id)) return false;
    if (info.map && info.map !== mapId && info.map !== s.boss.map) return false;
    if (info.keyword && held.size >= 2 && !held.has(info.keyword)) return false;
    return true;
  };
  const weight = (id: RelicId) => (RELICS[id].keyword && held.has(RELICS[id].keyword!) ? KEYWORD_WEIGHT : 1);
  const out: RelicId[] = [];
  for (let slot = 0; slot < 3; slot++) {
    const rarity = pickWeighted<RelicRarity>(rng, ['blue', 'purple', 'gold'], (r) => odds[['blue', 'purple', 'gold'].indexOf(r)])!;
    let pool = RELIC_IDS.filter((id) => allowed(id) && !out.includes(id) && RELICS[id].rarity === rarity);
    if (pool.length === 0) pool = RELIC_IDS.filter((id) => allowed(id) && !out.includes(id));
    if (pool.length === 0) break;
    if (slot === 0) {
      const pools: RelicPool[] = ['support', 'sustain', 'attack', 'cards'];
      const chosen = pickWeighted(rng, pools, (x) => classWeight(p.character, x))!;
      const leaning = pool.filter((id) => RELICS[id].pool === chosen);
      if (leaning.length) pool = leaning;
    }
    out.push(pickWeighted(rng, pool, weight)!);
  }
  return out;
}

/** 고를 유물 후보를 띄운다. 이미 고르는 중이면 다음 차례로 미룬다 */
export function offerRelic(s: GameState, rng: Rng, p: Player, tier: number, why: string) {
  if (p.relicOffer) {
    p.relicQueue.push(tier);
    return;
  }
  const ids = rollOffer(s, rng, p, tier);
  if (ids.length === 0) return;
  p.relicOffer = { ids, tier };
  log(s, `${p.name}: 🔷 유물 고르기 (${why})`);
}

/** 다시 뽑기 (무한 순환) */
export function rerollRelic(s: GameState, rng: Rng, p: Player) {
  if (!p.relicOffer || (p.relicVars.rerolls ?? 0) <= 0) return false;
  p.relicVars.rerolls -= 1;
  p.relicOffer = { ids: rollOffer(s, rng, p, p.relicOffer.tier), tier: p.relicOffer.tier };
  return true;
}

/** 유물을 얻는다: 바로 오르는 능력치 · 스택 */
export function gainRelic(s: GameState, rng: Rng, p: Player, id: RelicId) {
  p.relics.push(id);
  const v = p.relicVars;
  switch (id) {
    case 'gloves1': p.atk += 1; break;
    case 'gloves2': p.atk += 2; break;
    case 'gloves3': p.atk += 5; break;
    case 'skates1': p.move += 1; break;
    case 'skates2': p.move += 2; break;
    case 'skates3': p.move += 4; break;
    case 'cookie1': p.maxHp += 2; p.hp += 2; break;
    case 'cookie2': p.maxHp += 3; p.hp += 3; break;
    case 'cookie3': p.maxHp += 3; p.hp += 3; break;
    case 'helmet1': p.def += 1; break;
    case 'helmet2': p.def += 2; break;
    case 'helmet3': p.def += 3; break;
    case 'battery': p.skillCooldown = Math.max(0, p.skillCooldown - 1); break;
    case 'bank1': p.starlight += 4; break;
    case 'bank2': p.starlight += 7; break;
    case 'bank3': p.starlight += 3; break;
    case 'hammer': p.starlight += 5; break;
    case 'targetBoard': p.atk += 1; break;
    case 'sight': p.atk += 2; break;
    case 'endless': v.rerolls = (v.rerolls ?? 0) + 3; v.endless = 3; break;
    case 'perpetual': p.move += 2; break;
    case 'emGun': p.atk += 2; break;
    case 'revivalDoll': p.atk += 1; p.def += 1; break;
    case 'wristband': p.atk += 1; break;
    case 'cursedSword': p.maxHp = Math.max(1, p.maxHp - 2); p.hp = Math.min(p.hp, p.maxHp); break;
    case 'peacockFan': p.maxHp += 3; p.hp += 3; break;
    case 'dreamliner': p.move += 2; break;
    case 'teaCake': p.atk += 1; break;
    case 'swordShield': p.atk += 3; break;
  }
  log(s, `${p.name}: 🔷 「${RELICS[id].name}」 ${RELICS[id].text}`);
  void rng;
}

export function addEnergy(p: Player, n: number) {
  p.energy = Math.max(0, Math.min(ENERGY_MAX, p.energy + n));
}

export function addHeal(p: Player, n: number) {
  p.healStacks += n;
}

function mark(e: Enemy, n = 1) {
  e.mark = (e.mark ?? 0) + n;
}

function monstersNear(s: GameState, tile: number, range: number): Enemy[] {
  const dist = distances(s.board, tile);
  return s.enemies.filter((e) => targetable(s, e) && (dist.get(e.tile) ?? 99) <= range);
}

// ───────────────────────── 능력치 ─────────────────────────

const half = (p: Player) => p.hp * 2 <= p.maxHp;
/** phase 좁히기를 피하려고 함수로 읽는다 */
const over = (s: GameState) => s.phase.kind === 'gameOver';

/** 전투에서 공격할 때 더해지는 공격력 (몬스터 공격) */
export function relicAttack(p: Player, target: Enemy): number {
  let atk = 0;
  if (hasRelic(p, 'cookie3')) atk += Math.floor(Math.max(0, p.maxHp - CHARACTERS[p.character].hp) / 2);
  if (hasRelic(p, 'adrenaline') && half(p)) atk += 8;
  if (hasRelic(p, 'whetstone') && p.hp * 2 < p.maxHp) atk += 4;
  if (hasRelic(p, 'feather')) atk += p.relicVars.feather ?? 0;
  if (hasRelic(p, 'flashlight')) atk += Math.floor(p.starlight / 4);
  if (hasRelic(p, 'knife1') && p.hp >= p.maxHp) atk += 2 + Math.floor(p.healStacks / 2);
  if (hasRelic(p, 'knife2') && p.hp >= p.maxHp) atk += 4 + Math.floor(p.healStacks / 2);
  if (hasRelic(p, 'eBlade') && p.energy > 7) atk += 2;
  if (hasRelic(p, 'eagleEye')) atk += 2 * (target.mark ?? 0);
  // 맵 전용
  const mind = p.mapRes?.mind ?? 0;
  if (hasRelic(p, 'magnifier')) atk += Math.min(4, p.mapRes?.evidence ?? 0);
  if (hasRelic(p, 'carpPlush')) atk += p.relicVars.carp ?? 0;
  if (hasRelic(p, 'taser') && mind >= 3) atk += 2;
  if (hasRelic(p, 'wristband') && target.isBoss) atk += 3;
  if (hasRelic(p, 'adaptiveCore') && mind >= 3) atk += 2;
  if (hasRelic(p, 'entTerminal') && mind > 0) atk += 4;
  if (hasRelic(p, 'cursedSword')) atk += p.relicVars.cursed ?? 0;
  if (hasRelic(p, 'revengeHalberd') && half(p)) atk += 5;
  if (hasRelic(p, 'ironAnchor')) atk += p.relicVars.anchor ?? 0;
  if (hasRelic(p, 'teaCake') && target.kind === 'teapot') atk += 2;
  return atk;
}

/** 방어할 때 더해지는 방어력 */
export function relicDefense(p: Player): number {
  let def = 0;
  if (hasRelic(p, 'revengeHalberd') && p.hp >= p.maxHp) def += 3;
  if (hasRelic(p, 'entTerminal') && (p.mapRes?.mind ?? 0) > 0) def += 4;
  if (hasRelic(p, 'swordShield') && p.mapRes?.problem) def += 3;
  return def;
}

/** 공격 주사위를 정해 두는 유물 (쌍잉어 6 · 해물탕 1 또는 6) */
export function relicAttackRoll(rng: Rng, p: Player): number | undefined {
  if (hasRelic(p, 'twinCarps')) return 6;
  if (hasRelic(p, 'seafoodSoup')) return rng.d6() <= 3 ? 1 : 6;
  return undefined;
}

/** 맵 자원을 얻는다. 증거 4마다 유물 */
export function gainRes(s: GameState, rng: Rng, p: Player, res: MapRes, n: number) {
  if (res === 'overclock' && hasRelic(p, 'chronometer')) n += 1;
  const before = p.mapRes[res] ?? 0;
  const after = res === 'mind' ? Math.min(5, before + n) : before + n;
  p.mapRes[res] = after;
  const info = MAP_RES_INFO[res];
  log(s, `${p.name}: ${info.icon} ${info.name} ${after}`);
  const v = p.relicVars;
  if (res === 'mind' && after > before && hasRelic(p, 'consciousness') && (v.conscious ?? 0) < 5) {
    v.conscious = (v.conscious ?? 0) + 1;
    p.maxHp += 1;
    p.hp += 1;
    p.atk += 1;
  }
  if (res === 'evidence' && Math.floor(after / 4) > Math.floor(before / 4)) offerRelic(s, rng, p, Math.max(1, p.level), '증거 4');
}

/** 주사위를 굴릴 때 오버클럭을 다 쓴다 → 더 가는 칸 */
export function useOverclock(s: GameState, p: Player): number {
  const n = p.mapRes?.overclock ?? 0;
  if (!n) return 0;
  p.mapRes.overclock = 0;
  if (hasRelic(p, 'chronometer')) p.status.nextBattleAtk += 2;
  log(s, `${p.name}: 🕰️ 오버클럭 +${n}칸`);
  return n;
}

/** 에너미를 쓰러뜨렸다 (테이저 · 저주받은 검) */
export function onKill(s: GameState, rng: Rng, p: Player, e: Enemy) {
  kitKill(s, rng, p, e);
  if (hasRelic(p, 'taser') && e.counter) gainRes(s, rng, p, 'mind', 1);
  if (hasRelic(p, 'cursedSword')) p.relicVars.cursed = Math.min(5, (p.relicVars.cursed ?? 0) + 1);
}

/** 쓰러졌다. true면 진행도가 오르지 않는다 (부활 인형, 처음 1번) */
export function onKO(s: GameState, p: Player): boolean {
  if (!hasRelic(p, 'revivalDoll') || p.relicVars.revived) return false;
  p.relicVars.revived = 1;
  log(s, `${p.name}: 🪆 부활 인형 — 진행도가 오르지 않는다`);
  return true;
}

/** 반격을 받지 않는다 (아드레날린) */
export function relicNoCounter(p: Player): boolean {
  return hasRelic(p, 'adrenaline') && half(p);
}

/** 받는 피해 - (숫돌) */
export function relicDamageCut(p: Player): number {
  return (hasRelic(p, 'whetstone') && p.hp * 2 < p.maxHp ? 1 : 0) + (hasRelic(p, 'adaptiveCore') && (p.mapRes?.mind ?? 0) < 3 ? 1 : 0);
}

/** 차례마다 쓸 수 있는 주사위 전 카드 수 */
export function cardPlayLimit(s: GameState, p: Player): number {
  return (
    1 +
    (hasRelic(p, 'backpack') ? 1 : 0) +
    (hasRelic(p, 'darts') ? 1 : 0) +
    (hasRelic(p, 'infiniteSerpent') ? 1 : 0) +
    (hasRelic(p, 'ancientStaff') ? 1 : 0) +
    s.turn.extraPlays
  );
}

/** 효과 카드 사거리 + (탐사 위성) */
export function relicRange(p: Player): number {
  return (hasRelic(p, 'satellite') ? 3 : 0) + (hasRelic(p, 'ancientStaff') ? 3 : 0);
}

/** 피해 효과 카드 피해 + (책갈피 · 닌자 표창) */
export function relicCardDamage(p: Player, target: Enemy): number {
  return (
    (hasRelic(p, 'bookmark') ? 1 : 0) +
    (hasRelic(p, 'darts') ? (target.mark ?? 0) : 0) +
    (hasRelic(p, 'piercingGun') ? (target.isBoss ? 4 : 2) : 0)
  );
}

/** 표식: 모든 피해 +1 */
export function markBonus(e: Enemy): number {
  return (e.mark ?? 0) > 0 ? 1 : 0;
}

/** 상점 카드 값 - (회원 추천장) */
export function relicShopDiscount(p: Player): number {
  return hasRelic(p, 'membership') ? 1 : 0;
}

// ───────────────────────── 때에 따라 ─────────────────────────

/** 자기 차례 시작 (다른 시작 효과 다음) */
export function onTurnStart(s: GameState, rng: Rng, p: Player) {
  kitTurnStart(s, rng, p);
  const v = p.relicVars;
  if (hasRelic(p, 'perpetual') && p.energy < 6) p.energy = 6;
  if (v.anchor) v.anchor -= 1;
  if (hasRelic(p, 'infiniteSerpent') && p.hand.length < 4) drawCards(s, p, rng, 4 - p.hand.length);
  if (hasRelic(p, 'lovebird')) {
    const dist = distances(s.board, p.tile);
    if (s.players.some((o) => o.id !== p.id && !o.ko && (dist.get(o.tile) ?? 99) <= 1)) v.warpBoost = (v.warpBoost ?? 0) + 2;
    else p.status.nextBattleAtk += 1;
  }
  if (hasRelic(p, 'medkit1')) addHeal(p, 1);
  if (hasRelic(p, 'medkit2')) addHeal(p, 3);
  if (hasRelic(p, 'stew')) {
    const dist = distances(s.board, p.tile);
    for (const o of s.players) {
      if (o.ko || (dist.get(o.tile) ?? 99) > 5) continue;
      addHeal(o, 1);
      heal(o, 1);
    }
  }
  if (hasRelic(p, 'targetBoard')) {
    const dist = distances(s.board, p.tile);
    const near = monstersNear(s, p.tile, 4).sort((a, b) => (dist.get(a.tile) ?? 99) - (dist.get(b.tile) ?? 99))[0];
    if (near) mark(near);
  }
  // 힐: 스택만큼 회복
  if (p.healStacks > 0) {
    const healed = heal(p, p.healStacks);
    if (healed) log(s, `${p.name}: 💚 힐 ${p.healStacks} → 체력 +${healed}`);
  }
  if (hasRelic(p, 'endless') && (v.endless ?? 0) > 0) {
    v.endless -= 1;
    if (v.endless === 0) offerRelic(s, rng, p, Math.max(1, p.level), '무한 순환');
  }
}

/** 자기 차례 끝 */
export function onTurnEnd(s: GameState, rng: Rng, p: Player) {
  kitTurnEnd(s, rng, p);
  if (hasRelic(p, 'smartwatch') && p.hand.length < 5) drawCards(s, p, rng, 1);
  if (hasRelic(p, 'satellite') && p.hand.length < 6) p.hand.push({ card: 'railgun', shop: true });
  if (hasRelic(p, 'shockGloves') && p.energy >= 4) {
    const targets = monstersNear(s, p.tile, 2);
    if (targets.length) {
      p.energy -= 4;
      log(s, `${p.name}: 🧤 전격 장갑 — 2칸 안 몬스터 2 피해`);
      for (const e of targets) if (s.enemies.includes(e) && !over(s)) relicStrike(s, rng, p, e, 2);
    }
  }
  const heals = p.healStacks;
  p.healStacks = Math.floor(p.healStacks / 2);
  kitHealLost(s, rng, p, heals - p.healStacks);
  const res = p.mapRes;
  if (hasRelic(p, 'hannaDoll') && res.evidence) p.coins += res.evidence;
  if (hasRelic(p, 'entTerminal') && res.mind) res.mind -= 1;
  if (res.problem) res.problem -= 1;
}

/** 유물 효과로 몬스터에게 피해 (카드 피해처럼 처치 · 보상 · 승리까지) */
function relicStrike(s: GameState, rng: Rng, p: Player, e: Enemy, amount: number) {
  strikeEnemy(s, rng, p, e, amount);
}

/** 주사위로 움직인 칸 수 */
export function onMove(s: GameState, p: Player, steps: number) {
  const v = p.relicVars;
  if (hasRelic(p, 'die8')) {
    if (steps === 8) {
      p.coins += 8;
      log(s, `${p.name}: 🎲 8면 주사위 — 코인 +8`);
    }
    v.move8 = (v.move8 ?? 0) + steps;
    while (v.move8 >= 8) {
      v.move8 -= 8;
      p.starlight += 1;
    }
  }
  if (hasRelic(p, 'dreamliner')) {
    v.move15 = (v.move15 ?? 0) + steps;
    while (v.move15 >= 15) {
      v.move15 -= 15;
      p.skillCooldown = Math.max(0, p.skillCooldown - 1);
    }
  }
  if (hasRelic(p, 'recycler')) {
    v.move5 = (v.move5 ?? 0) + steps;
    while (v.move5 >= 5) {
      v.move5 -= 5;
      addEnergy(p, 2);
    }
  }
}

/** 이동에 더해지는 칸 (에너지 회수기 · 워프 엔진) */
export function relicMoveBonus(p: Player): number {
  let bonus = 0;
  if (hasRelic(p, 'recycler') && p.energy > 5) bonus += 1;
  if (p.relicVars.warpBoost) {
    bonus += p.relicVars.warpBoost;
    p.relicVars.warpBoost = 0;
  }
  return bonus;
}

/** 돌격 · 가속 칸 (워프 엔진) */
export function onBoostTile(p: Player) {
  if (!hasRelic(p, 'warpEngine')) return;
  addEnergy(p, 2);
  p.relicVars.warpBoost = 2;
}

/** 주사위 전 카드(효과 카드)를 썼다. target: 대상 몬스터 */
export function onEffectCard(s: GameState, rng: Rng, p: Player, card: Player['hand'][number], target?: Enemy, dealt?: number) {
  kitEffectCard(s, rng, p, card, target);
  const v = p.relicVars;
  v.effects = (v.effects ?? 0) + 1;
  if (hasRelic(p, 'tome') && v.effects % 3 === 0) {
    p.hand.push({ ...card });
    log(s, `${p.name}: 📖 마법서 — 카드를 돌려받았다`);
  }
  if (hasRelic(p, 'piggy') && v.effects % 2 === 0) p.coins += 3;
  if (hasRelic(p, 'candy')) {
    addHeal(p, 1);
    if (p.hp >= p.maxHp && !s.turn.candyUsed) {
      s.turn.candyUsed = true;
      s.turn.extraPlays += 1;
    }
  }
  if (hasRelic(p, 'shockGloves')) addEnergy(p, 2);
  if (hasRelic(p, 'candyCard') && HEAL_CARDS.has(card.card)) p.skillCooldown = Math.max(0, p.skillCooldown - 1);
  if (hasRelic(p, 'ragingCharm') && !over(s)) {
    const dist = distances(s.board, p.tile);
    const near = monstersNear(s, p.tile, 3).sort((a, b) => (dist.get(a.tile) ?? 99) - (dist.get(b.tile) ?? 99))[0];
    if (near) relicStrike(s, rng, p, near, 1);
  }
  if (target && dealt && dealt > 0 && hasRelic(p, 'spray') && s.enemies.includes(target)) mark(target);
  if (target && (target.mark ?? 0) > 0 && hasRelic(p, 'quiver') && !s.turn.quiverUsed && s.enemies.includes(target)) {
    s.turn.quiverUsed = true;
    p.hand.push({ ...card });
    mark(target);
    log(s, `${p.name}: 🏹 마법 화살통 — 카드를 돌려받았다`);
  }
  void rng;
}

const HEAL_CARDS = new Set(['cookie', 'cake', 'bandage', 'pudding']);

/** 카드를 얻었다 (뽑기 · 구매 · 받기) */
export function onCardsGained(p: Player, n: number) {
  if (hasRelic(p, 'vitamin') && n > 0) addHeal(p, n);
  if (hasRelic(p, 'ragingCharm') && n > 0) heal(p, n);
}

/** 전투에서 공격하기 직전 (표식 · 해머) → 이번 공격 공격력 + */
export function onAttackStart(s: GameState, p: Player, target: Enemy): number {
  if (hasRelic(p, 'sight') || hasRelic(p, 'eagleEye')) mark(target);
  let bonus = 0;
  if (hasRelic(p, 'hammer') && p.coins > 20) {
    bonus += Math.floor(p.coins * 0.3);
    p.coins -= 6;
    log(s, `${p.name}: 🔨 스타코인 해머 — 코인 6, 공격력 +${bonus}`);
  }
  return bonus;
}

/** 전투에서 몬스터를 맞혔다 */
export function onHitMonster(p: Player) {
  if (hasRelic(p, 'flashlight')) p.starlight += 1;
  if (hasRelic(p, 'eBlade')) addEnergy(p, 2);
}

/** 몬스터에게 도전한 뒤 (전자기총) */
export function afterChallenge(s: GameState, rng: Rng, p: Player, target: Enemy, atk: number) {
  if (!hasRelic(p, 'emGun') || p.energy < 4 || over(s)) return;
  const tile = target.tile;
  const victims = monstersNear(s, tile, 1);
  if (victims.length === 0) return;
  p.energy -= 4;
  const amount = Math.max(1, Math.floor(atk / 2));
  log(s, `${p.name}: 🔫 전자기총 — 주변 몬스터 ${amount} 피해`);
  for (const e of victims) if (s.enemies.includes(e) && !over(s)) relicStrike(s, rng, p, e, amount);
}

/** 회피 성공 (우아한 깃털) */
export function onEvaded(p: Player) {
  if (hasRelic(p, 'feather')) p.relicVars.feather = Math.min(4, (p.relicVars.feather ?? 0) + 1);
}

/** 공격받았다 (완충 방패) */
export function onAttacked(p: Player) {
  if (hasRelic(p, 'peacockFan')) p.status.nextBattleAtk += 1;
  if (!hasRelic(p, 'buffer')) return;
  addHeal(p, 2);
  p.coins += 3;
}

/**
 * 피해를 받기 직전: 줄어든 피해를 돌려준다 (숫돌 -1 · 에어백 0). 받은 뒤 에너지 +1 (에어백)
 */
export function onDamage(s: GameState, p: Player, amount: number): number {
  let dmg = Math.max(0, amount - relicDamageCut(p));
  if (dmg >= p.hp && hasRelic(p, 'pocketWatch')) {
    p.relics[p.relics.indexOf('pocketWatch')] = 'pocketWatchBroken';
    p.hp = p.maxHp;
    log(s, `${p.name}: ⌚ 제때 회중시계 — 버텼다`);
    notice(s, `⌚ ${p.name} 회중시계`);
    return 0;
  }
  if (dmg > 0) {
    if (p.mapRes?.mind) p.mapRes.mind -= 1;
    if (hasRelic(p, 'snakePlush')) p.status.nextBattleAtk += 2;
    if (hasRelic(p, 'ironAnchor')) p.relicVars.anchor = (p.relicVars.anchor ?? 0) + 1;
  }
  if (hasRelic(p, 'airbag')) {
    if (dmg >= p.hp && p.energy >= 6) {
      p.energy -= 6;
      log(s, `${p.name}: 🎈 에어백 — 피해 0`);
      notice(s, `🎈 ${p.name} 에어백`);
      return 0;
    }
    if (dmg > 0) addEnergy(p, 1);
  }
  return dmg;
}

/** 놓아주기 (유성) */
export function onSpare(s: GameState, rng: Rng, p: Player, e: Enemy) {
  const gold = hasRelic(p, 'shootingStar2');
  if (!gold && !hasRelic(p, 'shootingStar1')) return;
  p.starlight += 1;
  const amount = (gold ? 2 : 1) + (gold && e.isBoss ? p.starlight : 0);
  log(s, `${p.name}: 🌠 유성 — ${e.name} ${amount} 피해`);
  relicStrike(s, rng, p, e, amount);
}

/** 액티브 스킬을 썼다 (손선풍기 · 전기 코어) */
export function onSkillUsed(s: GameState, rng: Rng, p: Player) {
  const fan = hasRelic(p, 'fan2') ? 2 : hasRelic(p, 'fan1') ? 1 : 0;
  if (fan) {
    for (const e of monstersNear(s, p.tile, 6)) mark(e);
    if (fan === 2) drawCards(s, p, rng, 1);
  }
  if (hasRelic(p, 'carpPlush')) p.relicVars.carp = Math.min(4, (p.relicVars.carp ?? 0) + 1);
  if (hasRelic(p, 'trident')) for (const o of s.players) if (!o.ko) o.status.nextBattleAtk += 1;
  if (hasRelic(p, 'grandGong')) {
    const dist = distances(s.board, p.tile);
    for (const o of s.players) if (!o.ko && (dist.get(o.tile) ?? 99) <= 4) o.status.nextBattleAtk += 1;
  }
  if (hasRelic(p, 'featherBracelet')) {
    p.relicVars.feathers = (p.relicVars.feathers ?? 0) + 1;
    if (p.relicVars.feathers % 3 === 0) offerRelic(s, rng, p, Math.max(1, p.level), '오색 깃털');
  }
  if (hasRelic(p, 'eCore')) {
    s.turn.extraPlays += 1;
    if (p.energy >= 5) {
      p.energy -= 5;
      p.skillCooldown = Math.max(0, p.skillCooldown - 1);
    }
  }
}

/** 송금 (ATM · 우정 배지 · 한나 인형 · 세뱃돈 봉투) */
export function onTransfer(s: GameState, rng: Rng, p: Player, ally: Player) {
  if (hasRelic(p, 'hannaDoll')) gainRes(s, rng, p, 'evidence', 1);
  if (hasRelic(p, 'redEnvelope')) {
    p.status.nextBattleAtk += 1;
    ally.status.nextBattleAtk += 1;
    p.relicVars.envelopes = (p.relicVars.envelopes ?? 0) + 1;
    if (p.relicVars.envelopes % 3 === 0) {
      for (const o of s.players) o.coins += 5;
      log(s, `${p.name}: 🧧 세뱃돈 — 모든 아군 코인 +5`);
    }
  }
  if (hasRelic(p, 'atm')) {
    for (const x of [p, ally]) {
      x.starlight += 1;
      x.coins += 1;
    }
  }
  if (hasRelic(p, 'badge')) {
    addHeal(p, 2);
    addHeal(ally, 2);
  }
}

/** 아군을 회복시켰다 (우정 배지) */
export function onHealAlly(p: Player, ally: Player) {
  if (ally.id === p.id || !hasRelic(p, 'badge')) return;
  addHeal(p, 2);
  addHeal(ally, 2);
}

/** 라운드 보상: 스타라이트만큼 코인 + 무제한 은행 카드 + 회원 추천장 카드 */
export function roundRewardBonus(s: GameState, p: Player): { coins: number; cards: number } {
  const unlimited = s.players.filter((o) => hasRelic(o, 'bank3')).length * 3;
  return { coins: p.starlight + unlimited, cards: hasRelic(p, 'membership') ? 1 : 0 };
}

/** 보스 차례 끝: 표식 -1 */
export function decayMarks(s: GameState) {
  for (const e of s.enemies) if (e.mark) e.mark = Math.max(0, e.mark - 1);
}

// ───────────────────────── 임무 (원작 Tasks) ─────────────────────────

export interface TaskDef {
  id: string;
  text: string;
  goal: number;
  /** 무엇을 센다 */
  stat: 'kills' | 'bossDamage' | 'damage' | 'cardsUsed' | 'breaks' | 'coins';
  /** 보상 유물 확률표 줄 */
  tier: number;
}

export const TASKS: TaskDef[] = [
  { id: 'kill2', text: '에너미 처치 2', goal: 2, stat: 'kills', tier: 1 },
  { id: 'damage20', text: '피해 20', goal: 20, stat: 'damage', tier: 1 },
  { id: 'cards4', text: '카드 사용 4', goal: 4, stat: 'cardsUsed', tier: 1 },
  { id: 'coins25', text: '코인 25 모으기', goal: 25, stat: 'coins', tier: 1 },
  { id: 'boss15', text: '보스에게 피해 15', goal: 15, stat: 'bossDamage', tier: 2 },
  { id: 'kill5', text: '에너미 처치 5', goal: 5, stat: 'kills', tier: 2 },
  { id: 'break1', text: '저지 · 부위 파괴 1', goal: 1, stat: 'breaks', tier: 3 },
  { id: 'boss40', text: '보스에게 피해 40', goal: 40, stat: 'bossDamage', tier: 3 },
];

function taskValue(s: GameState, p: Player, stat: TaskDef['stat']): number {
  return stat === 'coins' ? p.coins : s.stats[p.id][stat];
}

/** 새 임무 (이미 한 임무는 빼고) */
export function assignTask(s: GameState, rng: Rng, p: Player) {
  const done = new Set(p.tasksDone);
  const pool = TASKS.filter((t) => !done.has(t.id));
  if (pool.length === 0) {
    p.task = null;
    return;
  }
  // 앞 임무일수록 쉽다: 처음에는 1등급 위주
  const tierCap = 1 + Math.floor(p.tasksDone.length / 2);
  const easy = pool.filter((t) => t.tier <= tierCap);
  const t = rng.pick(easy.length ? easy : pool);
  p.task = { id: t.id, base: t.stat === 'coins' ? 0 : taskValue(s, p, t.stat) };
}

/** 임무 진행 (화면용) */
export function taskProgress(s: GameState, p: Player): { def: TaskDef; value: number } | null {
  if (!p.task) return null;
  const def = TASKS.find((t) => t.id === p.task!.id)!;
  return { def, value: Math.max(0, taskValue(s, p, def.stat) - p.task.base) };
}

/** 행동이 끝날 때마다: 다 한 임무는 유물로 */
export function checkTasks(s: GameState, rng: Rng) {
  for (const p of s.players) {
    const prog = taskProgress(s, p);
    if (!prog || prog.value < prog.def.goal) continue;
    p.tasksDone.push(prog.def.id);
    notice(s, `📋 ${p.name} 임무 완료 — ${prog.def.text}`);
    offerRelic(s, rng, p, prog.def.tier, `임무 「${prog.def.text}」`);
    assignTask(s, rng, p);
  }
}

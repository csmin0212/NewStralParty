// 보스 차례 · 보스 행동 카드 · 미니언 움직임 · 보드 표식.
// 라운드가 시작되면 보스가 다음 행동을 공개하고(revealIntent), 라운드 끝에 보스 차례(bossTurn)가 온다 (OJ 코옵 보스 덱).

import { DIFFICULTIES } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { distances, shuffle, statusDef } from './cards';
import { advanceProgress, bossAppear, damage, heal, isOver, log, notice, summon } from './game';
import type { Rng } from './rng';
import { bossDamageTaken } from './skills';
import { decayMarks, markBonus, onAttacked } from './relics';
import { kitDef, kitEnemyAtk, kitFought, kitRetaliate, kitSafe, kitSlow, kitTaunter } from './kits';
import { apDamageIn, apEnemyHurt, apEnemyPhase, apLandMark, apRoundEnd, apSharedBoss, isAp } from './ap';
import type {
  BossDef,
  BossEffect,
  BossMove,
  BossState,
  BossTarget,
  BossTurn,
  DebuffKind,
  Enemy,
  EnemyKind,
  GameState,
  Mark,
  MarkKind,
  Player,
} from './types';

export function freshBossState(def: BossDef): BossState {
  return {
    drawPile: [],
    intent: null,
    gauge: 0,
    phase: 1,
    groggy: 0,
    vuln: 0,
    hidden: false,
    parts: [],
    part: 0,
    partDealt: 0,
    resort: def.passive?.resort?.hp ?? 0,
    heater: def.passive?.heater?.hp ?? 0,
    organ: 'boss',
    felled: 0,
  };
}

export function bossEnemy(s: GameState): Enemy | undefined {
  return s.enemies.find((e) => e.isBoss);
}

/** 지금 공개된 보스 행동 */
export function currentIntent(s: GameState): BossMove | null {
  const id = s.bossState.intent?.move;
  return id ? (s.boss.moves?.[id] ?? null) : null;
}

/** 켜져 있는 카이텐 부위 */
export function activePart(s: GameState) {
  const st = s.bossState;
  if (st.parts.length === 0 || !bossEnemy(s)) return null;
  const id = st.parts[st.part % st.parts.length];
  return s.boss.passive?.parts?.find((p) => p.id === id) ?? null;
}

const PINK_ATK = 2;

// ───────────────────────── 등장 · 공개 ─────────────────────────

/** 보스가 판에 나온 직후: 부위를 켜고 첫 행동을 공개한다 */
export function onBossAppear(s: GameState, rng: Rng) {
  const st = s.bossState;
  const parts = s.boss.passive?.parts;
  if (parts) {
    st.parts = parts.map((p) => p.id);
    st.part = 0;
    st.partDealt = 0;
    applyPart(s, +1);
  }
  revealIntent(s, rng);
}

/** 라운드 시작: 공개된 행동이 없으면 덱에서 1장 공개 */
export function revealIntent(s: GameState, rng: Rng) {
  const def = s.boss;
  const st = s.bossState;
  if (!def.moves || !bossEnemy(s) || st.intent || isOver(s)) return;
  const gauge = def.passive?.gauge;
  let id: string | undefined;
  if (gauge && st.gauge >= gauge.max) {
    id = gauge.release;
    st.gauge = 0;
  } else {
    if (st.drawPile.length === 0) {
      const deck = st.phase === 2 && def.phase2 ? def.phase2.deck : (def.deck ?? []);
      st.drawPile = def.deckOrder === 'shuffle' ? shuffle(deck, rng) : [...deck];
    }
    id = st.drawPile.shift();
  }
  if (!id || !def.moves[id]) return;
  st.intent = { move: id, dealt: 0, broken: false };
  log(s, `👁 ${bossEnemy(s)!.name}의 다음 행동: 「${def.moves[id].name}」`);
}

// ───────────────────────── 보스가 받는 피해 ─────────────────────────

/**
 * 에너미에게 피해를 준다. 보스 보정(성유물 · 그로기 · 방패 부위)과 미니언 연결 · 분신 · 행동 끊기 · 2페이즈를 여기서 처리한다.
 * 실제로 들어간 피해를 돌려준다. 보스가 쓰러지면 게임이 끝난다 (isOver로 확인).
 */
export function hurtEnemy(s: GameState, rng: Rng, e: Enemy, amount: number): number {
  const info = e.isBoss ? null : ENEMIES[e.kind as EnemyKind];
  // 원작 맵: 역린 · 취약 중추 · 지휘대 체력 공유
  amount = apDamageIn(s, e, amount);
  const shared = apSharedBoss(s, e);
  if (shared) {
    apEnemyHurt(s, rng, e, amount);
    const dealt = hurtEnemy(s, rng, shared, amount);
    e.hp = shared.hp;
    e.maxHp = shared.maxHp;
    if (shared.hp === 0) bossDown(s, shared);
    return dealt;
  }
  if (info?.decoy) {
    e.hp = 0;
    log(s, `  🎩 분신이었다!`);
    return 0;
  }
  // 표식 +1 · 허약의 표식 +1 (키이세이)
  const marked = amount > 0 ? markBonus(e) + (e.tags?.vuln ? 1 : 0) : 0;
  const dealt = (e.isBoss ? bossDamageTaken(s, amount) : amount) + marked;
  // 연결된 미니언은 남은 체력까지만 보스에게 넘긴다 (넘친 피해는 넘어가지 않는다)
  const taken = Math.min(e.hp, dealt);
  e.hp = Math.max(0, e.hp - dealt);
  // 피해는 늘 지금 차례인 플레이어가 준다 (카드 · 전투 · 회피 반격)
  const stats = s.stats[s.current];
  stats.damage += taken;
  if (e.isBoss) stats.bossDamage += taken;
  if (e.isBoss) afterBossHurt(s, rng, e, dealt);
  apEnemyHurt(s, rng, e, dealt);
  // 지휘대 체력도 같이 (체력 공유)
  if (e.isBoss) for (const x of s.enemies) if (x.kind === 'platform') x.hp = e.hp;
  // 연결된 미니언: 받은 피해를 보스도 받는다
  if (info?.link && taken > 0) {
    const boss = bossEnemy(s);
    if (boss && !s.bossState.hidden && !isOver(s)) {
      const linked = hurtEnemy(s, rng, boss, taken);
      log(s, `  🔗 ${boss.name}도 ${linked} 피해 (체력 ${boss.hp})`);
      if (boss.hp === 0) bossDown(s, boss);
    }
  }
  return dealt;
}

function afterBossHurt(s: GameState, rng: Rng, boss: Enemy, dealt: number) {
  const st = s.bossState;
  if (dealt <= 0) return;
  const move = currentIntent(s);
  if (st.intent && move?.breakAt && !st.intent.broken) {
    st.intent.dealt += dealt;
    if (st.intent.dealt >= move.breakAt) {
      st.intent.broken = true;
      s.stats[s.current].breaks += 1;
      log(s, `  💥 「${move.name}」 저지! ${boss.name} 그로기`);
      notice(s, `💥 「${move.name}」 저지!`);
    }
  }
  const part = activePart(s);
  if (part) {
    st.partDealt += dealt;
    if (st.partDealt >= part.breakAt) {
      s.stats[s.current].breaks += 1;
      applyPart(s, -1);
      st.parts.splice(st.part % st.parts.length, 1);
      st.partDealt = 0;
      log(s, `  🔧 ${part.name} 파괴!`);
      notice(s, `🔧 ${part.name} 파괴!`);
    }
  }
  const p2 = s.boss.phase2;
  if (p2 && st.phase === 1 && boss.hp > 0 && boss.hp <= boss.maxHp * p2.at) enterPhase2(s, rng, boss);
}

/** 연결 피해 · 폭발 등 전투 밖에서 보스가 쓰러졌다 */
export function bossDown(s: GameState, boss: Enemy) {
  if (isOver(s)) return;
  s.enemies = s.enemies.filter((e) => e.id !== boss.id);
  s.phase = { kind: 'gameOver', result: 'victory' };
  log(s, `🎉 ${boss.name} 처치! 모두의 승리!`);
  notice(s, `🎉 ${boss.name} 처치!`);
}

function enterPhase2(s: GameState, rng: Rng, boss: Enemy) {
  const p2 = s.boss.phase2!;
  const st = s.bossState;
  st.phase = 2;
  boss.name = p2.name;
  boss.icon = p2.icon;
  boss.atk = p2.atk + DIFFICULTIES[s.difficulty].atk + (activePart(s)?.id === 'pink' ? PINK_ATK : 0);
  boss.def = p2.def;
  if (p2.counter !== undefined) boss.counter = p2.counter;
  if (p2.defense) boss.defense = p2.defense;
  st.drawPile = [];
  log(s, `⚠ ${p2.name}!`);
  notice(s, `⚠ ${p2.name}`);
  const turn = newTurn(s, p2.name, '');
  runEffects(s, rng, p2.enter, turn);
  // 공개해 둔 행동은 바뀐 덱의 첫 행동으로
  st.intent = null;
  revealIntent(s, rng);
}

/** 에너미가 판에서 사라진 뒤 (처치 · 흡수) 보스 규칙 */
export function onEnemyGone(s: GameState, rng: Rng, e: Enemy) {
  if (e.isBoss || isOver(s)) return;
  const st = s.bossState;
  const passive = s.boss.passive;
  const left = (kind: EnemyKind) => s.enemies.some((x) => x.kind === kind);
  if (ENEMIES[e.kind as EnemyKind].link) st.felled += 1;
  if (passive?.gauge?.perMinion === e.kind && !left(e.kind) && bossEnemy(s)) {
    st.gauge = 0;
    st.groggy = Math.max(st.groggy, 1);
    log(s, `  🔓 코어 노출! ${bossEnemy(s)!.name} 그로기`);
    notice(s, '🔓 코어 노출!');
  }
  if (passive?.resort?.kind === e.kind && !left(e.kind) && bossEnemy(s)) {
    st.groggy = Math.max(st.groggy, 1);
    log(s, `  📡 미사일 유도 장치 파괴! ${bossEnemy(s)!.name} 그로기`);
    notice(s, '📡 미사일 프렌지 중단!');
  }
  if (passive?.appearWhenCleared === e.kind && !left(e.kind) && !bossEnemy(s)) {
    appear(s, rng);
  }
}

function appear(s: GameState, rng: Rng) {
  bossAppear(s, rng);
  log(s, `⚠ ${s.boss.name} 등장!`);
  notice(s, `⚠ ${s.boss.name} 등장`);
}

// ───────────────────────── 보스 차례 ─────────────────────────

function newTurn(s: GameState, move: string | null, text: string): BossTurn {
  s.seq += 1;
  const turn: BossTurn = { seq: s.seq, move, text, broken: false, hits: [], moved: [], lines: [] };
  s.bossTurn = turn;
  return turn;
}

/** 진행도 시간표의 move 기믹: 보스 행동 하나를 바로 쓴다 */
export function runTimelineMove(s: GameState, rng: Rng, id: string) {
  const move = s.boss.moves?.[id];
  if (!move) return;
  const turn = newTurn(s, move.name, move.text);
  runEffects(s, rng, move.effects, turn);
}

/** 라운드 끝: 보스 행동 → 보스 규칙 → 미니언 → 표식 · 저주 */
export function bossTurn(s: GameState, rng: Rng) {
  const st = s.bossState;
  const def = s.boss;
  const boss = bossEnemy(s);
  if (st.groggy > 0) st.groggy -= 1;
  const move = currentIntent(s);
  const turn = newTurn(s, null, '');

  if (boss && move && st.intent) {
    turn.move = move.name;
    turn.text = move.text;
    if (st.intent.broken) {
      turn.broken = true;
      st.groggy = Math.max(st.groggy, 1);
      turn.lines.push(`「${move.name}」 저지됨`);
      log(s, `💫 ${boss.name}: 「${move.name}」이 끊겼다 (그로기)`);
    } else {
      log(s, `👿 ${boss.name}: 「${move.name}」`);
      runEffects(s, rng, move.effects, turn);
    }
    st.intent = null;
  }
  if (isOver(s)) return;

  // 보스 규칙
  const passive = def.passive;
  if (boss && passive?.gauge) {
    const g = passive.gauge;
    const minions = g.perMinion ? s.enemies.filter((e) => e.kind === g.perMinion).length : 0;
    const before = st.gauge;
    st.gauge = Math.min(g.max, st.gauge + (g.perRound ?? 0) + minions);
    if (st.gauge > before) turn.lines.push(`게이지 ${st.gauge} / ${g.max}`);
  }
  if (passive?.drain) {
    const d = passive.drain;
    for (const e of s.enemies.filter((x) => x.kind === d.kind)) {
      const dist = distances(s.board, e.tile);
      for (const p of alive(s)) {
        if ((dist.get(p.tile) ?? Infinity) > d.range || p.coins <= 0) continue;
        const lost = Math.min(p.coins, d.amount);
        p.coins -= lost;
        turn.hits.push({ player: p.id, amount: 0, note: `코인 -${lost}` });
      }
    }
  }
  if (passive?.resort && s.enemies.some((e) => e.kind === passive.resort!.kind)) {
    st.resort = Math.max(0, st.resort - 1);
    turn.lines.push(`리조트 ${st.resort} / ${passive.resort.hp}`);
    log(s, `🚀 미사일이 리조트에 명중 (남은 ${st.resort})`);
    if (st.resort === 0) {
      s.phase = { kind: 'gameOver', result: 'defeat' };
      log(s, '💫 리조트가 무너졌다… 패배');
      notice(s, '💫 리조트가 무너졌다…');
      return;
    }
  }
  if (boss && passive?.heater) {
    st.heater = Math.max(0, st.heater - passive.heater.decay);
    turn.lines.push(`난로 ${st.heater} / ${passive.heater.hp}`);
    if (st.heater === 0) {
      log(s, '🥶 난로가 꺼졌다 — 저체온');
      for (const p of alive(s)) hit(s, rng, p, 1, turn, '저체온');
      if (isOver(s)) return;
    }
  }

  if (isAp(s)) apEnemyPhase(s, rng, turn);
  else minionTurn(s, rng, turn);
  if (isOver(s)) return;
  if (isAp(s)) apRoundEnd(s, rng);
  if (isOver(s)) return;
  tickMarks(s, rng, turn);
  if (isOver(s)) return;
  tickCurses(s, rng, turn);
  if (isOver(s)) return;

  decayMarks(s);
  if (boss && st.parts.length > 0) {
    applyPart(s, -1);
    st.part = (st.part + 1) % st.parts.length;
    st.partDealt = 0;
    applyPart(s, +1);
    turn.lines.push(`${activePart(s)!.name} 가동`);
  }
}

/** 분홍 부위(오른팔)는 켜져 있는 동안 공격력 +2 */
function applyPart(s: GameState, sign: 1 | -1) {
  const boss = bossEnemy(s);
  if (boss && activePart(s)?.id === 'pink') boss.atk += sign * PINK_ATK;
}

// ───────────────────────── 효과 ─────────────────────────

function alive(s: GameState): Player[] {
  return s.players.filter((p) => !p.ko);
}

function bossTile(s: GameState): number {
  return bossEnemy(s)?.tile ?? s.board.bossTile;
}

/** 진행 방향으로 n칸 안의 칸 (갈림길은 모두) */
function lineTiles(s: GameState, from: number, n: number): Set<number> {
  const out = new Set<number>();
  let frontier = [from];
  for (let i = 0; i < n; i++) {
    const next: number[] = [];
    for (const t of frontier) {
      for (const x of s.board.tiles[t].next) {
        if (!out.has(x)) {
          out.add(x);
          next.push(x);
        }
      }
    }
    frontier = next;
  }
  return out;
}

function pickTargets(s: GameState, rng: Rng, target: BossTarget, range = 2, count = 1): Player[] {
  const list = alive(s);
  const from = bossTile(s);
  const dist = distances(s.board, from);
  const d = (p: Player) => dist.get(p.tile) ?? Infinity;
  switch (target) {
    case 'all':
      return list;
    case 'near':
      return list.filter((p) => d(p) <= range);
    case 'line': {
      const tiles = lineTiles(s, from, range);
      return list.filter((p) => tiles.has(p.tile));
    }
    case 'closest':
      return [...list].sort((a, b) => d(a) - d(b) || a.id - b.id).slice(0, count);
    case 'farthest':
      return [...list].sort((a, b) => d(b) - d(a) || a.id - b.id).slice(0, count);
    case 'highestHp':
      return [...list].sort((a, b) => b.hp - a.hp || a.id - b.id).slice(0, count);
    case 'lowestHp':
      return [...list].sort((a, b) => a.hp - b.hp || a.id - b.id).slice(0, count);
    case 'richest':
      return [...list].sort((a, b) => b.coins - a.coins || a.id - b.id).slice(0, count);
    case 'random':
      return shuffle(list, rng).slice(0, count);
  }
}

/** 보스 · 미니언이 아군에게 주는 피해. 카이텐 가슴(빨강)이 켜져 있으면 맞은 아군은 기절 */
export function bossTurnHit(s: GameState, rng: Rng, p: Player, amount: number, turn: BossTurn, note?: string) {
  hit(s, rng, p, amount, turn, note);
}

function hit(s: GameState, rng: Rng, p: Player, amount: number, turn: BossTurn, note?: string) {
  if (p.ko || isOver(s)) return;
  const stun = bossEnemy(s) && activePart(s)?.id === 'red' && amount > 0;
  if (amount > 0) onAttacked(p);
  damage(s, rng, p, amount);
  if (stun && !p.ko) p.status.skipTurn = true;
  const notes = [note, p.ko ? 'KO' : stun ? '기절' : undefined].filter(Boolean).join(' · ');
  turn.hits.push({ player: p.id, amount, note: notes || undefined });
  log(s, `  ${p.name} ${amount} 피해${notes ? ` (${notes})` : ''} → 체력 ${p.hp}`);
}

/** 에너미가 들어갈 수 있는 빈 칸 */
export function freeTileFor(s: GameState, id: number, ignore?: number): boolean {
  return freeTile(s, id, ignore);
}

function freeTile(s: GameState, id: number, ignore?: number): boolean {
  const t = s.board.tiles[id];
  return t.kind !== 'base' && t.kind !== 'warp' && !s.enemies.some((e) => e.tile === id && e.id !== ignore);
}

export function runEffects(s: GameState, rng: Rng, effects: BossEffect[], turn: BossTurn) {
  for (const fx of effects) {
    if (isOver(s)) return;
    runEffect(s, rng, fx, turn);
  }
}

function runEffect(s: GameState, rng: Rng, fx: BossEffect, turn: BossTurn) {
  const st = s.bossState;
  const boss = bossEnemy(s);
  switch (fx.type) {
    case 'damage':
      for (const p of pickTargets(s, rng, fx.target, fx.range, fx.count)) hit(s, rng, p, fx.amount, turn);
      break;
    case 'damageRanked': {
      const order = pickTargets(s, rng, 'closest', 0, fx.amounts.length);
      order.forEach((p, i) => hit(s, rng, p, fx.amounts[i], turn));
      break;
    }
    case 'debuff':
      for (const p of pickTargets(s, rng, fx.target, fx.range, fx.count)) {
        debuff(p, fx.status, fx.amount ?? 1, fx.turns ?? 2);
        turn.hits.push({ player: p.id, amount: 0, note: DEBUFF_NAME[fx.status] });
        log(s, `  ${p.name}: ${DEBUFF_NAME[fx.status]}`);
      }
      break;
    case 'charge':
      if (boss) charge(s, rng, boss, fx.steps, fx.amount, fx.push ?? 0, turn);
      break;
    case 'hide':
      if (!boss) break;
      st.hidden = true;
      if (fx.then) st.drawPile.unshift(fx.then);
      log(s, `  ${boss.name}이(가) 모습을 감췄다`);
      break;
    case 'warp': {
      if (!boss) break;
      const to = fx.where === 'crowd' ? crowdTile(s, rng, boss) : randomFreeTile(s, rng, boss.id);
      if (to !== null) {
        turn.moved.push({ enemy: boss.id, path: [boss.tile, to] });
        boss.tile = to;
      }
      st.hidden = false;
      if (fx.amount) for (const p of pickTargets(s, rng, 'near', fx.range ?? 1)) hit(s, rng, p, fx.amount, turn);
      break;
    }
    case 'summon': {
      const kinds = fx.perPlayer ? s.players.map(() => fx.enemies[0]) : fx.enemies;
      for (const kind of kinds) summon(s, rng, kind, fx.near);
      if (kinds.some((k) => ENEMIES[k].link)) st.felled = 0;
      turn.lines.push(`${ENEMIES[kinds[0]].name} ${kinds.length}마리`);
      break;
    }
    case 'buffEnemies':
      s.enemyBonus.atk += fx.atk;
      s.enemyBonus.def += fx.def;
      for (const e of s.enemies) {
        if (e.isBoss) continue;
        e.atk += fx.atk;
        e.def += fx.def;
      }
      break;
    case 'buffSelf':
      if (!boss) break;
      boss.atk += fx.atk ?? 0;
      boss.def += fx.def ?? 0;
      turn.lines.push(`${boss.name} 공격 ${boss.atk} · 방어 ${boss.def}`);
      break;
    case 'heal':
      if (!boss) break;
      boss.hp = Math.min(boss.maxHp, boss.hp + fx.amount);
      turn.lines.push(`${boss.name} 체력 +${fx.amount}`);
      break;
    case 'absorb': {
      if (!boss) break;
      const eaten = s.enemies.filter((e) => e.kind === fx.kind);
      s.enemies = s.enemies.filter((e) => e.kind !== fx.kind);
      const healed = Math.min(boss.maxHp - boss.hp, eaten.length * fx.heal);
      boss.hp += healed;
      turn.lines.push(`${eaten.length}마리 흡수 · 체력 +${healed}`);
      log(s, `  ${boss.name}: ${eaten.length}마리 흡수, 체력 +${healed}`);
      if (st.felled >= 2) {
        st.groggy = Math.max(st.groggy, 1);
        turn.lines.push('쓰러진 미니언이 많아 그로기');
        log(s, `  💫 ${boss.name} 그로기`);
      }
      st.felled = 0;
      break;
    }
    case 'marks':
      placeMarks(s, rng, fx.kind, fx.count, fx.near, fx.power, fx.timer);
      break;
    case 'stealCoins':
      for (const p of pickTargets(s, rng, fx.target, fx.range, fx.count)) {
        const lost = Math.min(p.coins, fx.amount);
        p.coins -= lost;
        turn.hits.push({ player: p.id, amount: 0, note: `코인 -${lost}` });
        log(s, `  ${p.name} 코인 -${lost}`);
      }
      break;
    case 'cleanse':
      for (const p of alive(s)) {
        const st2 = p.status;
        if (!st2.regen && !st2.atkUp && !st2.defUp && !st2.nextBattleAtk) continue;
        st2.regen = null;
        st2.atkUp = null;
        st2.defUp = null;
        st2.nextBattleAtk = 0;
        turn.hits.push({ player: p.id, amount: 0, note: '강화 해제' });
      }
      break;
    case 'clones':
      if (boss) clones(s, rng, boss, fx.count, turn);
      break;
    case 'detonate':
      for (const e of s.enemies.filter((x) => x.kind === fx.kind)) {
        explode(s, rng, e.tile, fx.amount, fx.range, turn, e.name);
        s.enemies = s.enemies.filter((x) => x.id !== e.id);
        if (isOver(s)) return;
      }
      break;
    case 'chant':
      if (!boss) break;
      if (st.organ === 'boss') {
        const healed = Math.min(boss.maxHp - boss.hp, 10);
        boss.hp += healed;
        turn.lines.push(`성가가 ${boss.name}에게 · 체력 +${healed}`);
      } else {
        for (const p of alive(s)) {
          const healed = heal(p, 3);
          turn.hits.push({ player: p.id, amount: -healed, note: '성가' });
        }
        turn.lines.push('성가가 아군에게 · 체력 +3');
      }
      st.organ = 'boss';
      break;
    case 'progress':
      for (let i = 0; i < fx.amount && !isOver(s); i++) advanceProgress(s, rng, '보스');
      break;
  }
}

export const DEBUFF_NAME: Record<DebuffKind, string> = {
  defDown: '방어 하락',
  atkDown: '공격 하락',
  stun: '기절',
  erode: '위압',
  curse: '저주',
  slow: '이동 감소',
};

function debuff(p: Player, kind: DebuffKind, amount: number, turns: number) {
  const st = p.status;
  switch (kind) {
    case 'defDown':
      st.defDown = { amount, turns };
      break;
    case 'atkDown':
      st.atkDown = { amount, turns };
      break;
    case 'stun':
      st.skipTurn = true;
      break;
    case 'erode':
      st.erode = true;
      break;
    case 'curse':
      st.curse = 2;
      break;
    case 'slow':
      st.slow += amount;
      break;
  }
}

/** 돌진: 가장 가까운 아군 쪽으로 한 칸씩. 지나간 칸의 아군은 피해를 입고 밀려난다 */
function charge(s: GameState, rng: Rng, boss: Enemy, steps: number, amount: number, push: number, turn: BossTurn) {
  const path = [boss.tile];
  const struck = new Set<number>();
  let target: Player | undefined = pickTargets(s, rng, 'closest')[0];
  for (let i = 0; i < steps; i++) {
    const here = path[path.length - 1];
    const goal = target && target.tile !== here ? distances(s.board, target.tile) : null;
    const options = neighbors(s, here).filter((t) => !path.includes(t));
    if (options.length === 0) break;
    const step = goal
      ? options.sort((a, b) => (goal.get(a) ?? 99) - (goal.get(b) ?? 99) || a - b)[0]
      : (s.board.tiles[here].next.find((t) => options.includes(t)) ?? options[0]);
    path.push(step);
    for (const p of alive(s).filter((x) => x.tile === step && !struck.has(x.id))) {
      struck.add(p.id);
      hit(s, rng, p, amount, turn, push ? '밀려남' : undefined);
      if (push && !p.ko) pushAway(s, p, here, push);
      if (isOver(s)) return;
    }
    if (target && target.tile === step) target = pickTargets(s, rng, 'closest').find((p) => !struck.has(p.id));
  }
  // 거점 · 다른 에너미 칸에는 멈추지 않는다
  while (path.length > 1 && !freeTile(s, path[path.length - 1], boss.id)) path.pop();
  if (path.length > 1) {
    boss.tile = path[path.length - 1];
    turn.moved.push({ enemy: boss.id, path });
  }
}

/** 방향 없이 이어진 칸 */
function neighbors(s: GameState, id: number): number[] {
  const out = new Set(s.board.tiles[id].next);
  for (const t of s.board.tiles) if (t.next.includes(id)) out.add(t.id);
  return [...out];
}

/** from에서 멀어지는 쪽으로 n칸 밀어낸다 */
function pushAway(s: GameState, p: Player, from: number, n: number) {
  for (let i = 0; i < n; i++) {
    const dist = distances(s.board, from);
    const here = dist.get(p.tile) ?? 0;
    const away = neighbors(s, p.tile)
      .filter((t) => (dist.get(t) ?? 0) > here)
      .sort((a, b) => a - b)[0];
    if (away === undefined) return;
    p.tile = away;
  }
}

/** 아군이 가장 많이 모인 빈 칸 (2칸 안 인원) */
function crowdTile(s: GameState, rng: Rng, boss: Enemy): number | null {
  const players = alive(s);
  let best: number[] = [];
  let bestScore = -1;
  for (const t of s.board.tiles) {
    if (!freeTile(s, t.id, boss.id)) continue;
    const dist = distances(s.board, t.id);
    const score = players.filter((p) => (dist.get(p.tile) ?? 99) <= 1).length;
    if (score > bestScore) {
      bestScore = score;
      best = [t.id];
    } else if (score === bestScore) best.push(t.id);
  }
  return best.length ? rng.pick(best) : null;
}

function randomFreeTile(s: GameState, rng: Rng, ignore?: number, avoid: number[] = []): number | null {
  const tiles = s.board.tiles.filter((t) => freeTile(s, t.id, ignore) && !avoid.includes(t.id)).map((t) => t.id);
  return tiles.length ? rng.pick(tiles) : null;
}

/** 고즈: 사라졌다가 분신들과 함께 아무 칸에 나타난다. 화면에서는 모두 똑같이 보인다 */
function clones(s: GameState, rng: Rng, boss: Enemy, count: number, turn: BossTurn) {
  s.enemies = s.enemies.filter((e) => e.kind !== 'gozClone');
  const taken: number[] = s.players.map((p) => p.tile);
  const from = boss.tile;
  const to = randomFreeTile(s, rng, boss.id, taken);
  if (to !== null) {
    boss.tile = to;
    taken.push(to);
    turn.moved.push({ enemy: boss.id, path: [from, to] });
  }
  for (let i = 0; i < count; i++) {
    const tile = randomFreeTile(s, rng, undefined, taken);
    if (tile === null) break;
    taken.push(tile);
    s.enemies.push({
      id: s.nextEnemyId++,
      kind: 'gozClone',
      name: boss.name,
      icon: boss.icon,
      isBoss: false,
      tile,
      hp: boss.hp,
      maxHp: boss.maxHp,
      atk: 0,
      def: 0,
      counter: false,
      defense: boss.defense,
      reward: 0,
    });
  }
  // 분신이 생긴 뒤에는 진짜를 가리려고 id 순서를 섞는다
  s.enemies = shuffle(s.enemies, rng);
  turn.lines.push(`분신 ${count}`);
}

/** tile에서 range칸 안 아군 피해 */
function explode(s: GameState, rng: Rng, tile: number, amount: number, range: number, turn: BossTurn, what: string) {
  const dist = distances(s.board, tile);
  log(s, `  💥 ${what} 폭발`);
  for (const p of alive(s)) {
    if ((dist.get(p.tile) ?? Infinity) <= range) hit(s, rng, p, amount, turn, what);
    if (isOver(s)) return;
  }
}

// ───────────────────────── 미니언 ─────────────────────────

function minionTurn(s: GameState, rng: Rng, turn: BossTurn) {
  for (const e of [...s.enemies]) {
    if (e.isBoss || !s.enemies.includes(e) || isOver(s)) continue;
    const info = ENEMIES[e.kind as EnemyKind];
    if (info.fuse) {
      e.timer = (e.timer ?? info.fuse.turns) - 1;
      if (e.timer <= 0) {
        explode(s, rng, e.tile, info.fuse.amount, info.fuse.range, turn, `${e.name} 자폭`);
        s.enemies = s.enemies.filter((x) => x.id !== e.id);
        continue;
      }
    }
    if (info.calls) {
      e.timer = (e.timer ?? info.calls.every) - 1;
      if (e.timer <= 0) {
        e.timer = info.calls.every;
        const spot = neighbors(s, e.tile).find((t) => freeTile(s, t));
        if (spot !== undefined) {
          summonOn(s, info.calls.kind, spot);
          turn.lines.push(`${e.name}: ${ENEMIES[info.calls.kind].name} 호출`);
        }
      }
    }
    if (info.roam) {
      const steps = rng.int(1, info.roam) - kitSlow(s, e);
      if (steps > 0) roam(s, rng, e, steps, turn);
    }
  }
}

function summonOn(s: GameState, kind: EnemyKind, tile: number) {
  const info = ENEMIES[kind];
  s.enemies.push({
    id: s.nextEnemyId++,
    kind,
    name: info.name,
    icon: info.icon,
    isBoss: false,
    tile,
    hp: info.hp,
    maxHp: info.hp,
    atk: info.atk + s.enemyBonus.atk,
    def: info.def + s.enemyBonus.def,
    counter: info.counter,
    defense: info.defense,
    reward: info.reward,
  });
}

/** 한 칸씩 움직인다. 거점 · 워프 · 다른 에너미 칸에는 못 들어간다. 아군 칸에 들어가면 덮친다 */
function roam(s: GameState, rng: Rng, e: Enemy, steps: number, turn: BossTurn) {
  const info = ENEMIES[e.kind as EnemyKind];
  const path = [e.tile];
  for (let i = 0; i < steps; i++) {
    const here = path[path.length - 1];
    let options: number[];
    // 도발 (판다맨 잠재): 도발한 캐릭터를 쫓는다
    const taunter = kitTaunter(s, e);
    if (info.chase || taunter) {
      const targets = taunter ? [taunter.tile] : alive(s).filter((p) => !kitSafe(s, p)).map((p) => p.tile);
      const dist = (t: number) => {
        const d = distances(s.board, t);
        return Math.min(...targets.map((x) => d.get(x) ?? 99));
      };
      options = neighbors(s, here)
        .filter((t) => freeTile(s, t, e.id))
        .sort((a, b) => dist(a) - dist(b) || a - b);
      if (options.length && dist(options[0]) >= dist(here)) options = [];
    } else {
      options = s.board.tiles[here].next.filter((t) => freeTile(s, t, e.id));
    }
    if (options.length === 0) break;
    const step = info.chase || taunter ? options[0] : rng.pick(options);
    path.push(step);
    e.tile = step;
    const victims = alive(s).filter((p) => p.tile === step && !kitSafe(s, p));
    if (victims.length === 0) continue;
    if (info.steal) {
      for (const p of victims) {
        const taken = Math.min(p.coins, info.steal);
        if (taken === 0) continue;
        p.coins -= taken;
        e.loot = (e.loot ?? 0) + taken;
        turn.hits.push({ player: p.id, amount: 0, note: `코인 -${taken}` });
        log(s, `  🪖 ${e.name}: ${p.name}의 코인 ${taken} 훔침`);
      }
      continue;
    }
    // 쫓아와 거는 전투: 몬스터 공격 vs 아군 방어 (주사위 1~6씩, 최소 1)
    for (const p of victims) {
      if (isOver(s)) break;
      const dmg = Math.max(1, e.atk + kitEnemyAtk(e, p) + rng.d6() - (p.def + statusDef(p) + kitDef(s, p, e) + rng.d6()));
      kitFought(s, p, e);
      hit(s, rng, p, dmg, turn, e.name);
      if (!p.ko && !isOver(s)) kitRetaliate(s, rng, p, e, true);
    }
    break;
  }
  if (path.length > 1) turn.moved.push({ enemy: e.id, path });
}

// ───────────────────────── 표식 ─────────────────────────

const MARK_NAME: Record<MarkKind, string> = {
  bomb: '폭탄',
  relicGreen: '성유물 (초록)',
  relicRed: '성유물 (빨강)',
  hat: '모자',
  organ: '파이프 오르간',
  heater: '난로',
  fire: '불길',
  egg: '신비한 알',
  gourd: '호리병',
  mist: '독안개',
  mushroom: '질주 버섯',
  starfruit: '신선 스타프루트',
  peach: '향기로운 복숭아',
  moneyTree: '돈나무',
};

export function markName(kind: MarkKind) {
  return MARK_NAME[kind];
}

function placeMarks(
  s: GameState,
  rng: Rng,
  kind: MarkKind,
  count: number,
  near: 'players' | 'boss' | 'random',
  power?: number,
  timer?: number,
) {
  const used = new Set(s.marks.map((m) => m.tile));
  const ok = (t: number) => {
    const tile = s.board.tiles[t];
    return tile.kind !== 'base' && tile.kind !== 'warp' && !used.has(t) && !s.enemies.some((e) => e.tile === t);
  };
  const placed: Mark[] = [];
  for (let i = 0; i < count; i++) {
    let pool: number[] = [];
    if (near === 'players') {
      const p = rng.pick(alive(s).length ? alive(s) : s.players);
      const dist = distances(s.board, p.tile);
      pool = s.board.tiles.filter((t) => (dist.get(t.id) ?? 99) <= 2 && ok(t.id)).map((t) => t.id);
    } else if (near === 'boss') {
      const dist = distances(s.board, bossTile(s));
      pool = s.board.tiles.filter((t) => (dist.get(t.id) ?? 99) <= 3 && ok(t.id)).map((t) => t.id);
    }
    if (pool.length === 0) pool = s.board.tiles.filter((t) => ok(t.id)).map((t) => t.id);
    if (pool.length === 0) break;
    const tile = rng.pick(pool);
    used.add(tile);
    const mark: Mark = { id: s.nextMarkId++, tile, kind };
    if (kind === 'bomb' || kind === 'fire' || kind === 'hat') {
      mark.timer = timer ?? (kind === 'fire' ? 3 : 2);
      mark.power = power ?? (kind === 'bomb' ? 3 : 2);
    }
    placed.push(mark);
  }
  if (kind === 'hat' && placed.length) {
    s.marks = s.marks.filter((m) => m.kind !== 'hat');
    rng.pick(placed).coin = true;
  }
  s.marks.push(...placed);
  if (placed.length) log(s, `  ${MARK_NAME[kind]} ${placed.length}개`);
}

/** 보스 차례 끝: 폭탄 타이머 · 불길 */
function tickMarks(s: GameState, rng: Rng, turn: BossTurn) {
  for (const m of [...s.marks]) {
    if (m.timer === undefined || !s.marks.includes(m)) continue;
    m.timer -= 1;
    if (m.timer > 0) continue;
    s.marks = s.marks.filter((x) => x.id !== m.id);
    if (m.kind === 'bomb') explode(s, rng, m.tile, m.power ?? 3, 1, turn, '폭탄');
    // 시간 안에 못 찾은 빈 모자는 터진다
    if (m.kind === 'hat' && !m.coin) explode(s, rng, m.tile, m.power ?? 2, 1, turn, '빈 모자');
    if (isOver(s)) return;
  }
}

function tickCurses(s: GameState, rng: Rng, turn: BossTurn) {
  for (const p of alive(s)) {
    if (p.status.curse <= 0) continue;
    p.status.curse -= 1;
    if (p.status.curse > 0) continue;
    if (p.hp >= p.maxHp) {
      log(s, `  ${p.name}: 저주가 풀렸다`);
      continue;
    }
    explode(s, rng, p.tile, 3, 1, turn, `${p.name}의 저주`);
    if (isOver(s)) return;
  }
}

/** 플레이어가 표식 칸에 멈췄다 */
export function landOnMark(s: GameState, rng: Rng, p: Player) {
  if (isAp(s)) {
    for (const m of s.marks.filter((x) => x.tile === p.tile)) apLandMark(s, rng, p, m.kind);
    return;
  }
  const st = s.bossState;
  for (const m of s.marks.filter((x) => x.tile === p.tile)) {
    const remove = () => (s.marks = s.marks.filter((x) => x.id !== m.id));
    switch (m.kind) {
      case 'bomb':
        remove();
        p.coins += 2;
        log(s, `${p.name}: 💣 폭탄 해체! 코인 +2`);
        break;
      case 'relicGreen':
        remove();
        st.vuln = Math.min(3, st.vuln + 1);
        log(s, `${p.name}: 💚 성유물 — 보스가 받는 피해 +${st.vuln}`);
        notice(s, `💚 성유물 — 보스가 받는 피해 +${st.vuln}`);
        break;
      case 'relicRed': {
        remove();
        const move = currentIntent(s);
        if (st.intent && move) {
          st.intent.broken = true;
          log(s, `${p.name}: ❤️ 성유물 — 「${move.name}」 저지`);
          notice(s, `❤️ 성유물 — 「${move.name}」 저지`);
        }
        break;
      }
      case 'hat':
        if (m.coin) {
          s.marks = s.marks.filter((x) => x.kind !== 'hat');
          p.coins += 6;
          log(s, `${p.name}: 🎩 코인이 든 모자! 코인 +6`);
          notice(s, `🎩 정답! 코인 +6`);
        } else {
          remove();
          damage(s, rng, p, 2);
          log(s, `${p.name}: 🎩 빈 모자 — 2 피해`);
        }
        break;
      case 'organ':
        if (st.organ !== 'players') {
          st.organ = 'players';
          log(s, `${p.name}: 🎹 오르간을 아군 쪽으로 돌렸다`);
          notice(s, '🎹 오르간이 아군 쪽으로');
        }
        break;
      case 'heater': {
        const max = s.boss.passive?.heater?.hp ?? 0;
        st.heater = Math.min(max, st.heater + 3);
        heal(p, 2);
        log(s, `${p.name}: 🔥 난로에 불을 지폈다 (${st.heater} / ${max})`);
        break;
      }
      case 'fire':
        damage(s, rng, p, m.power ?? 2);
        log(s, `${p.name}: 🔥 불길 — ${m.power ?? 2} 피해`);
        break;
    }
  }
}

/**
 * 다음 보스 차례에 피해가 날 칸 (화면 경고용, OJ의 공격 범위 미리 보기).
 * 공개된 행동의 범위 공격 · 곧 터질 폭탄 · 자폭 직전 미니언 · 터지기 직전 저주
 */
export function dangerTiles(s: GameState): Set<number> {
  const out = new Set<number>();
  const around = (tile: number, range: number) => {
    const dist = distances(s.board, tile);
    for (const [t, d] of dist) if (d <= range) out.add(t);
  };
  const move = currentIntent(s);
  const boss = bossEnemy(s);
  if (move && boss && !s.bossState.intent?.broken) {
    for (const fx of move.effects) {
      if (fx.type === 'damage' && fx.target === 'near') around(boss.tile, fx.range ?? 2);
      if (fx.type === 'damage' && fx.target === 'line') for (const t of lineTiles(s, boss.tile, fx.range ?? 2)) out.add(t);
      if (fx.type === 'detonate') for (const e of s.enemies) if (e.kind === fx.kind) around(e.tile, fx.range);
    }
  }
  for (const m of s.marks) {
    // 모자는 빈 모자가 드러나지 않게 넣지 않는다
    if (m.kind === 'bomb' && m.timer === 1) around(m.tile, 1);
  }
  for (const e of s.enemies) {
    const fuse = !e.isBoss && ENEMIES[e.kind as EnemyKind].fuse;
    if (fuse && (e.timer ?? fuse.turns) === 1) around(e.tile, fuse.range);
  }
  for (const p of s.players) if (!p.ko && p.status.curse === 1) around(p.tile, 1);
  return out;
}

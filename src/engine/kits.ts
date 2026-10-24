// 아스트랄 파티 캐릭터 스킬 (협동 문구). 글 · 수치는 data/characters.ts, 원작 정리는 docs/COOP_DESIGN.md 9번.
// 게임 곳곳에서 kitXxx를 부르고, 여기서 캐릭터 id별로 처리한다. 뭇별 · Soda · 모나는 skills.ts.
// 캐릭터 상태는 p.stacks (화면에 보이는 고유 스택) · p.charVars (나머지) · p.charTiles (깔아 둔 칸).

import { CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { distances, randomCard, targetable } from './cards';
import { drawCards, heal, log, notice, strikeEnemy } from './game';
import type { Rng } from './rng';
import type { CardId, CharacterId, Enemy, GameState, HandCard, Player } from './types';

// ───────────────────────── 도움 ─────────────────────────

const v = (p: Player) => p.charVars;
/** 이 라운드 동안 (다음 자기 차례 시작까지) 켜 둔 효과 */
const until = (s: GameState) => s.round + 1;
const on = (s: GameState, p: Player, key: string) => (v(p)[key] ?? 0) > s.round;
const half = (p: Player) => p.hp * 2 <= p.maxHp;

function addStack(p: Player, n = 1) {
  const max = CHARACTERS[p.character].stack?.max ?? 99;
  p.stacks = Math.max(0, Math.min(max, p.stacks + n));
}

function monstersNear(s: GameState, tile: number, range: number): Enemy[] {
  const dist = distances(s.board, tile);
  return s.enemies.filter((e) => targetable(s, e) && (dist.get(e.tile) ?? 99) <= range);
}

function alliesNear(s: GameState, tile: number, range: number): Player[] {
  const dist = distances(s.board, tile);
  return s.players.filter((o) => !o.ko && (dist.get(o.tile) ?? 99) <= range);
}

function teammate(s: GameState, id: CharacterId): Player | undefined {
  return s.players.find((o) => o.character === id && !o.ko);
}

function give(s: GameState, to: Player, card: CardId, from?: Player) {
  to.hand.push({ card, ...(from && from.id !== to.id ? { from: from.id } : {}) });
  if (from && from.id !== to.id) kitGive(s, from, to, 1);
}

function tag(e: Enemy, key: keyof NonNullable<Enemy['tags']>, n: number) {
  e.tags = { ...e.tags, [key]: n };
}

const isBattle = (c: CardId) => CARDS[c].type === 'battle';
const isAttackCard = (c: CardId) => CARDS[c].type === 'battle' && CARDS[c].timing === 'attack';
const isDefenseCard = (c: CardId) => CARDS[c].type === 'battle' && CARDS[c].timing === 'defend';

// ───────────────────────── 시작 · 차례 ─────────────────────────

/** 판 시작 */
export function kitCreate(p: Player) {
  if (p.character === 'ame') p.stacks = 2;
}

/** 자기 차례 시작 */
export function kitTurnStart(s: GameState, rng: Rng, p: Player) {
  const c = v(p);
  switch (p.character) {
    case 'alana':
      // 지난 차례 뒤로 피해를 받지 않았으면 용기
      c.brave = c.hurt ? 0 : 1;
      c.hurt = 0;
      break;
    case 'padman': {
      const max = on(s, p, 'angry');
      c.dAtk = max ? 2 : rng.int(-2, 2);
      c.dDef = max ? 2 : rng.int(-2, 2);
      c.dMove = max ? 2 : rng.int(-2, 2);
      log(s, `${p.name}: 줏대 없음 — 공 ${c.dAtk} · 방 ${c.dDef} · 이동 ${c.dMove}`);
      break;
    }
    case 'inkshadow':
      for (const t of Object.keys(p.charTiles)) {
        p.charTiles[+t] -= 1;
        if (p.charTiles[+t] <= 0) delete p.charTiles[+t];
      }
      p.charTiles[p.tile] = 2;
      break;
    case 'nancy':
      if (monstersNear(s, p.tile, 2).length === 0) {
        give(s, p, pickBattleCard(rng));
        c.firewall = until(s);
        log(s, `${p.name}: 방화벽 — 전투 카드 1장 · 공격력 · 방어력 +2`);
      }
      break;
    case 'teru':
      c.god = 0;
      c.godAtk = 0;
      c.godDef = 0;
      break;
    case 'haiqing':
      for (const e of s.enemies) {
        if (e.tagBy?.vuln !== p.id || !e.tags?.vuln) continue;
        e.tags.vuln -= 1;
      }
      break;
    case 'sykes':
      c.zone = 0;
      break;
  }
}

/** 자기 차례 끝 */
export function kitTurnEnd(s: GameState, rng: Rng, p: Player) {
  const c = v(p);
  // 임시 카드 (나디스)
  if (p.hand.some((h) => h.temp)) p.hand = p.hand.filter((h) => !h.temp);
  switch (p.character) {
    case 'fen':
      if (!s.turn.challenged && p.stacks === 0) {
        p.stacks = 1;
        log(s, `${p.name}: 기력 비축`);
      }
      c.burst = 0;
      break;
    case 'megas':
      if (p.hand.length < 6) drawCards(s, p, rng, 1);
      break;
    case 'moses':
    case 'sherry':
      addStack(p, -1);
      break;
    case 'ame':
      if (c.overdose) {
        addStack(p, -4);
        c.overdose = 0;
      }
      break;
    case 'inkshadow':
      c.absorbed = 0;
      break;
    case 'rin':
      c.range = 0;
      break;
    case 'dorothy':
      c.burst = 0;
      c.passAtk = 0;
      break;
  }
}

/** 이동 주사위를 굴리기 직전: 더 가는 칸 */
export function kitMoveBonus(s: GameState, p: Player): number {
  const c = v(p);
  let n = 0;
  if (p.character === 'padman') n += c.dMove ?? 0;
  if (p.character === 'jasmine' && on(s, p, 'overload')) n += 3;
  if (p.character === 'ame' && c.overdose) n += p.stacks;
  if (p.character === 'hanna' && on(s, p, 'float')) n += 2;
  return n;
}

/** 이동 칸 수가 정해졌다 */
export function kitMoved(s: GameState, p: Player, steps: number) {
  const c = v(p);
  switch (p.character) {
    case 'haiqing':
      if (steps === 6) {
        p.coins += 6;
        log(s, `${p.name}: 행운의 눈 — 코인 +6`);
      }
      break;
    case 'jasmine':
      c.moved = (c.moved ?? 0) + steps;
      while (c.moved >= 13) {
        c.moved -= 13;
        if ((c.flip ?? 0) % 2 === 0) p.atk += 1;
        else p.def += 1;
        c.flip = (c.flip ?? 0) + 1;
        log(s, `${p.name}: 이동 충전 — ${c.flip % 2 === 1 ? '공격력' : '방어력'} +1`);
      }
      break;
    case 'hanna':
      if (steps >= 6) p.coins += 1;
      break;
  }
}

/** 이동 중 한 칸에 들어섰다 (전투가 없을 때) */
export function kitPass(s: GameState, rng: Rng, p: Player, tile: number) {
  const c = v(p);
  const kind = s.board.tiles[tile].kind;
  if (p.character === 'luka' && kind === 'checkpoint' && !s.turn.lukaCut) {
    s.turn.lukaCut = true;
    p.skillCooldown = Math.max(0, p.skillCooldown - 2);
    log(s, `${p.name}: 만반의 준비 — 재사용 대기 -2`);
  }
  // 루카 돌진: 지나는 몬스터 피해
  if (p.character === 'luka' && s.turn.noBattle) {
    for (const e of s.enemies.filter((x) => x.tile === tile && targetable(s, x))) {
      strikeEnemy(s, rng, p, e, 2 + p.atk);
    }
  }
  // 링링 돌진: 지나는 몬스터를 붙잡아 데려간다
  if (p.character === 'lingling' && s.turn.charge) {
    for (const e of s.enemies.filter((x) => x.tile === tile && !x.isBoss)) {
      tag(e, 'grab', 2);
      if (!s.turn.grabbed?.includes(e.id)) s.turn.grabbed = [...(s.turn.grabbed ?? []), e.id];
    }
    for (const e of s.enemies) if (s.turn.grabbed?.includes(e.id)) e.tile = tile;
  }
  const others = s.players.filter((o) => o.id !== p.id && !o.ko && o.tile === tile);
  if (others.length === 0) return;
  if (p.character === 'dorothy') {
    for (const o of others) {
      heal(o, 1);
      heal(p, 1);
    }
    if (on(s, p, 'trueSelf')) c.passAtk = 1;
  }
  if (p.character === 'hanna') {
    for (const o of others) {
      p.coins += 1;
      c.doll = Math.min(7, (c.doll ?? 0) + 1);
      if (c.doll >= 7) o.relicVars.warpBoost = (o.relicVars.warpBoost ?? 0) + 2;
      if (o.character === 'sherry') {
        o.relicVars.warpBoost = (o.relicVars.warpBoost ?? 0) + 2;
        addStack(o, 1);
      }
    }
  }
}

/** 몬스터가 걸어오지 못한다 (알라나 철의 처녀 · 한나 부유) */
export function kitSafe(s: GameState, p: Player): boolean {
  return (p.character === 'alana' && on(s, p, 'maiden')) || (p.character === 'hanna' && on(s, p, 'float'));
}

/** 재앙 · 함정 면역 */
export function kitTrapImmune(s: GameState, p: Player): boolean {
  return kitSafe(s, p);
}

// ───────────────────────── 능력치 ─────────────────────────

/** 몬스터를 공격할 때 더하는 공격력 */
export function kitAtk(s: GameState, p: Player, e: Enemy): number {
  const c = v(p);
  let n = 0;
  switch (p.character) {
    case 'alana':
      if (c.brave || on(s, p, 'maiden')) n += 3;
      break;
    case 'padman':
      n += c.dAtk ?? 0;
      break;
    case 'papara':
      if (half(p)) n += 3;
      break;
    case 'inkshadow':
      n += c.absorbed ?? 0;
      break;
    case 'fen':
      n += p.stacks * 2 + (c.burst ? 4 : 0);
      break;
    case 'misaki':
      n += p.stacks + (p.stacks >= 3 ? 2 : 0);
      break;
    case 'nardis':
      n += Math.min(3, p.hand.length);
      break;
    case 'al':
      n += Math.floor(p.starlight / 6);
      break;
    case 'nancy':
      if (on(s, p, 'firewall')) n += 2;
      break;
    case 'teru':
      n += c.godAtk ?? 0;
      break;
    case 'moses':
      n += p.stacks * 2;
      break;
    case 'mamushi':
      if (p.stacks >= 8) n += 4;
      break;
    case 'bonnie':
      if ((e.mark ?? 0) > 0) n += 3;
      break;
    case 'lingling':
      if (e.tags?.grab) n += 2;
      break;
    case 'ame':
      n += p.stacks;
      break;
    case 'dorothy':
      n += (c.passAtk ? 1 : 0) + (c.burst ?? 0);
      break;
    case 'sherry':
      n += p.stacks;
      break;
    case 'zhao':
    default:
      break;
  }
  // 백택의 축복 (누구든): 넘친 회복만큼
  n += c.blessAtk ?? 0;
  return n;
}

/** 방어할 때 더하는 방어력 */
export function kitDef(s: GameState, p: Player): number {
  const c = v(p);
  let n = 0;
  if (p.character === 'padman') n += c.dDef ?? 0;
  if (p.character === 'fen') n += p.stacks * 2;
  if (p.character === 'jasmine' && on(s, p, 'overload')) n -= 3;
  if (p.character === 'al') n += Math.floor(p.starlight / 6);
  if (p.character === 'nancy' && on(s, p, 'firewall')) n += 2;
  if (p.character === 'teru') n += c.godDef ?? 0;
  if (p.character === 'ame') n -= p.stacks;
  if (p.character === 'dorothy') n += p.stacks;
  return n;
}

/** 이 몬스터가 이 플레이어를 공격할 때 공격력 - (팬) */
export function kitEnemyAtk(e: Enemy, p: Player): number {
  if (e.tags?.fan && (p.character === 'kangel' || p.character === 'ame')) return -1;
  return 0;
}

/** 붙잡힌 몬스터 방어력 -2 (링링) */
export function kitEnemyDef(e: Enemy): number {
  return e.tags?.grab ? -2 : 0;
}

/** 모세의 빈틈: 이 몬스터의 주사위는 0 */
export function kitFlaw(e: Enemy, p: Player): boolean {
  return p.character === 'moses' && !!e.tags?.flaw && e.tagBy?.flaw === p.id;
}

/** 효과 카드 사거리 + (린) */
export function kitRange(p: Player): number {
  return p.character === 'rin' && v(p).range ? 3 : 0;
}

/** 원격 도전: 반격 없음 (낸시) */
export function kitNoCounter(s: GameState): boolean {
  return !!s.turn.remoteFar;
}

// ───────────────────────── 전투 ─────────────────────────

/** 내 공격이 몬스터에게 피해를 줬다 */
export function kitHit(s: GameState, rng: Rng, p: Player, e: Enemy, dealt: number) {
  if (dealt <= 0) return;
  switch (p.character) {
    case 'papara':
      if (on(s, p, 'vamp')) {
        const healed = heal(p, Math.ceil(dealt / 2));
        if (healed) log(s, `${p.name}: 흡혈 — 체력 +${healed}`);
      }
      break;
    case 'misaki':
      addStack(p, 1);
      break;
    case 'inkshadow':
      p.charTiles[p.tile] = 2;
      break;
    case 'sykes':
      tag(e, 'erode', (e.tags?.erode ?? 0) + 1);
      break;
  }
  if (p.character === 'kangel' || (p.character === 'ame' && teammate(s, 'kangel'))) tag(e, 'fan', 1);
  // 테루 추격: 강신 대상이 공격했고 몬스터가 살아 있으면
  const teru = s.players.find((o) => o.character === 'teru' && !o.ko && v(o).god === p.id + 1 && o.stacks > 0);
  if (teru && e.hp > 0 && s.enemies.includes(e)) {
    teru.stacks -= 1;
    const amount = Math.max(1, teru.atk + teru.stacks + 1 - e.def);
    log(s, `  ${teru.name}: 여우불 추격`);
    strikeEnemy(s, rng, p, e, amount);
  }
}

/** 몬스터와 싸웠다 (공격 · 반격 · 쫓아온 전투): 팬 */
export function kitFought(s: GameState, p: Player, e: Enemy) {
  if (p.character === 'kangel' || (p.character === 'ame' && teammate(s, 'kangel'))) tag(e, 'fan', 1);
}

/** 회피 성공 */
export function kitEvaded(p: Player) {
  if (p.character === 'misaki' || p.character === 'moses') addStack(p, 1);
}

/** 내가 건 전투가 끝났다 */
export function kitBattleEnd(s: GameState, p: Player) {
  switch (p.character) {
    case 'fen':
      p.stacks = 0;
      break;
    case 'nancy': {
      const i = p.hand.findIndex((h) => isBattle(h.card));
      if (i >= 0) {
        const [gone] = p.hand.splice(i, 1);
        log(s, `${p.name}: 방화벽 — 「${CARDS[gone.card].name}」 버림`);
      }
      break;
    }
    case 'sherry':
      if (!s.turn.sherryDone) {
        s.turn.sherryDone = true;
        addStack(p, 1);
      }
      break;
  }
}

/** 에너미를 쓰러뜨렸다 */
export function kitKill(s: GameState, rng: Rng, p: Player, e: Enemy) {
  if (p.character === 'z3000') p.skillCooldown = Math.max(0, p.skillCooldown - 2);
  if (p.character === 'bonnie' && (e.mark ?? 0) > 0) give(s, p, pickBattleCard(rng));
  if (e.tags?.vuln && e.tagBy?.vuln !== undefined) {
    const h = s.players[e.tagBy.vuln];
    if (h) {
      h.coins += 3;
      log(s, `  ${h.name}: 숙명의 메아리 — 코인 +3`);
    }
  }
}

/** 받는 피해 줄이기 (쥐쥐 보호막 · 셰리 수호) */
export function kitBeforeDamage(s: GameState, p: Player, amount: number): number {
  let dmg = amount;
  if (dmg > 0 && v(p).shield) {
    v(p).shield = 0;
    dmg = Math.max(0, dmg - 99);
    log(s, `${p.name}: 🐭 쥐쥐 보호막`);
  }
  if (dmg > 0 && p.character === 'hanna') {
    const sherry = teammate(s, 'sherry');
    if (sherry && (distances(s.board, p.tile).get(sherry.tile) ?? 99) <= 4) dmg = Math.max(0, dmg - 1);
  }
  return dmg;
}

/** 피해를 받았다 */
export function kitDamaged(s: GameState, p: Player, dmg: number) {
  if (dmg <= 0) return;
  switch (p.character) {
    case 'alana':
      v(p).hurt = 1;
      v(p).brave = 0;
      break;
    case 'lulu':
      p.healStacks += 1;
      p.skillCooldown = Math.max(0, p.skillCooldown - 1);
      break;
    case 'ame':
      addStack(p, 1);
      break;
    case 'kangel': {
      const ame = teammate(s, 'ame');
      if (ame) addStack(ame, 1);
      break;
    }
  }
}

/** 쓰러졌다 */
export function kitKO(p: Player) {
  if (p.character === 'misaki') p.stacks = 0;
}

/** 회복했다 (넘친 양 포함) */
export function kitHealed(p: Player, healed: number, over: number) {
  if (p.character === 'dorothy' && healed > 0) addStack(p, 1);
  if (over > 0 && (v(p).blessUntil ?? 0) > 0) v(p).blessAtk = (v(p).blessAtk ?? 0) + over;
}

// ───────────────────────── 카드 · 칸 ─────────────────────────

/** 효과 카드를 썼다 */
export function kitEffectCard(s: GameState, rng: Rng, p: Player, card: HandCard) {
  const c = v(p);
  if (p.character === 'komachi') {
    c.effects = (c.effects ?? 0) + 1;
    if (c.effects % 3 === 0) {
      p.hand.push({ card: card.card });
      log(s, `${p.name}: 복제 닌자 — 「${CARDS[card.card].name}」`);
    }
  }
  if (p.character === 'pandaman' && (card.card === 'cake' || card.card === 'bandage')) {
    for (const o of alliesNear(s, p.tile, 5)) heal(o, 2);
    log(s, `${p.name}: 5칸 안 아군 체력 +2`);
  }
  if (card.card === 'livingPage' && p.character === 'rin') c.page = (c.page ?? 0) + 1;
  void rng;
}

/** 전투 카드를 썼다 */
export function kitBattleCard(s: GameState, p: Player, card: CardId) {
  if (!isAttackCard(card) || (CARDS[card].battleCost ?? 0) < 2) return;
  for (const teru of s.players.filter((o) => o.character === 'teru' && !o.ko)) {
    if (teru.id === p.id || v(teru).god === p.id + 1) addStack(teru, 1);
  }
}

/** 카드를 버렸다 (미미) */
export function kitDiscard(s: GameState, p: Player, cards: HandCard[]) {
  if (p.character !== 'mimi') return;
  const n = cards.filter((h) => isBattle(h.card)).length;
  if (n) {
    p.coins += n;
    log(s, `${p.name}: 기한 지난 회수 — 코인 +${n}`);
  }
}

/** 카드를 다른 캐릭터에게 줬다 */
export function kitGive(s: GameState, from: Player, to: Player, n: number) {
  if (from.character === 'al') {
    from.starlight += n;
    to.starlight += n;
  }
  if (from.character === 'mamushi') {
    const before = from.stacks;
    addStack(from, n);
    if (before < 8 && from.stacks >= 8) {
      log(s, `${from.name}: 🐉 진룡`);
      notice(s, `🐉 ${from.name} 진룡`);
    }
  }
}

/** 이벤트를 일으켰다 */
export function kitEvent(s: GameState, p: Player) {
  if (p.character === 'fanny') {
    p.coins += 3;
    log(s, `${p.name}: 포인트 발견! 코인 +3`);
  }
  if (p.character === 'rin') give(s, p, 'livingPage');
}

/** 상점에 들어갔다: 전투 카드 1장 더 (파루난) */
export function kitShop(s: GameState, rng: Rng, p: Player): CardId | null {
  if (p.character !== 'parunan') return null;
  p.coins += 1;
  log(s, `${p.name}: 전설의 상인 — 코인 +1`);
  return pickBattleCard(rng);
}

function pickBattleCard(rng: Rng): CardId {
  for (let i = 0; i < 50; i++) {
    const c = randomCard(rng);
    if (isBattle(c)) return c;
  }
  return 'atkM';
}

/** 라운드 끝 (보스 차례 뒤) */
export function kitRoundEnd(s: GameState, rng: Rng) {
  for (const p of s.players) {
    if (p.ko) continue;
    if (p.character === 'inkshadow') {
      for (const e of s.enemies.filter((x) => p.charTiles[x.tile] && targetable(s, x))) {
        log(s, `  ${p.name}: 그림자 — ${e.name}`);
        strikeEnemy(s, rng, p, e, 1);
      }
    }
    if (p.character === 'sykes') {
      for (const e of monstersNear(s, p.tile, 2)) {
        const n = 1 + (e.tags?.erode ?? 0);
        if (e.tags) e.tags.erode = 0;
        log(s, `  ${p.name}: 촉수 — ${e.name}`);
        strikeEnemy(s, rng, p, e, n);
      }
    }
  }
  for (const e of s.enemies) {
    if (e.tags?.grab) e.tags.grab -= 1;
  }
}

/** 마역: 이 몬스터의 이동 -2 (사이크스) */
export function kitSlow(s: GameState, e: Enemy): number {
  for (const p of s.players) {
    const zone = v(p).zone;
    if (p.character !== 'sykes' || !zone) continue;
    if ((distances(s.board, zone - 1).get(e.tile) ?? 99) <= 2) return 2;
  }
  return 0;
}

// ───────────────────────── 액티브 ─────────────────────────

export interface KitInput {
  target?: number;
  cards?: number[];
  value?: number;
}

/** kits.ts가 맡는 캐릭터인지 */
export function isKit(id: CharacterId): boolean {
  return id !== 'mutbyeol' && id !== 'soda' && id !== 'mona';
}

/**
 * 액티브 효과. 반환값이 있으면 그 행동을 game.ts가 이어서 한다 (상점 열기 · 원격 전투 · 순간이동)
 */
export type KitFollow =
  | { kind: 'shop' }
  | { kind: 'challenge'; enemy: number; far: boolean }
  | { kind: 'teleport'; tile: number }
  | null;

export function kitActive(s: GameState, rng: Rng, p: Player, input: KitInput): KitFollow {
  const c = v(p);
  const enemy = input.target !== undefined ? s.enemies.find((e) => e.id === input.target) : undefined;
  const ally = input.target !== undefined ? s.players[input.target] : undefined;
  const picked = [...new Set(input.cards ?? [])].sort((a, b) => b - a);
  const takeCards = () => picked.map((i) => p.hand.splice(i, 1)[0]).reverse();

  switch (p.character) {
    case 'parunan':
      return { kind: 'shop' };
    case 'fanny':
      s.turn.extraEvent = true;
      break;
    case 'alana':
      c.maiden = until(s);
      break;
    case 'komachi':
      s.turn.extraPlays += 1;
      break;
    case 'padman':
      c.angry = until(s);
      c.dAtk = c.dDef = c.dMove = 2;
      break;
    case 'papara':
      if (p.hp * 2 > p.maxHp) {
        p.hp = Math.max(1, p.hp - 3);
        log(s, `${p.name}: 3 피해`);
      }
      c.vamp = until(s);
      break;
    case 'ren': {
      give(s, ally!, randomCard(rng), p);
      v(ally!).shield = 1;
      if (ally!.id !== p.id && half(ally!)) {
        give(s, p, randomCard(rng));
        c.shield = 1;
      }
      break;
    }
    case 'mimi': {
      const all = p.hand.splice(0);
      kitDiscard(s, p, all);
      drawCards(s, p, rng, all.length + 1);
      break;
    }
    case 'z3000':
      enemy!.tile = p.tile;
      strikeEnemy(s, rng, p, enemy!, 5);
      break;
    case 'pandaman':
      give(s, p, rng.next() < 0.5 ? 'cake' : 'bandage');
      break;
    case 'inkshadow': {
      const tiles = Object.keys(p.charTiles).map(Number).filter((t) => t !== p.tile);
      const n = Object.keys(p.charTiles).length;
      p.charTiles = {};
      c.absorbed = n;
      log(s, `${p.name}: 그림자 ${n}개 흡수 — 공격력 +${n}`);
      if (tiles.length) return { kind: 'teleport', tile: tiles[tiles.length - 1] };
      break;
    }
    case 'lulu':
      ally!.healStacks += 3;
      break;
    case 'fen': {
      heal(p, 2);
      if (p.stacks > 0) c.burst = 1;
      const zhao = teammate(s, 'zhao');
      if (zhao) give(s, zhao, 'talismanFu');
      break;
    }
    case 'haiqing':
      tag(enemy!, 'vuln', 2);
      enemy!.tagBy = { ...enemy!.tagBy, vuln: p.id };
      break;
    case 'misaki':
      strikeEnemy(s, rng, p, enemy!, 2);
      addStack(p, 1);
      break;
    case 'nardis':
      for (let i = 0; i < 3; i++) p.hand.push({ card: randomCard(rng), temp: true });
      break;
    case 'jasmine':
      c.overload = until(s);
      break;
    case 'al': {
      const cards = takeCards();
      for (const h of cards) ally!.hand.push({ ...h, from: p.id });
      p.coins += cards.length;
      kitGive(s, p, ally!, cards.length);
      break;
    }
    case 'luka':
      s.turn.sixDice = true;
      s.turn.diceCount = Math.max(2, s.turn.diceCount);
      s.turn.noBattle = true;
      break;
    case 'nancy': {
      const far = (distances(s.board, p.tile).get(enemy!.tile) ?? 99) > 2;
      return { kind: 'challenge', enemy: enemy!.id, far };
    }
    case 'rin':
      give(s, p, 'livingPage');
      c.range = 1;
      break;
    case 'megas': {
      const all = p.hand.splice(0);
      const cost = all.reduce((a, h) => a + (CARDS[h.card].battleCost ?? 0), 0);
      const times = Math.floor(all.length / 2);
      const amount = Math.ceil(3 + cost / 3);
      for (let i = 0; i < times; i++) {
        const near = monstersNear(s, p.tile, 6);
        if (!near.length || s.phase.kind === 'gameOver') break;
        strikeEnemy(s, rng, p, rng.pick(near), amount);
      }
      break;
    }
    case 'zhao':
      v(ally!).blessUntil = until(s);
      v(ally!).blessAtk = 0;
      give(s, p, 'talismanFu');
      for (const h of p.hand) if (h.card === 'talismanHuo') h.card = 'talismanFu';
      break;
    case 'teru':
      c.god = ally!.id + 1;
      c.godAtk = Math.ceil(ally!.atk / 2);
      c.godDef = Math.ceil(ally!.def / 2);
      break;
    case 'moses':
      tag(enemy!, 'flaw', 1);
      enemy!.tagBy = { ...enemy!.tagBy, flaw: p.id };
      break;
    case 'mamushi':
      give(s, p, 'bite');
      for (const o of alliesNear(s, p.tile, 5)) {
        if (o.id === p.id) continue;
        const n = o.hand.length < 4 ? 2 : 1;
        for (let i = 0; i < n; i++) o.hand.push({ card: randomCard(rng), from: p.id });
        kitGive(s, p, o, n);
      }
      break;
    case 'bonnie':
      enemy!.mark = (enemy!.mark ?? 0) + 1;
      tag(enemy!, 'probe', 1);
      p.coins += enemy!.mark * 2;
      break;
    case 'lingling':
      s.turn.fixedMove = input.value!;
      s.turn.charge = true;
      s.turn.noBattle = true;
      break;
    case 'sykes':
      c.zone = p.tile + 1;
      break;
    case 'kangel': {
      const fans = s.enemies.filter((e) => e.tags?.fan).length;
      p.coins += Math.min(7, 1 + fans);
      if (fans >= 3) heal(p, 3);
      break;
    }
    case 'ame':
      heal(p, p.stacks);
      c.overdose = 1;
      break;
    case 'jill': {
      const cards = takeCards();
      const kinds = new Set(cards.map((h) => (isAttackCard(h.card) ? 'atk' : isDefenseCard(h.card) ? 'def' : 'fx')));
      for (const h of cards) {
        if (isAttackCard(h.card)) ally!.status.atkUp = { amount: (ally!.status.atkUp?.amount ?? 0) + 1, turns: 1 };
        else if (isDefenseCard(h.card)) ally!.status.defUp = { amount: (ally!.status.defUp?.amount ?? 0) + 1, turns: 1 };
        else heal(ally!, 1);
      }
      if (kinds.size === 3) p.coins += 3;
      if (kinds.size === 1) ally!.relicVars.warpBoost = (ally!.relicVars.warpBoost ?? 0) + 3;
      drawCards(s, p, rng, cards.length);
      break;
    }
    case 'dorothy': {
      heal(p, 1);
      heal(ally!, 1);
      c.trueSelf = until(s);
      if (p.stacks >= 5) {
        c.burst = p.def + p.stacks;
        p.stacks = 0;
      }
      return { kind: 'teleport', tile: ally!.tile };
    }
    case 'hanna':
      c.float = until(s);
      break;
    case 'sherry': {
      const near = monstersNear(s, p.tile, 3).filter((e) => !e.isBoss);
      let dest = p.tile;
      for (let i = 0; i < 7; i++) dest = s.board.tiles[dest].next[0];
      for (const e of near) {
        e.tile = dest;
        strikeEnemy(s, rng, p, e, 2);
      }
      break;
    }
  }
  return null;
}

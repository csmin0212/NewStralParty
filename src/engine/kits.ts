// 아스트랄 파티 캐릭터 스킬 (협동 문구). 글 · 수치는 data/characters.ts, 원작 정리는 docs/COOP_DESIGN.md 9번.
// 게임 곳곳에서 kitXxx를 부르고, 여기서 캐릭터 id별로 처리한다. 뭇별 · Soda · 모나는 skills.ts.
// 캐릭터 상태는 p.stacks (화면에 보이는 고유 스택) · p.charVars (나머지) · p.charTiles (깔아 둔 칸).

import { CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { distances, randomCard, targetable } from './cards';
import { damage, drawCards, heal, log, notice, strikeEnemy } from './game';
import { offerRelic } from './relics';
import type { Rng } from './rng';
import type { AttackResult, CardId, CharacterId, Enemy, GameState, HandCard, Player, ShopOffer } from './types';

// ───────────────────────── 도움 ─────────────────────────

const v = (p: Player) => p.charVars;
/** 이 라운드 동안 (다음 자기 차례 시작까지) 켜 둔 효과 */
const until = (s: GameState) => s.round + 1;
const on = (s: GameState, p: Player, key: string) => (v(p)[key] ?? 0) > s.round;
const half = (p: Player) => p.hp * 2 <= p.maxHp;

function addStack(p: Player, n = 1) {
  const max = (CHARACTERS[p.character].stack?.max ?? 99) + (p.charVars.stackMax ?? 0);
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
const FOOD = new Set<CardId>(['cookie', 'cake', 'bandage', 'pudding']);
const isAttackCard = (c: CardId) => CARDS[c].type === 'battle' && CARDS[c].timing === 'attack';
const isDefenseCard = (c: CardId) => CARDS[c].type === 'battle' && CARDS[c].timing === 'defend';

// ───────────────────────── 시작 · 차례 ─────────────────────────

/** 판 시작 */
export function kitCreate(p: Player) {
  if (p.character === 'ame') p.stacks = 2;
  if (p.character === 'lingling') p.hand.push({ card: 'banSign' }, { card: 'banSign' });
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
      c.absorbed = 0;
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
      for (const e of s.enemies) if (e.tags?.erode) e.tags.erode = 0;
      break;
  }
}

/** 자기 차례 끝 */
export function kitTurnEnd(s: GameState, rng: Rng, p: Player) {
  const c = v(p);
  // 임시 카드 (나르디스)
  if (p.hand.some((h) => h.temp)) p.hand = p.hand.filter((h) => !h.temp);
  // 부적 카드 - 불행: 턴 끝에 손에 있으면 체력 -1
  const huo = p.hand.filter((h) => h.card === 'talismanHuo').length;
  if (huo) damage(s, rng, p, huo);
  switch (p.character) {
    case 'fen':
      if (!s.turn.challenged && p.stacks < fenMax(p)) {
        p.stacks += 1;
        log(s, `${p.name}: 에너지 보존 ${p.stacks}`);
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
    case 'sykes':
      // 턴 끝: 내 칸에 촉수 · 촉수 전부 작동
      p.charTiles[p.tile] = 1;
      activateTentacles(s, rng, p, p.tile, 99);
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
  if (p.character === 'ame' && on(s, p, 'overdose')) n += c.loveMove ?? 0;
  if (p.character === 'hanna' && on(s, p, 'float')) n += 2;
  return n;
}

/** 이동 칸 수가 정해졌다 (dice: 이동 주사위 눈) */
export function kitMoved(s: GameState, rng: Rng, p: Player, steps: number, dice: number[]) {
  const c = v(p);
  switch (p.character) {
    case 'haiqing':
      if (dice.includes(6)) {
        p.coins += 6;
        log(s, `${p.name}: 행운의 번호 — 코인 +6`);
      }
      break;
    case 'zhao':
      if (dice.includes(1)) give(s, p, 'talismanHuo');
      if (dice.includes(6)) give(s, p, 'talismanFu');
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
  // 자스민 잠재: 오버드라이브 뒤 첫 주사위가 10 이상이면 공격력 +2, 아니면 방어력 +2
  if (p.character === 'jasmine' && c.overPending) {
    c.overPending = 0;
    c[dice.reduce((a, b) => a + b, 0) >= 10 ? 'jasAtk' : 'jasDef'] = until(s);
  }
  void rng;
}

/** 대시 칸에 멈췄다 (자스민 잠재: 재사용 대기 -2) */
export function kitHaste(s: GameState, p: Player) {
  if (p.character !== 'jasmine' || !p.potential) return;
  p.skillCooldown = Math.max(0, p.skillCooldown - 2);
  log(s, `${p.name}: 대시 — 재사용 대기 -2`);
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
  // 링링 태클: 지나는 몬스터를 도착지점까지 튕겨 낸다
  if (p.character === 'lingling' && s.turn.charge) {
    for (const e of s.enemies.filter((x) => x.tile === tile && !x.isBoss)) {
      if (!s.turn.grabbed?.includes(e.id)) s.turn.grabbed = [...(s.turn.grabbed ?? []), e.id];
    }
    for (const e of s.enemies) if (s.turn.grabbed?.includes(e.id)) e.tile = tile;
    if (signOwner(s, tile)) {
      s.turn.signPassed = true;
      takeSign(s, p, tile);
    }
  }
  // 미니 슬라임 (루루 잠재): 지나가면 없애고 체력 +1 · 치유 +1
  for (const lulu of s.players) {
    if (lulu.character !== 'lulu' || !lulu.charTiles[tile]) continue;
    delete lulu.charTiles[tile];
    heal(p, 1);
    p.healStacks += 1;
    log(s, `${p.name}: 미니 슬라임 — 체력 +1 · 치유 +1`);
  }
  const others = s.players.filter((o) => o.id !== p.id && !o.ko && o.tile === tile);
  if (others.length === 0) return;
  void rng;
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
      // 부유 중이고 코인이 넉넉하면 그 아군에게 3 송금
      if (on(s, p, 'float') && p.coins >= 3) {
        p.coins -= 3;
        o.coins += 3;
      }
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
      // 잠재: 한 입만 동안은 절반 미만으로 친다
      if (half(p) || (p.potential && on(s, p, 'vamp'))) n += 3;
      break;
    case 'jasmine':
      if (on(s, p, 'jasAtk')) n += 2;
      break;
    case 'luka':
      if (on(s, p, 'lukaUntil')) n += c.lukaAtk ?? 0;
      break;
    case 'sykes':
      n += e.tags?.erode ?? 0;
      break;
    case 'inkshadow':
      n += c.absorbed ?? 0;
      break;
    case 'fen':
      n += (p.stacks > 0 ? 2 : 0) + (c.burst ? 4 : 0);
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
      if (on(s, p, 'signAtk')) n += 2;
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
  if (p.character === 'fen' && p.stacks > 0) n += 2;
  if (p.character === 'jasmine' && on(s, p, 'overload')) n -= 3;
  if (p.character === 'jasmine' && on(s, p, 'jasDef')) n += 2;
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

/** 태클 당한 몬스터 방어력 -2 (링링 · 금지 표지판을 지났을 때) */
export function kitEnemyDef(e: Enemy): number {
  return e.tags?.grab ? -2 : 0;
}

/** 이 몬스터를 도발한 캐릭터 (판다맨 잠재) */
export function kitTaunter(s: GameState, e: Enemy): Player | undefined {
  if (!e.tags?.taunt || e.tagBy?.taunt === undefined) return undefined;
  const p = s.players[e.tagBy.taunt];
  return p && !p.ko ? p : undefined;
}

/** 모제스 약점: 이 몬스터의 주사위는 0 */
export function kitFlaw(e: Enemy, p: Player): boolean {
  return p.character === 'moses' && !!e.tags?.flaw && e.tagBy?.flaw === p.id;
}

/** 효과 카드 사거리 + (린) */
export function kitRange(p: Player): number {
  return p.character === 'rin' && v(p).range ? 3 : 0;
}

/** 원격 도전: 반격 없음 (낸시) */
export function kitNoCounter(s: GameState): boolean {
  return !!s.turn.remoteFar || alanaGuard(s, s.players[s.current]);
}

/** 알라나 잠재: 액티브를 쓴 그 턴 동안 피해 · 반격 없음 */
function alanaGuard(s: GameState, p: Player): boolean {
  return p.character === 'alana' && p.potential && s.current === p.id && s.turn.skillUsed;
}

// ───────────────────────── 전투 ─────────────────────────

/** 내 공격이 몬스터에게 피해를 줬다 */
export function kitHit(s: GameState, rng: Rng, p: Player, e: Enemy, dealt: number) {
  if (dealt <= 0) return;
  if (p.character === 'fen' && p.potential && p.stacks >= 5) {
    p.stacks -= 2;
    const splash = Math.floor(dealt * 0.88);
    log(s, `  ${p.name}: 에너지 보존 — 2칸 안 몬스터 ${splash} 피해`);
    for (const x of monstersNear(s, e.tile, 2)) if (x.id !== e.id && splash > 0 && s.phase.kind !== 'gameOver') strikeEnemy(s, rng, p, x, splash);
  }
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
  void rng;
  if (p.character === 'kangel' || (p.character === 'ame' && teammate(s, 'kangel'))) tag(e, 'fan', 1);
  // 테루 추격: 삼신 빙의 대상이 공격했고 몬스터가 살아 있으면
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
      p.stacks = Math.max(0, p.stacks - 1);
      break;
    case 'nancy': {
      // 스킬로 건 전투 · 잠재: 손패 5장 이하면 버리지 않는다
      if (s.turn.remote || (p.potential && p.hand.length <= 5)) break;
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
  if (p.character === 'z3000') {
    p.skillCooldown = Math.max(0, p.skillCooldown - 2);
    // 잠재: 2마리마다 공격력 +1 (계속)
    if (p.potential) {
      v(p).kills = (v(p).kills ?? 0) + 1;
      if (v(p).kills % 2 === 0) {
        p.atk += 1;
        log(s, `${p.name}: 공격력 +1`);
      }
    }
  }
  if (p.character === 'bonnie' && (e.mark ?? 0) > 0) give(s, p, pickBattleCard(rng));
  if (e.tags?.vuln && e.tagBy?.vuln !== undefined) {
    const h = s.players[e.tagBy.vuln];
    if (h) {
      h.coins += 3;
      log(s, `  ${h.name}: 허약의 표식 — 코인 +3`);
      // 잠재: 처치한 캐릭터에게 운명의 인도
      if (h.potential) give(s, p, 'fateGuide');
    }
  }
}

/** 받는 피해 줄이기 (쥐쥐 보호막 · 절친의 수호) */
export function kitBeforeDamage(s: GameState, p: Player, amount: number): number {
  let dmg = amount;
  if (dmg > 0 && alanaGuard(s, p)) {
    log(s, `${p.name}: 아이언 메이든 — 피해 0`);
    return 0;
  }
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
    case 'pandaman':
      v(p).lastHit = dmg;
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
export function kitEffectCard(s: GameState, rng: Rng, p: Player, card: HandCard, target?: Enemy) {
  const c = v(p);
  if (p.character === 'komachi') {
    c.effects = (c.effects ?? 0) + 1;
    if (c.effects % 3 === 0) {
      p.hand.push({ card: card.card });
      log(s, `${p.name}: 카피 닌자 — 「${CARDS[card.card].name}」`);
      if (p.potential) {
        p.skillCooldown = Math.max(0, p.skillCooldown - 1);
        c.fxDamage = (c.fxDamage ?? 0) + 1;
      }
    }
  }
  if (p.character === 'pandaman' && (card.card === 'cake' || card.card === 'bandage')) {
    for (const o of alliesNear(s, p.tile, 5)) heal(o, 2);
    log(s, `${p.name}: 5칸 안 아군 체력 +2`);
  }
  // 판다맨 잠재: 음식을 먹으면 반격 1 · 햄버거면 최대 체력 +2
  if (p.character === 'pandaman' && p.potential && FOOD.has(card.card)) {
    c.counter = (c.counter ?? 0) + 1;
    if (card.card === 'bandage') {
      p.maxHp += 2;
      p.hp += 2;
    }
  }
  // 메가스 잠재: 레일건 뒤 전투 카드 1장 · 그 코스트만큼 목표와 2칸 안 몬스터에게
  if (p.character === 'megas' && p.potential && card.card === 'railgun' && target) {
    const drawn = pickBattleCard(rng);
    give(s, p, drawn);
    const amount = CARDS[drawn].battleCost ?? 0;
    if (amount > 0) for (const e of [target, ...monstersNear(s, target.tile, 2).filter((x) => x.id !== target.id)]) {
      if (s.enemies.includes(e) && s.phase.kind !== 'gameOver') strikeEnemy(s, rng, p, e, amount);
    }
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
  if (from.character === 'al' && n > 0) {
    from.starlight += 1;
    to.starlight += 1;
  }
  if (from.character === 'mamushi') awaken(s, from, n);
}

/** 마무시 각성 +n · 8이면 진룡 */
function awaken(s: GameState, p: Player, n: number) {
  const before = p.stacks;
  addStack(p, n);
  if (before < 8 && p.stacks >= 8) {
    log(s, `${p.name}: 🐉 진룡`);
    notice(s, `🐉 ${p.name} 진룡`);
    for (const h of p.hand) if (h.card === 'bite') h.card = 'dragonRoar';
  }
}

/** 깨물기: 각성 +1 · 각성만큼 공격력 (최대 4) */
export function kitBite(s: GameState, p: Player): number {
  if (p.character !== 'mamushi') return 1;
  awaken(s, p, 1);
  return Math.min(4, p.stacks);
}

/** 용의 포효: 이번 턴 대상 이동 -9 */
export function kitRoar(s: GameState, e: Enemy) {
  tag(e, 'slow', (e.tags?.slow ?? 0) + 9);
  void s;
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

/** 파루난 잠재: 모든 상점 전투 카드 +1 · 각 카드 10%로 1코인 */
export function kitShopOffers(s: GameState, rng: Rng, offers: ShopOffer[], price: number) {
  if (!s.players.some((o) => o.character === 'parunan' && o.potential)) return;
  offers.push({ card: pickBattleCard(rng), price, sold: false });
  for (const o of offers) if (o.price > 1 && rng.next() < 0.1) o.price = 1;
}

/** 파루난 잠재: 송금하면 지금 상점 카드 1장을 1코인으로 */
export function kitTransfer(s: GameState, p: Player, offers: ShopOffer[]) {
  if (p.character !== 'parunan' || !p.potential) return;
  const best = offers.filter((o) => !o.sold && o.price > 1).sort((a, b) => b.price - a.price)[0];
  if (best) best.price = 1;
  void s;
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
    if (p.character === 'ame' && v(p).overdose) {
      addStack(p, -4);
      v(p).overdose = 0;
    }
  }
  for (const e of s.enemies) {
    if (!e.tags) continue;
    if (e.tags.grab) e.tags.grab -= 1;
    if (e.tags.taunt) e.tags.taunt -= 1;
    e.tags.slow = 0;
  }
}

/** 마역: 이 몬스터의 이동 -2 (사이크스) */
export function kitSlow(s: GameState, e: Enemy): number {
  let n = e.tags?.slow ?? 0;
  for (const p of s.players) {
    const zone = v(p).zone;
    if (p.character !== 'sykes' || !zone) continue;
    if ((distances(s.board, zone - 1).get(e.tile) ?? 99) <= 2) {
      n += 2;
      break;
    }
  }
  return n;
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
      // 패시브가 꺼져 있으면 바로 켠다
      c.brave = 1;
      break;
    case 'komachi':
      s.turn.extraPlays += 1;
      break;
    case 'padman':
      c.angry = until(s);
      c.dAtk = c.dDef = c.dMove = 2;
      break;
    case 'papara':
      if (!p.potential && p.hp * 2 > p.maxHp) {
        p.hp = Math.max(1, p.hp - 3);
        log(s, `${p.name}: 3 피해`);
      }
      c.vamp = until(s);
      break;
    case 'ren': {
      give(s, ally!, randomCard(rng), p);
      v(ally!).shield = 1;
      if (p.potential) v(ally!).counter = (v(ally!).counter ?? 0) + 1;
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
      // 잠재: 공격력이 6보다 크면 끌어온 몬스터에게 도전 (보내기도 된다)
      if (p.potential && p.atk > 6 && s.enemies.includes(enemy!) && s.phase.kind !== 'gameOver') {
        return { kind: 'challenge', enemy: enemy!.id, far: false };
      }
      break;
    case 'pandaman':
      give(s, p, rng.next() < 0.5 ? 'cake' : 'bandage');
      // 잠재: 5칸 안 몬스터를 1턴 동안 도발
      if (p.potential) {
        for (const e of monstersNear(s, p.tile, 5)) {
          tag(e, 'taunt', 1);
          e.tagBy = { ...e.tagBy, taunt: p.id };
        }
      }
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
      // 잠재: 4칸 안 몬스터 다음 이동 -3
      if (p.potential) for (const e of monstersNear(s, p.tile, 4)) tag(e, 'slow', (e.tags?.slow ?? 0) + 3);
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
      // 잠재: 손패의 스마트 주사위 → 운명의 인도
      if (p.potential) for (const h of p.hand) if (h.card === 'remoteDice') h.card = 'fateGuide';
      break;
    case 'misaki': {
      const full = p.stacks >= 3;
      strikeEnemy(s, rng, p, enemy!, 2);
      if (p.potential && full) {
        p.stacks -= 2;
        give(s, p, 'gawu');
      }
      addStack(p, 1);
      break;
    }
    case 'nardis':
      for (let i = 0; i < 3; i++) p.hand.push({ card: randomCard(rng), temp: true });
      break;
    case 'jasmine':
      c.overload = until(s);
      if (p.potential) c.overPending = 1;
      break;
    case 'al': {
      const cards = takeCards();
      for (const h of cards) ally!.hand.push({ ...h, from: p.id });
      p.coins += cards.length;
      kitGive(s, p, ally!, cards.length);
      break;
    }
    case 'luka':
      // 잠재: 전투 카드 1장을 버리면 이번 턴 공격력 + (성 + 버린 카드 코스트)
      if (p.potential) {
        const [gone] = takeCards();
        if (gone) {
          c.lukaAtk = p.level + (CARDS[gone.card].battleCost ?? 0);
          c.lukaUntil = until(s);
        }
      }
      s.turn.sixDice = true;
      s.turn.diceCount = Math.max(2, s.turn.diceCount);
      s.turn.noBattle = true;
      break;
    case 'nancy': {
      const d = distances(s.board, p.tile).get(enemy!.tile) ?? 99;
      // 잠재: 6칸보다 멀면 전투 카드 1장 · 방화벽
      if (p.potential && d > 6) {
        give(s, p, pickBattleCard(rng));
        c.firewall = until(s);
      }
      return { kind: 'challenge', enemy: enemy!.id, far: d > 2 };
    }
    case 'rin':
      give(s, p, 'livingPage');
      c.range = 1;
      break;
    case 'megas': {
      const all = p.hand.splice(0);
      const cost = all.reduce((a, h) => a + (CARDS[h.card].battleCost ?? 0), 0);
      const times = Math.floor(all.length / 2);
      const amount = 3 + Math.floor(cost / 3);
      // 잠재: 1장 뽑기 · 6장 이상 버리면 레일건
      if (p.potential) {
        drawCards(s, p, rng, 1);
        if (all.length >= 6) p.hand.push({ card: 'railgun', shop: true });
      }
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
      give(s, p, p.stacks >= 8 ? 'dragonRoar' : 'bite');
      for (const o of alliesNear(s, p.tile, p.stacks >= 8 ? 99 : 5)) {
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
      s.turn.grabbed = [];
      s.turn.signPassed = false;
      break;
    case 'sykes': {
      // 4칸 안에서 몬스터가 가장 많이 걸리는 칸 (2칸 안)
      const dist = distances(s.board, p.tile);
      const tiles = [...dist].filter(([, d]) => d <= 4).map(([t]) => t);
      const score = (t: number) => monstersNear(s, t, 2).length;
      const tile = tiles.sort((a, b) => score(b) - score(a) || (dist.get(a) ?? 0) - (dist.get(b) ?? 0))[0] ?? p.tile;
      p.charTiles[tile] = 1;
      c.zone = tile + 1;
      activateTentacles(s, rng, p, tile, 2);
      break;
    }
    case 'kangel': {
      const fans = s.enemies.filter((e) => e.tags?.fan);
      p.coins += Math.min(p.potential ? 10 : 7, 1 + fans.length);
      if (fans.length >= 3) heal(p, 3);
      // 잠재: 팬 9 이상이면 다른 아군 코인 +3 · 모든 팬 공격력 -1 (영구, 한 번)
      if (p.potential && fans.length >= 9) {
        for (const o of s.players) if (o.id !== p.id) o.coins += 3;
        for (const e of fans) {
          if (e.tags?.fanDown) continue;
          e.atk = Math.max(0, e.atk - 1);
          tag(e, 'fanDown', 1);
        }
      }
      break;
    }
    case 'ame':
      heal(p, p.stacks);
      c.overdose = until(s);
      c.loveMove = p.stacks;
      // 잠재: 사랑 4 이상이면 최대 체력 +1 · 사랑 최대 +1
      if (p.potential && p.stacks >= 4) {
        p.maxHp += 1;
        p.hp += 1;
        c.stackMax = (c.stackMax ?? 0) + 1;
      }
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

// ───────────────────────── 잠재 능력 ─────────────────────────

/** 미미: 카드를 누적 25장 얻을 때마다 유물 */
export function kitCardsGained(s: GameState, rng: Rng, p: Player, n: number) {
  if (p.character !== 'mimi' || !p.potential || n <= 0) return;
  const c = v(p);
  const before = c.gained ?? 0;
  c.gained = before + n;
  for (let k = Math.floor(before / 25); k < Math.floor(c.gained / 25); k++) offerRelic(s, rng, p, Math.max(1, p.level), '카드 25장');
}

/** 패드맨: 지난 주사위가 1이면 이번 공격 주사위는 6 */
export function kitForcedAttack(p: Player): number | undefined {
  if (p.character !== 'padman' || !p.potential || !v(p).force6) return undefined;
  v(p).force6 = 0;
  return 6;
}

/** 패드맨: 공격 주사위 6이면 방어력 무시 · 1이면 다음 공격 6 */
export function kitAttackRolled(p: Player, hit: AttackResult) {
  if (p.character !== 'padman' || !p.potential) return;
  if (hit.attackRoll >= 6 && hit.mode === 'block') {
    hit.defenseValue = hit.defenseRoll;
    hit.damage = Math.max(1, hit.attackValue - hit.defenseValue);
  }
  if (hit.attackRoll < 2) v(p).force6 = 1;
}

/** 패드맨: 방어 · 회피 주사위가 1이면 다음 공격 6 */
export function kitDefenseRolled(p: Player, hit: AttackResult) {
  if (p.character === 'padman' && p.potential && hit.defenseRoll < 2) v(p).force6 = 1;
}

/** 반격 중첩 (렌 잠재): 공격받고 버티면 그 몬스터에게 되갚는다 */
export function kitRetaliate(s: GameState, rng: Rng, p: Player, e: Enemy, chased = false) {
  if (!s.enemies.includes(e) || !targetable(s, e)) return;
  // 모제스: 약점 몬스터가 걸어온 전투에는 반격한다
  const flaw = chased && kitFlaw(e, p);
  if (!v(p).counter && !flaw) return;
  if (!flaw) v(p).counter -= 1;
  // 판다맨 잠재: 이번에 받은 피해만큼 공격력 +
  const bonus = p.character === 'pandaman' && p.potential ? (v(p).lastHit ?? 0) : 0;
  if (p.character === 'moses') addStack(p, 1);
  const amount = Math.max(1, p.atk + bonus + rng.d6() - e.def);
  log(s, `  ${p.name}: 반격`);
  strikeEnemy(s, rng, p, e, amount);
}

/** 펭 에너지 보존 최대 (잠재 5) */
function fenMax(p: Player): number {
  return p.potential ? 5 : 1;
}

/** 펭 잠재: 몬스터를 지나치면 (보내기) 에너지 보존 +2 */
export function kitSpare(p: Player) {
  if (p.character === 'fen' && p.potential) p.stacks = Math.min(5, p.stacks + 2);
}

/** 전투 카드 코스트 (미사키 잠재: 명검 -1) */
export function kitBattleCost(p: Player, card: CardId): number {
  const cost = CARDS[card].battleCost ?? 0;
  return p.character === 'misaki' && p.potential && card === 'gawu' ? Math.max(0, cost - 1) : cost;
}

/** 효과 카드 피해 + (코마치 잠재) */
export function kitCardDamage(p: Player): number {
  return p.character === 'komachi' ? (v(p).fxDamage ?? 0) : 0;
}

/** 액티브 사거리 (미사키 잠재 6 · 마무시 진룡) */
export function kitSkillRange(p: Player): number | undefined {
  const range = CHARACTERS[p.character].active.range;
  if (p.character === 'misaki' && p.potential) return 6;
  if (p.character === 'lulu' && p.potential) return 99;
  return range;
}

/** 액티브와 함께 고르는 손패 수 (알 · 질 · 루카 잠재) */
export function skillCards(p: Player): [number, number] | undefined {
  if (p.character === 'luka' && p.potential) return [0, 1];
  return CHARACTERS[p.character].active.cards;
}

/** 액티브와 함께 고를 수 있는 카드 (루카: 전투 카드만) */
export function skillCardOk(p: Player, card: CardId): boolean {
  return p.character !== 'luka' || isBattle(card);
}

// ───────────────────────── 금지 표지판 (링링) ─────────────────────────

function signOwner(s: GameState, tile: number): Player | undefined {
  return s.players.find((o) => o.character === 'lingling' && o.charTiles[tile]);
}

/** 앞쪽 n칸에 금지 표지판 (링링의 칸 목록에 둔다) */
export function placeSign(s: GameState, p: Player, ahead: number) {
  const owner = p.character === 'lingling' ? p : (teammate(s, 'lingling') ?? p);
  let tile = p.tile;
  for (let i = 0; i < ahead; i++) tile = s.board.tiles[tile].next[0];
  owner.charTiles[tile] = 1;
  log(s, `${p.name}: ⛔ 금지 표지판 — ${ahead}칸 앞`);
}

/** 표지판을 지난다: 없어지고 링링이면 1장 돌려받는다 */
function takeSign(s: GameState, p: Player, tile: number) {
  const owner = signOwner(s, tile);
  if (!owner) return;
  delete owner.charTiles[tile];
  if (p.character === 'lingling') give(s, p, 'banSign');
}

/** 지금 칸의 금지 표지판에 멈추는지 (태클 · 부유는 무시) · 다음 이동 +2 */
export function kitSignStop(s: GameState, p: Player): boolean {
  if (s.turn.charge || kitTrapImmune(s, p) || !signOwner(s, p.tile)) return false;
  takeSign(s, p, p.tile);
  p.relicVars.warpBoost = (p.relicVars.warpBoost ?? 0) + 2;
  log(s, `${p.name}: ⛔ 금지 표지판 — 정지 · 다음 이동 +2`);
  return true;
}

/** 태클이 끝났다: 표지판을 지났으면 방어력 -2 · 공격력 +2 (2턴). 싸울 순서를 돌려준다 */
export function kitTackleEnd(s: GameState, p: Player): number[] {
  const order = s.turn.grabbed ?? [];
  if (s.turn.signPassed) {
    for (const e of s.enemies) if (order.includes(e.id)) tag(e, 'grab', 2);
    v(p).signAtk = s.round + 2;
  }
  s.turn.signPassed = false;
  s.turn.grabbed = [];
  return [...order];
}

// ───────────────────────── 미니 슬라임 (루루 잠재) ─────────────────────────

/** 턴 끝에 잃은 치유 2마다 3칸 안 무작위 칸에 미니 슬라임 (최대 2번) */
export function kitHealLost(s: GameState, rng: Rng, p: Player, lost: number) {
  if (p.character !== 'lulu' || !p.potential) return;
  const dist = distances(s.board, p.tile);
  for (let i = 0; i < Math.min(2, Math.floor(lost / 2)); i++) {
    const free = [...dist].filter(([t, d]) => d >= 1 && d <= 3 && !p.charTiles[t]).map(([t]) => t);
    if (!free.length) return;
    p.charTiles[rng.pick(free)] = 1;
    log(s, `${p.name}: 미니 슬라임`);
  }
}

/** 사이크스: center에서 range칸 안 촉수를 작동 → 촉수 2칸 안 몬스터 1 + 침식 피해 (한 마리에 한 번) */
function activateTentacles(s: GameState, rng: Rng, p: Player, center: number, range: number) {
  const dist = distances(s.board, center);
  const tentacles = Object.keys(p.charTiles).map(Number).filter((t) => (dist.get(t) ?? 99) <= range);
  const hit = new Set<number>();
  for (const t of tentacles) {
    for (const e of monstersNear(s, t, 2)) {
      if (hit.has(e.id) || s.phase.kind === 'gameOver' || !s.enemies.includes(e)) continue;
      hit.add(e.id);
      log(s, `  ${p.name}: 촉수 — ${e.name}`);
      strikeEnemy(s, rng, p, e, 1 + (e.tags?.erode ?? 0));
      if (s.enemies.includes(e) && kitSlow(s, e) > 0) tag(e, 'erode', (e.tags?.erode ?? 0) + 1);
    }
  }
}

// 아스트랄 파티 협동 맵 규칙: 몬스터 · 보스 액티브와 패시브, 캐릭터 상태, 과제, 맵 이벤트, 투표 · 루트.
// 데이터: data/apMaps.ts (보스 · 시간표 · 과제) · data/apBoards.ts (보드) · data/enemies.ts (몬스터). 정리: docs/AP_MAPS.md

import { CARDS } from '../data/cards';
import { AP_BOARD_MAP } from '../data/apBoards';
import { AP_VARIANTS } from '../data/apMaps';
import { DIFFICULTIES } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { distances, randomCard, statusDef } from './cards';
import { bossEnemy, bossTurnHit, freeTileFor } from './boss';
import { damage, drawCards, heal, isOver, log, notice, spawnEnemy } from './game';
import { gainRelic, offerRelic } from './relics';
import { kitDef, kitEnemyAtk, kitFought, kitSafe, kitSlow, kitTaunter } from './kits';
import type { Rng } from './rng';
import type { ApState, BossTurn, CardId, Enemy, EnemyKind, GameState, MapTask, Player } from './types';

// ───────────────────────── 기본 ─────────────────────────

export const isAp = (s: GameState) => !!s.boss.ap;
const ap = (s: GameState) => s.ap!;
const st = (e: Enemy) => (e.st ??= {});
const pst = (p: Player) => (p.ap ??= {});
const alive = (s: GameState) => s.players.filter((p) => !p.ko);
const rules = (s: GameState) => s.boss.ap?.rules ?? [];
const has = (s: GameState, rule: string) => rules(s).includes(rule);
const cell = (s: GameState, name: string) => s.board.cells?.[name];

function dist(s: GameState, from: number): Map<number, number> {
  return distances(s.board, from);
}

/** from에서 range칸 안 살아 있는 캐릭터 (가까운 순 · 자리 순) */
function playersNear(s: GameState, from: number, range: number): Player[] {
  const d = dist(s, from);
  return alive(s)
    .filter((p) => (d.get(p.tile) ?? 99) <= range)
    .sort((a, b) => (d.get(a.tile) ?? 99) - (d.get(b.tile) ?? 99) || a.id - b.id);
}

function monstersNear(s: GameState, from: number, range: number, but?: Enemy): Enemy[] {
  const d = dist(s, from);
  return s.enemies.filter((e) => e !== but && !e.isBoss && !ENEMIES[e.kind as EnemyKind]?.ally && (d.get(e.tile) ?? 99) <= range);
}

/** 체력이 가장 높은 캐릭터 (같으면 앞자리) */
function topHp(list: Player[]): Player | undefined {
  return [...list].sort((a, b) => b.hp - a.hp || a.id - b.id)[0];
}

function give(p: Player, card: CardId) {
  p.hand.push({ card, shop: true });
}

export const CANDY: CardId[] = ['supportGum', 'energyBar', 'smartGummy'];
export const BUILDINGS: CardId[] = ['hasteMushroom', 'starfruit', 'peach', 'moneyTree'];

// ───────────────────────── 시작 ─────────────────────────

/** 판을 만들 때: 갈래 고르기 · 시작 방향 */
export function apInit(s: GameState, rng: Rng) {
  if (!s.boss.ap) return;
  const state: ApState = { tasks: {}, done: [], counts: {}, awake: !s.boss.ap.sleeps, stage: 1, later: [], vars: {} };
  s.ap = state;
  // 매직 아카데미: 둘째 맵은 무작위 (원작 학원 안전관 · 대행 학장)
  if (s.boss.map === 'academy') {
    state.branch = rng.next() < 0.5 ? 'dean' : 'officer';
    s.boss = AP_VARIANTS[state.branch];
  }
  if (has(s, 'shield')) state.vars.shield = 3;
  faceStarts(s);
  for (const p of s.players) if (s.board.id === 'garden') pst(p).display = 0;
}

/** 시작 칸에서 정해진 쪽으로 나아가도록 지나온 칸을 정해 둔다 */
function faceStarts(s: GameState) {
  for (const p of s.players) {
    const dir = s.board.facing?.[p.id];
    const back = s.board.tiles[p.tile].next.find((t) => t !== dir);
    if (dir === undefined || back === undefined) continue;
    p.prev = back;
    p.prevTile = p.tile;
  }
}

// ───────────────────────── 시간표 ─────────────────────────

/** 원작 칸에 소환. 칸이 차 있으면 가까운 빈 칸, 이름이 없으면 무작위 */
export function apSummon(s: GameState, rng: Rng, kind: EnemyKind, at?: string): Enemy | null {
  const want = at ? cell(s, at) : undefined;
  const tile = want !== undefined ? nearestFree(s, want) : randomSpawn(s, rng);
  if (tile === null) return null;
  return spawnEnemy(s, kind, tile);
}

function nearestFree(s: GameState, from: number): number | null {
  const d = [...dist(s, from)].sort((a, b) => a[1] - b[1]);
  for (const [t] of d) if (freeTileFor(s, t)) return t;
  return null;
}

function randomSpawn(s: GameState, rng: Rng): number | null {
  const near = new Set(alive(s).flatMap((p) => [...dist(s, p.tile)].filter(([, d]) => d <= 1).map(([t]) => t)));
  const spawn = s.board.spawnTiles.filter((t) => freeTileFor(s, t) && !near.has(t));
  const all = s.board.tiles.filter((t) => freeTileFor(s, t.id) && !near.has(t.id)).map((t) => t.id);
  const pool = spawn.length ? spawn : all;
  return pool.length ? rng.pick(pool) : null;
}

/** 보스 등장 (원작 칸, 체력은 인원과 무관) */
export function apBossAppear(s: GameState, at?: string) {
  if (bossEnemy(s) || !s.boss.ap) return;
  const b = s.boss;
  const level = DIFFICULTIES[s.difficulty];
  const want = at ? cell(s, at) : s.board.bossTile;
  const tile = nearestFree(s, want ?? s.board.bossTile) ?? s.board.bossTile;
  const hp = Math.round(b.ap!.hp * level.hp);
  s.enemies.push({
    id: s.nextEnemyId++,
    kind: 'boss',
    name: b.name,
    icon: b.icon,
    isBoss: true,
    tile,
    hp,
    maxHp: hp,
    atk: b.atk + level.atk,
    def: b.def,
    counter: b.counter,
    defense: b.defense,
    reward: 0,
  });
  log(s, `⚠ ${b.name} 등장!`);
}

export function apWake(s: GameState) {
  if (!s.ap) return;
  s.ap.awake = true;
  log(s, `⚠ ${s.boss.name}이(가) 움직이기 시작했다`);
}

// ───────────────────────── 맵 이벤트 ─────────────────────────

export function apEvent(s: GameState, rng: Rng, event: string, p?: Player) {
  const a = ap(s);
  const boss = bossEnemy(s);
  const buff = (atk: number, def: number) => {
    s.enemyBonus.atk += atk;
    s.enemyBonus.def += def;
    for (const e of s.enemies) {
      if (e.isBoss || ENEMIES[e.kind as EnemyKind]?.ally) continue;
      e.atk += atk;
      e.def += def;
    }
  };
  switch (event) {
    case 'gawuDefDown':
      a.vars.defDown = 6;
      notice(s, '⚓ 가우 왕 방어력 -6');
      break;
    case 'mist':
      placeMist(s);
      break;
    case 'eggs':
      for (const c of ['C15', 'H1']) addMark(s, c, 'egg');
      break;
    case 'academyStage2':
      academyStage2(s, rng);
      break;
    case 'dragonVote':
      a.choice = {
        id: 'vote',
        options: [
          { id: 'mamushi', label: '🎏 소우리 편 (보스: 아마카와 마무시)' },
          { id: 'souri', label: '🐍 마무시 편 (보스: 아마카와 소우리)' },
        ],
      };
      notice(s, '🗳 비보 출현 — 누구 편을 들까');
      break;
    case 'gourdDone':
    case 'scaleDone':
      if (boss) {
        boss.maxHp = Math.max(1, Math.round(boss.maxHp * 0.8));
        boss.hp = Math.min(boss.hp, boss.maxHp);
        a.vars.noPassive = 1;
        if (boss.st) boss.st.scale = 0;
        notice(s, `💔 ${boss.name} 최대 체력 -20%`);
      }
      break;
    case 'firstStar':
      if (p) give(p, 'supportGum');
      break;
    case 'peacockGate':
      a.vars.gateWaiter = s.round;
      break;
    case 'loveGate':
      a.vars.gateEgg = s.round;
      break;
    case 'fenPeacock':
      apBossAppear(s, 'B9');
      apSummon(s, rng, 'crane', 'I7');
      buff(1, 1);
      a.later.push({ round: s.round + 2, event: 'colorless' });
      notice(s, '🦚 펭의 내면으로');
      break;
    case 'colorless':
      apSummon(s, rng, 'peacock', 'G6');
      apSummon(s, rng, 'crane', 'D10');
      buff(1, 1);
      break;
    case 'fenLovebird':
      apBossAppear(s, 'B9');
      apSummon(s, rng, 'crane', 'I7');
      buff(1, 1);
      a.later.push({ round: s.round + 2, event: 'brilliance' });
      notice(s, '🦆 펭의 내면으로');
      break;
    case 'brilliance':
      apSummon(s, rng, 'lovebirdChalice', 'J2');
      apSummon(s, rng, 'lovebirdChalice', 'A14');
      apSummon(s, rng, 'crane', 'H10');
      buff(1, 1);
      break;
    case 'phoenixSplendour':
      apSummon(s, rng, 'lovebirdChalice', 'J2');
      apSummon(s, rng, 'lovebirdChalice', 'A14');
      break;
    case 'phoenixTrial':
      apSummon(s, rng, 'peacock', 'C6');
      apSummon(s, rng, 'lovebirdChalice', 'H10');
      buff(0, 1);
      break;
    case 'reviveSynth2':
    case 'reviveSynth3': {
      const kind = event === 'reviveSynth2' ? 'synth2' : 'synth3';
      const e = boss ? spawnNear(s, kind, boss.tile) : apSummon(s, rng, kind);
      if (e && kind === 'synth3') useSkillNow(s, rng, e);
      notice(s, `🧟 ${ENEMIES[kind].name} 부활`);
      break;
    }
  }
}

function spawnNear(s: GameState, kind: EnemyKind, tile: number): Enemy | null {
  const t = nearestFree(s, tile);
  return t === null ? null : spawnEnemy(s, kind, t);
}

function addMark(s: GameState, name: string | number, kind: 'egg' | 'gourd' | 'mist') {
  const tile = typeof name === 'number' ? name : cell(s, name);
  if (tile === undefined) return;
  s.marks.push({ id: s.nextMarkId++, tile, kind });
}

/** 과학 괴인 주변 2칸을 독안개로 */
function placeMist(s: GameState) {
  const boss = bossEnemy(s);
  if (!boss) return;
  s.marks = s.marks.filter((m) => m.kind !== 'mist');
  for (const [t, d] of dist(s, boss.tile)) if (d <= 2) addMark(s, t, 'mist');
}

/** 매직 아카데미: 젤리 전사를 쓰러뜨리면 모두 둘째 맵으로 (남은 몬스터도 함께) */
function academyStage2(s: GameState, rng: Rng) {
  const a = ap(s);
  if (a.stage === 2) return;
  a.stage = 2;
  const board = AP_BOARD_MAP[a.branch === 'officer' ? 'academy-library' : 'academy-dessert'];
  s.board = board;
  s.marks = [];
  s.players.forEach((p, i) => {
    p.home = board.homeTiles![i];
    p.tile = p.home;
    p.prev = null;
  });
  const moving = s.enemies;
  s.enemies = [];
  for (const e of moving) {
    const t = randomSpawn(s, rng);
    if (t === null) continue;
    e.tile = t;
    e.prev = undefined;
    s.enemies.push(e);
  }
  apBossAppear(s, 'E7');
  if (a.branch === 'officer') {
    for (const p of s.players) give(p, 'hisFault');
    notice(s, '📢 검거 신고 — 학원 안전관 등장');
  } else {
    for (let i = 0; i < 3; i++) apSummon(s, rng, 'teapot');
    notice(s, '🫖 원죄 현신 — 대행 학장 등장');
  }
  log(s, `🏫 ${board.name}으로 이동`);
}

// ───────────────────────── 과제 ─────────────────────────

function liveTasks(s: GameState): MapTask[] {
  const a = ap(s);
  return (s.boss.ap?.tasks ?? []).filter((t) => !a.done.includes(t.id) && (!t.branch || t.branch === a.branch));
}

/** 과제 셈 +n (set이면 그 값으로) */
export function apCount(s: GameState, rng: Rng, key: string, n: number, p?: Player, set = false) {
  if (!s.ap) return;
  const a = s.ap;
  for (const task of liveTasks(s)) {
    const hit = task.counter === key || task.kill?.includes(key as EnemyKind);
    if (!hit) continue;
    a.tasks[task.id] = set ? Math.max(a.tasks[task.id] ?? 0, n) : (a.tasks[task.id] ?? 0) + n;
    if (a.tasks[task.id] >= task.count) completeTask(s, rng, task, p);
  }
}

function completeTask(s: GameState, rng: Rng, task: MapTask, p?: Player) {
  const a = ap(s);
  a.done.push(task.id);
  const r = task.reward;
  log(s, `✅ 과제 「${task.name} ${task.count}」 완료`);
  notice(s, `✅ 과제 완료 — ${task.name}`);
  for (const o of s.players) {
    if (r.chip) offerRelic(s, rng, o, r.chip, '과제');
    if (r.coins) o.coins += r.coins;
    if (r.card) give(o, r.card === 'building' ? rng.pick(BUILDINGS) : r.card);
  }
  if (r.progress) s.progress = Math.max(1, s.progress + r.progress);
  if (r.event) apEvent(s, rng, r.event, p);
}

// ───────────────────────── 선택 (투표 · 루트) ─────────────────────────

/** 다음 차례 시작에 고르기를 띄운다 */
export function apPendingChoice(s: GameState) {
  return s.ap?.choice;
}

export function apChoose(s: GameState, rng: Rng, choice: string) {
  const a = ap(s);
  const pending = a.choice;
  if (!pending || !pending.options.some((o) => o.id === choice)) return false;
  a.choice = undefined;
  if (pending.id === 'vote') chooseDragon(s, rng, choice as 'mamushi' | 'souri');
  else chooseRoute(s, rng, choice);
  return true;
}

function setBoss(s: GameState, key: string) {
  const def = AP_VARIANTS[key];
  s.boss = { ...def, timeline: s.boss.timeline };
  ap(s).branch = key;
}

function chooseDragon(s: GameState, rng: Rng, boss: 'mamushi' | 'souri') {
  setBoss(s, boss);
  const a = ap(s);
  apBossAppear(s, 'H1');
  const ally = apSummon(s, rng, boss === 'mamushi' ? 'souriAlly' : 'mamushiAlly', 'H10');
  if (ally) ally.cd = 0;
  const minions: EnemyKind[] = boss === 'mamushi' ? ['prawn', 'prawn', 'prawn'] : ['goldfish', 'goldfish'];
  for (const k of minions) apSummon(s, rng, k);
  for (const e of s.enemies) if (!e.isBoss && !ENEMIES[e.kind as EnemyKind]?.ally) {
    e.atk += 1;
    e.def += 1;
  }
  // 편을 든 쪽의 파란 칩
  for (const p of s.players) gainRelic(s, rng, p, boss === 'mamushi' ? 'ragingCharm' : 'seafoodSoup');
  a.vars.half = 0;
  notice(s, boss === 'mamushi' ? '🐍 마무시 출격!' : '🎏 소우리 등장!');
}

function chooseRoute(s: GameState, rng: Rng, route: string) {
  const a = ap(s);
  if (route === 'investigate') {
    a.vars.investigate = 1;
    return;
  }
  setBoss(s, route);
  if (route === 'peacock') {
    apSummon(s, rng, 'peacock', 'C6');
    apSummon(s, rng, 'swallow', 'J3');
    apSummon(s, rng, 'swallow', 'A13');
    notice(s, '🦚 공작 시련');
  } else if (route === 'lovebird') {
    apSummon(s, rng, 'lovebirdChalice', 'J2');
    apSummon(s, rng, 'lovebirdChalice', 'A14');
    apSummon(s, rng, 'swallow', 'A9');
    apSummon(s, rng, 'swallow', 'J7');
    notice(s, '🦆 원앙 시련');
  } else {
    apBossAppear(s, 'C6');
    apSummon(s, rng, 'peacock', 'H10');
    apSummon(s, rng, 'swallow', 'C14');
    apSummon(s, rng, 'swallow', 'H2');
    a.later.push({ round: s.round + 3, event: 'phoenixSplendour' }, { round: s.round + 6, event: 'phoenixTrial' });
    notice(s, '🔥 전면 폭주 — 폭주한 봉황');
  }
}

/** 정원 안뜰: 관문 과제를 끝낸 라운드 끝에 루트를 고른다 */
function gardenGate(s: GameState) {
  const a = ap(s);
  if (a.branch || a.choice) return;
  const waiter = a.vars.gateWaiter;
  const egg = a.vars.gateEgg;
  if (waiter === undefined && egg === undefined) return;
  if (waiter !== undefined && egg !== undefined) {
    if (a.vars.investigate || waiter === egg) {
      a.choice = a.vars.investigate
        ? { id: 'route', options: [{ id: 'phoenix', label: '🔥 봉황 루트' }] }
        : {
            id: 'route',
            options: [
              { id: 'phoenix', label: '🔥 모두 바치기 (봉황)' },
              { id: 'peacock', label: '🪶 오색 깃털 바치기 (공작)' },
              { id: 'lovebird', label: '🥚 신비한 알 바치기 (원앙)' },
            ],
          };
    }
    return;
  }
  if (a.vars.investigate) return;
  a.choice = {
    id: 'route',
    options:
      waiter !== undefined
        ? [{ id: 'peacock', label: '🪶 오색 깃털 바치기 (공작)' }, { id: 'investigate', label: '🔎 더 조사하기' }]
        : [{ id: 'lovebird', label: '🥚 신비한 알 바치기 (원앙)' }, { id: 'investigate', label: '🔎 더 조사하기' }],
  };
}

// ───────────────────────── 몬스터 차례 ─────────────────────────

/** 라운드 끝 몬스터 · 보스 차례 (원작 몬스터 행동: 스킬을 쓰고 움직인다) */
export function apEnemyPhase(s: GameState, rng: Rng, turn: BossTurn) {
  const order = [...s.enemies].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  turn.acts = [];
  for (const e of order) {
    if (!s.enemies.includes(e) || isOver(s)) continue;
    if (e.isBoss && !ap(s).awake) continue;
    const from = { tile: e.tile, hits: turn.hits.length, moved: turn.moved.length, lines: turn.lines.length };
    act(s, rng, e, turn);
    const path = turn.moved.slice(from.moved).find((m) => m.enemy === e.id)?.path;
    const skill = turn.lines.slice(from.lines).map((l) => l.split(': ').slice(1).join(': ')).join(' · ');
    const hits = turn.hits.slice(from.hits);
    if (path || skill || hits.length) turn.acts.push({ enemy: e.id, tile: from.tile, skill: skill || undefined, path, hits });
  }
}

/** 몬스터 하나의 차례: 시작 패시브 → 스킬 → 이동 */
function act(s: GameState, rng: Rng, e: Enemy, turn: BossTurn) {
  const info = e.isBoss ? null : ENEMIES[e.kind as EnemyKind];
  if (info?.ally) {
    allyAct(s, rng, e);
    return;
  }
  turnStartPassive(s, rng, e, turn);
  if (!s.enemies.includes(e) || isOver(s)) return;
  const skill = e.isBoss ? s.boss.ap?.skill : info?.skill;
  if (skill && !(e.isBoss && e.st?.silenced === s.round)) {
    if ((e.cd ?? 0) <= 0) {
      useSkill(s, rng, e, turn);
      e.cd = skill.cd - 1;
    } else e.cd = (e.cd ?? 0) - 1;
  }
  if (!s.enemies.includes(e) || isOver(s)) return;
  moveEnemy(s, rng, e, turn);
}

/** 원작 행동 순서: 도둑이 먼저, 보스와 소환된 것이 뒤 */
function rank(e: Enemy): number {
  if (e.kind === 'thief') return 0;
  if (e.isBoss) return 2;
  return 1;
}

function useSkillNow(s: GameState, rng: Rng, e: Enemy) {
  const turn = s.bossTurn ?? { seq: 0, move: null, text: '', broken: false, hits: [], moved: [], lines: [] };
  useSkill(s, rng, e, turn);
}

function useSkill(s: GameState, rng: Rng, e: Enemy, turn: BossTurn) {
  const skill = e.isBoss ? s.boss.ap!.skill! : ENEMIES[e.kind as EnemyKind].skill!;
  const range = skill.range ?? 99;
  const hurt = (p: Player, n: number, note = skill.name) => bossTurnHit(s, rng, p, n, turn, `${e.name} · ${note}`);
  const line = () => turn.lines.push(`${e.name}: ${skill.name}`);
  switch (skill.id) {
    case 'summon': {
      const kind = skill.kind!;
      if (skill.max && s.enemies.filter((x) => x.kind === kind).length >= skill.max) return;
      if (spawnNear(s, kind, e.tile)) line();
      break;
    }
    case 'shootTop': {
      const [p] = skillTargets(s, e);
      if (!p) return;
      line();
      hurt(p, skill.amount ?? e.atk);
      break;
    }
    case 'shootFar': {
      const [p] = skillTargets(s, e);
      if (!p) return;
      line();
      hurt(p, skill.amount ?? e.atk);
      break;
    }
    case 'poisonTop': {
      const [p] = skillTargets(s, e);
      if (!p) return;
      line();
      hurt(p, skill.amount ?? 2);
      pst(p).poison = 3;
      break;
    }
    case 'buffNear':
      for (const m of [e, ...monstersNear(s, e.tile, range, e)]) {
        if (st(m).hype) continue;
        st(m).hype = 1;
        m.atk += 1;
        m.def += 1;
      }
      line();
      break;
    case 'guard': {
      const pool = monstersNear(s, e.tile, range, e).filter((m) => !m.st?.guard);
      const boss = bossEnemy(s);
      if (boss && (dist(s, e.tile).get(boss.tile) ?? 99) <= range && !boss.st?.guard) pool.push(boss);
      if (!pool.length) return;
      const m = rng.pick(pool);
      st(m).guard = 9;
      m.def += 9;
      line();
      break;
    }
    case 'aoe':
    case 'noise': {
      const hit = skillTargets(s, e);
      if (!hit.length) return;
      line();
      for (const p of hit) hurt(p, skill.amount ?? 2);
      if (skill.id === 'noise') e.atk += hit.length;
      break;
    }
    case 'mushroom': {
      const [p] = skillTargets(s, e);
      if (!p) return;
      line();
      hurt(p, skill.amount ?? 2);
      pst(p).attention = 2;
      break;
    }
    case 'saw': {
      const [p] = skillTargets(s, e);
      if (!p) return;
      line();
      heal(p, 1);
      addOverclock(p, 3);
      break;
    }
    case 'pinata':
      st(e).overclock = 4;
      line();
      break;
    case 'chain': {
      const victims = alive(s).filter((p) => p.ap?.overclock);
      if (!victims.length) return;
      line();
      let drained = 0;
      for (const p of victims) {
        const before = p.hp;
        hurt(p, 2);
        drained += before - p.hp;
      }
      e.hp = Math.min(e.maxHp, e.hp + drained);
      break;
    }
    case 'scale': {
      const souri = bossEnemy(s);
      if (!souri || s.boss.id !== 'dragon-souri' || ap(s).vars.noPassive) return;
      addScale(s, rng, souri, 1);
      line();
      break;
    }
    case 'masao':
      if (spawnNear(s, rng.next() < 0.5 ? 'swordSpirit' : 'spearSpirit', e.tile)) line();
      break;
    case 'tea': {
      const pots = monstersNear(s, e.tile, range).filter((m) => m.kind === 'teapot' || m.kind === 'mutantTeapot');
      if (pots.length) {
        const d = dist(s, e.tile);
        const pot = pots.sort((a, b) => (d.get(a.tile) ?? 99) - (d.get(b.tile) ?? 99))[0];
        s.enemies = s.enemies.filter((x) => x !== pot);
        if (pot.kind === 'teapot') {
          e.atk += 1;
          e.def += 1;
        }
        st(e).absorbed = s.round;
        turn.lines.push(`${e.name}: ${skill.name} — 찻주전자 흡수`);
      } else {
        spawnNear(s, 'teapot', e.tile);
        line();
      }
      if (e.hp * 2 <= e.maxHp) spawnNear(s, 'mutantTeapot', e.tile);
      break;
    }
    case 'indicate': {
      const near = skillTargets(s, e);
      for (const p of near) give(p, 'hisFault');
      if (near.length) line();
      break;
    }
    case 'mamushiChain': {
      const near = playersNear(s, e.tile, range);
      if (!near.length) return;
      line();
      for (const p of near) {
        const i = p.hand.findIndex((h) => CARDS[h.card].type !== 'battle');
        if (i >= 0) p.hand.splice(i, 1);
        if (p.hand.length < 4) hurt(p, 3);
      }
      break;
    }
    case 'scientist': {
      const [p] = skillTargets(s, e);
      if (p) addOverclock(p, 3);
      placeMist(s);
      line();
      break;
    }
    case 'display': {
      const p = topHp(alive(s));
      st(e).display = (e.st?.display ?? 0) + 1;
      if (p) pst(p).display = (p.ap?.display ?? 0) + 1;
      line();
      break;
    }
    case 'bond': {
      const [p] = skillTargets(s, e);
      if (!p) return;
      pst(p).bond = 3;
      line();
      break;
    }
    case 'fenBond': {
      const pool = alive(s).filter((x) => !x.ap?.bond);
      for (let i = 0; i < 2 && pool.length; i++) pst(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]).bond = 3;
      line();
      break;
    }
    case 'wings': {
      const d = dist(s, e.tile);
      for (const p of alive(s)) {
        if ((d.get(p.tile) ?? 99) > 6 && p.hand.length) p.hand[Math.floor(rng.next() * p.hand.length)] = { card: 'ashenFeather' };
        pst(p).bond = 3;
      }
      line();
      break;
    }
  }
}

/** 보스 · 몬스터 차례 시작 패시브 */
function turnStartPassive(s: GameState, rng: Rng, e: Enemy, turn: BossTurn) {
  const a = ap(s);
  if (e.kind === 'owl' && e.hp * 2 <= e.maxHp) e.atk += 1;
  if (e.kind === 'pinata' && e.st?.overclock) {
    e.st.overclock -= 1;
    if (e.st.overclock <= 0) {
      s.enemies = s.enemies.filter((x) => x !== e);
      turn.lines.push(`${e.name}: 터졌다`);
      return;
    }
  }
  if (!e.isBoss || a.vars.noPassive) return;
  // 골목대장 가우: 정력 +1 (60% 이하 +2) · 5칸 안 주목받은 캐릭터 3 피해
  if (has(s, 'kidGawu')) {
    const low = e.hp <= e.maxHp * 0.6;
    const gain = low ? 2 : 1;
    st(e).energy = (e.st?.energy ?? 0) + gain;
    e.atk += 2 * gain;
    for (const p of playersNear(s, e.tile, 5).filter((x) => x.ap?.attention)) {
      bossTurnHit(s, rng, p, 3, turn, `${e.name} · 호기심`);
      pst(p).attention = 0;
    }
  }
  // 펭 (원앙 의식): 4칸 안에 아무도 없으면 이동 +2 · 방어력 +2
  if (has(s, 'solitude')) st(e).solitude = playersNear(s, e.tile, 4).length === 0 ? 1 : 0;
  // 폭주한 봉황: 5칸 안 온염 1 · 지금 체력 10% 잃음 · 잃은 체력 30마다 공격력 +1 · 절반 이하 공격력 +2
  if (has(s, 'rebirth')) {
    for (const p of playersNear(s, e.tile, 5)) pst(p).flame = (p.ap?.flame ?? 0) + 1;
    e.hp = Math.max(1, e.hp - Math.ceil(e.hp * 0.1));
    const lost = e.maxHp - e.hp;
    const base = s.boss.atk + DIFFICULTIES[s.difficulty].atk;
    e.atk = base + Math.floor(lost / 30) + (e.hp * 2 <= e.maxHp ? 2 : 0);
  }
}

/** 아군 NPC 행동 (드래곤 팰리스) */
function allyAct(s: GameState, rng: Rng, e: Enemy) {
  if (e.kind === 'mamushiAlly') {
    const p = playersNear(s, e.tile, 99)[0];
    if (p) give(p, 'poisonFang');
  }
  if (e.kind === 'souriAlly') {
    const free = s.board.tiles.filter((t) => t.kind !== 'base').map((t) => t.id);
    for (let i = 0; i < 2; i++) addMark(s, rng.pick(free), 'gourd');
  }
}

// ───────────────────────── 이동 ─────────────────────────

/** 원작 몬스터 이동 주사위 (플레이어와 같은 10면) */
export const AP_MOVE_DIE = 10;

/** 움직이는 몬스터인지 (원작: 공격형 · 추격형 · 정해진 칸 수) */
function mover(s: GameState, e: Enemy): boolean {
  if (e.isBoss) return !!s.boss.ap?.roam && !!s.ap?.awake;
  const info = ENEMIES[e.kind as EnemyKind];
  if (info.ally) return false;
  if (e.kind === 'trainee') return !!e.st?.moves;
  return !!(info.roam || info.fixedMove);
}

function chaser(e: Enemy): boolean {
  if (e.isBoss) return true;
  return !!ENEMIES[e.kind as EnemyKind].chase || e.kind === 'trainee';
}

/**
 * 노리는 캐릭터 (원작: 길 위에서 가장 가까운 캐릭터 · 같으면 앞자리).
 * 도발 · 문제아 · 연리 · 가우 왕 무작위 추격이 먼저. rng가 없으면 미리보기 (아직 안 정한 무작위는 null)
 */
export function apPrey(s: GameState, e: Enemy, rng?: Rng): Player | null {
  if (!chaser(e)) return null;
  const targets = alive(s).filter((p) => !kitSafe(s, p));
  if (!targets.length) return null;
  const taunt = kitTaunter(s, e);
  if (taunt && targets.includes(taunt)) return taunt;
  let pool = targets;
  if (e.isBoss && has(s, 'fury')) {
    const problem = targets.filter((p) => p.ap?.problem);
    if (problem.length) pool = problem;
  }
  if (e.kind === 'lovebirdChalice') {
    const bonded = targets.filter((p) => p.ap?.bond);
    if (bonded.length) pool = bonded;
  }
  if (e.isBoss && has(s, 'chaseRandom')) {
    const kept = targets.find((p) => p.id === e.st?.prey);
    if (kept) return kept;
    if (!rng) return null;
    const p = rng.pick(targets);
    st(e).prey = p.id;
    return p;
  }
  const d = dist(s, e.tile);
  return [...pool].sort((a, b) => (d.get(a.tile) ?? 99) - (d.get(b.tile) ?? 99) || a.id - b.id)[0];
}

/** 이번 이동 칸 수: 10면 주사위 (빨간 영혼 3 · 피냐타 4) · 라쿤은 6칸 안에 아무도 없으면 +3 · 고독 · 부활 +2 · 이동 감소 */
function apSteps(s: GameState, rng: Rng, e: Enemy): number {
  const info = e.isBoss ? null : ENEMIES[e.kind as EnemyKind];
  if (info?.fixedMove) return info.fixedMove;
  let n = rng.int(1, AP_MOVE_DIE);
  if (e.kind === 'thief' && playersNear(s, e.tile, 6).length === 0) n += 3;
  if (e.isBoss && e.st?.solitude) n += 2;
  if (e.isBoss && has(s, 'rebirth') && e.hp * 2 <= e.maxHp) n += 2;
  return Math.max(0, n - kitSlow(s, e));
}

function moveEnemy(s: GameState, rng: Rng, e: Enemy, turn: BossTurn) {
  if (!mover(s, e)) return;
  const steps = apSteps(s, rng, e);
  if (steps <= 0) return;
  walk(s, rng, e, steps, apPrey(s, e, rng), turn);
}

/** 몬스터가 다음 차례에 할 일 (화면 미리보기: 노리는 캐릭터 · 스킬과 맞을 캐릭터) */
export interface EnemyIntent {
  /** 쫓아가 공격할 캐릭터 */
  prey: number | null;
  /** 아직 안 정한 무작위 추격 (가우 왕) */
  randomPrey: boolean;
  moves: boolean;
  sleeping: boolean;
  skill: { name: string; text: string; cd: number; ready: boolean; targets: number[] } | null;
}

export function apIntent(s: GameState, e: Enemy): EnemyIntent {
  const sleeping = e.isBoss && !s.ap?.awake;
  const info = e.isBoss ? null : ENEMIES[e.kind as EnemyKind];
  const skill = e.isBoss ? s.boss.ap?.skill : info?.skill;
  const moves = !sleeping && mover(s, e);
  const prey = moves ? apPrey(s, e) : null;
  const ready = !!skill && !sleeping && (e.cd ?? 0) <= 0 && !(e.isBoss && e.st?.silenced === s.round);
  return {
    prey: prey?.id ?? null,
    randomPrey: moves && !prey && e.isBoss && has(s, 'chaseRandom'),
    moves,
    sleeping,
    skill: skill
      ? { name: skill.name, text: skill.text, cd: Math.max(0, e.cd ?? 0), ready, targets: ready ? skillTargets(s, e).map((p) => p.id) : [] }
      : null,
  };
}

/** 캐릭터마다 노리는 몬스터 수 (어그로) */
export function apAggro(s: GameState): number[] {
  const out = s.players.map(() => 0);
  if (!s.ap) return out;
  for (const e of s.enemies) {
    const it = apIntent(s, e);
    const hit = new Set([...(it.prey !== null ? [it.prey] : []), ...(it.skill?.targets ?? [])]);
    for (const id of hit) out[id] += 1;
  }
  return out;
}

/** 스킬이 맞힐 캐릭터 (정해진 규칙만, 무작위 · 소환은 빈 목록) */
function skillTargets(s: GameState, e: Enemy): Player[] {
  const skill = e.isBoss ? s.boss.ap?.skill : ENEMIES[e.kind as EnemyKind]?.skill;
  if (!skill) return [];
  const range = skill.range ?? 99;
  const one = (p: Player | undefined) => (p ? [p] : []);
  switch (skill.id) {
    case 'shootTop':
    case 'poisonTop':
      return one(topHp(playersNear(s, e.tile, range)));
    case 'shootFar': {
      const d = dist(s, e.tile);
      return one(topHp(alive(s).filter((x) => (d.get(x.tile) ?? 99) > range)));
    }
    case 'mushroom':
      return one(playersNear(s, e.tile, range)[0]);
    case 'saw':
      return one(playersNear(s, e.tile, range).find((x) => !x.ap?.overclock));
    case 'aoe':
    case 'noise':
    case 'mamushiChain':
      return playersNear(s, e.tile, range);
    case 'chain':
      return alive(s).filter((p) => p.ap?.overclock);
    case 'indicate':
      return playersNear(s, e.tile, 99).slice(0, e.hp * 2 <= e.maxHp ? 2 : 1);
    case 'scientist':
      return one(playersNear(s, e.tile, 99).find((x) => !x.ap?.overclock));
    case 'display':
      return one(topHp(alive(s)));
    case 'bond':
      return one(playersNear(s, e.tile, 99).find((x) => !x.ap?.bond));
    case 'wings':
      return alive(s);
    default:
      return [];
  }
}

function walk(s: GameState, rng: Rng, e: Enemy, steps: number, target: Player | null, turn: BossTurn) {
  const prey = target ? [target] : null;
  const info = e.isBoss ? null : ENEMIES[e.kind as EnemyKind];
  const fly = !!info?.fly;
  const path = [e.tile];
  for (let i = 0; i < steps; i++) {
    const here = path[path.length - 1];
    const tile = s.board.tiles[here];
    let options = tile.next.filter((t) => freeTileFor(s, t, e.id) || fly);
    if (prey) {
      const near = (t: number) => {
        const d = dist(s, t);
        return Math.min(...prey.map((p) => d.get(p.tile) ?? 99));
      };
      options = options.sort((a, b) => near(a) - near(b) || a - b);
      if (options.length && near(options[0]) >= near(here)) options = [];
      options = options.slice(0, 1);
    } else {
      const forward = options.filter((t) => t !== e.prev);
      if (forward.length) options = forward;
    }
    if (!options.length) break;
    const step = prey ? options[0] : rng.pick(options);
    e.prev = here;
    e.tile = step;
    path.push(step);
    const victims = alive(s).filter((p) => p.tile === step && !kitSafe(s, p));
    if (!victims.length) continue;
    // 사탕 피냐타: 지나가며 2 피해
    if (e.kind === 'pinata') {
      for (const p of victims) bossTurnHit(s, rng, p, 2, turn, e.name);
      continue;
    }
    // 빨간 영혼: 캐릭터를 지나가면 터져서 3칸 안 중독
    if (e.kind === 'redSpirit') {
      for (const p of playersNear(s, step, 3)) pst(p).poison = 3;
      s.enemies = s.enemies.filter((x) => x !== e);
      turn.lines.push(`${e.name}: 붕괴 — 3칸 안 중독`);
      break;
    }
    if (fly) continue;
    if (info?.steal) {
      for (const p of victims) {
        const taken = Math.min(p.coins, info.steal);
        if (!taken) continue;
        p.coins -= taken;
        e.loot = (e.loot ?? 0) + taken;
        turn.hits.push({ player: p.id, amount: 0, note: `코인 -${taken}` });
      }
      continue;
    }
    if (!prey) continue;
    for (const p of victims) {
      if (isOver(s)) break;
      contactFight(s, rng, e, p, turn);
    }
    break;
  }
  if (path.length > 1) turn.moved.push({ enemy: e.id, path });
}

/** 쫓아와 거는 전투: 몬스터 공격 vs 아군 방어 (주사위 1~6씩, 최소 1) */
function contactFight(s: GameState, rng: Rng, e: Enemy, p: Player, turn: BossTurn) {
  const atk = e.atk + kitEnemyAtk(e, p) + apEnemyAtk(s, e, p);
  const dmg = Math.max(1, atk + rng.d6() - (p.def + statusDef(p) + kitDef(s, p, e) + rng.d6()));
  kitFought(s, p, e);
  bossTurnHit(s, rng, p, dmg, turn, e.name);
  apEnemyHit(s, rng, e, p, dmg);
}

// ───────────────────────── 라운드 끝 ─────────────────────────

/** 몬스터 차례 뒤: 지속 효과 · 부활 · 예약 이벤트 · 루트 고르기 */
export function apRoundEnd(s: GameState, rng: Rng) {
  const a = ap(s);
  const boss = bossEnemy(s);
  for (const e of s.enemies) {
    if (!e.st) continue;
    e.st.scaleRev = 0;
    e.st.fragile = 0;
    // 젤리 전사: 피해 없이 지난 라운드면 공격력 +1
    if (e.kind === 'jellyFighter' && e.st.hurt !== s.round) e.atk += 1;
  }
  if (boss && !a.vars.noPassive) {
    // 대행 학장: 이번 라운드에 흡수하지 못했으면 최대 체력 10% 잃음
    if (has(s, 'sugar') && a.awake && boss.st?.absorbed !== s.round) {
      boss.hp = Math.max(1, boss.hp - Math.ceil(boss.maxHp * 0.1));
      log(s, `🍬 ${boss.name}: 당분 부족 — 체력 ${boss.hp}`);
    }
  }
  for (const e of s.enemies) if (e.kind === 'peacock') e.hp = Math.min(e.maxHp, e.hp + 2);
  for (const later of a.later.filter((x) => x.round <= s.round)) apEvent(s, rng, later.event);
  a.later = a.later.filter((x) => x.round > s.round);
  if (s.board.id === 'garden') gardenGate(s);
}

// ───────────────────────── 캐릭터 상태 ─────────────────────────

function addOverclock(p: Player, n: number) {
  pst(p).overclock = (p.ap?.overclock ?? 0) + n;
}

/** 자기 차례 시작: 연리 (공격력 · 방어력 -1) · 주목 · 저주 줄이기 · 잿빛 깃털 */
export function apTurnStart(s: GameState, rng: Rng, p: Player) {
  const a = p.ap;
  if (!a) return;
  if (a.bond) {
    a.bondDown = (a.bondDown ?? 0) + 1;
    a.bond -= 1;
    if (a.bond <= 0) a.bondDown = 0;
  }
  if (a.attention) a.attention -= 1;
  if (a.curse) a.curse -= 1;
  const ashen = p.hand.filter((h) => h.card === 'ashenFeather').length;
  if (ashen) a.flame = (a.flame ?? 0) + ashen;
  void s;
  void rng;
}

/** 자기 차례 끝: 중독 · 개조 · 온염 · 그놈 탓이야! */
export function apTurnEnd(s: GameState, rng: Rng, p: Player) {
  const a = p.ap;
  const fault = p.hand.filter((h) => h.card === 'hisFault').length;
  if (fault) damage(s, rng, p, fault);
  if (!a || p.ko) return;
  if (a.poison) {
    a.poison -= 1;
    log(s, `${p.name}: ☠️ 중독 — 체력 -1`);
    damage(s, rng, p, 1);
  }
  if (a.flame && !p.ko) {
    log(s, `${p.name}: 🔥 온염 — 2 피해`);
    damage(s, rng, p, 2);
  }
  if (a.overclock && !p.ko) {
    a.overclock -= 1;
    if (a.overclock <= 0) {
      log(s, `${p.name}: ⚙️ 개조 폭주 — 체력 ${p.hp} 피해`);
      notice(s, `⚙️ ${p.name} 개조 폭주`);
      damage(s, rng, p, p.hp);
    }
  }
}

/** 회복했다: 온염 1층 줄고 1라운드 공격력 +1 · 공작 개병 +1 */
export function apHealed(p: Player) {
  const a = p.ap;
  if (!a) return;
  if (a.flame) {
    a.flame -= 1;
    p.status.atkUp = { amount: (p.status.atkUp?.amount ?? 0) + 1, turns: Math.max(1, p.status.atkUp?.turns ?? 1) };
  }
  if (a.display !== undefined) a.display += 1;
}

/** 방어력 깎임 (저주 · 주목 · 연리) */
export function apPlayerDef(p: Player): number {
  const a = p.ap;
  if (!a) return 0;
  return -(a.curse ? 2 : 0) - (a.attention ? 1 : 0) - (a.bondDown ?? 0);
}

export function apPlayerAtk(p: Player): number {
  return -(p.ap?.bondDown ?? 0);
}

/** 다음 이동 + (금지 표지판 · 질주 버섯 · 에너지 바) · 주목 -1 */
export function apMoveBonus(p: Player): number {
  const a = p.ap;
  if (!a) return 0;
  const up = a.moveUp ?? 0;
  a.moveUp = 0;
  return up - (a.attention ? 1 : 0);
}

// ───────────────────────── 길 ─────────────────────────

/** 이동 중 한 칸에 들어섰다: 알 · 호리병 줍기 · 복숭아 · 연리 풀기 */
export function apPass(s: GameState, rng: Rng, p: Player, tile: number) {
  if (!s.ap) return;
  for (const m of s.marks.filter((x) => x.tile === tile)) {
    if (m.kind === 'egg') {
      s.marks = s.marks.filter((x) => x !== m);
      log(s, `${p.name}: 🥚 신비한 알`);
      apCount(s, rng, 'egg', 1, p);
    }
    if (m.kind === 'gourd') {
      s.marks = s.marks.filter((x) => x !== m);
      give(p, 'gourd');
      log(s, `${p.name}: 🍶 호리병`);
      apCount(s, rng, 'gourd', 1, p);
    }
    if (m.kind === 'peach') {
      heal(p, 2);
      if (p.ap) p.ap.attention = 0;
    }
  }
  // 연리: 연리인 다른 캐릭터를 만나면 둘 다 풀리고 체력 +2
  if (p.ap?.bond) {
    for (const o of s.players.filter((x) => x.id !== p.id && !x.ko && x.tile === tile && x.ap?.bond)) {
      for (const who of [p, o]) {
        who.ap!.bond = 0;
        who.ap!.bondDown = 0;
        heal(who, 2);
      }
      log(s, `${p.name} · ${o.name}: 💞 연리가 풀렸다`);
    }
  }
}

/** 멈춘 칸 표식 (독안개 · 질주 버섯) — 처리했으면 true */
export function apLandMark(s: GameState, rng: Rng, p: Player, kind: string): boolean {
  if (kind === 'mist') {
    if (p.ap?.overclock) {
      heal(p, 2);
      log(s, `${p.name}: 🌫️ 독안개 — 개조 상태라 체력 +2`);
    } else {
      log(s, `${p.name}: 🌫️ 독안개 — 2 피해`);
      damage(s, rng, p, 2);
    }
    return true;
  }
  if (kind === 'mushroom') {
    pst(p).moveUp = (p.ap?.moveUp ?? 0) + 3;
    log(s, `${p.name}: 🍄 질주 버섯 — 다음 이동 +3`);
    return true;
  }
  return kind === 'egg' || kind === 'gourd' || kind === 'peach' || kind === 'starfruit' || kind === 'moneyTree';
}

// ───────────────────────── 전투 ─────────────────────────

/** 공격받을 수 있는지 (카드 · 스킬 대상) */
export function apTargetable(s: GameState, e: Enemy): boolean {
  if (!e.isBoss && ENEMIES[e.kind as EnemyKind]?.ally) return false;
  if (e.isBoss && (s.ap?.vars.shield ?? 0) > 0) return false;
  return true;
}

/** 도전할 수 있는지 (지나가다 · 멈춰서 전투) */
export function apChallengeable(s: GameState, e: Enemy): boolean {
  if (!apTargetable(s, e)) return false;
  return e.isBoss || !ENEMIES[e.kind as EnemyKind]?.fly;
}

/** 몬스터 공격력 + (이 캐릭터를 공격할 때) */
export function apEnemyAtk(s: GameState, e: Enemy, p: Player): number {
  if (!s.ap) return 0;
  const a = p.ap ?? {};
  let n = 0;
  if (e.kind === 'prawn' && p.hand.length < 4) n += 3;
  if (e.kind === 'monkeyBox' && a.overclock) n -= 2;
  if (e.kind === 'madApe' && a.overclock) n += 3;
  if (e.kind === 'lovebirdChalice' && a.bond) n += 2;
  if (e.isBoss) {
    if (has(s, 'spiritLink')) n += 2 * s.enemies.filter((x) => x.kind === 'spearSpirit').length;
    if (has(s, 'fury') && a.problem) n += 2;
    if (has(s, 'solitude') && a.bond) n += 3;
    if (has(s, 'reverseScale')) n += 2 * (e.st?.scaleRev ?? 0);
  }
  return n;
}

/** 몬스터 방어력 + (이 캐릭터와 싸울 때) */
export function apEnemyDef(s: GameState, e: Enemy, p: Player): number {
  if (!s.ap) return 0;
  let n = 0;
  if (e.kind === 'lovebirdChalice' && p.ap?.bond) n += 2;
  if (e.isBoss) {
    if (has(s, 'spiritLink')) n += 2 * s.enemies.filter((x) => x.kind === 'swordSpirit').length;
    if (has(s, 'solitude') && e.st?.solitude) n += 2;
    n -= s.ap.vars.defDown ?? 0;
  }
  return n;
}

/** 공작 개병: 청동 공작과 싸울 때 층 차이마다 공격력 · 방어력 +2 */
export function apDisplayBonus(p: Player, e: Enemy): number {
  if (e.kind !== 'peacock') return 0;
  return 2 * Math.max(0, (p.ap?.display ?? 0) - (e.st?.display ?? 0));
}

/** 받는 피해 보정: 역린 -2/층 · 취약 중추 +1/번 · 지휘대 피해는 사자 가우에게 */
export function apDamageIn(s: GameState, e: Enemy, amount: number): number {
  if (!s.ap || amount <= 0) return amount;
  let n = amount;
  if (e.isBoss && has(s, 'reverseScale') && !s.ap.vars.noPassive) n = Math.max(0, n - 2 * (e.st?.scaleRev ?? 0));
  if (e.kind === 'platform') n += e.st?.fragile ?? 0;
  return n;
}

/** 피해를 받은 뒤: 젤리 방어력 -2 · 게 공격력 +1 · 수호 보주 풀림 · 역린 · 공유 체력 */
export function apEnemyHurt(s: GameState, rng: Rng, e: Enemy, dealt: number) {
  if (!s.ap || dealt <= 0) return;
  const t = st(e);
  t.hurt = s.round;
  if (t.guard) {
    e.def -= t.guard;
    t.guard = 0;
  }
  if (e.kind === 'jellyFighter' || e.kind === 'jellyGuard') e.def = Math.max(0, e.def - 2);
  if (e.kind === 'crab') e.atk += 1;
  if (e.kind === 'platform') t.fragile = (t.fragile ?? 0) + 1;
  if (e.isBoss && has(s, 'reverseScale') && !s.ap.vars.noPassive) {
    if (dealt > 20) {
      t.scaleRev = 0;
      t.silenced = s.round;
    } else t.scaleRev = (t.scaleRev ?? 0) + 1;
  }
  // 골목대장 가우: 체력 60% 이하부터 반격
  if (e.isBoss && has(s, 'kidGawu')) e.counter = e.hp <= e.maxHp * 0.6;
  // 아마카와 자매: 절반 이하에서 추가 병력
  if (e.isBoss && (has(s, 'reverseScale') || has(s, 'goldScale')) && !s.ap.vars.half && e.hp * 2 <= e.maxHp) {
    s.ap.vars.half = 1;
    const kinds: EnemyKind[] = has(s, 'reverseScale') ? ['prawn', 'prawn'] : ['goldfish', 'goldfish', 'goldfish'];
    for (const k of kinds) apSummon(s, rng, k);
    for (const m of s.enemies) if (!m.isBoss && !ENEMIES[m.kind as EnemyKind]?.ally) {
      m.atk += 1;
      m.def += 1;
    }
    notice(s, has(s, 'reverseScale') ? '🐍 독목난지 — 새우 병사' : '🎏 명정추태 — 금붕어');
  }
}

/** 지휘대가 받은 피해는 사자 가우의 체력에서 (체력 공유) */
export function apSharedBoss(s: GameState, e: Enemy): Enemy | null {
  if (e.kind !== 'platform' || !has(s, 'sharedHp')) return null;
  return bossEnemy(s) ?? null;
}

/** 캐릭터가 도전했다 */
export function apChallenged(s: GameState, rng: Rng, p: Player, e: Enemy) {
  if (!s.ap) return;
  if (e.isBoss && has(s, 'kidGawu') && !s.ap.vars.noPassive) {
    pst(p).attention = 2;
    if ((e.st?.energy ?? 0) > 0) {
      e.st!.energy -= 1;
      e.atk -= 2;
    }
  }
  void rng;
}

/** 반격을 받지 않는다 (폭죽 · 독니) */
export function apNoCounter(s: GameState, e: Enemy): boolean {
  return !!s.ap && (e.st?.noCounter === s.round || s.turn.battle.noCounterAll === true);
}

/** 반격했다 (소우리: 금린 +2) */
export function apCountered(s: GameState, rng: Rng, e: Enemy) {
  if (!s.ap || !e.isBoss || !has(s, 'goldScale') || s.ap.vars.noPassive) return;
  addScale(s, rng, e, 2);
}

function addScale(s: GameState, rng: Rng, e: Enemy, n: number) {
  st(e).scale = (e.st?.scale ?? 0) + n;
  e.atk += n;
  e.def += n;
  apCount(s, rng, 'scale', e.st!.scale, undefined, true);
}

/** 몬스터가 캐릭터에게 피해를 줬다 (반격 · 쫓아온 전투) */
export function apEnemyHit(s: GameState, rng: Rng, e: Enemy, p: Player, dmg: number) {
  if (!s.ap || dmg <= 0) return;
  if (e.isBoss && has(s, 'momentum')) {
    e.atk += 2;
    st(e).momentum = (e.st?.momentum ?? 0) + 2;
  }
  if (e.kind === 'madApe' && p.ap?.overclock) e.hp = Math.min(e.maxHp, e.hp + 3);
  if (e.isBoss && has(s, 'flameHit')) pst(p).flame = (p.ap?.flame ?? 0) + 2;
  if (e.isBoss && has(s, 'solitude')) pst(p).bond = 3;
  if (e.isBoss && has(s, 'fury') && p.ap?.problem) p.ap.problem = 0;
  void rng;
}

/** 몬스터를 쓰러뜨렸다: 과제 · 떨어뜨리는 것 · 보스 규칙 */
export function apKill(s: GameState, rng: Rng, p: Player, e: Enemy) {
  if (!s.ap || e.isBoss) return;
  const info = ENEMIES[e.kind as EnemyKind];
  switch (info.drop) {
    case 'firecracker':
      give(p, 'firecracker');
      break;
    case 'candy':
      give(p, rng.pick(CANDY));
      break;
    case 'building':
      give(p, rng.pick(BUILDINGS));
      break;
    case 'feather':
      give(p, 'feather');
      break;
    case 'heal2':
      heal(p, 2);
      break;
    case 'card':
      drawCards(s, p, rng, 1);
      break;
  }
  const boss = bossEnemy(s);
  // 영혼 축전: 검 · 창 영혼이 쓰러지면 마사오 체력 -10%
  if (boss && has(s, 'spiritLink') && (e.kind === 'swordSpirit' || e.kind === 'spearSpirit')) {
    boss.hp = Math.max(1, boss.hp - Math.ceil(boss.maxHp * 0.1));
    log(s, `  🏮 ${boss.name} 체력 -10% (${boss.hp})`);
  }
  // 큰목소리 · 무술 수련생: 짝을 잃으면 강해진다
  if (e.kind === 'trainee') for (const x of s.enemies.filter((m) => m.kind === 'loudmouth')) {
    x.atk += 2;
    x.def += 2;
    x.counter = true;
  }
  if (e.kind === 'loudmouth') for (const x of s.enemies.filter((m) => m.kind === 'trainee')) {
    x.atk += 3;
    st(x).moves = 1;
  }
  // 유령 골목: 인공생명체를 쓰러뜨리면 심도 개조 -1 · 다음 라운드에 다음 개체
  if (has(s, 'shield') && (e.kind === 'synth1' || e.kind === 'synth2' || e.kind === 'synth3')) {
    const a = ap(s);
    a.vars.shield = Math.max(0, (a.vars.shield ?? 0) - 1);
    if (e.kind === 'synth1') {
      apSummon(s, rng, 'madApe');
      apSummon(s, rng, 'sawMonkey');
      a.later.push({ round: s.round + 1, event: 'reviveSynth2' });
    }
    if (e.kind === 'synth2') {
      apSummon(s, rng, 'madApe');
      apSummon(s, rng, 'madApe');
      apSummon(s, rng, 'sawMonkey');
      a.later.push({ round: s.round + 1, event: 'reviveSynth3' });
    }
    for (const m of s.enemies) if (!m.isBoss) m.def += e.kind === 'synth3' ? 0 : 1;
    s.enemyBonus.def += e.kind === 'synth3' ? 0 : 1;
    notice(s, a.vars.shield ? `🧪 심도 개조 ${a.vars.shield}` : '🧪 과학 괴인을 공격할 수 있다!');
  }
  apCount(s, rng, e.kind, 1, p);
}

/** 성이 올랐다 (유령 골목 첫 1성 과제) */
export function apStar(s: GameState, rng: Rng, p: Player) {
  apCount(s, rng, 'star', 1, p);
}

// ───────────────────────── 원작 맵 카드 ─────────────────────────

/** 원작 맵 카드 효과. 처리했으면 true */
export function apCardEffect(s: GameState, rng: Rng, p: Player, card: CardId, target?: number): boolean {
  const ally = target !== undefined ? s.players[target] : undefined;
  const enemy = target !== undefined ? s.enemies.find((e) => e.id === target) : undefined;
  const build = (kind: 'mushroom' | 'starfruit' | 'peach' | 'moneyTree', tileKind?: 'haste' | 'checkpoint' | 'shop') => {
    if (target === undefined) return;
    if (tileKind) s.board.tiles[target].kind = tileKind;
    s.marks = s.marks.filter((m) => m.tile !== target);
    s.marks.push({ id: s.nextMarkId++, tile: target, kind });
    s.turn.extraPlays += 1;
    apCount(s, rng, 'build', 1, p);
  };
  switch (card) {
    case 'hisFault':
      if (ally) {
        damage(s, rng, ally, 1);
        pst(ally).problem = 1;
      }
      p.coins += 3;
      if (s.ap && has(s, 'fury')) {
        s.ap.counts.fault = (s.ap.counts.fault ?? 0) + 1;
        const boss = bossEnemy(s);
        if (boss && s.ap.counts.fault % 3 === 0) {
          boss.atk += 1;
          spawnNear(s, 'jellyGuard', boss.tile);
          notice(s, '👮 격노 — 젤리 호위병');
        }
      }
      return true;
    case 'supportGum':
      if (ally) {
        heal(ally, 2);
        if (ally.ap) ally.ap.overclock = 0;
      }
      s.turn.extraPlays += 1;
      return true;
    case 'energyBar':
      if (ally) {
        ally.status.atkUp = { amount: (ally.status.atkUp?.amount ?? 0) + 2, turns: 2 };
        pst(ally).moveUp = (ally.ap?.moveUp ?? 0) + 2;
        addOverclock(ally, 2);
      }
      return true;
    case 'smartGummy':
      if (ally) {
        drawCards(s, ally, rng, 3);
        if (ally.ap) ally.ap.overclock = 0;
      }
      return true;
    case 'gourd':
      drawCards(s, p, rng, 3);
      return true;
    case 'hasteMushroom':
      build('mushroom', 'haste');
      return true;
    case 'starfruit':
      build('starfruit', 'checkpoint');
      return true;
    case 'peach':
      build('peach');
      return true;
    case 'moneyTree':
      build('moneyTree', 'shop');
      return true;
    case 'feather':
      if (target !== undefined) {
        const from = p.tile;
        p.tile = target;
        s.lastMove = { seq: ++s.seq, player: p.id, path: [from, target] };
        heal(p, 3);
      }
      return true;
    case 'firecracker':
      if (enemy) {
        const t = st(enemy);
        if (t.hype) {
          enemy.atk -= 1;
          enemy.def -= 1;
          t.hype = 0;
        }
        if (t.momentum) {
          enemy.atk -= t.momentum;
          t.momentum = 0;
        }
        t.noCounter = s.round;
      }
      return false;
    case 'poisonFang':
      s.turn.battle.noCounterAll = true;
      if (s.phase.kind === 'encounter') {
        const foe = s.enemies.find((e) => e.id === (s.phase as { enemy: number }).enemy);
        if (foe?.isBoss && foe.st?.scale) {
          const n = Math.min(2, foe.st.scale);
          foe.st.scale -= n;
          foe.atk -= n;
          foe.def -= n;
        }
      }
      return true;
  }
  return false;
}

/** 카드가 고를 칸 (건물: 지을 수 있는 빈 칸 · 깃털: 5칸 안) */
export function apTileTargets(s: GameState, p: Player, card: CardId): number[] | null {
  if (BUILDINGS.includes(card)) {
    const built = new Set(s.marks.filter((m) => ['mushroom', 'starfruit', 'peach', 'moneyTree'].includes(m.kind)).map((m) => m.tile));
    return (s.board.buildable ?? []).filter((t) => !built.has(t));
  }
  if (card === 'banSign') {
    return [...dist(s, p.tile)].filter(([, d]) => d >= 1 && d <= 10).map(([t]) => t);
  }
  if (card === 'feather') {
    return [...dist(s, p.tile)].filter(([t, d]) => d >= 1 && d <= 5 && s.board.tiles[t].kind !== 'base').map(([t]) => t);
  }
  return null;
}

/** 원작 맵에 맞는 몬스터 칸 몬스터 (없으면 null) */
export function apUsesCandy(s: GameState): boolean {
  return s.board.id === 'ghostalley';
}

export { randomCard };

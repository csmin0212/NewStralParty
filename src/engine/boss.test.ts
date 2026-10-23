import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../data/board';
import { BOSSES } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import { activePart, bossEnemy, currentIntent } from './boss';
import { MAPS } from '../data/maps';
import { RELICS } from '../data/relics';
import { statusAtk } from './cards';
import { rollOffer } from './relics';
import { cardTargets } from './cards';
import { applyAction, createGame } from './game';
import { createRng } from './rng';
import { enemyDefAgainst } from './skills';
import type { Action, Board, BossDef, BossMove, EnemyKind, GameState, MarkKind, TileKind } from './types';

/** 0번 본부 + 한 바퀴. 보스는 bossTile에 바로 나온다 */
function ring(n: number, bossTile = n - 1): Board {
  const kinds: TileKind[] = ['base', ...Array<TileKind>(n - 1).fill('empty')];
  return {
    name: 'test',
    baseTile: 0,
    tiles: kinds.map((kind, id) => ({ id, kind, x: id, y: 0, next: [(id + 1) % kinds.length] })),
    spawnTiles: [],
    bossTile,
  };
}

function boss(moves: Record<string, BossMove>, deck: string[], patch: Partial<BossDef> = {}): BossDef {
  return {
    id: 'test',
    name: '테스트 보스',
    icon: 'B',
    hpPerPlayer: 10,
    atk: 1,
    def: 0,
    counter: false,
    defense: 'block',
    defeatAt: 99,
    timeline: [{ at: 1, actions: [{ type: 'bossAppear' }] }],
    moves,
    deck,
    deckOrder: 'cycle',
    ...patch,
  };
}

const hit2: BossMove = { name: '전체 공격', text: '', effects: [{ type: 'damage', target: 'all', amount: 2 }] };
const nothing: BossMove = { name: '대기', text: '', effects: [] };

function start(def: BossDef, board = ring(20), players = 2): GameState {
  const setups = Array.from({ length: players }, (_, i) => ({ name: `P${i + 1}`, color: '#fff', character: 'mutbyeol' as const }));
  return createGame({ board, boss: def, players: setups, seed: 7 });
}

/** 주사위 없이 steps칸 (밀린 유물 고르기는 첫 후보로) */
function rollExactly(state: GameState, steps: number): GameState {
  let s = structuredClone(state);
  const offer = s.players[s.current].relicOffer;
  if (offer) s = applyAction(s, { type: 'PICK_RELIC', player: s.current, relic: offer.ids[0] });
  s.turn.diceCount = 0;
  s.turn.extraSteps = steps;
  return applyAction(s, { type: 'ROLL', player: s.current });
}

/** 모두 한 칸씩 움직이고 턴을 넘겨 라운드를 끝낸다 (보스 차례까지) */
function endRound(state: GameState): GameState {
  let s = state;
  const round = s.round;
  while (s.round === round && s.phase.kind !== 'gameOver') {
    if (s.phase.kind === 'preRoll') s = rollExactly(s, 1);
    if (s.phase.kind === 'encounter') s = applyAction(s, { type: 'ENCOUNTER', player: s.current, choice: 'release' });
    if (s.phase.kind === 'endTurn') s = applyAction(s, { type: 'END_TURN', player: s.current });
  }
  return s;
}

function put(state: GameState, kind: EnemyKind, tile: number): GameState {
  const s = structuredClone(state);
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
    atk: info.atk,
    def: info.def,
    counter: info.counter,
    defense: info.defense,
    reward: info.reward,
  });
  return s;
}

function mark(state: GameState, kind: MarkKind, tile: number, extra: object = {}): GameState {
  const s = structuredClone(state);
  s.marks.push({ id: s.nextMarkId++, tile, kind, ...extra });
  return s;
}

describe('보스 데이터', () => {
  it('보스는 9종 이상이고 id가 겹치지 않는다', () => {
    expect(BOSSES.length).toBeGreaterThanOrEqual(9);
    expect(new Set(BOSSES.map((b) => b.id)).size).toBe(BOSSES.length);
  });

  it.each(BOSSES.map((b) => [b.name, b] as const))('%s: 덱 · 시간표 · 규칙이 가리키는 행동이 모두 있다', (_, b) => {
    const has = (id: string) => expect(b.moves, id).toHaveProperty(id);
    for (const id of b.deck ?? []) has(id);
    for (const id of b.phase2?.deck ?? []) has(id);
    if (b.passive?.gauge) has(b.passive.gauge.release);
    for (const g of b.timeline) for (const a of g.actions) if (a.type === 'move') has(a.move);
    for (const m of Object.values(b.moves ?? {}))
      for (const fx of m.effects) if (fx.type === 'hide' && fx.then) has(fx.then);
    for (const fx of b.phase2?.enter ?? []) if (fx.type === 'hide' && fx.then) has(fx.then);
    expect(b.timeline.some((g) => g.actions.some((a) => a.type === 'bossAppear'))).toBe(true);
  });
});

describe('보스 행동 카드', () => {
  it('보스가 나오면 첫 행동을 공개하고, 라운드 끝 보스 차례에 쓴 뒤 다음 행동을 공개한다', () => {
    let s = start(boss({ hit2, nothing }, ['hit2', 'nothing']));
    expect(s.bossState.intent?.move).toBe('hit2');
    s = endRound(s);
    expect(s.players.map((p) => p.hp)).toEqual([7, 7]);
    expect(s.bossTurn?.move).toBe('전체 공격');
    expect(s.bossState.intent?.move).toBe('nothing');
    s = endRound(s);
    expect(s.bossState.intent?.move).toBe('hit2');
  });

  it('공개된 뒤 breakAt만큼 피해를 주면 행동이 끊기고 보스가 그로기 (방어 0)', () => {
    const big: BossMove = { ...hit2, breakAt: 3 };
    let s = start(boss({ big }, ['big'], { def: 4 }));
    const b = bossEnemy(s)!;
    s = structuredClone(s);
    // 레이저 대신 직접: 카드 효과와 같은 경로로 피해를 준다
    s.players[0].hand = [{ card: 'brick' }];
    s.players[0].level = 3;
    s.players[0].tile = b.tile - 1;
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0, target: b.id });
    expect(s.bossState.intent?.broken).toBe(true);
    s = endRound(s);
    expect(s.players.map((p) => p.hp)).toEqual([9, 9]);
    expect(s.bossTurn?.broken).toBe(true);
    expect(s.bossState.groggy).toBe(1);
    expect(enemyDefAgainst(s, s.players[0], bossEnemy(s)!)).toBe(0);
  });

  it('땅속에 숨은 보스는 부딪히지 않고 카드로 고를 수 없다', () => {
    const dive: BossMove = { name: '잠행', text: '', effects: [{ type: 'hide', then: 'up' }] };
    const up: BossMove = { name: '습격', text: '', effects: [{ type: 'warp', where: 'crowd', amount: 3, range: 1 }] };
    let s = start(boss({ dive, up }, ['dive']), ring(20, 2));
    s = endRound(s);
    expect(s.bossState.hidden).toBe(true);
    expect(s.bossState.intent?.move).toBe('up');
    // 숨은 보스 칸(2)을 그냥 지나간다
    s = structuredClone(s);
    s.players[s.current].tile = 1;
    s = rollExactly(s, 2);
    expect(s.phase.kind).toBe('endTurn');
    s.players[s.current].hand = [{ card: 'laser' }];
    s.players[s.current].level = 3;
    expect(cardTargets(s, s.players[s.current], 'laser')).toEqual([]);
    s = endRound(s);
    expect(s.bossState.hidden).toBe(false);
    expect(s.bossTurn?.moved.length).toBe(1);
  });

  it('체력이 절반 아래로 떨어지면 2페이즈: 이름 · 덱이 바뀌고 들어갈 때 효과를 쓴다', () => {
    const def = boss({ nothing, hit2 }, ['nothing'], {
      phase2: { at: 0.5, name: '변신', icon: 'X', atk: 5, def: 0, deck: ['hit2'], enter: [{ type: 'summon', enemies: ['robot'], near: 'boss' }] },
    });
    let s = start(def);
    s = structuredClone(s);
    const b = bossEnemy(s)!;
    s.players[0].hand = [{ card: 'railgun' }];
    s.players[0].level = 3;
    s.players[0].coins = 99;
    s.players[0].tile = b.tile - 1;
    b.hp = 11;
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0, target: b.id });
    expect(bossEnemy(s)!.name).toBe('변신');
    expect(bossEnemy(s)!.atk).toBe(5);
    expect(s.bossState.phase).toBe(2);
    expect(s.bossState.intent?.move).toBe('hit2');
    expect(s.enemies.filter((e) => e.kind === 'robot')).toHaveLength(1);
  });
});

describe('미니언 기믹', () => {
  it('연결된 미니언이 받은 피해는 보스도 받는다 (미니언 남은 체력까지)', () => {
    let s = put(start(boss({ nothing }, ['nothing'])), 'perorominion', 3);
    const b = bossEnemy(s)!;
    s = structuredClone(s);
    s.players[0].hand = [{ card: 'laser' }];
    s.players[0].level = 3;
    s.players[0].coins = 99;
    const minion = s.enemies.find((e) => e.kind === 'perorominion')!;
    minion.hp = 2;
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0, target: minion.id });
    expect(s.enemies.find((e) => e.kind === 'perorominion')).toBeUndefined();
    // 레이저 3 피해 중 미니언 체력만큼만 넘어간다
    expect(bossEnemy(s)!.hp).toBe(b.hp - 2);
  });

  it('분신은 맞으면 피해 없이 사라진다', () => {
    let s = put(start(boss({ nothing }, ['nothing'])), 'gozClone', 2);
    const hp = bossEnemy(s)!.hp;
    s = rollExactly(s, 2);
    expect(s.phase.kind).toBe('encounter');
    s = applyAction(s, { type: 'ENCOUNTER', player: 0, choice: 'attack' });
    expect(s.enemies.some((e) => e.kind === 'gozClone')).toBe(false);
    expect(bossEnemy(s)!.hp).toBe(hp);
    expect(s.battles.at(-1)!.events.some((e) => e.type === 'skill' && e.name === '분신이었다!')).toBe(true);
  });

  it('도둑은 덮친 아군의 코인을 훔치고, 쓰러뜨리면 돌려받는다', () => {
    let s = put(start(boss({ nothing }, ['nothing'])), 'thief', 5);
    s = structuredClone(s);
    for (const p of s.players) p.tile = 6;
    const coins = s.players.map((p) => p.coins);
    // 도둑을 6번 칸으로만 갈 수 있게: 1칸만 움직이도록 roam 결과를 확인
    let tries = 0;
    while (!s.enemies.find((e) => e.kind === 'thief')?.loot && tries++ < 10) s = endRound(s);
    const thief = s.enemies.find((e) => e.kind === 'thief')!;
    expect(thief.loot).toBeGreaterThan(0);
    expect(s.players.reduce((a, p) => a + p.coins, 0)).toBeLessThan(coins.reduce((a, c) => a + c, 0) + 100);
    s = structuredClone(s);
    s.players[s.current].hand = [{ card: 'brick' }];
    s.players[s.current].level = 3;
    s.players[s.current].tile = thief.tile;
    s.enemies.find((e) => e.id === thief.id)!.hp = 3;
    const before = s.players[s.current].coins;
    s = applyAction(s, { type: 'PLAY_CARD', player: s.current, handIndex: 0, target: thief.id });
    expect(s.players[s.current].coins).toBe(before + ENEMIES.thief.reward + thief.loot!);
  });

  it('자폭 병사는 정해진 보스 차례가 지나면 주변 아군에게 피해를 주고 사라진다', () => {
    let s = put(start(boss({ nothing }, ['nothing'])), 'automaton', 5);
    s = structuredClone(s);
    for (const p of s.players) p.tile = 4;
    // 이동하지 않게 한 칸 이동 대신 제자리: 4 → 5는 병사 칸이라 놓아준다
    for (let i = 0; i < ENEMIES.automaton.fuse!.turns; i++) {
      s = structuredClone(s);
      for (const p of s.players) p.tile = 4;
      s.turn.diceCount = 0;
      s = endRoundStay(s);
    }
    expect(s.enemies.some((e) => e.kind === 'automaton')).toBe(false);
    expect(s.bossTurn?.hits.some((h) => h.amount === ENEMIES.automaton.fuse!.amount)).toBe(true);
  });

  it('필러 1개마다 보스 방어 +2, 2칸 안 아군 코인 -2', () => {
    const def = boss({ nothing }, ['nothing'], { passive: { guard: { kind: 'pillar', def: 2 }, drain: { kind: 'pillar', range: 2, amount: 2 } } });
    let s = put(put(start(def), 'pillar', 8), 'pillar', 12);
    expect(enemyDefAgainst(s, s.players[0], bossEnemy(s)!)).toBe(4);
    s = structuredClone(s);
    s.players[1].tile = 9;
    s.players[1].coins = 10;
    s = endRoundStay(s);
    expect(s.bossTurn?.hits.some((h) => h.player === 1 && h.note === '코인 -2')).toBe(true);
  });
});

/** 아무도 움직이지 않고 라운드를 끝낸다 (주사위 0칸) */
function endRoundStay(state: GameState): GameState {
  let s = state;
  const round = s.round;
  while (s.round === round && s.phase.kind !== 'gameOver') {
    s = structuredClone(s);
    s.phase = { kind: 'endTurn' };
    s = applyAction(s, { type: 'END_TURN', player: s.current });
  }
  return s;
}

describe('보드 표식', () => {
  it('폭탄은 다음 보스 차례에 터지고, 멈추면 해체된다', () => {
    const bomb: BossMove = { name: '폭탄', text: '', effects: [{ type: 'marks', kind: 'bomb', count: 1, near: 'players' }] };
    let s = start(boss({ bomb, nothing }, ['bomb', 'nothing']));
    s = endRoundStay(s);
    expect(s.marks.filter((m) => m.kind === 'bomb')).toHaveLength(1);
    const tile = s.marks[0].tile;
    s = structuredClone(s);
    for (const p of s.players) p.tile = tile;
    s = endRoundStay(s);
    expect(s.marks).toHaveLength(0);
    expect(s.players.every((p) => p.hp === 9 - 3)).toBe(true);

    // 해체
    let t = mark(start(boss({ nothing }, ['nothing'])), 'bomb', 3, { timer: 2, power: 3 });
    const coins = t.players[0].coins;
    t = rollExactly(t, 3);
    expect(t.marks).toHaveLength(0);
    expect(t.players[0].coins).toBe(coins + 2);
  });

  it('초록 성유물은 보스가 받는 피해 +1, 빨강 성유물은 공개된 행동을 끊는다', () => {
    let s = mark(mark(start(boss({ hit2 }, ['hit2'])), 'relicGreen', 2), 'relicRed', 3);
    s = rollExactly(s, 2);
    expect(s.bossState.vuln).toBe(1);
    s = applyAction(s, { type: 'END_TURN', player: 0 });
    s = rollExactly(s, 3);
    expect(s.bossState.intent?.broken).toBe(true);
    s = applyAction(s, { type: 'END_TURN', player: 1 });
    expect(s.players.map((p) => p.hp)).toEqual([9, 9]);
  });

  it('모자는 하나에만 코인이 있고, 남은 빈 모자는 다음 보스 차례에 터진다', () => {
    const hats: BossMove = { name: '모자', text: '', effects: [{ type: 'marks', kind: 'hat', count: 3, near: 'players' }] };
    let s = start(boss({ hats, nothing }, ['hats', 'nothing']));
    s = endRoundStay(s);
    expect(s.marks.filter((m) => m.kind === 'hat')).toHaveLength(3);
    expect(s.marks.filter((m) => m.coin)).toHaveLength(1);
    const coinTile = s.marks.find((m) => m.coin)!.tile;
    s = structuredClone(s);
    s.players[0].tile = coinTile - 1;
    const coins = s.players[0].coins;
    s = rollExactly(s, 1);
    expect(s.players[0].coins).toBe(coins + 6);
    expect(s.marks).toHaveLength(0);
  });

  it('오르간에 멈추면 성가가 아군을 치유하고, 성가가 끝나면 보스 쪽으로 돌아간다', () => {
    const chant: BossMove = { name: '성가', text: '', effects: [{ type: 'chant' }] };
    let s = mark(start(boss({ chant }, ['chant'], { passive: { organ: true } })), 'organ', 2);
    s = structuredClone(s);
    for (const p of s.players) p.hp = 5;
    s = rollExactly(s, 2);
    expect(s.bossState.organ).toBe('players');
    s = applyAction(s, { type: 'END_TURN', player: 0 });
    s = rollExactly(s, 1);
    s = applyAction(s, { type: 'END_TURN', player: 1 });
    expect(s.players.map((p) => p.hp)).toEqual([8, 8]);
    expect(s.bossState.organ).toBe('boss');
  });

  it('난로가 꺼지면 보스 차례마다 저체온 피해 · 보스 방어 +2, 멈추면 다시 지핀다', () => {
    let s = mark(start(boss({ nothing }, ['nothing'], { passive: { heater: { hp: 2, decay: 2 } } })), 'heater', 2);
    s = endRoundStay(s);
    expect(s.bossState.heater).toBe(0);
    expect(s.players.map((p) => p.hp)).toEqual([8, 8]);
    expect(enemyDefAgainst(s, s.players[0], bossEnemy(s)!)).toBe(2);
    s = structuredClone(s);
    s.players[s.current].tile = 0;
    s = rollExactly(s, 2);
    expect(s.bossState.heater).toBe(2);
  });

  it('저주는 다음 보스 차례에 터지지만, 그때 체력이 가득 차 있으면 풀린다', () => {
    const curse: BossMove = { name: '저주', text: '', effects: [{ type: 'debuff', target: 'lowestHp', status: 'curse' }] };
    let s = start(boss({ curse, nothing }, ['curse', 'nothing']));
    s = structuredClone(s);
    s.players[1].hp = 5;
    s = endRoundStay(s);
    expect(s.players[1].status.curse).toBe(1);
    s = endRoundStay(s);
    expect(s.players[1].hp).toBe(2);
    expect(s.players[1].status.curse).toBe(0);

    let t = start(boss({ curse, nothing }, ['curse', 'nothing']));
    t = structuredClone(t);
    t.players[1].hp = 5;
    t = endRoundStay(t);
    t = structuredClone(t);
    t.players[1].hp = t.players[1].maxHp;
    t = endRoundStay(t);
    expect(t.players[1].hp).toBe(t.players[1].maxHp);
  });
});

describe('보스 규칙', () => {
  it('케세드: 병사마다 게이지가 차고, 가득 차면 다음 행동은 release, 병사를 모두 쓰러뜨리면 코어 노출', () => {
    const mercy: BossMove = { name: '자비', text: '', effects: [{ type: 'damage', target: 'all', amount: 3 }] };
    const def = boss({ nothing, mercy }, ['nothing'], { passive: { gauge: { max: 4, perMinion: 'automaton', release: 'mercy' } } });
    let s = put(put(start(def), 'automaton', 10), 'automaton', 12);
    s = endRoundStay(s);
    expect(s.bossState.gauge).toBe(2);
    s = endRoundStay(s);
    expect(s.bossState.intent?.move).toBe('mercy');
    expect(s.bossState.gauge).toBe(0);

    let t = put(start(def), 'automaton', 3);
    t = structuredClone(t);
    t.players[0].hand = [{ card: 'brick' }];
    t.players[0].level = 3;
    t.enemies.find((e) => e.kind === 'automaton')!.hp = 3;
    t = applyAction(t, { type: 'PLAY_CARD', player: 0, handIndex: 0, target: t.enemies.find((e) => e.kind === 'automaton')!.id });
    expect(t.bossState.groggy).toBe(1);
  });

  it('와카모: 미사일 유도 장치가 있는 동안 리조트가 깎이고, 0이면 패배', () => {
    const def = boss({ nothing }, ['nothing'], { passive: { resort: { hp: 2, kind: 'missile' } } });
    let s = put(start(def), 'missile', 10);
    s = endRoundStay(s);
    expect(s.bossState.resort).toBe(1);
    s = endRoundStay(s);
    expect(s.phase).toEqual({ kind: 'gameOver', result: 'defeat' });
  });

  it('카이텐: 부위가 라운드마다 바뀌고, 분홍은 공격 +2, 초록은 받는 피해 절반, 켜진 부위에 피해를 몰아주면 부서진다', () => {
    const def = boss({ nothing }, ['nothing'], {
      atk: 1,
      passive: {
        parts: [
          { id: 'pink', name: '오른팔', text: '', breakAt: 4 },
          { id: 'green', name: '왼팔', text: '', breakAt: 99 },
        ],
      },
    });
    let s = start(def);
    expect(activePart(s)?.id).toBe('pink');
    expect(bossEnemy(s)!.atk).toBe(3);
    s = endRoundStay(s);
    expect(activePart(s)?.id).toBe('green');
    expect(bossEnemy(s)!.atk).toBe(1);
    s = structuredClone(s);
    const b = bossEnemy(s)!;
    const hp = b.hp;
    s.players[s.current].hand = [{ card: 'brick' }];
    s.players[s.current].level = 3;
    s.players[s.current].tile = b.tile - 1;
    s = applyAction(s, { type: 'PLAY_CARD', player: s.current, handIndex: 0, target: b.id });
    expect(bossEnemy(s)!.hp).toBe(hp - 3);

    s = endRoundStay(s);
    expect(activePart(s)?.id).toBe('pink');
    s = structuredClone(s);
    s.players[s.current].hand = [{ card: 'brick' }];
    s.players[s.current].level = 3;
    s.players[s.current].tile = bossEnemy(s)!.tile - 1;
    s = applyAction(s, { type: 'PLAY_CARD', player: s.current, handIndex: 0, target: bossEnemy(s)!.id });
    expect(s.bossState.parts).toEqual(['green']);
    expect(bossEnemy(s)!.atk).toBe(1);
  });

  it('돌진: 가까운 아군 쪽으로 움직이며 지나간 아군에게 피해를 주고 밀어낸다', () => {
    const rush: BossMove = { name: '돌진', text: '', effects: [{ type: 'charge', steps: 6, amount: 3, push: 2 }] };
    let s = start(boss({ rush }, ['rush']), ring(20, 10));
    s = structuredClone(s);
    s.players[0].tile = 7;
    s.players[1].tile = 15;
    s = endRoundStay(s);
    const moved = s.bossTurn!.moved.find((m) => m.enemy === bossEnemy(s)!.id)!;
    expect(moved.path[0]).toBe(10);
    expect(s.players[0].hp).toBe(6);
    expect(s.players[0].tile).not.toBe(7);
  });

  it('흡수: 남은 미니언만큼 회복, 그 사이 2마리 넘게 쓰러졌으면 그로기', () => {
    const absorb: BossMove = { name: '흡수', text: '', effects: [{ type: 'absorb', kind: 'perorominion', heal: 3 }] };
    let s = put(start(boss({ absorb }, ['absorb'])), 'perorominion', 5);
    s = structuredClone(s);
    bossEnemy(s)!.hp = 10;
    s.bossState.felled = 2;
    s = endRoundStay(s);
    expect(bossEnemy(s)!.hp).toBe(13);
    expect(s.enemies.some((e) => e.kind === 'perorominion')).toBe(false);
    expect(s.bossState.groggy).toBe(1);
  });
});

/** 무작위로 끝까지 둔다: 오류 없이 끝나는지 */
function autoplay(def: BossDef, seed: number, players: number): GameState {
  const setups = Array.from({ length: players }, (_, i) => ({
    name: `P${i + 1}`,
    color: '#fff',
    character: (['mutbyeol', 'soda', 'mona'] as const)[i % 3],
  }));
  let s = createGame({ board: MAPS[def.map!] ?? DEFAULT_BOARD, boss: def, players: setups, seed });
  const rng = createRng(seed * 31 + 1);
  for (let step = 0; step < 3000 && s.phase.kind !== 'gameOver'; step++) {
    const me = s.current;
    let action: Action;
    const offer = s.players[me].relicOffer;
    switch (s.phase.kind) {
      case 'preRoll':
        action = offer ? { type: 'PICK_RELIC', player: me, relic: rng.pick(offer.ids) } : { type: 'ROLL', player: me };
        break;
      case 'choosePath':
        action = { type: 'CHOOSE_PATH', player: me, to: rng.pick(s.phase.options) };
        break;
      case 'encounter':
        action = { type: 'ENCOUNTER', player: me, choice: rng.next() < 0.8 ? 'attack' : 'release' };
        break;
      case 'defend':
        action = { type: 'DEFEND', player: me, mode: rng.next() < 0.5 ? 'block' : 'evade' };
        break;
      case 'shop':
        action = { type: 'LEAVE_SHOP', player: me };
        break;
      default:
        action = { type: 'END_TURN', player: me };
    }
    s = applyAction(s, action);
  }
  return s;
}

describe('보스 전부 자동 진행', () => {
  it.each(BOSSES.map((b) => [b.name, b] as const))('%s: 전용 맵에서 여러 판을 오류 없이 끝까지 둔다', (_, def) => {
    const results: string[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      const s = autoplay(def, seed, 1 + (seed % 4));
      expect(s.phase.kind).toBe('gameOver');
      results.push(s.phase.kind === 'gameOver' ? s.phase.result : '?');
      // 보스 행동을 실제로 썼는지
      expect(s.bossTurn).not.toBeNull();
      expect(currentIntent(s) === null || typeof currentIntent(s)!.name === 'string').toBe(true);
    }
  });
});

describe('난이도 · 기록', () => {
  it('난이도에 따라 보스 체력 · 공격과 에너미 강화가 오른다', () => {
    const def = boss({ nothing }, ['nothing'], { hpPerPlayer: 10, atk: 2 });
    const setups = [0, 1].map((i) => ({ name: `P${i}`, color: '#fff', character: 'mutbyeol' as const }));
    const normal = createGame({ board: ring(20), boss: def, players: setups, seed: 1 });
    const extreme = createGame({ board: ring(20), boss: def, players: setups, seed: 1, difficulty: 'extreme' });
    expect(bossEnemy(normal)!.maxHp).toBe(20);
    expect(bossEnemy(extreme)!.maxHp).toBe(40);
    expect(bossEnemy(extreme)!.atk).toBe(4);
    expect(extreme.enemyBonus).toEqual({ atk: 1, def: 1 });
  });

  it('보스 피해 · 처치 · 카드 · KO를 플레이어별로 센다', () => {
    let s = put(start(boss({ nothing }, ['nothing'])), 'robot', 3);
    s = structuredClone(s);
    s.players[0].hand = [{ card: 'brick' }, { card: 'laser' }];
    s.players[0].level = 3;
    s.enemies.find((e) => e.kind === 'robot')!.hp = 4;
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0, target: s.enemies.find((e) => e.kind === 'robot')!.id });
    expect(s.stats[0]).toMatchObject({ kills: 1, cardsUsed: 1, damage: 4, bossDamage: 0 });
    s = structuredClone(s);
    s.players[0].tile = bossEnemy(s)!.tile - 3;
    s.turn.cardsPlayed = 0;
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0, target: bossEnemy(s)!.id });
    expect(s.stats[0].bossDamage).toBe(3);
    expect(s.stats[1].damage).toBe(0);
  });
});

describe('이벤트 칸', () => {
  it('멈추면 이벤트 하나가 일어난다. 여러 시드로 모든 이벤트를 오류 없이 돌린다', () => {
    const board = ring(12);
    board.tiles[3].kind = 'event';
    board.tiles[6].kind = 'warp';
    board.tiles[6].warpTo = 9;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const setups = [0, 1].map((i) => ({ name: `P${i}`, color: '#fff', character: 'mutbyeol' as const }));
      let s = createGame({ board, boss: boss({ nothing }, ['nothing'], { timeline: [] }), players: setups, seed });
      s = rollExactly(s, 3);
      const n = s.notices.at(-1)?.text ?? '';
      expect(n).toMatch(/—/);
      seen.add(n);
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });
});

describe('유물', () => {
  it('성이 오르면 유물 3개 중 하나를 골라야 주사위를 굴린다. 능력치 유물은 바로 오른다', () => {
    let s = start(boss({ nothing }, ['nothing'], { timeline: [] }), ring(8));
    s = structuredClone(s);
    s.players[0].coins = 100;
    s = rollExactly(s, 8);
    expect(s.players[0].level).toBe(1);
    const offer = s.players[0].relicOffer!;
    expect(offer.ids).toHaveLength(3);
    expect(new Set(offer.ids).size).toBe(3);
    s = applyAction(s, { type: 'END_TURN', player: 0 });
    s = rollExactly(s, 1);
    s = applyAction(s, { type: 'END_TURN', player: 1 });
    expect(() => applyAction(s, { type: 'ROLL', player: 0 })).toThrow('유물');
    const t = structuredClone(s);
    t.players[0].relicOffer = { ids: ['gloves3', 'cookie1', 'backpack'], tier: 1 };
    const atk = t.players[0].atk;
    const u = applyAction(t, { type: 'PICK_RELIC', player: 0, relic: 'gloves3' });
    expect(u.players[0].atk).toBe(atk + 5);
    expect(u.players[0].relicOffer).toBeNull();
    expect(u.players[0].relics).toEqual(['gloves3']);
    expect(() => applyAction(u, { type: 'PICK_RELIC', player: 0, relic: 'cookie1' })).toThrow();
  });

  it('키워드를 두 가지 가지면 다른 키워드 유물은 나오지 않는다 · 가진 유물은 다시 나오지 않는다', () => {
    let s = start(boss({ nothing }, ['nothing'], { timeline: [] }));
    s = structuredClone(s);
    s.players[0].relics = ['bank1', 'medkit1'];
    for (let i = 0; i < 40; i++) {
      s.players[0].relicOffer = null;
      s.phase = { kind: 'shop', stepsLeft: 0, offers: [], free: false };
      s.players[0].coins = 999;
      const u = applyAction(s, { type: 'BUY_RELIC', player: 0 });
      for (const id of u.players[0].relicOffer!.ids) {
        expect(['bank1', 'medkit1']).not.toContain(id);
        expect(['mark', 'energy']).not.toContain(RELICS[id].keyword ?? 'none');
      }
      s = { ...u, rngState: u.rngState };
    }
  });

  it('유물 상점: 10코인, 살 때마다 +5', () => {
    let s = start(boss({ nothing }, ['nothing'], { timeline: [] }));
    s = structuredClone(s);
    s.phase = { kind: 'shop', stepsLeft: 0, offers: [], free: false };
    s.players[0].coins = 30;
    s = applyAction(s, { type: 'BUY_RELIC', player: 0 });
    expect(s.players[0].coins).toBe(20);
    s = applyAction(s, { type: 'PICK_RELIC', player: 0, relic: s.players[0].relicOffer!.ids[0] });
    s = applyAction(s, { type: 'BUY_RELIC', player: 0 });
    expect(s.players[0].coins).toBe(5);
  });

  it('힐: 차례 시작에 스택만큼 회복, 차례 끝에 절반 · 스타라이트: 라운드 보상 코인 +', () => {
    let s = start(boss({ nothing }, ['nothing'], { timeline: [] }));
    s = structuredClone(s);
    s.players[1].hp = 3;
    s.players[1].healStacks = 4;
    s.players[0].starlight = 5;
    s = applyAction(rollExactly(s, 1), { type: 'END_TURN', player: 0 });
    expect(s.players[1].hp).toBe(7);
    s = applyAction(rollExactly(s, 1), { type: 'END_TURN', player: 1 });
    expect(s.players[1].healStacks).toBe(2);
    // 3라운드 보상
    let coins = 0;
    while (s.round < 3) {
      coins = s.players[0].coins;
      s = applyAction(rollExactly(s, 1), { type: 'END_TURN', player: s.current });
    }
    expect(s.players[0].coins - coins).toBeGreaterThanOrEqual(5 + 5);
  });

  it('표식: 모든 피해 +1, 보스 차례마다 1 줄어든다 · 책갈피: 효과 카드 피해 +1', () => {
    let s = put(start(boss({ nothing }, ['nothing'])), 'robot', 3);
    s = structuredClone(s);
    const robot = s.enemies.find((e) => e.kind === 'robot')!;
    robot.mark = 2;
    robot.hp = 20;
    s.players[0].relics = ['bookmark'];
    s.players[0].hand = [{ card: 'laser' }];
    s.players[0].level = 3;
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0, target: robot.id });
    expect(s.enemies.find((e) => e.kind === 'robot')!.hp).toBe(20 - (3 + 1 + 1));
    s = endRoundStay(s);
    expect(s.enemies.find((e) => e.kind === 'robot')!.mark).toBe(1);
  });

  it('임무를 마치면 유물을 고르고 새 임무를 받는다', () => {
    let s = start(boss({ nothing }, ['nothing'], { timeline: [] }));
    s = structuredClone(s);
    s.players[0].task = { id: 'kill2', base: 0 };
    s.stats[0].kills = 2;
    s = applyAction(rollExactly(s, 1), { type: 'END_TURN', player: 0 });
    expect(s.players[0].tasksDone).toContain('kill2');
    expect(s.players[0].relicOffer).not.toBeNull();
    expect(s.players[0].task?.id).not.toBe('kill2');
  });
});

describe('맵 기믹', () => {
  /** 0번 거점 + kinds 칸 + 빈 칸 몇 개 (한 바퀴) */
  function line(kinds: TileKind[], patch: Partial<Board> = {}): Board {
    const b = ring(kinds.length + 8, kinds.length + 7);
    kinds.forEach((k, i) => (b.tiles[i + 1].kind = k));
    return { ...b, ...patch };
  }
  const calm = () => boss({ nothing }, ['nothing'], { timeline: [] });
  const me = (s: GameState) => s.players[0];

  it('유사: 다음 이동 -2 · 가속: 멈추지 않고 1칸 더', () => {
    expect(me(rollExactly(start(calm(), line(['sand'])), 1)).status.slow).toBe(2);
    expect(me(rollExactly(start(calm(), line(['boost'])), 1)).tile).toBe(2);
  });

  it('컨베이어 3칸 · 해류 2칸 · 빙판은 끝까지', () => {
    expect(me(rollExactly(start(calm(), line(['conveyor'])), 1)).tile).toBe(4);
    expect(me(rollExactly(start(calm(), line(['current'])), 1)).tile).toBe(3);
    expect(me(rollExactly(start(calm(), line(['ice', 'ice', 'ice'])), 1)).tile).toBe(4);
  });

  it('함정 2 피해 · 돌격문: 맵 에너미가 곁에 나오고 코인 +3', () => {
    const s = start(calm(), line(['trap']));
    expect(me(rollExactly(s, 1)).hp).toBe(me(s).hp - 2);
    const t = start(calm(), line(['assault'], { assault: 'robot' }));
    const u = rollExactly(t, 1);
    expect(u.enemies.filter((e) => e.kind === 'robot')).toHaveLength(1);
    expect(me(u).coins).toBe(me(t).coins + 3);
  });

  it('단서: 증거 4마다 유물 · 시계탑: 오버클럭만큼 다음 이동 + · 반성실: 문제아 공격력 +2', () => {
    let s = structuredClone(start(calm(), line(['clue'])));
    s.players[0].mapRes.evidence = 3;
    s = rollExactly(s, 1);
    expect(me(s).mapRes.evidence).toBe(4);
    expect(me(s).relicOffer).not.toBeNull();

    let c = rollExactly(start(calm(), line(['clock'])), 1);
    expect(me(c).mapRes.overclock).toBe(1);
    c = applyAction(c, { type: 'END_TURN', player: 0 });
    c = applyAction(rollExactly(c, 1), { type: 'END_TURN', player: 1 });
    const from = me(c).tile;
    c = rollExactly(c, 1);
    expect(me(c).tile).toBe(from + 2);
    expect(me(c).mapRes.overclock).toBe(0);

    const d = rollExactly(start(calm(), line(['detention'])), 1);
    expect(statusAtk(me(d))).toBe(2);
  });

  it('맵 전용 유물은 그 맵에서만 나온다', () => {
    const campus = start(calm());
    const library = start(calm(), MAPS.library);
    const rng = createRng(5);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      for (const id of rollOffer(campus, rng, campus.players[0], 3)) expect(RELICS[id].map).toBeUndefined();
      for (const id of rollOffer(library, rng, library.players[0], 3)) {
        expect([undefined, 'library']).toContain(RELICS[id].map);
        seen.add(id);
      }
    }
    expect(seen.has('magnifier') || seen.has('hannaDoll')).toBe(true);
  });

  it('제때 회중시계: 쓰러질 피해를 한 번 버틴다 · 부활 인형: 처음 쓰러질 때 진행도가 오르지 않는다', () => {
    let s = structuredClone(start(calm(), line(['trap'])));
    s.players[0].relics = ['pocketWatch'];
    s.players[0].hp = 1;
    s = rollExactly(s, 1);
    expect(me(s).ko).toBe(false);
    expect(me(s).hp).toBe(me(s).maxHp);
    expect(me(s).relics).toEqual(['pocketWatchBroken']);

    let t = structuredClone(start(calm(), line(['trap'])));
    t.players[0].relics = ['revivalDoll'];
    t.players[0].hp = 1;
    const progress = t.progress;
    t = rollExactly(t, 1);
    expect(me(t).ko).toBe(true);
    expect(t.progress).toBe(progress);
  });
});

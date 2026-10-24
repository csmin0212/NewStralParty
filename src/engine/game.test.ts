import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../data/board';
import { CARDS } from '../data/cards';
import { CHARACTERS } from '../data/characters';
import { PLACEHOLDER_BOSS } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import { cardCoinCost, cardTargets } from './cards';
import { onEnemyDefeated } from './skills';
import { applyAction, createGame, RuleError, validateBoard } from './game';
import { RULES } from './rules';
import type { Board, BossDef, CardId, CharacterId, EnemyKind, GameState, Gimmick, TileKind } from './types';

/** 기믹 없는 테스트용 보스 */
const TEST_BOSS: BossDef = {
  id: 'test',
  name: '테스트 보스',
  icon: 'B',
  hpPerPlayer: 5,
  atk: 1,
  def: 0,
  counter: false,
  defense: 'block',
  defeatAt: 99,
  timeline: [],
};

const withTimeline = (timeline: Gimmick[], patch: Partial<BossDef> = {}): BossDef => ({
  ...TEST_BOSS,
  ...patch,
  timeline,
});

/** 0번 본부 + 나머지 칸이 한 바퀴로 이어진 보드. 보스 칸은 기본으로 마지막 칸 */
function ring(kinds: TileKind[], opts: { spawnTiles?: number[]; bossTile?: number } = {}): Board {
  const all: TileKind[] = ['base', ...kinds];
  return {
    name: 'test',
    baseTile: 0,
    tiles: all.map((kind, id) => ({ id, kind, x: id, y: 0, next: [(id + 1) % all.length] })),
    spawnTiles: opts.spawnTiles ?? [],
    bossTile: opts.bossTile ?? all.length - 1,
  };
}

function newGame(
  board: Board,
  opts: { players?: number; seed?: number; boss?: BossDef; potential?: boolean; character?: CharacterId } = {},
): GameState {
  const { players = 2, seed = 42, boss = TEST_BOSS, potential = false, character = 'mutbyeol' } = opts;
  const setups = Array.from({ length: players }, (_, i) => ({
    name: `P${i + 1}`,
    color: '#fff',
    character,
    potential,
  }));
  return createGame({ board, boss, players: setups, seed });
}

/** 에너미를 원하는 칸에 바로 놓는다 */
function withEnemy(state: GameState, kind: EnemyKind, tile: number): GameState {
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

/** 주사위 없이 정확히 steps칸 이동시킨다 */
function rollExactly(state: GameState, steps: number): GameState {
  const s = structuredClone(state);
  s.turn.diceCount = 0;
  s.turn.extraSteps = steps;
  return applyAction(s, { type: 'ROLL', player: s.current });
}

function finishTurn(state: GameState): GameState {
  return applyAction(rollExactly(state, 1), { type: 'END_TURN', player: state.current });
}

const attack = (s: GameState) => applyAction(s, { type: 'ENCOUNTER', player: s.current, choice: 'attack' });
const release = (s: GameState) => applyAction(s, { type: 'ENCOUNTER', player: s.current, choice: 'release' });
const defend = (s: GameState, mode: 'block' | 'evade') => applyAction(s, { type: 'DEFEND', player: s.current, mode });

const empties = (n: number): TileKind[] => Array(n).fill('empty');
const MUT = CHARACTERS.mutbyeol;

describe('createGame', () => {
  it('모두 본부에서 시작 · 시작 코인 · 손패 6장 · 진행도 1', () => {
    const s = newGame(ring(empties(5)), { players: 3 });
    expect(s.players.map((p) => p.tile)).toEqual([0, 0, 0]);
    expect(s.players.map((p) => p.coins)).toEqual([RULES.startCoins, RULES.startCoins, RULES.startCoins]);
    expect(s.players.map((p) => p.hand.length)).toEqual([RULES.startHand, RULES.startHand, RULES.startHand]);
    expect(s.phase).toEqual({ kind: 'preRoll' });
    expect([s.round, s.progress]).toEqual([1, 1]);
  });

  it('잘못된 보드는 거부한다', () => {
    const bad = ring(['empty']);
    bad.tiles[1].next = [99];
    expect(validateBoard(bad)).not.toEqual([]);
    expect(() => newGame(bad)).toThrow(RuleError);

    expect(validateBoard(ring(['empty'], { bossTile: 0 }))).not.toEqual([]);
    expect(validateBoard(ring(['empty'], { spawnTiles: [7] }))).not.toEqual([]);
  });

  it('기본 보드는 올바르다', () => {
    expect(validateBoard(DEFAULT_BOARD)).toEqual([]);
  });

  it('진행도 1의 기믹은 시작하자마자 발동한다', () => {
    const boss = withTimeline([{ at: 1, actions: [{ type: 'summon', enemies: ['robot', 'delinquent'] }] }]);
    const s = newGame(ring(empties(6), { spawnTiles: [2, 4] }), { boss });
    expect(s.enemies.map((e) => e.kind).sort()).toEqual(['delinquent', 'robot']);
    expect(s.enemies.map((e) => e.tile).sort()).toEqual([2, 4]);
    expect(s.notices).toHaveLength(1);
  });
});

describe('주사위와 이동', () => {
  it('주사위 눈만큼 이동하고 턴 종료 단계로 간다', () => {
    const s0 = newGame(ring(empties(12)));
    const s1 = applyAction(s0, { type: 'ROLL', player: 0 });
    const roll = s1.turn.dice[0];
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(6);
    expect(s1.players[0].tile).toBe(roll);
    expect(s1.lastMove?.path).toEqual(Array.from({ length: roll + 1 }, (_, i) => i));
    expect(s1.phase).toEqual({ kind: 'endTurn' });
  });

  it('입력 state를 바꾸지 않는다', () => {
    const s0 = newGame(ring(empties(12)));
    const before = JSON.stringify(s0);
    applyAction(s0, { type: 'ROLL', player: 0 });
    expect(JSON.stringify(s0)).toBe(before);
  });

  it('같은 시드 + 같은 행동이면 결과가 같다', () => {
    const play = () => {
      let s = newGame(DEFAULT_BOARD, { seed: 7, boss: PLACEHOLDER_BOSS });
      for (let i = 0; i < 60 && s.phase.kind !== 'gameOver'; i++) {
        const player = s.current;
        const offer = s.players[player].relicOffer;
        if (offer) s = applyAction(s, { type: 'PICK_RELIC', player, relic: offer.ids[0] });
        else if (s.phase.kind === 'preRoll') s = applyAction(s, { type: 'ROLL', player });
        else if (s.phase.kind === 'choosePath')
          s = applyAction(s, { type: 'CHOOSE_PATH', player, to: s.phase.options[0] });
        else if (s.phase.kind === 'encounter') s = applyAction(s, { type: 'ENCOUNTER', player, choice: 'attack' });
        else if (s.phase.kind === 'defend') s = applyAction(s, { type: 'DEFEND', player, mode: 'block' });
        else if (s.phase.kind === 'shop') s = applyAction(s, { type: 'LEAVE_SHOP', player });
        else if (s.phase.kind === 'stopChoice') s = applyAction(s, { type: 'STOP_HERE', player, stop: true });
        else s = applyAction(s, { type: 'END_TURN', player });
      }
      return s;
    };
    expect(play()).toEqual(play());
  });

  it('차례가 아닌 플레이어나 잘못된 단계의 행동은 거부한다', () => {
    const s0 = newGame(ring(empties(12)));
    expect(() => applyAction(s0, { type: 'ROLL', player: 1 })).toThrow(RuleError);
    expect(() => applyAction(s0, { type: 'END_TURN', player: 0 })).toThrow(RuleError);
    const s1 = applyAction(s0, { type: 'ROLL', player: 0 });
    expect(() => applyAction(s1, { type: 'ROLL', player: 0 })).toThrow(RuleError);
  });

  it('턴을 넘겨도 코인은 늘지 않고, 한 바퀴 돌면 라운드와 진행도가 오른다', () => {
    let s = newGame(ring(empties(12)));
    s = finishTurn(s);
    expect(s.current).toBe(1);
    expect(s.players[1].coins).toBe(RULES.startCoins);
    expect([s.round, s.progress]).toEqual([1, 1]);
    s = finishTurn(s);
    expect(s.current).toBe(0);
    expect([s.round, s.progress]).toEqual([2, 2]);
  });

  it('갈림길에서 멈추고 고른 방향으로 남은 칸을 간다', () => {
    const board: Board = {
      name: 'fork',
      baseTile: 0,
      tiles: [
        { id: 0, kind: 'base', x: 0, y: 0, next: [1, 2] },
        { id: 1, kind: 'empty', x: 1, y: 0, next: [3] },
        { id: 2, kind: 'empty', x: 1, y: 1, next: [3] },
        { id: 3, kind: 'empty', x: 2, y: 0, next: [0] },
      ],
      spawnTiles: [],
      bossTile: 1,
    };
    const s1 = rollExactly(newGame(board), 2);
    expect(s1.phase).toEqual({ kind: 'choosePath', stepsLeft: 2, options: [1, 2] });
    expect(() => applyAction(s1, { type: 'CHOOSE_PATH', player: 0, to: 3 })).toThrow(RuleError);

    const s2 = applyAction(s1, { type: 'CHOOSE_PATH', player: 0, to: 2 });
    expect(s2.players[0].tile).toBe(3);
    expect(s2.lastMove?.path).toEqual([0, 2, 3]);
    expect(s2.phase).toEqual({ kind: 'endTurn' });
  });

  it('워프 칸에 도착하면 지정된 칸으로 날아간다', () => {
    const board = ring(['warp', 'empty', 'empty']);
    board.tiles[1].warpTo = 3;
    const s = rollExactly(newGame(board), 1);
    expect(s.players[0].tile).toBe(3);
    expect(s.lastMove?.path).toEqual([0, 1, 3]);
  });
});

describe('거점과 성 오름 (원작: 멈춰야 오른다)', () => {
  it('거점에 멈추면 체력 +2 · 코인을 내고 1성, 캐릭터의 그 별 능력치를 얻는다', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].coins = 20;
    s0.players[0].hp = 3;
    const s = rollExactly(s0, 3); // 0 → 1 → 2 → 0(거점) 멈춤
    expect(s.players[0].tile).toBe(0);
    expect(s.players[0].level).toBe(1);
    expect(s.players[0].coins).toBe(20 - RULES.levelUpCost[0]);
    // 뭇별 1성: 체력 +1 (지금 HP도 같이) · 공격력 +1 · 이동거리 +1, 거점 회복 +2
    expect([s.players[0].maxHp, s.players[0].hp]).toEqual([MUT.hp + 1, 3 + RULES.heal + 1]);
    expect(s.players[0]).toMatchObject({ atk: MUT.atk + 1, move: 1 });
  });

  it('내 거점을 지나갈 때 멈출지 고른다: 멈추면 오르고, 계속 가면 그냥 지나간다', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].coins = 20;
    const s1 = rollExactly(s0, 4);
    expect(s1.phase).toEqual({ kind: 'stopChoice', stepsLeft: 1 });
    const stop = applyAction(s1, { type: 'STOP_HERE', player: 0, stop: true });
    expect(stop.players[0]).toMatchObject({ tile: 0, level: 1 });
    expect(stop.phase.kind).toBe('endTurn');
    const go = applyAction(s1, { type: 'STOP_HERE', player: 0, stop: false });
    expect(go.players[0]).toMatchObject({ tile: 1, level: 0 });
  });

  it('할 일이 없으면 묻지 않고 지나간다 · 코인이 모자라면 오르지 않는다', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].coins = RULES.levelUpCost[0] - 1;
    expect(rollExactly(s0, 4).players[0].tile).toBe(1);
    const s = rollExactly(s0, 3);
    expect(s.players[0].level).toBe(0);
    expect(s.players[0].coins).toBe(RULES.levelUpCost[0] - 1);
  });

  it('확인 지점: 누구나 멈춰서 오른다', () => {
    const s0 = newGame(ring(['checkpoint', 'empty']));
    s0.players[0].coins = 20;
    const s = rollExactly(s0, 1);
    expect(s.players[0].level).toBe(1);
  });

  it('한 번 멈추면 1성만 · 3성이 최대', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].level = 3;
    s0.players[0].coins = 100;
    const s = rollExactly(s0, 3);
    expect(s.players[0]).toMatchObject({ level: 3, coins: 100 });
  });

  it('이동거리만큼 주사위 칸 수에 더해서 간다 · 한 번 이동은 최대 10', () => {
    const s0 = newGame(ring(empties(14)));
    s0.players[0].move = 2;
    expect(rollExactly(s0, 1).players[0].tile).toBe(3);
    expect(rollExactly(s0, 20).players[0].tile).toBe(10);
  });

  it('이동 주사위는 1~10', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed < 200; seed++) {
      const s = applyAction(newGame(ring(empties(14)), { seed }), { type: 'ROLL', player: 0 });
      seen.add(s.turn.dice[0]);
    }
    expect(Math.min(...seen)).toBe(1);
    expect(Math.max(...seen)).toBe(10);
  });
});

describe('칸 효과', () => {
  it('횡재: 코인 2 · 3 · 4 · 5 · 10 · 재앙: 2 피해 · 질주: 한 번 더 굴린다', () => {
    const plus = rollExactly(newGame(ring(['windfall', 'empty'])), 1);
    expect(RULES.windfall).toContain(plus.players[0].coins - RULES.startCoins);
    const hurt = rollExactly(newGame(ring(['calamity', 'empty'])), 1);
    expect(hurt.players[0].hp).toBe(MUT.hp - RULES.calamity);
    const haste = rollExactly(newGame(ring(['haste', ...empties(4)])), 1);
    expect(haste.phase.kind).toBe('preRoll');
    expect(rollExactly(haste, 2).players[0].tile).toBe(3);
  });

  it('몬스터 칸: 맵 몬스터가 나와 바로 전투', () => {
    const board = { ...ring(['monster', 'empty']), monsters: ['robot' as const] };
    const s = rollExactly(newGame(board), 1);
    expect(s.enemies.map((e) => e.kind)).toEqual(['robot']);
    expect(s.phase).toMatchObject({ kind: 'encounter', stepsLeft: 0 });
  });

  it('회복은 최대 HP를 넘지 않는다', () => {
    const s0 = newGame(ring(['heal', 'empty']));
    s0.players[0].hp = s0.players[0].maxHp - 1;
    expect(rollExactly(s0, 1).players[0].hp).toBe(s0.players[0].maxHp);
  });

  it('카드 칸에서 공용 카드 2장', () => {
    const s0 = newGame(ring(['card', 'empty']));
    s0.players[0].hand = [];
    expect(rollExactly(s0, 1).players[0].hand).toHaveLength(RULES.cardTile);
  });
});

describe('인카운터', () => {
  /** 0 본부 → 1 → 2(에너미) → 3 … 9 */
  const enemyRing = (kind: EnemyKind = 'robot') => withEnemy(newGame(ring(empties(9))), kind, 2);

  it('에너미가 있는 칸을 지나가면 멈추고 인카운터가 시작된다', () => {
    const s0 = enemyRing();
    const s = rollExactly(s0, 4);
    expect(s.phase).toEqual({ kind: 'encounter', enemy: s0.enemies[0].id, stepsLeft: 2 });
    expect(s.players[0].tile).toBe(2);
    expect(s.lastMove?.path).toEqual([0, 1, 2]);
    expect(s.battles.at(-1)).toMatchObject({ player: 0, enemy: { kind: 'robot' }, events: [], done: false });
  });

  it('놓아주면 아무 일 없이 남은 칸을 마저 간다', () => {
    const s = release(rollExactly(enemyRing(), 4));
    expect(s.players[0].tile).toBe(4);
    expect(s.lastMove?.path).toEqual([2, 3, 4]);
    expect(s.phase).toEqual({ kind: 'endTurn' });
    expect(s.enemies[0].hp).toBe(s.enemies[0].maxHp);
    expect(s.battles.at(-1)).toMatchObject({ events: [{ type: 'release' }], done: true });
  });

  it('비반격형은 공격해도 반격하지 않고, 남은 칸을 마저 간다', () => {
    const s0 = rollExactly(enemyRing('robot'), 4);
    s0.enemies[0].hp = s0.enemies[0].maxHp = 100;
    const s = attack(s0);
    expect(s.enemies[0].hp).toBeLessThan(100);
    expect(s.players[0].hp).toBe(s.players[0].maxHp);
    expect(s.players[0].tile).toBe(4);
    expect(s.battles.at(-1)?.events).toHaveLength(1);
  });

  it('에너미를 처치하면 사라지고 보상을 받는다', () => {
    const s0 = rollExactly(enemyRing(), 4);
    s0.players[0].atk = 100;
    const coins = s0.players[0].coins;
    const s = attack(s0);
    expect(s.enemies).toEqual([]);
    expect(s.players[0].coins).toBe(coins + s0.enemies[0].reward);
    expect(s.battles.at(-1)?.events.at(-1)).toEqual({ type: 'enemyDefeated', reward: s0.enemies[0].reward });
    expect(s.players[0].tile).toBe(4);
  });

  it('반격형이 살아남으면 반격하고, 플레이어가 방어/회피를 고른다', () => {
    const s0 = rollExactly(enemyRing('delinquent'), 4);
    s0.enemies[0].hp = s0.enemies[0].maxHp = 100;
    const s1 = attack(s0);
    expect(s1.phase).toMatchObject({ kind: 'defend', enemy: s0.enemies[0].id, stepsLeft: 2 });
    expect(() => attack(s1)).toThrow(RuleError);
    expect(() => defend(s0, 'block')).toThrow(RuleError);

    const s2 = defend(s1, 'block');
    const counter = s2.battles.at(-1)!.events.filter((e) => e.type === 'attack')[1];
    expect(counter).toMatchObject({ type: 'attack', attacker: 'enemy', result: { mode: 'block' } });
    if (counter.type !== 'attack') throw new Error();
    expect(counter.result.damage).toBeGreaterThanOrEqual(1);
    expect(s2.players[0].hp).toBe(s2.players[0].maxHp - counter.result.damage);
    expect(counter.targetHp).toBe(s2.players[0].hp);
    expect(s2.players[0].tile).toBe(4);
    expect(s2.phase).toEqual({ kind: 'endTurn' });
  });

  it('회피: 내 주사위가 상대 공격 주사위보다 크거나 6이면 피해 0, 아니면 공격값 전부', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s0 = rollExactly(withEnemy(newGame(ring(empties(9)), { seed }), 'delinquent', 2), 4);
      s0.enemies[0].hp = s0.enemies[0].maxHp = 100;
      const s = defend(attack(s0), 'evade');
      const counter = s.battles.at(-1)!.events.filter((e) => e.type === 'attack')[1];
      if (counter.type !== 'attack') throw new Error();
      const r = counter.result;
      expect(r.defenseValue).toBe(r.defenseRoll); // 회피는 능력치 없이 주사위만
      expect(r.damage).toBe(r.defenseRoll > r.attackRoll || r.defenseRoll === 6 ? 0 : r.attackValue);
      expect(s.players[0].hp).toBe(Math.max(0, MUT.hp - r.damage));
    }
  });

  it('에너미 칸에 딱 도착해도 인카운터가 일어나고, 끝나면 그 칸에 머문다', () => {
    const s1 = rollExactly(enemyRing(), 2);
    expect(s1.phase).toMatchObject({ kind: 'encounter', stepsLeft: 0 });
    const s2 = release(s1);
    expect(s2.players[0].tile).toBe(2);
    expect(s2.phase).toEqual({ kind: 'endTurn' });
  });

  it('한 번 이동에 인카운터가 여러 번 일어날 수 있다', () => {
    const s0 = withEnemy(withEnemy(newGame(ring(empties(6))), 'robot', 2), 'drone', 4);
    const s1 = release(rollExactly(s0, 5));
    expect(s1.phase).toMatchObject({ kind: 'encounter', stepsLeft: 1 });
    expect(s1.players[0].tile).toBe(4);
    expect(s1.battles.map((b) => [b.enemy.kind, b.done])).toEqual([
      ['robot', true],
      ['drone', false],
    ]);
  });

  it('갈림길에서 고른 칸에 에너미가 있어도 인카운터', () => {
    const board: Board = {
      name: 'fork',
      baseTile: 0,
      tiles: [
        { id: 0, kind: 'base', x: 0, y: 0, next: [1, 2] },
        { id: 1, kind: 'empty', x: 1, y: 0, next: [3] },
        { id: 2, kind: 'empty', x: 1, y: 1, next: [3] },
        { id: 3, kind: 'empty', x: 2, y: 0, next: [0] },
      ],
      spawnTiles: [2],
      bossTile: 3,
    };
    const s0 = withEnemy(newGame(board), 'robot', 2);
    const s = applyAction(rollExactly(s0, 2), { type: 'CHOOSE_PATH', player: 0, to: 2 });
    expect(s.phase).toMatchObject({ kind: 'encounter', stepsLeft: 1 });
  });
});

describe('KO', () => {
  /** 불량배 반격에 KO 당하는 상황까지 만든다 */
  function knockedOut(boss: BossDef = TEST_BOSS): GameState {
    let s = withEnemy(newGame(ring(empties(9)), { boss }), 'delinquent', 2);
    s = rollExactly(s, 4);
    s.enemies[0].hp = s.enemies[0].maxHp = 100;
    s.players[0].hp = 1;
    s.players[0].coins = 11;
    return defend(attack(s), 'block');
  }

  it('쓰러진 자리에 눕고, 코인은 그대로, 진행도 +1, 이동은 끝', () => {
    const s = knockedOut();
    expect(s.players[0]).toMatchObject({ ko: true, hp: 0, tile: 2, coins: 11, reviveRound: 3 });
    expect(s.progress).toBe(2);
    expect(s.phase).toEqual({ kind: 'endTurn' });
    expect(s.battles.at(-1)).toMatchObject({ done: true });
    expect(s.battles.at(-1)?.events.at(-1)).toEqual({ type: 'playerKO' });
  });

  it('KO로 진행도가 기믹 시점에 닿으면 기믹이 바로 발동한다', () => {
    const boss = withTimeline([{ at: 2, actions: [{ type: 'summon', enemies: ['robot'] }] }]);
    const s = knockedOut(boss);
    expect(s.progress).toBe(2);
    expect(s.enemies.map((e) => e.kind)).toContain('robot');
    expect(s.gimmicksDone).toBe(2);
  });

  it('다음 라운드는 쉬고, 그다음 라운드 자기 차례에 쓰러진 자리에서 HP 가득으로 부활', () => {
    let s = knockedOut();
    s.enemies = []; // 다른 플레이어가 불량배과 마주치지 않게
    s = applyAction(s, { type: 'END_TURN', player: 0 });
    expect([s.current, s.round]).toEqual([1, 1]);

    s = finishTurn(s); // 2라운드: P1은 건너뛴다
    expect([s.current, s.round]).toEqual([1, 2]);
    expect(s.players[0].ko).toBe(true);

    s = finishTurn(s); // 3라운드: P1 부활
    expect([s.current, s.round]).toEqual([0, 3]);
    expect(s.players[0]).toMatchObject({ ko: false, hp: s.players[0].maxHp, tile: 2, reviveRound: null });
    // 3라운드 = 라운드 보상
    expect(s.players[0].coins).toBe(11 + RULES.roundRewardCoins);
  });
});

describe('뭇별', () => {
  const useSkill = (s: GameState) => applyAction(s, { type: 'USE_SKILL', player: s.current });

  /** 불량배의 반격 앞까지. 시드를 바꿔 가며 원하는 결과가 나오는 판을 찾는다 */
  function counterCase(opts: { potential?: boolean; skill?: boolean; enemyHp?: number }, want: (evaded: boolean) => boolean) {
    for (let seed = 1; seed < 300; seed++) {
      let s = withEnemy(newGame(ring(empties(9)), { seed, potential: opts.potential }), 'delinquent', 2);
      if (opts.skill) s = useSkill(s);
      s = rollExactly(s, 4);
      s.enemies[0].hp = s.enemies[0].maxHp = 100;
      const before = attack(s);
      before.enemies[0].hp = opts.enemyHp ?? 100;
      const after = defend(before, 'evade');
      const counter = after.battles.at(-1)!.events.filter((e) => e.type === 'attack')[1];
      if (counter.type === 'attack' && want(counter.result.damage === 0)) return { before, after };
    }
    throw new Error('원하는 판을 못 찾음');
  }

  it('시작 능력치: 체력 9 · 공격력 2 · 방어력 0 · 0성', () => {
    const p = newGame(ring(empties(5))).players[1];
    expect(p).toMatchObject({ character: 'mutbyeol', hp: 9, maxHp: 9, atk: 2, def: 0, coins: RULES.startCoins, level: 0 });
  });

  it('액티브: 굴리기 전에만, 턴마다 한 번, 쓰면 재사용 대기 4라운드', () => {
    const s0 = newGame(ring(empties(9)));
    const s1 = useSkill(s0);
    expect(s1.players[0]).toMatchObject({ skillCooldown: 4, skillActiveUntil: 2 });
    expect(() => useSkill(s1)).toThrow(RuleError);
    const rolled = applyAction(s0, { type: 'ROLL', player: 0 });
    expect(() => useSkill(rolled)).toThrow(RuleError);
  });

  it('재사용 대기는 라운드마다 1씩 줄고, 효과는 다음 자기 차례가 오면 끝난다', () => {
    let s = useSkill(newGame(ring(empties(12))));
    s = finishTurn(finishTurn(s)); // 2라운드, 다시 P1 차례
    expect(s.round).toBe(2);
    expect(s.players[0]).toMatchObject({ skillCooldown: 3, skillActiveUntil: null });
    expect(() => useSkill(s)).toThrow(RuleError);
  });

  it('액티브 효과 중에는 회피 주사위 2개 중 높은 값을 쓴다', () => {
    const { after } = counterCase({ skill: true }, () => true);
    const counter = after.battles.at(-1)!.events.filter((e) => e.type === 'attack')[1];
    if (counter.type !== 'attack') throw new Error();
    expect(counter.result.defenseRolls).toHaveLength(2);
    expect(counter.result.defenseRoll).toBe(Math.max(...counter.result.defenseRolls));
  });

  it('효과가 없으면 회피 주사위는 1개', () => {
    const { after } = counterCase({}, () => true);
    const counter = after.battles.at(-1)!.events.filter((e) => e.type === 'attack')[1];
    if (counter.type !== 'attack') throw new Error();
    expect(counter.result.defenseRolls).toHaveLength(1);
  });

  it('패시브: 회피에 성공하면 액티브 재사용 대기 -1', () => {
    const { after } = counterCase({ skill: true }, (evaded) => evaded);
    expect(after.players[0].skillCooldown).toBe(3);
    expect(after.battles.at(-1)!.events).toContainEqual({ type: 'skill', name: MUT.passive.name });
  });

  it('회피에 실패하면 재사용 대기는 그대로', () => {
    const { after } = counterCase({ skill: true }, (evaded) => !evaded);
    expect(after.players[0].skillCooldown).toBe(4);
  });

  it('잠재 능력: 해방했으면 회피 성공 시 그 몬스터에게 공격력만큼 피해', () => {
    const on = counterCase({ potential: true }, (evaded) => evaded).after;
    expect(on.enemies[0].hp).toBe(100 - MUT.atk);
    expect(on.battles.at(-1)!.events).toContainEqual({ type: 'skill', name: MUT.potential!.name, damage: MUT.atk, targetHp: 100 - MUT.atk });

    const off = counterCase({ potential: false }, (evaded) => evaded).after;
    expect(off.enemies[0].hp).toBe(100);
  });

  it('잠재 능력 피해로 몬스터를 쓰러뜨리면 보상을 받는다', () => {
    const { before, after } = counterCase({ potential: true, enemyHp: 1 }, (evaded) => evaded);
    expect(after.enemies).toEqual([]);
    expect(after.players[0].coins).toBe(before.players[0].coins + ENEMIES.delinquent.reward);
    expect(after.battles.at(-1)!.events.at(-1)).toEqual({ type: 'enemyDefeated', reward: ENEMIES.delinquent.reward });
  });
});

describe('진행도와 보스', () => {
  it('진행도가 한계에 닿으면 패배', () => {
    let s = newGame(ring(empties(12)), { boss: withTimeline([], { defeatAt: 3 }) });
    for (let i = 0; i < 4; i++) s = finishTurn(s);
    expect(s.progress).toBe(3);
    expect(s.phase).toEqual({ kind: 'gameOver', result: 'defeat' });
    expect(() => applyAction(s, { type: 'ROLL', player: s.current })).toThrow(RuleError);
  });

  it('보스는 보스 칸에 나타나고, HP는 인원수에 비례한다', () => {
    const boss = withTimeline([{ at: 1, actions: [{ type: 'bossAppear' }] }]);
    const s = newGame(ring(empties(6), { bossTile: 4 }), { boss, players: 3 });
    const b = s.enemies.find((e) => e.isBoss)!;
    expect(b).toMatchObject({ tile: 4, hp: TEST_BOSS.hpPerPlayer * 3, name: TEST_BOSS.name });
  });

  it('보스 칸에 있던 에너미는 보스에게 자리를 내준다', () => {
    const boss = withTimeline([
      { at: 1, actions: [{ type: 'summon', enemies: ['pillar'] }] },
      { at: 2, actions: [{ type: 'bossAppear' }] },
    ]);
    let s = newGame(ring(empties(12), { spawnTiles: [10], bossTile: 10 }), { boss });
    expect(s.enemies.map((e) => e.tile)).toEqual([10]);
    s = finishTurn(finishTurn(s));
    expect(s.enemies.map((e) => [e.tile, e.isBoss])).toEqual([[10, true]]);
  });

  it('보스를 처치하면 모두 승리', () => {
    const boss = withTimeline([{ at: 1, actions: [{ type: 'bossAppear' }] }]);
    const s0 = rollExactly(newGame(ring(empties(6), { bossTile: 3 }), { boss }), 4);
    expect(s0.phase).toMatchObject({ kind: 'encounter' });
    s0.players[0].atk = 100;
    const s = attack(s0);
    expect(s.phase).toEqual({ kind: 'gameOver', result: 'victory' });
    expect(s.enemies).toEqual([]);
  });

  it('에너미 강화는 지금 있는 에너미와 이후 소환되는 에너미에 모두 적용된다', () => {
    const boss = withTimeline([
      { at: 1, actions: [{ type: 'summon', enemies: ['robot'] }] },
      { at: 2, actions: [{ type: 'buffEnemies', atk: 1, def: 2 }] },
      { at: 3, actions: [{ type: 'summon', enemies: ['robot'] }] },
    ]);
    let s = newGame(ring(empties(14), { spawnTiles: [12, 13] }), { boss });
    for (let i = 0; i < 4; i++) s = finishTurn(s);
    expect(s.progress).toBe(3);
    expect(s.enemies).toHaveLength(2);
    for (const e of s.enemies) {
      expect([e.atk, e.def]).toEqual([ENEMIES.robot.atk + 1, ENEMIES.robot.def + 2]);
    }
  });

  it('소환 칸이 다 차면 본부 · 보스 칸이 아닌 빈 칸에 나온다', () => {
    const boss = withTimeline([{ at: 1, actions: [{ type: 'summon', enemies: ['robot', 'robot', 'robot'] }] }]);
    const s = newGame(ring(empties(6), { spawnTiles: [2], bossTile: 5 }), { boss });
    const tiles = s.enemies.map((e) => e.tile);
    expect(tiles).toHaveLength(3);
    expect(tiles).toContain(2);
    expect(new Set(tiles).size).toBe(3);
    expect(tiles).not.toContain(0);
    expect(tiles).not.toContain(5);
  });
});

describe('카드 (원작: 덱 없음)', () => {
  it('쓴 카드는 사라지고, 손패 한도를 넘으면 차례가 끝날 때 늦게 얻은 것부터 버린다', () => {
    const s0 = newGame(ring(['card', ...empties(4)]));
    s0.players[0].hand = [{ card: 'cake' }];
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    expect(s1.players[0].hand).toHaveLength(0);
    const s2 = structuredClone(s0);
    s2.players[0].hand = Array.from({ length: RULES.handLimit }, () => ({ card: 'dash' as const }));
    const s3 = rollExactly(s2, 1); // 카드 칸 +2
    expect(s3.players[0].hand).toHaveLength(RULES.handLimit + 2);
    const s4 = applyAction(s3, { type: 'END_TURN', player: 0 });
    expect(s4.players[0].hand).toHaveLength(RULES.handLimit);
    expect(s4.players[0].hand.every((h) => h.card === 'dash')).toBe(true);
  });

  it('라운드 보상: 3라운드마다 모두 코인 +5 · 카드 1장', () => {
    let s = newGame(ring(empties(20)), { players: 2 });
    for (const p of s.players) p.hand = [];
    const coins = s.players.map((p) => p.coins);
    while (s.round < RULES.roundRewardEvery) s = finishTurn(s);
    expect(s.players.map((p) => p.hand.length)).toEqual([1, 1]);
    expect(s.players.map((p, i) => p.coins - coins[i])).toEqual([RULES.roundRewardCoins, RULES.roundRewardCoins]);
  });
});

describe('상점', () => {
  const shopRing = () => newGame(ring(['empty', 'shop', ...empties(6)]));

  it('상점을 지나가면 열리고, 사거나 그냥 나가면 남은 칸을 마저 간다', () => {
    let s = shopRing();
    s.players[0].coins = 10;
    s.players[0].hand = [];
    s = rollExactly(s, 4);
    expect(s.phase.kind).toBe('shop');
    if (s.phase.kind !== 'shop') throw new Error();
    expect(s.phase.offers).toHaveLength(RULES.shopOffers);
    expect(s.phase.free).toBe(false);
    s = applyAction(s, { type: 'BUY_CARD', player: 0, offer: 0 });
    expect(s.players[0].coins).toBe(10 - RULES.shopPrice);
    expect(s.players[0].hand[0].shop).toBe(true);
    expect(() => applyAction(s, { type: 'BUY_CARD', player: 0, offer: 0 })).toThrow(RuleError);
    s = applyAction(s, { type: 'LEAVE_SHOP', player: 0 });
    expect(s.players[0].tile).toBe(4);
    expect(s.phase.kind).toBe('endTurn');
  });

  it('상점에 멈추면 첫 구매가 무료', () => {
    let s = shopRing();
    s.players[0].coins = 0;
    s.players[0].hand = [];
    s = rollExactly(s, 2);
    if (s.phase.kind !== 'shop') throw new Error();
    expect(s.phase.free).toBe(true);
    s = applyAction(s, { type: 'BUY_CARD', player: 0, offer: 1 });
    expect(s.players[0].hand).toHaveLength(1);
    expect(() => applyAction(s, { type: 'BUY_CARD', player: 0, offer: 2 })).toThrow(RuleError);
    s = applyAction(s, { type: 'LEAVE_SHOP', player: 0 });
    expect(s.phase.kind).toBe('endTurn');
  });

});

describe('카드', () => {
  const give = (s: GameState, ...cards: CardId[]) => {
    s.players[s.current].hand = cards.map((card) => ({ card }));
    return s;
  };
  const play = (s: GameState, i = 0, extra: { target?: number; value?: number } = {}) =>
    applyAction(s, { type: 'PLAY_CARD', player: s.current, handIndex: i, ...extra });
  const lastAttack = (s: GameState) => {
    const hit = s.battles.at(-1)!.events.filter((e) => e.type === 'attack').at(-1)!;
    if (hit.type !== 'attack') throw new Error();
    return hit.result;
  };

  it('주사위 전 카드는 턴마다 1장, 굴린 뒤에는 못 쓴다', () => {
    const s0 = give(newGame(ring(empties(12))), 'dash', 'dash');
    const s1 = play(s0);
    expect(() => play(s1)).toThrow(RuleError);
    const s2 = applyAction(s1, { type: 'ROLL', player: 0 });
    expect(s2.players[0].tile).toBe(s2.turn.dice[0] + 2);
    expect(() => play(s2)).toThrow(RuleError);
  });

  it('성 제한: 성이 모자라면 못 쓴다', () => {
    const s0 = give(newGame(ring(empties(12))), 'bandage');
    expect(() => play(s0)).toThrow(RuleError);
    s0.players[0].level = 1;
    s0.players[0].hp = 2;
    expect(play(s0).players[0].hp).toBe(6);
  });

  it('코인 비용: 더블 주사위 3코인', () => {
    const s0 = give(newGame(ring(empties(20))), 'doubleDice');
    s0.players[0].coins = 2;
    expect(() => play(s0)).toThrow(RuleError);
    s0.players[0].coins = 5;
    const s = applyAction(play(s0), { type: 'ROLL', player: 0 });
    expect(s.turn.dice).toHaveLength(2);
    expect(s.players[0].coins).toBe(2);
  });

  it('트리플 주사위: 주사위 3개, 다음 차례를 쉰다', () => {
    let s = give(newGame(ring(empties(30)), { players: 2 }), 'tripleDice');
    s.players[0].level = 2;
    s.players[0].coins = 10;
    s = applyAction(play(s), { type: 'ROLL', player: 0 });
    expect(s.turn.dice).toHaveLength(3);
    s = finishTurn(applyAction(s, { type: 'END_TURN', player: 0 }));
    expect([s.current, s.round]).toEqual([1, 2]); // 2라운드 0번 차례는 건너뛰었다
    expect(s.players[0].status.skipTurn).toBe(false);
  });

  it('리모컨 주사위: 고른 칸만큼 이동', () => {
    const s0 = give(newGame(ring(empties(12))), 'remoteDice');
    s0.players[0].level = 1;
    expect(() => play(s0)).toThrow(RuleError);
    const s = applyAction(play(s0, 0, { value: 5 }), { type: 'ROLL', player: 0 });
    expect(s.players[0].tile).toBe(5);
  });

  it('이독제독: 체력 -2, 다음 2번의 차례 시작에 체력 +3', () => {
    let s = give(newGame(ring(empties(30)), { players: 1 }), 'poisonCure');
    s.players[0].level = 1;
    s.players[0].hp = 5;
    s = play(s);
    expect(s.players[0].hp).toBe(3);
    s = finishTurn(s);
    expect(s.players[0].hp).toBe(6);
    s = finishTurn(s);
    expect(s.players[0].hp).toBe(9);
    expect(s.players[0].status.regen).toBe(null);
  });

  it('왕의 힘: 체력 -4, 이번 턴과 다음 2턴 공격력 +5', () => {
    let s = give(withEnemy(newGame(ring(empties(9)), { players: 1 }), 'robot', 2), 'kingPower');
    s.players[0].level = 2;
    s.enemies[0].hp = 99;
    s = play(s);
    expect(s.players[0].hp).toBe(MUT.hp - 4);
    s = attack(rollExactly(s, 3));
    expect(lastAttack(s).attackValue).toBe(lastAttack(s).attackRoll + MUT.atk + 5);
    s = finishTurn(applyAction(s, { type: 'END_TURN', player: 0 }));
    s = finishTurn(s);
    expect(s.players[0].status.atkUp).toBe(null);
  });

  it('보충 수업: 쓰러지면 쉬지 않고 다음 차례에 부활', () => {
    let s = give(newGame(ring(empties(20)), { players: 2 }), 'extend');
    s.players[0].level = 3;
    s.players[0].coins = 20;
    s = play(s);
    expect(s.players[0].status.extend).toBe(true);
    s.players[0].hp = 1;
    s = withEnemy(s, 'delinquent', 2);
    s.enemies[0].hp = 99;
    s.enemies[0].atk = 50;
    s = defend(attack(rollExactly(s, 3)), 'block');
    expect(s.players[0].ko).toBe(true);
    expect(s.players[0].reviveRound).toBe(s.round + 1);
  });

  it('서둘러: 고른 아군의 다음 이동 주사위 2개', () => {
    let s = give(newGame(ring(empties(30)), { players: 2 }), 'hurry');
    expect(() => play(s)).toThrow(RuleError); // 대상 필요
    s = play(s, 0, { target: 1 });
    expect(s.players[1].status.nextMoveDice).toBe(2);
    s = finishTurn(s);
    s = applyAction(s, { type: 'ROLL', player: 1 });
    expect(s.turn.dice).toHaveLength(2);
  });

  it('너도 나도 · 지원 요청 · 호화 만찬', () => {
    const base = newGame(ring(empties(12)), { players: 3 });
    base.players[0].level = 1;
    base.players[1].tile = 2;
    base.players[2].tile = 9;
    base.players[1].hp = 1;
    base.players[2].hp = 1;
    expect(() => play(give(structuredClone(base), 'share'), 0, { target: 0 })).toThrow(RuleError);
    const share = play(give(structuredClone(base), 'share'), 0, { target: 1 });
    expect(share.players[1].hand).toHaveLength(base.players[1].hand.length + 1);
    const backup = play(give(structuredClone(base), 'backup'), 0, { target: 2 });
    expect(backup.players[0].tile).toBe(9);
    const feast = play(give(structuredClone(base), 'feast'), 0, { target: 1 });
    expect(feast.players.map((p) => p.hp)).toEqual([MUT.hp, 4, 1]); // 9번 칸 아군은 3칸 밖
  });

  it('새총 · 벽돌: 사거리 안 에너미만, 쓰러뜨리면 보상', () => {
    const base = withEnemy(withEnemy(newGame(ring(empties(12))), 'robot', 2), 'drone', 8);
    base.players[0].level = 2;
    base.enemies[0].hp = 5;
    base.enemies[1].hp = 9;
    const [near, far] = base.enemies;
    expect(cardTargets(base, base.players[0], 'brick')).toEqual([near.id]); // 8번은 뒤로 5칸
    expect(() => play(give(structuredClone(base), 'brick'), 0, { target: far.id })).toThrow(RuleError);
    const sling = play(give(structuredClone(base), 'slingshot'), 0, { target: far.id });
    expect(sling.enemies.find((e) => e.id === far.id)!.hp).toBe(Math.max(0, far.hp - 2));
    const coins = base.players[0].coins;
    const brick = play(give(structuredClone(base), 'brick'), 0, { target: near.id });
    expect(brick.enemies.map((e) => e.id)).not.toContain(near.id);
    expect(brick.players[0].coins).toBe(coins + ENEMIES.robot.reward);
  });

  it('전투 코스트: 인카운터마다 3 + 성, 그 안에서 여러 장', () => {
    let s = give(withEnemy(newGame(ring(empties(9))), 'robot', 2), 'atkM', 'atkL', 'atkM');
    s.enemies[0].hp = 99;
    s = rollExactly(s, 3);
    s = play(s, 0); // 1
    s = play(s, 0); // +2 = 3
    expect(() => play(s, 0)).toThrow(RuleError); // 4 > 3
    const b = s.turn.battle;
    expect(b.costUsed).toBe(3);
    s = attack(s);
    expect(lastAttack(s).attackValue).toBe(lastAttack(s).attackRoll + MUT.atk + b.atk);
    expect(b.atk).toBeGreaterThanOrEqual(2);
    expect(b.atk).toBeLessThanOrEqual(9);
  });

  it('공격 카드는 공격 때, 방어 카드는 반격 때만', () => {
    let s = give(withEnemy(newGame(ring(empties(9))), 'delinquent', 2), 'atkM', 'defM');
    s.enemies[0].hp = 99;
    expect(() => play(s, 0)).toThrow(RuleError);
    s = rollExactly(s, 3);
    expect(() => play(s, 1)).toThrow(RuleError);
    s = attack(play(s, 0));
    expect(s.phase.kind).toBe('defend');
    s = play(s, 0);
    expect(s.turn.battle.def).toBeGreaterThanOrEqual(1);
  });

  it('그림자 습격: 공격력 +3, 반격 없음', () => {
    let s = give(withEnemy(newGame(ring(empties(9))), 'delinquent', 2), 'shadowRaid');
    s.players[0].level = 1;
    s.enemies[0].hp = 99;
    s = attack(play(rollExactly(s, 3)));
    expect(s.phase.kind).not.toBe('defend');
    expect(lastAttack(s).attackValue).toBe(lastAttack(s).attackRoll + MUT.atk + 3);
  });

  it('축적 → 전력 공격: 공격력 +5, 다음 전투에서 (공격력 + 6) × 1.5', () => {
    let s = give(withEnemy(newGame(ring(empties(9))), 'robot', 2), 'charge');
    s.players[0].level = 2;
    s.enemies[0].hp = 99;
    s = play(rollExactly(s, 3));
    expect(s.players[0].hand.map((h) => h.card)).toEqual(['fullAttack']);
    s = attack(s);
    expect(lastAttack(s).attackValue).toBe(lastAttack(s).attackRoll + MUT.atk + 5);
  });

  it('전술적 후퇴: 반격을 받지 않고 이탈 · 실드 카운터: 반사 피해 후 종료', () => {
    const toDefend = (...cards: CardId[]) => {
      let s = withEnemy(newGame(ring(empties(9))), 'delinquent', 2);
      s.enemies[0].hp = 99;
      s = attack(rollExactly(s, 3));
      expect(s.phase.kind).toBe('defend');
      s.players[0].level = 3;
      s.players[0].coins = 10;
      return give(s, ...cards);
    };
    const r0 = toDefend('retreat');
    const r = play(r0);
    expect(r.players[0].hp).toBe(r0.players[0].hp);
    expect(r.battles.at(-1)!.events.at(-1)).toEqual({ type: 'escape' });

    const c0 = toDefend('shieldCounter');
    const enemyHp = c0.enemies[0].hp;
    const c = play(c0);
    expect(c.players[0].hp).toBe(c0.players[0].hp);
    expect(c.enemies[0].hp).toBe(enemyHp - Math.max(1, c0.enemies[0].atk - MUT.def));
  });

  it('이벤트: 단체 급식 · 총공격 · 긴급 호출', () => {
    const base = newGame(ring(empties(9)), { players: 2 });
    base.players[0].level = 3;
    base.players[0].coins = 50;
    base.players[1].hp = 1;
    expect(play(give(structuredClone(base), 'dinner')).players[1].hp).toBe(4);
    expect(play(give(structuredClone(base), 'allOut')).players.map((p) => p.status.nextBattleAtk)).toEqual([2, 2]);
    expect(() => play(give(structuredClone(base), 'revival'))).toThrow(RuleError);
    base.players[1].ko = true;
    base.players[1].reviveRound = 5;
    const rev = play(give(base, 'revival'));
    expect(rev.players[1]).toMatchObject({ ko: false, hp: Math.ceil(MUT.hp / 2) });
  });
});

describe('Soda', () => {
  const SODA = CHARACTERS.soda;
  const sodaGame = (players = 1) => newGame(ring(empties(12)), { players, character: 'soda' });
  const rush = (s: GameState, target: number) => applyAction(s, { type: 'USE_SKILL', player: s.current, target });
  const lastAttack = (s: GameState) => {
    const hit = s.battles.at(-1)!.events.filter((e) => e.type === 'attack').at(-1)!;
    if (hit.type !== 'attack') throw new Error();
    return hit.result;
  };

  it('시작 능력치: 체력 9 · 공격력 2 · 방어력 1', () => {
    const p = sodaGame(2).players[1];
    expect(p).toMatchObject({ character: 'soda', hp: 9, maxHp: 9, atk: 2, def: 1, coins: RULES.startCoins, stacks: 0 });
  });

  it('성장: 1성 공격력 +1 · 최대 체력 +2 / 2성 없음 / 3성 공격력 +1 · 방어력 +1 · 이동거리 +1', () => {
    let s = sodaGame();
    s.players[0].coins = 100;
    s.players[0].tile = 12;
    s = rollExactly(s, 1); // 본부에 멈춤
    expect(s.players[0]).toMatchObject({ level: 1, atk: 3, maxHp: 11, def: 1 });
    s.players[0].tile = 12;
    s.players[0].relicOffer = null;
    s.phase = { kind: 'preRoll' };
    s = rollExactly(s, 1);
    expect(s.players[0]).toMatchObject({ level: 2, atk: 3, maxHp: 11, def: 1, move: 0 });
    s.players[0].tile = 12;
    s.players[0].relicOffer = null;
    s.phase = { kind: 'preRoll' };
    s = rollExactly(s, 1);
    expect(s.players[0]).toMatchObject({ level: 3, atk: 4, def: 2, move: 1 });
  });

  it('조나단 러시: 7칸 안 상대에게 워프해 전투, 이 전투 동안 상대 방어력 -2, 끝나면 그 칸에서 차례 끝', () => {
    let s = withEnemy(withEnemy(sodaGame(), 'robot', 6), 'drone', 3);
    const [robot, drone] = s.enemies;
    robot.hp = 99;
    robot.def = 3;
    s.enemies.push({ ...robot, id: 99, tile: 9 }); // 9번은 뒤로 4칸 → 사거리 안
    expect(() => applyAction(s, { type: 'USE_SKILL', player: 0 })).toThrow(RuleError); // 대상 필요
    s = rush(s, robot.id);
    expect(s.players[0].tile).toBe(6);
    expect(s.phase).toEqual({ kind: 'encounter', enemy: robot.id, stepsLeft: 0 });
    expect(s.players[0].skillCooldown).toBe(SODA.active.cooldown);
    s = attack(s);
    expect(lastAttack(s).defenseValue).toBe(lastAttack(s).defenseRoll + 1); // 방어력 3 - 2
    expect(s.phase.kind).toBe('endTurn');
    expect(drone.id).toBeDefined();
  });

  it('조나단 러시: 7칸 밖이나 재사용 대기 중에는 못 쓴다', () => {
    let s = withEnemy(sodaGame(), 'robot', 7); // 0 → 7: 앞으로 7칸, 뒤로 6칸
    const far = withEnemy(newGame(ring(empties(20)), { players: 1, character: 'soda' }), 'robot', 10);
    expect(() => rush(far, far.enemies[0].id)).toThrow(RuleError);
    s.players[0].skillCooldown = 1;
    expect(() => rush(s, s.enemies[0].id)).toThrow(RuleError);
  });

  it('연마: 방어력 0인 적을 처치하면 스택 +1 (최대 6), 2개당 상대 방어력 -1', () => {
    let s = withEnemy(sodaGame(), 'robot', 2);
    s.enemies[0].hp = 1;
    s.enemies[0].def = 0;
    s = attack(rollExactly(s, 3));
    expect(s.players[0].stacks).toBe(1);
    expect(s.battles.at(-1)!.events.some((e) => e.type === 'skill' && e.name === SODA.passive.name)).toBe(true);

    // 방어력이 남아 있는 적은 스택 없음
    let t = withEnemy(sodaGame(), 'robot', 2);
    t.enemies[0].hp = 1;
    t.enemies[0].def = 5;
    t.players[0].atk = 50;
    t = attack(rollExactly(t, 3));
    expect(t.players[0].stacks).toBe(0);

    // 스택 4개 = 방어력 -2 → 방어력 2인 적은 0으로 보고 스택 +1, 최대 6
    let u = withEnemy(sodaGame(), 'robot', 2);
    u.players[0].stacks = 4;
    u.enemies[0].hp = 99;
    u.enemies[0].def = 2;
    u = attack(rollExactly(u, 3));
    expect(lastAttack(u).defenseValue).toBe(lastAttack(u).defenseRoll);
    u.players[0].stacks = 6;
    expect(onEnemyDefeated(u.players[0], 0)).toBe(false);
    expect(u.players[0].stacks).toBe(6);
  });
});

describe('모나', () => {
  const MONA = CHARACTERS.mona;
  /** 0번 모나, 1번 뭇별 */
  const monaGame = () => {
    const s = createGame({
      board: ring(empties(14)),
      boss: TEST_BOSS,
      players: [
        { name: 'M', color: '#fff', character: 'mona' },
        { name: 'B', color: '#fff', character: 'mutbyeol' },
      ],
      seed: 42,
    });
    s.players[0].hand = [{ card: 'slingshot' }, { card: 'cake' }, { card: 'dash' }];
    s.players[1].hand = [];
    return s;
  };
  const gift = (s: GameState, target: number, cards: number[]) =>
    applyAction(s, { type: 'USE_SKILL', player: 0, target, cards });

  it('시작 능력치: 체력 9 · 공격력 1 · 방어력 1 · 코인 12', () => {
    const s = monaGame();
    expect(s.players[0]).toMatchObject({ character: 'mona', maxHp: 9, atk: 1, def: 1, coins: RULES.startCoins });
  });

  it('성장: 1성 코인 +10 · 최대 체력 +2 / 2성 없음 / 3성 공격력 +1 · 방어력 +1 · 이동거리 +1', () => {
    let s = monaGame();
    s.players[0].coins = 20;
    s.players[0].tile = s.board.tiles.length - 1;
    s = rollExactly(s, 1); // 본부에 멈춤
    expect(s.players[0]).toMatchObject({ level: 1, maxHp: 11, hp: 11, coins: 20 - RULES.levelUpCost[0] + 10 });
    expect(MONA.stars[1]).toEqual({});
    expect(MONA.stars[2]).toEqual({ atk: 1, def: 1, move: 1 });
  });

  it('역조공: 손패 1~2장을 10칸 안 아군에게 주고, 팬만큼 뽑는다', () => {
    const s0 = monaGame();
    s0.players[0].stacks = 2;
    expect(() => gift(s0, 1, [])).toThrow(RuleError);
    expect(() => gift(s0, 1, [0, 1, 2])).toThrow(RuleError);
    expect(() => gift(s0, 0, [0])).toThrow(RuleError); // 자기 자신
    const s = gift(s0, 1, [0, 2]);
    expect(s.players[1].hand).toEqual([
      { card: 'dash', from: 0 },
      { card: 'slingshot', from: 0 },
    ]);
    expect(s.players[0].hand).toHaveLength(1 + 2); // 케이크 + 팬 2장
    expect(s.players[0].skillCooldown).toBe(MONA.active.cooldown);
  });

  it('10칸 밖 아군에게는 못 준다', () => {
    const s = monaGame();
    s.players[1].tile = 12; // 뒤로 3칸
    expect(() => gift(s, 1, [0])).not.toThrow();
    const far = createGame({
      board: ring(empties(30)),
      boss: TEST_BOSS,
      players: [
        { name: 'M', color: '#fff', character: 'mona' },
        { name: 'B', color: '#fff', character: 'mutbyeol' },
      ],
      seed: 1,
    });
    far.players[1].tile = 15;
    expect(() => applyAction(far, { type: 'USE_SKILL', player: 0, target: 1, cards: [0] })).toThrow(RuleError);
  });

  it('준 카드를 아군이 쓰면 팬 +1 (최대 5), 효과 카드 피해 + 팬', () => {
    let s = gift(monaGame(), 1, [0]);
    s.players[0].stacks = 3;
    s = applyAction(rollExactly(s, 1), { type: 'END_TURN', player: 0 });
    expect(s.current).toBe(1);
    s = withEnemy(s, 'robot', s.players[1].tile + 1);
    s.enemies[0].hp = 20;
    s.players[1].level = 1; // 새총은 1성부터
    s = applyAction(s, { type: 'PLAY_CARD', player: 1, handIndex: 0, target: s.enemies[0].id });
    expect(s.enemies[0].hp).toBe(20 - (2 + 3)); // 새총 2 + 팬 3
    expect(s.players[0].stacks).toBe(4);

    s.players[0].stacks = 5;
    s.players[1].hand = [{ card: 'cookie', from: 0 }];
    s.turn.cardsPlayed = 0;
    s = applyAction(s, { type: 'PLAY_CARD', player: 1, handIndex: 0 });
    expect(s.players[0].stacks).toBe(5);
  });

  it('팬레터: 아군이 받은 효과 카드로 적을 처치하면 모나가 카드 1장', () => {
    let s = gift(monaGame(), 1, [0]); // 새총
    s = applyAction(rollExactly(s, 1), { type: 'END_TURN', player: 0 });
    s = withEnemy(s, 'robot', s.players[1].tile + 1);
    s.enemies[0].hp = 2;
    s.players[1].level = 1;
    const monaHand = s.players[0].hand.length;
    s = applyAction(s, { type: 'PLAY_CARD', player: 1, handIndex: 0, target: s.enemies[0].id });
    expect(s.enemies).toHaveLength(0);
    expect(s.players[0].hand).toHaveLength(monaHand + 1);

    // 처치하지 못하면 없음
    let t2 = gift(monaGame(), 1, [0]);
    t2 = applyAction(rollExactly(t2, 1), { type: 'END_TURN', player: 0 });
    t2 = withEnemy(t2, 'robot', t2.players[1].tile + 1);
    t2.enemies[0].hp = 20;
    t2.players[1].level = 1;
    const hand2 = t2.players[0].hand.length;
    t2 = applyAction(t2, { type: 'PLAY_CARD', player: 1, handIndex: 0, target: t2.enemies[0].id });
    expect(t2.players[0].hand).toHaveLength(hand2);
  });
});

describe('거점', () => {
  it('자리마다 거점에서 시작한다', () => {
    const s = newGame(DEFAULT_BOARD, { players: 4 });
    expect(s.players.map((p) => [p.tile, p.home])).toEqual([
      [0, 0],
      [7, 7],
      [11, 11],
      [18, 18],
    ]);
    expect(validateBoard(DEFAULT_BOARD)).toEqual([]);
  });

  it('남의 거점은 정확히 멈추면 오르고, 지나갈 때는 묻지 않는다', () => {
    const board: Board = { ...ring(empties(9)), homeTiles: [0, 3] };
    board.tiles[3] = { ...board.tiles[3], kind: 'base' };
    const s0 = newGame(board);
    s0.players[0].coins = 50;
    expect(rollExactly(s0, 3).players[0].level).toBe(1);
    expect(rollExactly(s0, 4).players[0]).toMatchObject({ tile: 4, level: 0 });
  });
});

describe('송금', () => {
  it('상점에서 아군에게 코인 5', () => {
    let s = newGame(ring(['empty', 'shop', ...empties(6)]));
    s.players[0].coins = 12;
    s = rollExactly(s, 2);
    const before = s.players[1].coins;
    s = applyAction(s, { type: 'SEND_COINS', player: 0, to: 1 });
    expect([s.players[0].coins, s.players[1].coins]).toEqual([7, before + 5]);
    expect(() => applyAction(s, { type: 'SEND_COINS', player: 0, to: 0 })).toThrow(RuleError);
    s.players[0].coins = 4;
    expect(() => applyAction(s, { type: 'SEND_COINS', player: 0, to: 1 })).toThrow(RuleError);
  });

  it('상점 밖에서는 못 보낸다', () => {
    const s = newGame(ring(empties(6)));
    expect(() => applyAction(s, { type: 'SEND_COINS', player: 0, to: 1 })).toThrow(RuleError);
  });
});

describe('반격 순서', () => {
  it('에너미가 먼저 공격 주사위를 굴리고, 플레이어는 그 값을 보고 방어 · 회피를 고른다', () => {
    let s = withEnemy(newGame(ring(empties(9))), 'delinquent', 2);
    s.enemies[0].hp = 99;
    s = attack(rollExactly(s, 3));
    if (s.phase.kind !== 'defend') throw new Error();
    const { attackRoll } = s.phase;
    const pre = s.battles.at(-1)!.events.at(-1)!;
    expect(pre).toEqual({ type: 'enemyRoll', roll: attackRoll, value: attackRoll + s.enemies[0].atk });
    for (const mode of ['block', 'evade'] as const) {
      const after = applyAction(s, { type: 'DEFEND', player: 0, mode });
      const hit = after.battles.at(-1)!.events.filter((e) => e.type === 'attack').at(-1)!;
      if (hit.type !== 'attack') throw new Error();
      expect(hit.result.attackRoll).toBe(attackRoll);
    }
  });
});

describe('밸런스 조정', () => {
  it('그림자 습격의 반격 없음은 보스에게 통하지 않는다', () => {
    let s = withEnemy(newGame(ring(empties(9))), 'delinquent', 2);
    s.enemies[0].isBoss = true;
    s.enemies[0].hp = 99;
    s.players[0].level = 1;
    s.players[0].hand = [{ card: 'shadowRaid' }];
    s = rollExactly(s, 3);
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    s = attack(s);
    expect(s.phase.kind).toBe('defend');
  });

  it('전술적 후퇴는 성 × 3코인 (최소 3)', () => {
    const p = newGame(ring(empties(4))).players[0];
    expect(cardCoinCost('retreat', p)).toBe(3);
    p.level = 2;
    expect(cardCoinCost('retreat', p)).toBe(6);
    p.level = 3;
    expect(cardCoinCost('retreat', p)).toBe(9);
  });

  it('액셀: 공격 주사위 2개를 더한다', () => {
    for (let seed = 1; seed < 20; seed++) {
      let s = withEnemy(newGame(ring(empties(9)), { seed }), 'robot', 2);
      s.enemies[0].hp = 99;
      s.players[0].level = 3;
      s.players[0].hand = [{ card: 'accel' }];
      s = attack(applyAction(rollExactly(s, 3), { type: 'PLAY_CARD', player: 0, handIndex: 0 }));
      const hit = s.battles.at(-1)!.events.find((e) => e.type === 'attack')!;
      if (hit.type !== 'attack') throw new Error();
      expect(hit.result.attackRoll).toBeGreaterThanOrEqual(2);
      expect(hit.result.attackRoll).toBeLessThanOrEqual(12);
    }
  });

  it('덱 제한: 질주 2장 · 벽돌 2장 · 새총 1성 2포인트 · 명검 2성 · 너도 나도 2포인트', () => {
    expect([CARDS.dash.limit, CARDS.brick.limit]).toEqual([2, 2]);
    expect([CARDS.slingshot.level, CARDS.slingshot.points]).toEqual([1, 2]);
    expect(CARDS.gawu.level).toBe(2);
    expect(CARDS.share.points).toBe(2);
  });
});

describe('원작 캐릭터 스킬', () => {
  const game = (character: CharacterId, kinds: TileKind[] = empties(14)) => newGame(ring(kinds), { character });
  const skill = (s: GameState, extra: { target?: number; cards?: number[]; value?: number } = {}) =>
    applyAction(s, { type: 'USE_SKILL', player: s.current, ...extra });

  it('협동 보너스: A형은 시작 코인 +6 · 1성 코인 +10 · 최대 HP +2', () => {
    const s = game('parunan');
    expect(s.players[0].coins).toBe(RULES.startCoins + 6);
    expect(CHARACTERS.parunan.stars[0]).toEqual({ coins: 10, maxHp: 2 });
  });

  it('Z3000: 7칸 안 몬스터를 끌어와 5 피해', () => {
    let s = withEnemy(game('z3000'), 'elite', 5);
    s = skill(s, { target: s.enemies[0].id });
    expect(s.enemies[0]).toMatchObject({ tile: 0, hp: ENEMIES.elite.hp - 5 });
  });

  it('렌: 쥐쥐 보호막은 다음 피해를 막는다', () => {
    let s = game('ren', ['calamity', ...empties(4)]);
    s = skill(s, { target: 0 });
    s = rollExactly(s, 1);
    expect(s.players[0].hp).toBe(CHARACTERS.ren.hp);
    expect(s.players[0].charVars.shield).toBe(0);
  });

  it('키이세이: 이동 주사위 눈이 6이면 코인 +6 (최종 이동과 무관)', () => {
    const s0 = game('haiqing');
    s0.turn.fixedMove = 6;
    s0.turn.extraSteps = 2;
    const s = applyAction(s0, { type: 'ROLL', player: 0 });
    expect(s.players[0].coins).toBe(RULES.startCoins + 6 + 6);
    const t = rollExactly(game('haiqing'), 6);
    expect(t.players[0].coins).toBe(RULES.startCoins + 6);
  });

  it('미사키: 4칸 안 몬스터 2 피해 + 검기 · 검기만큼 공격력', () => {
    let s = withEnemy(game('misaki'), 'elite', 3);
    s = skill(s, { target: s.enemies[0].id });
    expect(s.enemies[0].hp).toBe(ENEMIES.elite.hp - 2);
    expect(s.players[0].stacks).toBe(1);
  });

  it('루카: 돌진 중에는 전투 없이 지나는 몬스터에게 2 + 공격력 피해', () => {
    let s = withEnemy(game('luka'), 'elite', 2);
    s = skill(s);
    s = rollExactly(s, 4);
    expect(s.phase.kind).toBe('endTurn');
    expect(s.enemies[0].hp).toBe(ENEMIES.elite.hp - (2 + CHARACTERS.luka.atk));
  });

  it('낸시: 원격 도전 뒤 제자리에서 주사위 전으로', () => {
    let s = withEnemy(game('nancy'), 'robot', 6);
    s = skill(s, { target: s.enemies[0].id });
    expect(s.phase.kind).toBe('encounter');
    s = attack(s);
    if (s.phase.kind === 'defend') s = defend(s, 'block');
    expect(s.phase.kind).toBe('preRoll');
    expect(s.players[0].tile).toBe(0);
  });

  it('링링: 고른 만큼 돌진하고 지나간 몬스터를 데려가 싸운다', () => {
    let s = withEnemy(game('lingling'), 'elite', 2);
    s = skill(s, { value: 4 });
    s = applyAction(s, { type: 'ROLL', player: 0 });
    expect(s.players[0].tile).toBe(4);
    expect(s.enemies[0].tile).toBe(4);
    expect(s.phase.kind).toBe('encounter');
  });

  it('알: 카드를 주면 준 수만큼 코인 · 둘 다 스타라이트', () => {
    let s = game('al');
    s.players[0].hand = [{ card: 'dash' }, { card: 'cake' }];
    const coins = s.players[0].coins;
    s = skill(s, { target: 1, cards: [0, 1] });
    expect(s.players[0].coins).toBe(coins + 2);
    expect(s.players[1].hand.slice(-2).map((h) => h.card)).toEqual(['dash', 'cake']);
    expect([s.players[0].starlight, s.players[1].starlight]).toEqual([1, 1]);
  });
});

describe('원작 공식 문구 (미미 · 패니 · 패드맨 · 렌 · Z3000)', () => {
  const game = (character: CharacterId, kinds: TileKind[] = empties(14), potential = false) =>
    newGame(ring(kinds), { character, potential });
  const skill = (s: GameState, extra: { target?: number } = {}) => applyAction(s, { type: 'USE_SKILL', player: s.current, ...extra });

  it('유물 재선택: 시작 2회 · 별마다 +1', () => {
    let s = game('mimi');
    expect(s.players[0].relicVars.rerolls).toBe(2);
    s.players[0].coins = 50;
    s.players[0].tile = 14;
    s = rollExactly(s, 1); // 거점에 멈춤
    expect(s.players[0].level).toBe(1);
    expect(s.players[0].relicVars.rerolls).toBe(3);
  });

  it('Z3000: 재사용 대기 4 · 잠재: 2마리마다 공격력 +1', () => {
    expect(CHARACTERS.z3000.active.cooldown).toBe(4);
    let s = withEnemy(withEnemy(game('z3000', empties(14), true), 'thief', 3), 'thief', 5);
    for (const e of s.enemies) e.hp = 1;
    const atk = s.players[0].atk;
    s = skill(s, { target: s.enemies[0].id });
    s.players[0].skillCooldown = 0;
    s.turn.skillUsed = false;
    s = skill(s, { target: s.enemies[0].id });
    expect(s.players[0].atk).toBe(atk + 1);
  });

  it('패니: 턴 종료 시 이벤트 1번 더 · 잠재: 2개 중 고르기', () => {
    let s = skill(game('fanny'));
    s = rollExactly(s, 1);
    const coins = s.players[0].coins;
    s = applyAction(s, { type: 'END_TURN', player: 0 });
    expect(s.current).toBe(1);
    expect(s.players[0].coins).toBeGreaterThanOrEqual(coins + 3 - 4); // 결정적 단서 +3 (지갑 분실 -4가 나올 수 있다)
    let t = skill(game('fanny', empties(14), true));
    t = rollExactly(t, 1);
    t = applyAction(t, { type: 'END_TURN', player: 0 });
    expect(t.phase.kind).toBe('eventPick');
    if (t.phase.kind !== 'eventPick') return;
    t = applyAction(t, { type: 'PICK_EVENT', player: 0, event: t.phase.options[1] });
    expect(t.current).toBe(1);
  });

  it('렌 잠재: 슈슈 쉴드와 함께 반격 1중첩', () => {
    const s = skill(game('ren', empties(14), true), { target: 1 });
    expect(s.players[1].charVars).toMatchObject({ shield: 1, counter: 1 });
  });

  it('미미 잠재: 카드 25장마다 유물', () => {
    let s = game('mimi', ['card', ...empties(13)], true);
    s.players[0].charVars.gained = 24;
    s = rollExactly(s, 1);
    expect(s.players[0].relicOffer).not.toBeNull();
  });
});

describe('원작 공식 문구 2 (펑 · 마무시 · 사이크스 · 알라나 · 코마치 · 미사키 · 나르디스)', () => {
  const game = (character: CharacterId, kinds: TileKind[] = empties(14), potential = false) =>
    newGame(ring(kinds), { character, potential });
  const skill = (s: GameState, extra: { target?: number } = {}) => applyAction(s, { type: 'USE_SKILL', player: s.current, ...extra });

  it('펑: 에너지 보존 상태면 공 +2 · 방 +2 (중첩과 무관) · 잠재: 5중첩 공격 시 2칸 안 88%', async () => {
    const { kitAtk, kitDef } = await import('./kits');
    const s = game('fen', empties(14), true);
    s.players[0].stacks = 3;
    const dummy = { ...s.enemies[0], mark: 0 } as GameState['enemies'][number];
    expect([kitAtk(s, s.players[0], dummy), kitDef(s, s.players[0])]).toEqual([2, 2]);
    let t = withEnemy(withEnemy(game('fen', empties(14), true), 'elite', 1), 'elite', 2);
    t.players[0].stacks = 5;
    t.enemies[1].hp = 50;
    t = rollExactly(t, 1);
    t = attack(t);
    const dealt = ENEMIES.elite.hp - t.enemies[0].hp;
    if (dealt > 0) expect(t.enemies[1].hp).toBe(50 - Math.floor(dealt * 0.88));
  });

  it('알라나 잠재: 액티브를 쓴 턴에 피해 0', () => {
    let s = skill(game('alana', ['calamity', ...empties(13)], true));
    s = rollExactly(s, 1);
    expect(s.players[0].hp).toBe(CHARACTERS.alana.hp);
  });

  it('코마치 잠재: 효과 카드 3장마다 재사용 -1 · 효과 카드 피해 +1', () => {
    let s = game('komachi', empties(14), true);
    s.players[0].charVars.effects = 2;
    s.players[0].skillCooldown = 2;
    s.players[0].hand = [{ card: 'cake' }];
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    expect(s.players[0].skillCooldown).toBe(1);
    expect(s.players[0].charVars.fxDamage).toBe(1);
  });

  it('미사키 잠재: 사거리 6 · 검기 3에서 쓰면 2 소모 · 명검 1장 · 명검 코스트 -1', async () => {
    const { kitBattleCost } = await import('./kits');
    let s = withEnemy(game('misaki', empties(14), true), 'elite', 6);
    s.players[0].stacks = 3;
    s = skill(s, { target: s.enemies[0].id });
    expect(s.players[0].stacks).toBe(2);
    expect(s.players[0].hand.at(-1)?.card).toBe('gawu');
    expect(kitBattleCost(s.players[0], 'gawu')).toBe(CARDS.gawu.battleCost! - 1);
  });

  it('마무시: 각성 8이면 진룡 · 깨물기 → 용의 포효', () => {
    let s = game('mamushi');
    s.players[0].stacks = 7;
    s.players[0].hand = [{ card: 'bite' }];
    s = skill(s);
    expect(s.players[0].stacks).toBe(8);
    expect(s.players[0].hand.filter((h) => h.card === 'bite')).toHaveLength(0);
    expect(s.players[0].hand.some((h) => h.card === 'dragonRoar')).toBe(true);
  });

  it('사이크스: 촉수를 소환하고 어비스 존의 촉수가 몬스터를 친다', () => {
    let s = withEnemy(game('sykes'), 'elite', 3);
    s = skill(s);
    expect(Object.keys(s.players[0].charTiles)).toHaveLength(1);
    expect(s.enemies[0].hp).toBe(ENEMIES.elite.hp - 1);
  });
});

describe('원작 공식 문구 3', () => {
  const game = (character: CharacterId, kinds: TileKind[] = empties(14), potential = false) =>
    newGame(ring(kinds), { character, potential });
  const skill = (s: GameState, extra: { target?: number; cards?: number[]; value?: number } = {}) =>
    applyAction(s, { type: 'USE_SKILL', player: s.current, ...extra });

  it('링링: 금지 표지판 2장으로 시작 · 태클로 튕겨 낸 몬스터와 순서대로 싸운다', () => {
    expect(game('lingling').players[0].hand.filter((h) => h.card === 'banSign')).toHaveLength(2);
    let s = withEnemy(withEnemy(game('lingling'), 'elite', 1), 'elite', 3);
    const [a, b] = s.enemies.map((e) => e.id);
    s = skill(s, { value: 5 });
    s = applyAction(s, { type: 'ROLL', player: 0 });
    expect(s.enemies.map((e) => e.tile)).toEqual([5, 5]);
    expect(s.phase).toMatchObject({ kind: 'encounter', enemy: a });
    s = release(s);
    expect(s.phase).toMatchObject({ kind: 'encounter', enemy: b });
  });

  it('링링: 태클 중 금지 표지판을 지나면 방어력 -2 · 공격력 +2 · 표지판 1장', async () => {
    const { kitAtk } = await import('./kits');
    let s = withEnemy(game('lingling'), 'elite', 1);
    s.players[0].charTiles[2] = 1;
    s = skill(s, { value: 4 });
    s = applyAction(s, { type: 'ROLL', player: 0 });
    expect(s.enemies[0].tags?.grab).toBe(2);
    expect(kitAtk(s, s.players[0], s.enemies[0])).toBe(2);
    expect(s.players[0].charTiles[2]).toBeUndefined();
    expect(s.players[0].hand.filter((h) => h.card === 'banSign')).toHaveLength(3);
  });

  it('금지 표지판: 지나는 캐릭터는 멈추고 다음 이동 +2', () => {
    let s = game('lingling', empties(14));
    const i = s.players[0].hand.findIndex((h) => h.card === 'banSign');
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: i, value: 3 });
    expect(s.players[0].charTiles[3]).toBe(1);
    s.current = 1;
    s.phase = { kind: 'preRoll' };
    s = rollExactly(s, 6);
    expect(s.players[1].tile).toBe(3);
    expect(s.players[1].relicVars.warpBoost).toBe(2);
  });

  it('파루난 잠재: 상점 전투 카드 +1 · 송금하면 1장 1코인', () => {
    let s = game('parunan', ['shop', ...empties(13)], true);
    s = rollExactly(s, 1);
    if (s.phase.kind !== 'shop') throw new Error('상점 아님');
    expect(s.phase.offers).toHaveLength(RULES.shopOffers + 2);
    s.players[0].coins = 20;
    s = applyAction(s, { type: 'SEND_COINS', player: 0, to: 1 });
    if (s.phase.kind !== 'shop') throw new Error('상점 아님');
    expect(s.phase.offers.some((o) => o.price === 1)).toBe(true);
  });

  it('파파라 잠재: 체력을 쓰지 않고 한 입만 동안 공격력 +3', async () => {
    const { kitAtk } = await import('./kits');
    let s = withEnemy(game('papara', empties(14), true), 'elite', 5);
    s = skill(s);
    expect(s.players[0].hp).toBe(s.players[0].maxHp);
    expect(kitAtk(s, s.players[0], s.enemies[0])).toBe(3);
  });

  it('판다맨 잠재: 햄버거 → 반격 1 · 최대 체력 +2 · 액티브로 5칸 안 도발', () => {
    let s = withEnemy(game('pandaman', empties(14), true), 'elite', 4);
    const max = s.players[0].maxHp;
    s.players[0].level = 1;
    s.players[0].hand = [{ card: 'bandage' }];
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    expect(s.players[0].charVars.counter).toBe(1);
    expect(s.players[0].maxHp).toBe(max + 2);
    s = skill(s);
    expect(s.enemies[0].tags?.taunt).toBe(1);
  });

  it('루루 잠재: 사거리 제한 없음 · 4칸 안 몬스터 이동 -3 · 미니 슬라임', async () => {
    const { kitSlow, kitHealLost } = await import('./kits');
    const { createRng } = await import('./rng');
    let s = withEnemy(game('lulu', empties(14), true), 'elite', 3);
    s.players[1].tile = 12;
    s = skill(s, { target: 1 });
    expect(s.players[1].healStacks).toBe(3);
    expect(kitSlow(s, s.enemies[0])).toBe(3);
    kitHealLost(s, createRng(1), s.players[0], 4);
    expect(Object.keys(s.players[0].charTiles)).toHaveLength(2);
  });

  it('키이세이 잠재: 스마트 주사위 → 운명의 인도 · 표식 몬스터를 처치하면 운명의 인도', () => {
    let s = withEnemy(game('haiqing', empties(14), true), 'elite', 4);
    s.players[0].level = 1;
    s.players[0].hand = [{ card: 'remoteDice' }, { card: 'laser' }];
    s = skill(s, { target: s.enemies[0].id });
    expect(s.players[0].hand[0].card).toBe('fateGuide');
    s.enemies[0].hp = 1;
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 1, target: s.enemies[0].id });
    expect(s.enemies).toHaveLength(0);
    expect(s.players[0].hand.filter((h) => h.card === 'fateGuide')).toHaveLength(2);
  });

  it('메가스: 궤도 폭격 피해 3 + 버린 코스트 3마다 1 · 잠재 6장 이상이면 레일건', () => {
    let s = withEnemy(game('megas', empties(14), true), 'elite', 3);
    s.enemies[0].hp = 99;
    s.players[0].hand = [{ card: 'atkM' }, { card: 'atkM' }, { card: 'atkM' }, { card: 'dash' }, { card: 'dash' }, { card: 'dash' }];
    const cost = CARDS.atkM.battleCost! * 3;
    s = skill(s);
    expect(s.enemies[0].hp).toBe(99 - 3 * (3 + Math.floor(cost / 3)));
    expect(s.players[0].hand.some((h) => h.card === 'railgun')).toBe(true);
  });

  it('리빙 북: 2 피해 · 표식 +1 · 표식 3 이상이면 이번 턴 카드 +1', () => {
    let s = withEnemy(game('rin'), 'elite', 4);
    s.enemies[0].mark = 2;
    s.players[0].hand = [{ card: 'livingPage' }];
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0, target: s.enemies[0].id });
    expect(s.enemies[0].mark).toBe(3);
    expect(s.turn.extraPlays).toBe(1);
  });

  it('루카 잠재: 전투 카드 1장을 버리면 이번 턴 공격력 + (성 + 코스트)', async () => {
    const { kitAtk } = await import('./kits');
    const s0 = withEnemy(game('luka', empties(14), true), 'elite', 9);
    s0.players[0].hand = [{ card: 'dash' }, { card: 'atkM' }];
    expect(() => skill(s0, { cards: [0] })).toThrow(RuleError);
    const s = skill(s0, { cards: [1] });
    expect(kitAtk(s, s.players[0], s.enemies[0])).toBe(s.players[0].level + CARDS.atkM.battleCost!);
  });

  it('초텐짱 잠재: 최대 10코인 · 팬 9 이상이면 다른 아군 코인 +3', () => {
    let s = game('kangel', empties(14), true);
    for (let i = 0; i < 10; i++) s = withEnemy(s, 'robot', 2 + i);
    for (const e of s.enemies) e.tags = { fan: 1 };
    const [mine, theirs] = s.players.map((p) => p.coins);
    s = skill(s);
    expect(s.players[0].coins).toBe(mine + 10);
    expect(s.players[1].coins).toBe(theirs + 3);
  });

  it('유메: 이동 주사위 1 → 불행 · 불행을 들고 턴을 마치면 체력 -1', () => {
    const s0 = game('zhao');
    s0.players[0].hand = [];
    s0.turn.fixedMove = 1;
    let s = applyAction(s0, { type: 'ROLL', player: 0 });
    expect(s.players[0].hand.map((h) => h.card)).toEqual(['talismanHuo']);
    const hp = s.players[0].hp;
    s = applyAction(s, { type: 'END_TURN', player: 0 });
    expect(s.players[0].hp).toBe(hp - 1);
  });

  it('용의 포효 코스트 3 · 깨물기 코스트 2', () => {
    expect([CARDS.dragonRoar.battleCost, CARDS.bite.battleCost]).toEqual([3, 2]);
  });
});

describe('라우렐', () => {
  const game = () => newGame(ring(empties(30)), { character: 'laurel' });
  const skill = (s: GameState, target: number) => applyAction(s, { type: 'USE_SKILL', player: s.current, target });

  it('능력치 · 시작 코인 +6', () => {
    const p = game().players[0];
    expect(p).toMatchObject({ hp: 8, maxHp: 8, atk: 2, def: 0, coins: RULES.startCoins + 6 });
    expect(CHARACTERS.laurel.stars).toEqual([{ atk: 1, maxHp: 2 }, { atk: 1 }, { maxHp: 1 }]);
  });

  it('너 때문이야: 10칸 안 또는 불운이 있는 몬스터 · 불운 1 뒤 전투 · 전투하면 불운 +1', async () => {
    const { skillTargets } = await import('./skills');
    let s = withEnemy(withEnemy(game(), 'robot', 4), 'robot', 15);
    const [near, far] = s.enemies;
    expect(skillTargets(s, s.players[0])).toEqual([near.id]);
    s.enemies[1].tags = { unluck: 1 };
    s.enemies[1].tagBy = { unluck: 0 };
    expect(skillTargets(s, s.players[0])).toEqual([near.id, far.id]);
    s = skill(s, near.id);
    expect(s.phase.kind).toBe('encounter');
    expect(s.enemies[0].tags?.unluck).toBe(1);
    s = attack(s);
    expect(s.enemies.find((e) => e.id === near.id)?.tags?.unluck ?? 2).toBe(2);
  });

  it('불운: 라우렐이 주는 피해 + · 방어력 + · 최대 3', async () => {
    const { kitDef, kitFought } = await import('./kits');
    const { strikeEnemy } = await import('./game');
    const { createRng } = await import('./rng');
    const s = withEnemy(game(), 'elite', 3);
    const [p, other] = s.players;
    const e = s.enemies[0];
    for (let i = 0; i < 5; i++) kitFought(s, p, e);
    expect(e.tags?.unluck).toBe(3);
    expect(kitDef(s, p, e)).toBe(3);
    expect(kitDef(s, other, e)).toBe(0);
    const hp = e.hp;
    strikeEnemy(s, createRng(1), p, e, 2);
    expect(e.hp).toBe(hp - 5);
    strikeEnemy(s, createRng(1), other, e, 2);
    expect(e.hp).toBe(hp - 7);
  });

  it('액티브 전투로 처치: 재사용 -2 · 2마리마다 공격력 +1', async () => {
    const { kitKill } = await import('./kits');
    const { createRng } = await import('./rng');
    const s = withEnemy(game(), 'robot', 3);
    const p = s.players[0];
    const atk = p.atk;
    for (let i = 0; i < 2; i++) {
      p.skillCooldown = 3;
      p.charVars.skillBattle = 1;
      kitKill(s, createRng(1), p, s.enemies[0]);
      expect(p.skillCooldown).toBe(1);
    }
    expect(p.atk).toBe(atk + 1);
    // 액티브 전투가 아니면 그대로
    p.skillCooldown = 3;
    kitKill(s, createRng(1), p, s.enemies[0]);
    expect(p.skillCooldown).toBe(3);
  });
});

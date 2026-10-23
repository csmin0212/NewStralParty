import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../data/board';
import { CHARACTERS } from '../data/characters';
import { PLACEHOLDER_BOSS } from '../data/bosses';
import { ENEMIES } from '../data/enemies';
import { applyAction, createGame, RuleError, validateBoard } from './game';
import { RULES } from './rules';
import type { Board, BossDef, EnemyKind, GameState, Gimmick, TileKind } from './types';

/** 기믹 없는 테스트용 보스 */
const TEST_BOSS: BossDef = {
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
  opts: { players?: number; seed?: number; boss?: BossDef; potential?: boolean } = {},
): GameState {
  const { players = 2, seed = 42, boss = TEST_BOSS, potential = false } = opts;
  const setups = Array.from({ length: players }, (_, i) => ({
    name: `P${i + 1}`,
    color: '#fff',
    character: 'mutbyeol' as const,
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
  it('모두 본부에서 시작하고, 첫 플레이어는 턴 수입을 받고, 진행도 1에서 시작한다', () => {
    const s = newGame(ring(empties(5)), { players: 3 });
    expect(s.players.map((p) => p.tile)).toEqual([0, 0, 0]);
    expect(s.players[0].coins).toBe(MUT.startCoins + RULES.turnIncome);
    expect(s.players[1].coins).toBe(MUT.startCoins);
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
        if (s.phase.kind === 'preRoll') s = applyAction(s, { type: 'ROLL', player });
        else if (s.phase.kind === 'choosePath')
          s = applyAction(s, { type: 'CHOOSE_PATH', player, to: s.phase.options[0] });
        else if (s.phase.kind === 'encounter') s = applyAction(s, { type: 'ENCOUNTER', player, choice: 'attack' });
        else if (s.phase.kind === 'defend') s = applyAction(s, { type: 'DEFEND', player, mode: 'block' });
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

  it('턴을 넘기면 다음 플레이어가 수입을 받고, 한 바퀴 돌면 라운드와 진행도가 오른다', () => {
    let s = newGame(ring(empties(12)));
    s = finishTurn(s);
    expect(s.current).toBe(1);
    expect(s.players[1].coins).toBe(MUT.startCoins + RULES.turnIncome);
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

describe('본부와 레벨업', () => {
  it('본부를 지나가면 코인을 내고 별을 따고, 캐릭터의 그 별 능력치를 얻는다', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].coins = 20;
    const s = rollExactly(s0, 4); // 0 → 1 → 2 → 0(본부) → 1
    expect(s.players[0].tile).toBe(1);
    expect(s.players[0].level).toBe(1);
    expect(s.players[0].coins).toBe(20 - RULES.levelUpCost[0]);
    // 뭇별 1성: 체력 +2 (지금 HP도 같이)
    expect([s.players[0].maxHp, s.players[0].hp]).toEqual([MUT.hp + 2, MUT.hp + 2]);
  });

  it('코인이 모자라면 별을 따지 않는다', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].coins = RULES.levelUpCost[0] - 1;
    const s = rollExactly(s0, 3);
    expect(s.players[0].level).toBe(0);
    expect(s.players[0].coins).toBe(RULES.levelUpCost[0] - 1);
  });

  it('뭇별 2성 · 3성: 체력 +1, 공격력 +1씩', () => {
    let s = newGame(ring(['empty', 'empty']));
    s.players[0].level = 1;
    s.players[0].coins = 100;
    s = rollExactly(s, 3);
    expect(s.players[0]).toMatchObject({ level: 2, maxHp: MUT.hp + 1, atk: MUT.atk + 1 });
  });

  it('3성이 되어도 게임은 끝나지 않고, 더 올라가지 않는다', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].level = 2;
    s0.players[0].coins = 100;
    const s = rollExactly(s0, 6); // 본부를 두 번 지나간다
    expect(s.players[0].level).toBe(3);
    expect(s.players[0].coins).toBe(100 - RULES.levelUpCost[2]);
    expect(s.phase).toEqual({ kind: 'endTurn' });
  });
});

describe('칸 효과', () => {
  it('코인+ / 코인- (0 아래로는 안 내려간다)', () => {
    const plus = rollExactly(newGame(ring(['coinPlus', 'empty'])), 1);
    expect(plus.players[0].coins).toBe(MUT.startCoins + RULES.turnIncome + RULES.coinPlus);

    const s0 = newGame(ring(['coinMinus', 'empty']));
    s0.players[0].coins = 1;
    expect(rollExactly(s0, 1).players[0].coins).toBe(0);
  });

  it('회복은 최대 HP를 넘지 않는다', () => {
    const s0 = newGame(ring(['heal', 'empty']));
    s0.players[0].hp = s0.players[0].maxHp - 1;
    expect(rollExactly(s0, 1).players[0].hp).toBe(s0.players[0].maxHp);
  });

  it('카드 칸에서 1장 뽑고, 손패가 가득 차면 버린다', () => {
    const s0 = newGame(ring(['card', 'empty']));
    expect(rollExactly(s0, 1).players[0].hand).toHaveLength(1);

    s0.players[0].hand = ['dash', 'dash', 'dash'];
    expect(rollExactly(s0, 1).players[0].hand).toHaveLength(RULES.handLimit);
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
    expect(s1.phase).toEqual({ kind: 'defend', enemy: s0.enemies[0].id, stepsLeft: 2 });
    expect(() => attack(s1)).toThrow(RuleError);
    expect(() => defend(s0, 'block')).toThrow(RuleError);

    const s2 = defend(s1, 'block');
    const counter = s2.battles.at(-1)!.events[1];
    expect(counter).toMatchObject({ type: 'attack', attacker: 'enemy', result: { mode: 'block' } });
    if (counter.type !== 'attack') throw new Error();
    expect(counter.result.damage).toBeGreaterThanOrEqual(1);
    expect(s2.players[0].hp).toBe(s2.players[0].maxHp - counter.result.damage);
    expect(counter.targetHp).toBe(s2.players[0].hp);
    expect(s2.players[0].tile).toBe(4);
    expect(s2.phase).toEqual({ kind: 'endTurn' });
  });

  it('회피: 내 주사위가 상대 공격 주사위보다 크면 피해 0, 아니면 공격값 전부', () => {
    for (let seed = 1; seed < 40; seed++) {
      const s0 = rollExactly(withEnemy(newGame(ring(empties(9)), { seed }), 'delinquent', 2), 4);
      s0.enemies[0].hp = s0.enemies[0].maxHp = 100;
      const s = defend(attack(s0), 'evade');
      const counter = s.battles.at(-1)!.events[1];
      if (counter.type !== 'attack') throw new Error();
      const r = counter.result;
      expect(r.defenseValue).toBe(r.defenseRoll); // 회피는 능력치 없이 주사위만
      expect(r.damage).toBe(r.defenseRoll > r.attackRoll ? 0 : r.attackValue);
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
        { id: 2, kind: 'spawn', x: 1, y: 1, next: [3] },
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
    expect(s.players[0].coins).toBe(11 + RULES.turnIncome);
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
      const counter = after.battles.at(-1)!.events[1];
      if (counter.type === 'attack' && want(counter.result.damage === 0)) return { before, after };
    }
    throw new Error('원하는 판을 못 찾음');
  }

  it('시작 능력치: 체력 9 · 공격력 1 · 방어력 0 · 코인 9 · 0성', () => {
    const p = newGame(ring(empties(5))).players[1];
    expect(p).toMatchObject({ character: 'mutbyeol', hp: 9, maxHp: 9, atk: 1, def: 0, coins: 9, level: 0 });
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
    const counter = after.battles.at(-1)!.events[1];
    if (counter.type !== 'attack') throw new Error();
    expect(counter.result.defenseRolls).toHaveLength(2);
    expect(counter.result.defenseRoll).toBe(Math.max(...counter.result.defenseRolls));
  });

  it('효과가 없으면 회피 주사위는 1개', () => {
    const { after } = counterCase({}, () => true);
    const counter = after.battles.at(-1)!.events[1];
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
    expect(on.battles.at(-1)!.events).toContainEqual({ type: 'skill', name: MUT.potential.name, damage: MUT.atk, targetHp: 100 - MUT.atk });

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
      { at: 1, actions: [{ type: 'summon', enemies: ['robot'] }] },
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

describe('카드', () => {
  it('질주: 이동 +2, 턴마다 1장만', () => {
    const s0 = newGame(ring(empties(12)));
    s0.players[0].hand = ['dash', 'dash'];
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    expect(s1.players[0].hand).toEqual(['dash']);
    expect(() => applyAction(s1, { type: 'PLAY_CARD', player: 0, handIndex: 0 })).toThrow(RuleError);

    const s2 = applyAction(s1, { type: 'ROLL', player: 0 });
    expect(s2.players[0].tile).toBe(s2.turn.dice[0] + RULES.dashSteps);
  });

  it('더블 주사위: 주사위 2개', () => {
    const s0 = newGame(ring(empties(12)));
    s0.players[0].hand = ['doubleDice'];
    let s = applyAction(s0, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    s = applyAction(s, { type: 'ROLL', player: 0 });
    expect(s.turn.dice).toHaveLength(2);
    expect(s.players[0].tile).toBe(s.turn.dice[0] + s.turn.dice[1]);
  });

  it('붕대: HP 회복', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].hand = ['bandage'];
    s0.players[0].hp = 3;
    const s = applyAction(s0, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    expect(s.players[0].hp).toBe(3 + RULES.bandageHeal);
  });

  it('주사위를 굴린 뒤에는 카드를 쓸 수 없다', () => {
    const s0 = newGame(ring(empties(12)));
    s0.players[0].hand = ['dash'];
    const s1 = applyAction(s0, { type: 'ROLL', player: 0 });
    expect(() => applyAction(s1, { type: 'PLAY_CARD', player: 0, handIndex: 0 })).toThrow(RuleError);
  });
});

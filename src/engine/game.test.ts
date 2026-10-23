import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../data/board';
import { applyAction, createGame, RuleError, validateBoard } from './game';
import { RULES } from './rules';
import type { Board, GameState, TileKind } from './types';

/** 0번 본부 + 나머지 칸이 한 바퀴로 이어진 보드 */
function ring(kinds: TileKind[]): Board {
  const all: TileKind[] = ['base', ...kinds];
  return {
    name: 'test',
    baseTile: 0,
    tiles: all.map((kind, id) => ({ id, kind, x: id, y: 0, next: [(id + 1) % all.length] })),
  };
}

function newGame(board: Board, players = 2, seed = 42): GameState {
  const setups = Array.from({ length: players }, (_, i) => ({ name: `P${i + 1}`, color: '#fff' }));
  return createGame({ board, players: setups, seed });
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

describe('createGame', () => {
  it('모두 본부에서 시작하고 첫 플레이어는 턴 수입을 받는다', () => {
    const s = newGame(ring(Array(5).fill('empty')), 3);
    expect(s.players.map((p) => p.tile)).toEqual([0, 0, 0]);
    expect(s.players[0].coins).toBe(RULES.startCoins + RULES.turnIncome);
    expect(s.players[1].coins).toBe(RULES.startCoins);
    expect(s.phase).toEqual({ kind: 'preRoll' });
    expect(s.round).toBe(1);
  });

  it('잘못된 보드는 거부한다', () => {
    const bad = ring(['empty']);
    bad.tiles[1].next = [99];
    expect(validateBoard(bad)).not.toEqual([]);
    expect(() => newGame(bad)).toThrow(RuleError);
  });

  it('기본 보드는 올바르다', () => {
    expect(validateBoard(DEFAULT_BOARD)).toEqual([]);
  });
});

describe('주사위와 이동', () => {
  it('주사위 눈만큼 이동하고 턴 종료 단계로 간다', () => {
    const s0 = newGame(ring(Array(12).fill('empty')));
    const s1 = applyAction(s0, { type: 'ROLL', player: 0 });
    const roll = s1.turn.dice[0];
    expect(roll).toBeGreaterThanOrEqual(1);
    expect(roll).toBeLessThanOrEqual(6);
    expect(s1.players[0].tile).toBe(roll);
    expect(s1.lastMove?.path).toEqual(Array.from({ length: roll + 1 }, (_, i) => i));
    expect(s1.phase).toEqual({ kind: 'endTurn' });
  });

  it('입력 state를 바꾸지 않는다', () => {
    const s0 = newGame(ring(Array(12).fill('empty')));
    const before = JSON.stringify(s0);
    applyAction(s0, { type: 'ROLL', player: 0 });
    expect(JSON.stringify(s0)).toBe(before);
  });

  it('같은 시드 + 같은 행동이면 결과가 같다', () => {
    const play = () => {
      let s = newGame(DEFAULT_BOARD, 2, 7);
      for (let i = 0; i < 20 && s.phase.kind !== 'gameOver'; i++) {
        if (s.phase.kind === 'preRoll') s = applyAction(s, { type: 'ROLL', player: s.current });
        else if (s.phase.kind === 'choosePath')
          s = applyAction(s, { type: 'CHOOSE_PATH', player: s.current, to: s.phase.options[0] });
        else s = applyAction(s, { type: 'END_TURN', player: s.current });
      }
      return s;
    };
    expect(play()).toEqual(play());
  });

  it('차례가 아닌 플레이어나 잘못된 단계의 행동은 거부한다', () => {
    const s0 = newGame(ring(Array(12).fill('empty')));
    expect(() => applyAction(s0, { type: 'ROLL', player: 1 })).toThrow(RuleError);
    expect(() => applyAction(s0, { type: 'END_TURN', player: 0 })).toThrow(RuleError);
    const s1 = applyAction(s0, { type: 'ROLL', player: 0 });
    expect(() => applyAction(s1, { type: 'ROLL', player: 0 })).toThrow(RuleError);
  });

  it('턴을 넘기면 다음 플레이어가 수입을 받고, 한 바퀴 돌면 라운드가 오른다', () => {
    let s = newGame(ring(Array(12).fill('empty')));
    s = finishTurn(s);
    expect(s.current).toBe(1);
    expect(s.players[1].coins).toBe(RULES.startCoins + RULES.turnIncome);
    expect(s.round).toBe(1);
    s = finishTurn(s);
    expect(s.current).toBe(0);
    expect(s.round).toBe(2);
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
  it('본부를 지나가면 코인을 내고 레벨업한다', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].coins = 25;
    const s = rollExactly(s0, 4); // 0 → 1 → 2 → 0(본부) → 1
    expect(s.players[0].tile).toBe(1);
    expect(s.players[0].level).toBe(2);
    expect(s.players[0].coins).toBe(5);
  });

  it('코인이 모자라면 레벨업하지 않는다', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].coins = 19;
    const s = rollExactly(s0, 3);
    expect(s.players[0].level).toBe(1);
    expect(s.players[0].coins).toBe(19);
  });

  it('레벨 3을 달성하면 그 자리에서 게임이 끝난다', () => {
    const s0 = newGame(ring(['empty', 'empty']));
    s0.players[0].level = 2;
    s0.players[0].coins = 40;
    const s = rollExactly(s0, 5);
    expect(s.phase).toEqual({ kind: 'gameOver', winner: 0 });
    expect(s.players[0].level).toBe(3);
    expect(s.players[0].tile).toBe(0);
    expect(() => applyAction(s, { type: 'END_TURN', player: 0 })).toThrow(RuleError);
  });
});

describe('칸 효과', () => {
  it('코인+ / 코인- (0 아래로는 안 내려간다)', () => {
    const plus = rollExactly(newGame(ring(['coinPlus'])), 1);
    expect(plus.players[0].coins).toBe(RULES.turnIncome + RULES.coinPlus);

    const s0 = newGame(ring(['coinMinus']));
    s0.players[0].coins = 1;
    expect(rollExactly(s0, 1).players[0].coins).toBe(0);
  });

  it('회복은 최대 HP를 넘지 않는다', () => {
    const s0 = newGame(ring(['heal']));
    s0.players[0].hp = s0.players[0].maxHp - 1;
    expect(rollExactly(s0, 1).players[0].hp).toBe(s0.players[0].maxHp);
  });

  it('카드 칸에서 1장 뽑고, 손패가 가득 차면 버린다', () => {
    const s0 = newGame(ring(['card']));
    expect(rollExactly(s0, 1).players[0].hand).toHaveLength(1);

    s0.players[0].hand = ['dash', 'dash', 'dash'];
    expect(rollExactly(s0, 1).players[0].hand).toHaveLength(RULES.handLimit);
  });

  it('몬스터를 처치하면 보상을 받는다', () => {
    const s0 = newGame(ring(['monster']));
    s0.players[0].atk = 100;
    const s = rollExactly(s0, 1);
    expect(s.players[0].coins).toBe(RULES.turnIncome + RULES.monster.reward);
    expect(s.players[0].hp).toBe(s.players[0].maxHp);
  });

  it('몬스터에게 KO 당하면 코인 절반을 잃고 본부로, 다음 턴에 부활한다', () => {
    const s0 = newGame(ring(['monster']));
    s0.players[0].atk = -10; // 피해 1 → 몬스터가 살아남아 반격
    s0.players[0].hp = 1;
    s0.players[0].coins = 11;

    let s = rollExactly(s0, 1);
    expect(s.players[0]).toMatchObject({ ko: true, hp: 0, tile: 0, coins: 6 });

    s = applyAction(s, { type: 'END_TURN', player: 0 });
    s = finishTurn(s);
    expect(s.current).toBe(0);
    expect(s.players[0]).toMatchObject({ ko: false, hp: s.players[0].maxHp, coins: 6 + RULES.turnIncome });
  });
});

describe('카드', () => {
  it('질주: 이동 +2, 턴마다 1장만', () => {
    const s0 = newGame(ring(Array(12).fill('empty')));
    s0.players[0].hand = ['dash', 'dash'];
    const s1 = applyAction(s0, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    expect(s1.players[0].hand).toEqual(['dash']);
    expect(() => applyAction(s1, { type: 'PLAY_CARD', player: 0, handIndex: 0 })).toThrow(RuleError);

    const s2 = applyAction(s1, { type: 'ROLL', player: 0 });
    expect(s2.players[0].tile).toBe(s2.turn.dice[0] + RULES.dashSteps);
  });

  it('더블 주사위: 주사위 2개', () => {
    const s0 = newGame(ring(Array(12).fill('empty')));
    s0.players[0].hand = ['doubleDice'];
    let s = applyAction(s0, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    s = applyAction(s, { type: 'ROLL', player: 0 });
    expect(s.turn.dice).toHaveLength(2);
    expect(s.players[0].tile).toBe(s.turn.dice[0] + s.turn.dice[1]);
  });

  it('붕대: HP 회복', () => {
    const s0 = newGame(ring(['empty']));
    s0.players[0].hand = ['bandage'];
    s0.players[0].hp = 3;
    const s = applyAction(s0, { type: 'PLAY_CARD', player: 0, handIndex: 0 });
    expect(s.players[0].hp).toBe(3 + RULES.bandageHeal);
  });

  it('주사위를 굴린 뒤에는 카드를 쓸 수 없다', () => {
    const s0 = newGame(ring(Array(12).fill('empty')));
    s0.players[0].hand = ['dash'];
    const s1 = applyAction(s0, { type: 'ROLL', player: 0 });
    expect(() => applyAction(s1, { type: 'PLAY_CARD', player: 0, handIndex: 0 })).toThrow(RuleError);
  });
});

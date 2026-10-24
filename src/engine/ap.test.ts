import { describe, expect, it } from 'vitest';
import { AP_BOARD_MAP } from '../data/apBoards';
import { AP_BOSSES, KING_GAWU, KID_GAWU, LION_GAWU, MAD_SCIENTIST, MASAO } from '../data/apMaps';
import { MAPS } from '../data/maps';
import { apAggro, apChallengeable, apIntent, apKill, apPass, apPrey, apTurnEnd } from './ap';
import { applyAction, createGame, forward, validateBoard } from './game';
import { hurtEnemy } from './boss';
import { createRng } from './rng';
import type { BossDef, GameState } from './types';

const game = (boss: BossDef, seed = 7): GameState =>
  createGame({
    board: MAPS[boss.map!],
    boss,
    players: [0, 1, 2, 3].map((i) => ({ name: `P${i + 1}`, color: '#fff', character: 'mutbyeol' as const })),
    seed,
  });

/** 다음 라운드 시작까지 모두 1칸씩 */
function nextRound(s: GameState): GameState {
  const round = s.round;
  for (let i = 0; i < 40 && s.round === round && s.phase.kind !== 'gameOver'; i++) {
    if (s.phase.kind === 'mapChoice') s = applyAction(s, { type: 'MAP_CHOICE', player: s.current, choice: s.phase.options[0].id });
    else if (s.phase.kind === 'preRoll') {
      s = structuredClone(s);
      s.turn.diceCount = 0;
      s.turn.extraSteps = 0;
      s = applyAction(s, { type: 'ROLL', player: s.current });
    } else if (s.phase.kind === 'endTurn') s = applyAction(s, { type: 'END_TURN', player: s.current });
    else if (s.phase.kind === 'encounter') s = applyAction(s, { type: 'ENCOUNTER', player: s.current, choice: 'release' });
    else if (s.phase.kind === 'choosePath') s = applyAction(s, { type: 'CHOOSE_PATH', player: s.current, to: s.phase.options[0] });
    else break;
  }
  return s;
}

describe('원작 협동 맵 보드', () => {
  it.each([
    ['dreama', 56],
    ['soul', 65],
    ['watertown', 56],
    ['academy', 48],
    ['academy-library', 48],
    ['academy-dessert', 42],
    ['dragonpalace', 54],
    ['ghostalley', 42],
    ['autumnwood', 56],
    ['garden', 44],
  ])('%s: 칸 %i개 · 길이 이어져 있다', (id, n) => {
    const board = AP_BOARD_MAP[id];
    expect(board.tiles).toHaveLength(n);
    expect(validateBoard(board)).toEqual([]);
    expect(board.homeTiles).toHaveLength(4);
    expect(board.tiles.every((t) => t.next.length >= 2)).toBe(true);
  });

  it('지나온 칸으로는 되돌아가지 않는다 · 시작 방향', () => {
    const s = game(KID_GAWU);
    const p = s.players[0];
    expect(s.board.tiles[forward(s, p)[0]].cell).toBe('C2');
    expect(forward(s, p)).toHaveLength(1);
  });

  it('8개 맵 모두 보스 고르기 목록에 있다', () => {
    expect(AP_BOSSES.map((b) => b.map)).toEqual(['dreama', 'soul', 'watertown', 'academy', 'dragonpalace', 'ghostalley', 'autumnwood', 'garden']);
  });
});

describe('몬스터 AI', () => {
  it('가장 가까운 캐릭터를 노린다 · 같으면 앞자리', () => {
    const s = game(KID_GAWU);
    const boss = { ...s.enemies[0], id: 98, isBoss: true, tile: s.players[2].tile };
    s.ap!.awake = true;
    expect(apPrey(s, boss)?.id).toBe(2);
    for (const p of s.players) p.tile = s.players[3].home;
    expect(apPrey(s, boss)?.id).toBe(0);
  });

  it('미리보기: 다음 차례 이동 · 스킬 준비', () => {
    let s = game(KING_GAWU);
    s.progress = 2;
    s = nextRound(s);
    const boss = s.enemies.find((e) => e.isBoss)!;
    expect(apIntent(s, boss).sleeping).toBe(true);
    s.ap!.awake = true;
    const it = apIntent(s, boss);
    expect(it.moves).toBe(true);
    expect(it.randomPrey).toBe(true);
    boss.st = { ...boss.st, prey: 1 };
    expect(apIntent(s, boss).prey).toBe(1);
    expect(apAggro(s).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('몬스터 차례는 몬스터마다 한 일을 차례대로 남긴다', () => {
    let s = game(KING_GAWU);
    s = nextRound(s);
    const acts = s.bossTurn?.acts ?? [];
    expect(acts.length).toBeGreaterThan(0);
    for (const a of acts) expect(a.path || a.skill || a.hits.length).toBeTruthy();
  });
});

describe('드리마', () => {
  it('진행도 3에 F1에서 잠든 채 등장 · 엘리트 해적 2 처치 → 방어력 -6', () => {
    let s = game(KING_GAWU);
    s.progress = 2;
    s = nextRound(s);
    const boss = s.enemies.find((e) => e.isBoss)!;
    expect(s.board.tiles[boss.tile].cell).toBe('F1');
    expect(s.ap!.awake).toBe(false);
    const rng = createRng(1);
    for (let i = 0; i < 2; i++) {
      const e = s.enemies.find((x) => x.kind === 'sharkPirate')!;
      apKill(s, rng, s.players[0], { ...e, kind: 'elitePirate' });
    }
    expect(s.ap!.vars.defDown).toBe(6);
  });
});

describe('영혼 축전', () => {
  it('검 영혼마다 방어력 +2 · 쓰러지면 마사오 체력 -10%', async () => {
    const { enemyDefAgainst } = await import('./skills');
    const s = game(MASAO);
    const boss = s.enemies.find((e) => e.isBoss)!;
    const base = enemyDefAgainst(s, s.players[0], boss);
    const sword = { ...s.enemies.find((e) => !e.isBoss)!, id: 99, kind: 'swordSpirit' as const };
    s.enemies.push(sword);
    expect(enemyDefAgainst(s, s.players[0], boss)).toBe(base + 2);
    const hp = boss.hp;
    s.enemies = s.enemies.filter((e) => e !== sword);
    apKill(s, createRng(1), s.players[0], sword);
    expect(boss.hp).toBe(hp - Math.ceil(boss.maxHp * 0.1));
  });
});

describe('워터 타운', () => {
  it('지휘대가 받은 피해는 사자 가우 체력에서 · 지휘대는 도전할 수 없다', () => {
    let s = game(LION_GAWU);
    s.progress = 2;
    s = nextRound(s);
    const lion = s.enemies.find((e) => e.isBoss)!;
    const platform = s.enemies.find((e) => e.kind === 'platform')!;
    expect(apChallengeable(s, platform)).toBe(false);
    hurtEnemy(s, createRng(1), platform, 5);
    expect(lion.hp).toBe(lion.maxHp - 5);
    expect(platform.hp).toBe(lion.hp);
  });
});

describe('유령 골목', () => {
  it('심도 개조가 남아 있으면 과학 괴인은 공격 · 지정할 수 없다 · 인공생명체를 쓰러뜨리면 -1', () => {
    const s = game(MAD_SCIENTIST);
    const boss = s.enemies.find((e) => e.isBoss)!;
    expect(apChallengeable(s, boss)).toBe(false);
    const synth = s.enemies.find((e) => e.kind === 'synth1')!;
    s.enemies = s.enemies.filter((e) => e !== synth);
    apKill(s, createRng(1), s.players[0], synth);
    expect(s.ap!.vars.shield).toBe(2);
  });

  it('개조가 0이 되면 지금 체력만큼 피해', () => {
    const s = game(MAD_SCIENTIST);
    const p = s.players[0];
    p.ap = { overclock: 1 };
    apTurnEnd(s, createRng(1), p);
    expect(p.ko).toBe(true);
  });
});

describe('가을숲 환상경', () => {
  it('건물 카드: 지을 수 있는 칸을 상점으로 · 건물 수 +1 · 이번 턴 카드 +1', () => {
    let s = game(KID_GAWU);
    s.players[0].hand = [{ card: 'moneyTree' }];
    const tile = s.board.buildable![0];
    s = applyAction(s, { type: 'PLAY_CARD', player: 0, handIndex: 0, target: tile });
    expect(s.board.tiles[tile].kind).toBe('shop');
    expect(s.ap!.tasks.build8).toBe(1);
    expect(s.turn.extraPlays).toBe(1);
  });
});

describe('정원 안뜰', () => {
  it('신비한 알 2개 → 라운드 끝에 원앙 루트 고르기', () => {
    let s = game(AP_BOSSES[7]);
    const eggs = s.marks.filter((m) => m.kind === 'egg');
    expect(eggs).toHaveLength(2);
    for (const m of eggs) apPass(s, createRng(1), s.players[0], m.tile);
    expect(s.ap!.done).toContain('eggs');
    s = nextRound(s);
    expect(s.phase.kind === 'mapChoice' || s.ap!.branch === 'lovebird').toBe(true);
  });

  it('온염: 차례 끝에 2 피해', () => {
    const s = game(AP_BOSSES[7]);
    const p = s.players[0];
    const hp = p.hp;
    p.ap = { flame: 1 };
    apTurnEnd(s, createRng(1), p);
    expect(p.hp).toBe(hp - 2);
  });
});

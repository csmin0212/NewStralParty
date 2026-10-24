import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../data/board';
import { BOSSES } from '../data/bosses';
import { CHARACTER_IDS } from '../data/characters';
import { createGame } from '../engine/game';
import type { GameState } from '../engine/types';
import { loadAccount, saveAccount, type Account } from './account';
import { applyMatch, bondRank, bondStep, matchRewards, teacherLevel } from './rules';

// vitest 기본 환경에는 localStorage가 없어서 메모리로 흉내 낸다
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  },
});

function finished(result: 'victory' | 'defeat'): GameState {
  const s = createGame({
    board: DEFAULT_BOARD,
    boss: BOSSES[0],
    players: [
      { name: 'A', color: '#fff', character: 'mutbyeol' },
      { name: 'B', color: '#fff', character: 'soda' },
    ],
    seed: 1,
  });
  s.phase = { kind: 'gameOver', result };
  s.round = 9;
  s.stats[1].bossDamage = 12;
  s.stats[0].kills = 3;
  return s;
}

describe('계정', () => {
  beforeEach(() => store.clear());

  it('처음 계정: 모든 학생 · 재화 없음. 저장하고 다시 읽는다', () => {
    const acc = loadAccount();
    expect(Object.keys(acc.students)).toEqual(CHARACTER_IDS);
    expect('credits' in acc).toBe(false);
    acc.exp = 123;
    acc.students.soda.skin = 'rider';
    saveAccount(acc);
    expect(loadAccount().exp).toBe(123);
    expect(loadAccount().students.soda.skin).toBe('rider');
  });

  it('옛 계정의 재화 칸은 버린다', () => {
    store.set('newparty.account.v1', JSON.stringify({ version: 1, credits: 9, pyroxene: 9, exp: 5, students: { mona: { owned: true, affection: 7 } } }));
    const acc = loadAccount();
    expect(acc.exp).toBe(5);
    expect(acc.students.mona).toEqual({ affection: 7 });
    expect('pyroxene' in acc).toBe(false);
  });

  it('깨진 저장은 새 계정으로', () => {
    store.set('newparty.account.v1', '{broken');
    expect(loadAccount().version).toBe(1);
  });
});

describe('인연 · 레벨', () => {
  it('호감도가 쌓이면 인연 랭크가 오른다', () => {
    expect(bondRank(0).rank).toBe(1);
    expect(bondRank(bondStep(1)).rank).toBe(2);
    expect(bondRank(bondStep(1) - 1)).toEqual({ rank: 1, into: bondStep(1) - 1, need: bondStep(1) });
    expect(bondRank(1e9).rank).toBe(20);
  });

  it('선생님 레벨', () => {
    expect(teacherLevel(0).level).toBe(1);
    expect(teacherLevel(100).level).toBe(2);
    expect(teacherLevel(299).level).toBe(2);
    expect(teacherLevel(300).level).toBe(3);
  });
});

describe('한 판의 기록', () => {
  beforeEach(() => store.clear());

  it('승리: 처음 처치 · MVP는 보스 피해가 가장 큰 사람 · 기록 · 호감도', () => {
    const acc: Account = loadAccount();
    const s = finished('victory');
    const r = matchRewards(s, acc);
    expect(r.victory).toBe(true);
    expect(r.firstClear).toBe(true);
    expect(r.mvp).toBe(1);
    applyMatch(acc, s, r);
    expect(acc.records[BOSSES[0].id].normal).toEqual({ clears: 1, bestRound: 9, tries: 1 });
    expect(acc.students.soda.affection).toBe(40);
    expect(acc.totals.wins).toBe(1);
    expect(matchRewards(s, acc).firstClear).toBe(false);
  });

  it('보스 피해가 없으면 MVP도 없다', () => {
    const s = finished('defeat');
    s.stats[1].bossDamage = 0;
    const r = matchRewards(s, loadAccount());
    expect(r.mvp).toBeNull();
    expect(r.affection.every((a) => a.amount === 15)).toBe(true);
  });

  it('패배: 기록은 시도만 는다', () => {
    const acc = loadAccount();
    const s = finished('defeat');
    applyMatch(acc, s, matchRewards(s, acc));
    expect(acc.records[BOSSES[0].id].normal).toEqual({ clears: 0, bestRound: null, tries: 1 });
  });
});

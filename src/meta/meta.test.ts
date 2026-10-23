import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../data/board';
import { BOSSES } from '../data/bosses';
import { createGame } from '../engine/game';
import type { GameState } from '../engine/types';
import { loadAccount, saveAccount, type Account } from './account';
import {
  ACHIEVEMENTS,
  applyMatch,
  ATTENDANCE,
  checkAttendance,
  bondRank,
  bondStep,
  DUPLICATE_CREDITS,
  FIRST_CLEAR_PYROXENE,
  grantStudent,
  matchRewards,
  recruit,
  SEASON_BONUS,
  seasonBoss,
  STUDENT_RARITY,
  teacherLevel,
} from './rules';

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

  it('처음 계정: 시작 학생을 가지고 재화가 있다. 저장하고 다시 읽는다', () => {
    const acc = loadAccount();
    expect(acc.students.mutbyeol.owned).toBe(true);
    expect(acc.pyroxene).toBeGreaterThan(0);
    acc.credits = 123;
    saveAccount(acc);
    expect(loadAccount().credits).toBe(123);
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

describe('모집', () => {
  beforeEach(() => store.clear());

  it('10회 모집은 ★2 이상을 하나는 준다', () => {
    const acc = loadAccount();
    const out = recruit(acc, 10, () => 0.99);
    expect(out).toHaveLength(10);
    expect(out.some((r) => r.rarity >= 2)).toBe(true);
    expect(acc.recruitPoints).toBe(10);
  });

  it('★1 학생이 없으면 ★1 칸은 선물이 된다', () => {
    const acc = loadAccount();
    const out = recruit(acc, 1, () => 0.99);
    expect(out[0].kind).toBe('gift');
    expect(Object.values(acc.gifts).reduce((a, n) => a + (n ?? 0), 0)).toBe(1);
  });

  it('가진 학생이 또 나오면 크레딧', () => {
    const acc = loadAccount();
    const before = acc.credits;
    const r = grantStudent(acc, 'mutbyeol');
    expect(r).toMatchObject({ kind: 'student', isNew: false, credits: DUPLICATE_CREDITS[STUDENT_RARITY.mutbyeol] });
    expect(acc.credits).toBe(before + DUPLICATE_CREDITS[STUDENT_RARITY.mutbyeol]);
  });
});

describe('한 판의 보상', () => {
  beforeEach(() => store.clear());

  it('승리: 처음 처치면 청휘석, MVP는 보스 피해가 가장 큰 사람, 기록 · 미션이 쌓인다', () => {
    const acc: Account = loadAccount();
    const s = finished('victory');
    const r = matchRewards(s, acc, '');
    expect(r.victory).toBe(true);
    expect(r.firstClear).toBe(true);
    expect(r.pyroxene).toBe(20 + FIRST_CLEAR_PYROXENE);
    expect(r.mvp).toBe(1);
    applyMatch(acc, s, r);
    expect(acc.records[BOSSES[0].id].normal).toEqual({ clears: 1, bestRound: 9, tries: 1 });
    expect(acc.daily.progress.win).toBe(1);
    expect(acc.students.soda.affection).toBe(40);
    // 두 번째 처치는 처음이 아니다
    expect(matchRewards(s, acc, '').firstClear).toBe(false);
    expect(ACHIEVEMENTS.find((a) => a.id === 'first-win')!.value(acc)).toBe(1);
  });

  it('보스 피해가 없으면 MVP도 없다', () => {
    const s = finished('defeat');
    s.stats[1].bossDamage = 0;
    const r = matchRewards(s, loadAccount(), '');
    expect(r.mvp).toBeNull();
    expect(r.affection.every((a) => a.amount === 15)).toBe(true);
  });

  it('패배: 기록은 시도만 늘고 청휘석은 없다', () => {
    const acc = loadAccount();
    const s = finished('defeat');
    const r = matchRewards(s, acc, '');
    expect(r.pyroxene).toBe(0);
    applyMatch(acc, s, r);
    expect(acc.records[BOSSES[0].id].normal).toEqual({ clears: 0, bestRound: null, tries: 1 });
  });
});

describe('출석', () => {
  beforeEach(() => store.clear());

  it('하루에 한 번, 7칸을 돌며 보상을 준다', () => {
    const acc = loadAccount();
    const pyro = acc.pyroxene;
    expect(checkAttendance(acc, '2026-10-24')).toBe(1);
    expect(acc.pyroxene).toBe(pyro + (ATTENDANCE[0].pyroxene ?? 0));
    expect(checkAttendance(acc, '2026-10-24')).toBeNull();
    for (let d = 25; d <= 30; d++) checkAttendance(acc, `2026-10-${d}`);
    expect(acc.attendance.day).toBe(7);
    expect(checkAttendance(acc, '2026-10-31')).toBe(1);
  });
});

describe('시즌', () => {
  beforeEach(() => store.clear());

  it('시즌 보스는 주마다 바뀌고, 그 보스를 잡으면 보상 ×1.5', () => {
    const a = seasonBoss(new Date(2026, 9, 19));
    const b = seasonBoss(new Date(2026, 9, 26));
    expect(a).not.toBe(b);
    expect(seasonBoss(new Date(2026, 9, 20))).toBe(a);
    const s = finished('victory');
    const normal = matchRewards(s, loadAccount(), '');
    const season = matchRewards(s, loadAccount(), s.boss.id);
    expect(season.season).toBe(true);
    expect(season.credits).toBe(Math.round(normal.credits * SEASON_BONUS));
  });
});

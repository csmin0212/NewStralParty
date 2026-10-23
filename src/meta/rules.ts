// 게임 밖 성장 규칙 (블루 아카이브: 청휘석 · 크레딧 · 모집 · 인연 랭크). 숫자는 여기만 고치면 된다.

import { BOSSES } from '../data/bosses';
import { CHARACTER_IDS } from '../data/characters';
import { DIFFICULTIES, type DifficultyId } from '../data/difficulty';
import type { CharacterId, GameState } from '../engine/types';
import { rollDaily, type Account } from './account';

// ───────── 학생 ─────────

/** 처음부터 가진 학생 */
export const STARTER_STUDENTS: CharacterId[] = [...CHARACTER_IDS];

/** 모집 등급 (★1~3). 새 캐릭터를 넣으면 여기에도 적는다 */
export const STUDENT_RARITY: Record<CharacterId, 1 | 2 | 3> = {
  mutbyeol: 3,
  soda: 2,
  mona: 2,
};

/** 겹친 학생 → 크레딧 */
export const DUPLICATE_CREDITS: Record<1 | 2 | 3, number> = { 1: 1000, 2: 3000, 3: 10000 };

// ───────── 인연 ─────────

export const MAX_BOND = 20;

/** 인연 랭크 r → r+1에 필요한 호감도 */
export function bondStep(rank: number): number {
  return 15 + rank * 15;
}

/** 호감도 → 인연 랭크 (1부터) · 이번 랭크에서 모은 양 · 다음까지 필요한 양 */
export function bondRank(affection: number): { rank: number; into: number; need: number } {
  let rank = 1;
  let left = affection;
  while (rank < MAX_BOND && left >= bondStep(rank)) {
    left -= bondStep(rank);
    rank += 1;
  }
  return { rank, into: rank >= MAX_BOND ? 0 : left, need: rank >= MAX_BOND ? 0 : bondStep(rank) };
}

// ───────── 선물 ─────────

export type GiftId = 'cookie' | 'flowers' | 'cake';

export const GIFTS: Record<GiftId, { name: string; icon: string; affection: number; price: number }> = {
  cookie: { name: '쿠키 상자', icon: '🍪', affection: 20, price: 1500 },
  flowers: { name: '꽃다발', icon: '💐', affection: 60, price: 4000 },
  cake: { name: '홀 케이크', icon: '🎂', affection: 150, price: 9000 },
};
export const GIFT_IDS = Object.keys(GIFTS) as GiftId[];

// ───────── 모집 ─────────

export const RECRUIT_COST = { one: 120, ten: 1200 };
/** 블루 아카이브 확률 (★3 3% · ★2 18.5% · ★1 78.5%) */
export const RECRUIT_RATES: [1 | 2 | 3, number][] = [
  [3, 0.03],
  [2, 0.185],
  [1, 0.785],
];
/** 모집 포인트: 1회마다 +1, 이만큼 모이면 ★3 학생 1명과 교환 */
export const RECRUIT_EXCHANGE = 200;

export type RecruitResult =
  | { kind: 'student'; id: CharacterId; rarity: 1 | 2 | 3; isNew: boolean; credits: number }
  | { kind: 'gift'; id: GiftId; rarity: 1 | 2 | 3 };

/** 모집 n회. random()은 [0,1) */
export function recruit(acc: Account, n: number, random: () => number = Math.random): RecruitResult[] {
  const out: RecruitResult[] = [];
  for (let i = 0; i < n; i++) {
    // 10회 모집의 마지막 칸은 ★2 이상 (원작)
    let roll = random();
    let rarity: 1 | 2 | 3 = 1;
    for (const [r, p] of RECRUIT_RATES) {
      if (roll < p) {
        rarity = r;
        break;
      }
      roll -= p;
    }
    if (n === 10 && i === 9 && rarity === 1 && !out.some((x) => x.rarity >= 2)) rarity = 2;
    const pool = CHARACTER_IDS.filter((id) => STUDENT_RARITY[id] === rarity);
    if (pool.length === 0) {
      out.push({ kind: 'gift', id: GIFT_IDS[Math.floor(random() * GIFT_IDS.length)], rarity });
      continue;
    }
    const id = pool[Math.floor(random() * pool.length)];
    out.push(grantStudent(acc, id));
  }
  acc.recruitPoints += n;
  for (const r of out) if (r.kind === 'gift') acc.gifts[r.id] = (acc.gifts[r.id] ?? 0) + 1;
  return out;
}

/** 학생을 받는다. 이미 있으면 크레딧으로 */
export function grantStudent(acc: Account, id: CharacterId): RecruitResult {
  const s = acc.students[id];
  const rarity = STUDENT_RARITY[id];
  if (!s.owned) {
    s.owned = true;
    return { kind: 'student', id, rarity, isNew: true, credits: 0 };
  }
  const credits = DUPLICATE_CREDITS[rarity];
  acc.credits += credits;
  return { kind: 'student', id, rarity, isNew: false, credits };
}

// ───────── 선생님 레벨 ─────────

/** 경험치 → 레벨 (레벨 n → n+1에 100 × n) */
export function teacherLevel(exp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = exp;
  while (left >= level * 100) {
    left -= level * 100;
    level += 1;
  }
  return { level, into: left, need: level * 100 };
}

// ───────── 한 판의 보상 ─────────

// ───────── 시즌 (블루 아카이브 총력전 시즌) ─────────

export const SEASON_BONUS = 1.5;

/** 이번 주 시즌 보스 id (월요일마다 바뀐다) */
export function seasonBoss(date: Date = new Date()): string {
  const monday = new Date(2024, 0, 1).getTime(); // 2024-01-01은 월요일
  const week = Math.floor((date.getTime() - monday) / (7 * 24 * 3600 * 1000));
  return BOSSES[((week % BOSSES.length) + BOSSES.length) % BOSSES.length].id;
}

export interface MatchRewards {
  victory: boolean;
  /** 시즌 보스 보상 배수가 붙었는지 */
  season: boolean;
  credits: number;
  pyroxene: number;
  exp: number;
  /** 처음 처치한 보스 · 난이도 */
  firstClear: boolean;
  /** 자리별 호감도 (같은 캐릭터를 여럿이 쓰면 합친다) */
  affection: { player: number; character: CharacterId; amount: number }[];
  mvp: number | null;
}

export const FIRST_CLEAR_PYROXENE = 60;

/** 끝난 판의 보상 (계정은 바꾸지 않는다) */
export function matchRewards(s: GameState, acc: Account, season = seasonBoss()): MatchRewards {
  const victory = s.phase.kind === 'gameOver' && s.phase.result === 'victory';
  const isSeason = s.boss.id === season;
  const mult = DIFFICULTIES[s.difficulty].reward * (isSeason ? SEASON_BONUS : 1);
  const kills = s.stats.reduce((a, x) => a + x.kills, 0);
  const firstClear = victory && !(acc.records[s.boss.id]?.[s.difficulty]?.clears ?? 0);
  // MVP: 보스 피해가 가장 큰 사람 (2인 이상, 보스 피해가 있을 때만)
  const top = s.stats.reduce((best, x, i) => (x.bossDamage > s.stats[best].bossDamage ? i : best), 0);
  const mvp = s.stats.length > 1 && s.stats[top].bossDamage > 0 ? top : null;
  return {
    victory,
    season: isSeason,
    credits: Math.round(((victory ? 3000 : 1000) + kills * 100) * mult),
    pyroxene: (victory ? 20 : 0) + (firstClear ? Math.round(FIRST_CLEAR_PYROXENE * mult) : 0),
    exp: Math.round((victory ? 120 : 50) * mult),
    firstClear,
    affection: s.players.map((p, i) => ({
      player: i,
      character: p.character,
      amount: (victory ? 30 : 15) + (mvp === i ? 10 : 0),
    })),
    mvp,
  };
}

/** 보상과 기록을 계정에 넣는다 */
export function applyMatch(acc: Account, s: GameState, r: MatchRewards) {
  acc.credits += r.credits;
  acc.pyroxene += r.pyroxene;
  acc.exp += r.exp;
  for (const a of r.affection) acc.students[a.character].affection += a.amount;
  const rec = ((acc.records[s.boss.id] ??= {})[s.difficulty] ??= { clears: 0, bestRound: null, tries: 0 });
  rec.tries += 1;
  if (r.victory) {
    rec.clears += 1;
    rec.bestRound = rec.bestRound === null ? s.round : Math.min(rec.bestRound, s.round);
  }
  const t = acc.totals;
  t.games += 1;
  if (r.victory) t.wins += 1;
  for (const x of s.stats) {
    t.kills += x.kills;
    t.bossDamage += x.bossDamage;
    t.cards += x.cardsUsed;
    t.breaks += x.breaks;
  }
  // 일일 미션
  rollDaily(acc);
  const d = acc.daily.progress;
  const add = (id: string, n: number) => (d[id] = (d[id] ?? 0) + n);
  add('play', 1);
  if (r.victory) add('win', 1);
  add('kills', s.stats.reduce((a, x) => a + x.kills, 0));
  add('cards', s.stats.reduce((a, x) => a + x.cardsUsed, 0));
  add('boss', s.stats.reduce((a, x) => a + x.bossDamage, 0));
  add('breaks', s.stats.reduce((a, x) => a + x.breaks, 0));
}

// ───────── 미션 ─────────

export interface Reward {
  credits?: number;
  pyroxene?: number;
  gift?: GiftId;
}

export interface Mission {
  id: string;
  name: string;
  goal: number;
  reward: Reward;
}

export const DAILY_MISSIONS: Mission[] = [
  { id: 'play', name: '총력전 1회', goal: 1, reward: { pyroxene: 20 } },
  { id: 'win', name: '보스 처치 1회', goal: 1, reward: { pyroxene: 40 } },
  { id: 'kills', name: '에너미 처치 15', goal: 15, reward: { credits: 3000 } },
  { id: 'cards', name: '카드 사용 20', goal: 20, reward: { credits: 2000 } },
  { id: 'boss', name: '보스에게 피해 30', goal: 30, reward: { gift: 'cookie' } },
  { id: 'breaks', name: '저지 · 부위 파괴 1회', goal: 1, reward: { pyroxene: 30 } },
];

export interface Achievement extends Mission {
  /** 지금 값 */
  value: (acc: Account) => number;
}

const clearedBosses = (acc: Account, levels?: DifficultyId[]) =>
  BOSSES.filter((b) =>
    Object.entries(acc.records[b.id] ?? {}).some(([lv, r]) => (r?.clears ?? 0) > 0 && (!levels || levels.includes(lv as DifficultyId))),
  ).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-win', name: '첫 보스 처치', goal: 1, reward: { pyroxene: 100 }, value: (a) => a.totals.wins },
  { id: 'boss-5', name: '보스 5종 처치', goal: 5, reward: { pyroxene: 300 }, value: (a) => clearedBosses(a) },
  { id: 'boss-all', name: `보스 ${BOSSES.length}종 처치`, goal: BOSSES.length, reward: { pyroxene: 600 }, value: (a) => clearedBosses(a) },
  { id: 'hardcore', name: 'HARDCORE 이상 처치', goal: 1, reward: { pyroxene: 300 }, value: (a) => clearedBosses(a, ['hardcore', 'extreme']) },
  { id: 'extreme', name: 'EXTREME 처치', goal: 1, reward: { pyroxene: 600 }, value: (a) => clearedBosses(a, ['extreme']) },
  { id: 'kills-100', name: '에너미 처치 100', goal: 100, reward: { credits: 30000 }, value: (a) => a.totals.kills },
  { id: 'breaks-20', name: '저지 · 부위 파괴 20', goal: 20, reward: { pyroxene: 200 }, value: (a) => a.totals.breaks },
  { id: 'games-30', name: '총력전 30회', goal: 30, reward: { gift: 'cake' }, value: (a) => a.totals.games },
  {
    id: 'bond-10',
    name: '인연 랭크 10',
    goal: 10,
    reward: { pyroxene: 200 },
    value: (a) => Math.max(...CHARACTER_IDS.map((id) => bondRank(a.students[id].affection).rank)),
  },
];

/** 출석 보상 7칸 (다 받으면 처음부터) */
export const ATTENDANCE: Reward[] = [
  { pyroxene: 20 },
  { credits: 5000 },
  { gift: 'cookie' },
  { pyroxene: 30 },
  { credits: 10000 },
  { gift: 'flowers' },
  { pyroxene: 100 },
];

/** 오늘 처음이면 출석 보상을 넣고 그 칸 번호(1~7)를, 이미 받았으면 null */
export function checkAttendance(acc: Account, date: string): number | null {
  if (acc.attendance.last === date) return null;
  const day = (acc.attendance.day % ATTENDANCE.length) + 1;
  acc.attendance = { last: date, day };
  grantReward(acc, ATTENDANCE[day - 1]);
  return day;
}

export function grantReward(acc: Account, r: Reward) {
  acc.credits += r.credits ?? 0;
  acc.pyroxene += r.pyroxene ?? 0;
  if (r.gift) acc.gifts[r.gift] = (acc.gifts[r.gift] ?? 0) + 1;
}

export function rewardText(r: Reward): string {
  return [
    r.pyroxene ? `청휘석 ${r.pyroxene}` : '',
    r.credits ? `크레딧 ${r.credits.toLocaleString()}` : '',
    r.gift ? GIFTS[r.gift].name : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

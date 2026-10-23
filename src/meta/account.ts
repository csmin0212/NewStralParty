// 계정: 게임 밖에서 쌓이는 것 (재화 · 학생 · 인연 · 기록 · 미션 · 도감). 이 기기의 localStorage 하나에 저장한다.
// 규칙(숫자 · 계산)은 meta/rules.ts, 화면은 ui/*Screen.ts.

import { CHARACTER_IDS } from '../data/characters';
import type { DifficultyId } from '../data/difficulty';
import type { CharacterId, EnemyKind } from '../engine/types';
import { GIFTS, type GiftId, STARTER_STUDENTS } from './rules';

export interface StudentRecord {
  owned: boolean;
  /** 호감도 경험치 (인연 랭크는 여기서 계산) */
  affection: number;
}

export interface BossRecord {
  clears: number;
  /** 가장 빨리 처치한 라운드 */
  bestRound: number | null;
  tries: number;
}

export interface Account {
  version: 1;
  credits: number;
  pyroxene: number;
  /** 선생님 레벨 경험치 */
  exp: number;
  students: Record<CharacterId, StudentRecord>;
  /** 보스 id → 난이도 → 기록 */
  records: Record<string, Partial<Record<DifficultyId, BossRecord>>>;
  gifts: Partial<Record<GiftId, number>>;
  /** 모집 포인트 (200이면 교환) */
  recruitPoints: number;
  /** 도감: 본 에너미 · 보스 */
  seenEnemies: EnemyKind[];
  seenBosses: string[];
  /** 미션: 날짜 (YYYY-MM-DD) · 오늘 진행 · 받은 것, 업적 받은 것 */
  daily: { date: string; progress: Record<string, number>; claimed: string[] };
  achievements: string[];
  /** 누적 기록 (업적용) */
  totals: { games: number; wins: number; kills: number; bossDamage: number; cards: number; breaks: number };
  /** 출석: 마지막으로 받은 날 · 몇 번째 칸 (1~7) */
  attendance: { last: string; day: number };
}

const KEY = 'newparty.account.v1';

function fresh(): Account {
  return {
    version: 1,
    credits: 5000,
    pyroxene: 1200,
    exp: 0,
    students: Object.fromEntries(
      CHARACTER_IDS.map((id) => [id, { owned: STARTER_STUDENTS.includes(id), affection: 0 }]),
    ) as Record<CharacterId, StudentRecord>,
    records: {},
    gifts: {},
    recruitPoints: 0,
    seenEnemies: [],
    seenBosses: [],
    daily: { date: '', progress: {}, claimed: [] },
    achievements: [],
    totals: { games: 0, wins: 0, kills: 0, bossDamage: 0, cards: 0, breaks: 0 },
    attendance: { last: '', day: 0 },
  };
}

/** 저장된 계정. 없거나 깨졌으면 새 계정, 새로 생긴 학생 · 칸은 채워 넣는다 */
export function loadAccount(): Account {
  const base = fresh();
  let saved: Partial<Account> | null = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (!saved || saved.version !== 1) return base;
  const acc: Account = {
    ...base,
    ...saved,
    totals: { ...base.totals, ...saved.totals },
    daily: { ...base.daily, ...saved.daily },
    attendance: { ...base.attendance, ...saved.attendance },
  };
  acc.students = { ...base.students };
  for (const id of CHARACTER_IDS) acc.students[id] = { ...base.students[id], ...saved.students?.[id] };
  for (const id of Object.keys(acc.gifts) as GiftId[]) if (!GIFTS[id]) delete acc.gifts[id];
  return acc;
}

export function saveAccount(acc: Account) {
  try {
    localStorage.setItem(KEY, JSON.stringify(acc));
  } catch {
    // 저장소를 못 쓰면 이번 실행 동안만
  }
}

/** 계정을 읽고 고친 뒤 저장한다 */
export function updateAccount<T>(fn: (acc: Account) => T): T {
  const acc = loadAccount();
  const out = fn(acc);
  saveAccount(acc);
  return out;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 날짜가 바뀌었으면 일일 미션을 새로 */
export function rollDaily(acc: Account) {
  const now = today();
  if (acc.daily.date === now) return;
  acc.daily = { date: now, progress: {}, claimed: [] };
}

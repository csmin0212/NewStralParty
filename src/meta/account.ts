// 계정: 게임 밖에서 쌓이는 것 (재화 · 학생 · 인연 · 기록 · 미션 · 도감). 이 기기의 localStorage 하나에 저장한다.
// 규칙(숫자 · 계산)은 meta/rules.ts, 화면은 ui/*Screen.ts.

import { CHARACTER_IDS } from '../data/characters';
import type { DifficultyId } from '../data/difficulty';
import type { CharacterId, EnemyKind } from '../engine/types';

export interface StudentRecord {
  /** 호감도 경험치 (인연 랭크는 여기서 계산) */
  affection: number;
  /** 고른 스킨 */
  skin?: string;
}

export interface BossRecord {
  clears: number;
  /** 가장 빨리 처치한 라운드 */
  bestRound: number | null;
  tries: number;
}

export interface Account {
  version: 1;
  /** 선생님 레벨 경험치 */
  exp: number;
  students: Record<CharacterId, StudentRecord>;
  /** 보스 id → 난이도 → 기록 */
  records: Record<string, Partial<Record<DifficultyId, BossRecord>>>;
  /** 도감: 본 에너미 · 보스 */
  seenEnemies: EnemyKind[];
  seenBosses: string[];
  /** 누적 기록 */
  totals: { games: number; wins: number; kills: number; bossDamage: number; cards: number; breaks: number };
}

const KEY = 'newparty.account.v1';

function fresh(): Account {
  return {
    version: 1,
    exp: 0,
    students: Object.fromEntries(CHARACTER_IDS.map((id) => [id, { affection: 0 }])) as Record<CharacterId, StudentRecord>,
    records: {},
    seenEnemies: [],
    seenBosses: [],
    totals: { games: 0, wins: 0, kills: 0, bossDamage: 0, cards: 0, breaks: 0 },
  };
}

/** 저장된 계정. 없거나 깨졌으면 새 계정, 새로 생긴 학생은 채워 넣는다 (옛 재화 칸은 버린다) */
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
    version: 1,
    exp: saved.exp ?? 0,
    students: { ...base.students },
    records: saved.records ?? {},
    seenEnemies: saved.seenEnemies ?? [],
    seenBosses: saved.seenBosses ?? [],
    totals: { ...base.totals, ...saved.totals },
  };
  for (const id of CHARACTER_IDS) {
    const x = saved.students?.[id];
    acc.students[id] = { affection: x?.affection ?? 0, ...(x?.skin ? { skin: x.skin } : {}) };
  }
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


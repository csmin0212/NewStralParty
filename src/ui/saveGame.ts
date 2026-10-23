import type { PlayerSetup } from '../engine/game';
import type { GameState } from '../engine/types';

/** 진행 중인 판 (이어하기). 상태가 JSON이라 통째로 넣는다 */
export interface SavedGame {
  version: 1;
  state: GameState;
  players: PlayerSetup[];
  savedAt: number;
}

const KEY = 'newparty.save.v1';

export function saveGame(state: GameState, players: PlayerSetup[]) {
  try {
    const data: SavedGame = { version: 1, state, players, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 저장소를 못 쓰면 이어하기만 안 된다
  }
}

export function loadGame(): SavedGame | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SavedGame | null;
    // 예전 형식 (보스 상태 · 기록이 없는 판)은 이어 하지 않는다
    if (!data || data.version !== 1 || !data.state?.bossState || !data.state.stats) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}

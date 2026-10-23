import type { GameState } from '../engine/types';

/** 화면 연출이 필요한 순간. 엔진은 상태만 바꾸므로, 행동 전후 상태를 비교해서 뽑아낸다 */
export type FxEvent =
  | { type: 'round'; round: number }
  | { type: 'turn'; player: number }
  | { type: 'skill'; player: number }
  | { type: 'coins'; player: number; delta: number }
  | { type: 'hp'; player: number; delta: number }
  | { type: 'cards'; player: number; delta: number }
  | { type: 'levelUp'; player: number; level: number }
  | { type: 'ko'; player: number }
  | { type: 'revive'; player: number }
  | { type: 'gameOver'; result: 'victory' | 'defeat' };

/** 이동 · 전투가 끝난 "결과"에 붙는 연출 (말이 도착한 뒤에 보여 준다) */
export function resultEvents(prev: GameState, next: GameState): FxEvent[] {
  const events: FxEvent[] = [];
  next.players.forEach((p, i) => {
    const before = prev.players[i];
    if (p.level > before.level) events.push({ type: 'levelUp', player: i, level: p.level });
    if (p.ko && !before.ko) events.push({ type: 'ko', player: i });
  });
  // 보스 등장은 기믹 알림(notice)으로 따로 들어오므로 여기서는 다루지 않는다
  if (next.phase.kind === 'gameOver' && prev.phase.kind !== 'gameOver') {
    events.push({ type: 'gameOver', result: next.phase.result });
  }
  return events;
}

/** 숫자 변화(코인 · HP)는 말 머리 위에 띄운다. 턴 수입처럼 차례가 바뀌며 생긴 변화도 여기서 잡힌다 */
export function deltaEvents(prev: GameState, next: GameState): FxEvent[] {
  const events: FxEvent[] = [];
  next.players.forEach((p, i) => {
    const before = prev.players[i];
    if (p.coins !== before.coins) events.push({ type: 'coins', player: i, delta: p.coins - before.coins });
    // KO는 따로 크게 보여 주므로 HP 변화는 살아 있을 때만
    if (p.hp !== before.hp && !p.ko && !before.ko) events.push({ type: 'hp', player: i, delta: p.hp - before.hp });
    // 손패가 늘었을 때만 (쓴 카드는 카드 연출이 따로 있다)
    if (p.hand.length > before.hand.length) events.push({ type: 'cards', player: i, delta: p.hand.length - before.hand.length });
  });
  return events;
}

/** 차례 · 라운드가 넘어갈 때의 연출 (턴 종료 직후) */
export function turnEvents(prev: GameState, next: GameState): FxEvent[] {
  const events: FxEvent[] = [];
  if (next.round > prev.round) events.push({ type: 'round', round: next.round });
  const newTurn = next.current !== prev.current || next.round !== prev.round;
  if (newTurn && next.phase.kind !== 'gameOver') {
    const p = next.players[next.current];
    if (prev.players[next.current].ko && !p.ko) events.push({ type: 'revive', player: next.current });
    events.push({ type: 'turn', player: next.current });
  }
  return events;
}

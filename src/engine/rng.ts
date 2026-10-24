// mulberry32: 상태가 32비트 정수 하나라서 GameState에 그대로 저장할 수 있다.

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [min, max] 정수 */
  int(min: number, max: number): number;
  d6(): number;
  /** 이동 주사위 (원작 1~10) */
  d10(): number;
  pick<T>(items: readonly T[]): T;
  readonly state: number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const rng: Rng = {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    d6() {
      return rng.int(1, 6);
    },
    d10() {
      return rng.int(1, 10);
    },
    pick(items) {
      return items[rng.int(0, items.length - 1)];
    },
    get state() {
      return s;
    },
  };
  return rng;
}

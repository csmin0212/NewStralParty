// 이 기기의 설정 (연출 속도 · 소리). 계정과 따로 둔다.

export type Speed = 'normal' | 'fast';
export type Volume = 'off' | 'low' | 'high';

interface Settings {
  speed: Speed;
  volume: Volume;
}

const KEY = 'newparty.settings.v1';

function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    const volume: Volume = s?.volume === 'off' || s?.volume === 'high' ? s.volume : 'low';
    return { speed: s?.speed === 'fast' ? 'fast' : 'normal', volume };
  } catch {
    return { speed: 'normal', volume: 'low' };
  }
}

let current = load();

export function getSpeed(): Speed {
  return current.speed;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // 저장이 막혀 있으면 이번 실행 동안만
  }
}

export function setSpeed(speed: Speed) {
  current = { ...current, speed };
  save();
}

export function getVolumeSetting(): Volume {
  return current.volume;
}

export function setVolume(volume: Volume) {
  current = { ...current, volume };
  save();
}

/** 효과음 크기 0 ~ 1 */
export function getVolume(): number {
  return current.volume === 'off' ? 0 : current.volume === 'low' ? 0.35 : 0.8;
}

/** 연출 시간 배수 (빠름 = 0.55배) */
export function pace(ms: number): number {
  return current.speed === 'fast' ? Math.round(ms * 0.55) : ms;
}

/** 연출 속도를 따르는 기다리기 */
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, pace(ms)));

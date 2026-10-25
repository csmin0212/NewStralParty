// 이 기기의 설정 (연출 속도 · 소리). 계정과 따로 둔다.

export type Speed = 'normal' | 'fast';
export type Volume = 'off' | 'low' | 'high';

interface Settings {
  speed: Speed;
  /** 효과음 */
  volume: Volume;
  /** 배경 음악 */
  bgm: Volume;
  /** 캐릭터 목소리 · 아나운서 */
  voice: Volume;
  announcer: Announcer;
}

export type Announcer = 'female' | 'male';

const KEY = 'newparty.settings.v1';

function load(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    const vol = (v: unknown): Volume => (v === 'off' || v === 'high' ? v : 'low');
    return {
      speed: s?.speed === 'fast' ? 'fast' : 'normal',
      volume: vol(s?.volume),
      bgm: vol(s?.bgm),
      voice: vol(s?.voice),
      announcer: s?.announcer === 'male' ? 'male' : 'female',
    };
  } catch {
    return { speed: 'normal', volume: 'low', bgm: 'low', voice: 'low', announcer: 'female' };
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

const level = (v: Volume, low: number, high: number) => (v === 'off' ? 0 : v === 'low' ? low : high);

/** 효과음 크기 0 ~ 1 */
export function getVolume(): number {
  return level(current.volume, 0.35, 0.8);
}

export function getBgmSetting(): Volume {
  return current.bgm;
}

export function setBgm(bgm: Volume) {
  current = { ...current, bgm };
  save();
  for (const fn of listeners) fn();
}

/** 배경 음악 크기 0 ~ 1 */
export function getBgmVolume(): number {
  return level(current.bgm, 0.22, 0.5);
}

export function getVoiceSetting(): Volume {
  return current.voice;
}

export function setVoice(voice: Volume) {
  current = { ...current, voice };
  save();
}

export function getAnnouncer(): Announcer {
  return current.announcer;
}

export function setAnnouncer(announcer: Announcer) {
  current = { ...current, announcer };
  save();
}

/** 목소리 크기 0 ~ 1 */
export function getVoiceVolume(): number {
  return level(current.voice, 0.5, 0.95);
}

const listeners: (() => void)[] = [];
/** 배경 음악 크기가 바뀌면 */
export function onBgmChange(fn: () => void) {
  listeners.push(fn);
}

/** 연출 시간 배수 (빠름 = 0.55배) */
export function pace(ms: number): number {
  return current.speed === 'fast' ? Math.round(ms * 0.55) : ms;
}

/** 연출 속도를 따르는 기다리기 */
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, pace(ms)));

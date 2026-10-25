// 배경 음악. public/assets/bgm/<곡>.ogg 를 반복 재생하고, 곡이 바뀌면 짧게 겹쳐 바꾼다 (docs/AUDIO.md).
// 브라우저는 사용자가 한 번 누른 뒤에야 소리를 내서, 그 전에 고른 곡은 첫 누름에 시작한다.

import { getBgmVolume, onBgmChange } from './settings';

const root = `${import.meta.env.BASE_URL}assets/bgm/`;
const FADE_MS = 700;

/** 원작 맵이 있는 곡 */
const MAPS = ['dreama', 'soul', 'watertown', 'academy', 'dragonpalace', 'ghostalley', 'autumnwood', 'garden'];

export type BgmId = 'lobby' | 'select' | 'result' | `map-${string}` | `boss-${string}`;

/** 맵 보드 곡 (없는 맵은 기본 곡) */
export function mapTrack(mapId: string | undefined): BgmId {
  return mapId && MAPS.includes(mapId.split('-')[0]) ? `map-${mapId.split('-')[0]}` : 'map-default';
}

/** 보스가 깨어난 뒤 곡 */
export function bossTrack(mapId: string | undefined): BgmId {
  return `boss-${mapId && MAPS.includes(mapId.split('-')[0]) ? mapId.split('-')[0] : 'ghostalley'}`;
}

/** 맵 환경음 (음악 아래 낮게): 바다 · 밤 · 숲 */
const AMBIENCE: Record<string, string> = {
  dreama: 'amb-waves',
  watertown: 'amb-waves',
  dragonpalace: 'amb-waves',
  soul: 'amb-crickets',
  ghostalley: 'amb-crickets',
  autumnwood: 'amb-forest',
  garden: 'amb-forest',
};
const AMB_LEVEL = 0.6;

/** 이 맵의 환경음 (없으면 null) */
export function ambienceOf(mapId: string | undefined): string | null {
  return (mapId && AMBIENCE[mapId.split('-')[0]]) || null;
}

let wantedAmb: string | null = null;
let amb: { id: string; el: HTMLAudioElement } | null = null;

function startAmb() {
  if (!unlocked || amb?.id === wantedAmb) return;
  const old = amb;
  if (old) fade(old.el, 0, () => old.el.pause());
  amb = null;
  const volume = getBgmVolume() * AMB_LEVEL;
  if (!wantedAmb || volume <= 0) return;
  const el = new Audio(`${root}${wantedAmb}.ogg`);
  el.loop = true;
  el.volume = 0;
  void el.play().catch(() => {});
  fade(el, volume);
  amb = { id: wantedAmb, el };
}

/** 환경음을 깐다. null이면 끈다 */
export function playAmbience(id: string | null) {
  wantedAmb = id;
  startAmb();
}

let wanted: BgmId | null = null;
let playing: { id: BgmId; el: HTMLAudioElement } | null = null;
let unlocked = false;

function fade(el: HTMLAudioElement, to: number, done?: () => void) {
  const from = el.volume;
  const start = performance.now();
  const step = () => {
    const t = Math.min(1, (performance.now() - start) / FADE_MS);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) setTimeout(step, 40);
    else done?.();
  };
  step();
}

function start() {
  if (!unlocked || !wanted || playing?.id === wanted) return;
  const old = playing;
  if (old) fade(old.el, 0, () => old.el.pause());
  const volume = getBgmVolume();
  if (volume <= 0) {
    playing = null;
    return;
  }
  const el = new Audio(`${root}${wanted}.ogg`);
  el.loop = true;
  el.volume = 0;
  void el.play().catch(() => {
    // 재생이 막혔으면 다음 누름에
    unlocked = false;
  });
  fade(el, volume);
  playing = { id: wanted, el };
}

/** 이 곡을 튼다 (같은 곡이면 그대로). null이면 끈다 */
export function playBgm(id: BgmId | null) {
  wanted = id;
  if (!id) {
    const old = playing;
    playing = null;
    if (old) fade(old.el, 0, () => old.el.pause());
    return;
  }
  start();
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    unlocked = true;
    start();
    startAmb();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  onBgmChange(() => {
    const volume = getBgmVolume();
    if (amb && volume > 0) amb.el.volume = volume * AMB_LEVEL;
    else if (amb) {
      amb.el.pause();
      amb = null;
    } else startAmb();
    if (playing && volume > 0) playing.el.volume = volume;
    else if (playing) {
      playing.el.pause();
      playing = null;
    } else start();
  });
}

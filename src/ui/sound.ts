// 효과음. 파일(SFX_ART, Kenney CC0)을 미리 풀어 두고, 아직 못 불러왔으면 WebAudio로 짧게 합성한다.
// 출처: public/assets/sfx/LICENSE-kenney.txt · 크기: 설정의 효과음 (끄기 · 작게 · 크게)

import { getVolume } from './settings';

export type SfxId =
  | 'click'
  | 'step'
  | 'dice'
  | 'coin'
  | 'hurt'
  | 'heal'
  | 'card'
  | 'turn'
  | 'boss'
  | 'warning'
  | 'levelup'
  | 'ko'
  | 'victory'
  | 'defeat';

const SFX_IDS: SfxId[] = ['click', 'step', 'dice', 'coin', 'hurt', 'heal', 'card', 'turn', 'boss', 'warning', 'levelup', 'ko', 'victory', 'defeat'];

/** 소리 파일 (public/assets/sfx/<id>.ogg, Kenney CC0 · docs/SYSTEMS.md 효과음 표) */
export const SFX_ART: Partial<Record<SfxId, string>> = Object.fromEntries(
  SFX_IDS.map((id) => [id, `${import.meta.env.BASE_URL}assets/sfx/${id}.ogg`]),
);

/** 풀어 둔 소리 */
const buffers = new Map<SfxId, AudioBuffer>();
let loading = false;

function preload(a: AudioContext) {
  if (loading) return;
  loading = true;
  for (const [id, url] of Object.entries(SFX_ART) as [SfxId, string][]) {
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(url))))
      .then((data) => a.decodeAudioData(data))
      .then((buf) => buffers.set(id, buf))
      .catch(() => {
        // 못 불러온 소리는 합성음으로
      });
  }
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  preload(ctx);
  return ctx;
}

// 브라우저는 사용자가 한 번 누른 뒤에야 소리를 낸다
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => audio(), { once: true });
}

/** 음 하나: 주파수 · 길이 · 파형 · 시작 지연 · 끝 주파수(미끄러짐) */
function tone(a: AudioContext, out: AudioNode, freq: number, dur: number, type: OscillatorType, at = 0, to?: number, gain = 0.25) {
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** 짧은 잡음 (주사위 · 카드) */
function noise(a: AudioContext, out: AudioNode, dur: number, at = 0, freq = 2000, gain = 0.2) {
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(out);
  src.start(t);
}

const SYNTH: Record<SfxId, (a: AudioContext, out: AudioNode) => void> = {
  click: (a, o) => tone(a, o, 1100, 0.05, 'sine', 0, undefined, 0.12),
  step: (a, o) => tone(a, o, 520, 0.06, 'triangle', 0, 600, 0.07),
  dice: (a, o) => {
    for (let i = 0; i < 5; i++) noise(a, o, 0.05, i * 0.07, 2600 + i * 300, 0.25);
  },
  coin: (a, o) => {
    tone(a, o, 988, 0.08, 'square', 0, undefined, 0.07);
    tone(a, o, 1319, 0.22, 'square', 0.07, undefined, 0.07);
  },
  hurt: (a, o) => tone(a, o, 220, 0.18, 'square', 0, 90, 0.12),
  heal: (a, o) => [660, 880, 1100].forEach((f, i) => tone(a, o, f, 0.14, 'sine', i * 0.06, undefined, 0.12)),
  card: (a, o) => noise(a, o, 0.18, 0, 4200, 0.12),
  turn: (a, o) => {
    tone(a, o, 784, 0.12, 'sine', 0, undefined, 0.12);
    tone(a, o, 1175, 0.2, 'sine', 0.08, undefined, 0.12);
  },
  boss: (a, o) => {
    tone(a, o, 110, 0.35, 'sawtooth', 0, 82, 0.14);
    tone(a, o, 165, 0.35, 'sawtooth', 0.02, 123, 0.08);
  },
  warning: (a, o) => {
    for (let i = 0; i < 3; i++) tone(a, o, 440, 0.18, 'square', i * 0.28, 330, 0.09);
  },
  levelup: (a, o) => [523, 659, 784, 1047].forEach((f, i) => tone(a, o, f, 0.18, 'triangle', i * 0.08, undefined, 0.16)),
  ko: (a, o) => tone(a, o, 440, 0.6, 'triangle', 0, 110, 0.16),
  victory: (a, o) =>
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(a, o, f, i === 5 ? 0.6 : 0.16, 'triangle', i * 0.12, undefined, 0.16)),
  defeat: (a, o) => [392, 349, 311, 262].forEach((f, i) => tone(a, o, f, 0.35, 'triangle', i * 0.22, undefined, 0.14)),
};

/** 효과음 하나 (기다리지 않는다) */
export function sfx(id: SfxId) {
  const volume = getVolume();
  if (volume <= 0) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  const master = a.createGain();
  master.gain.value = volume;
  master.connect(a.destination);
  const buf = buffers.get(id);
  if (buf) {
    const src = a.createBufferSource();
    src.buffer = buf;
    src.connect(master);
    src.start();
    return;
  }
  SYNTH[id](a, master);
}

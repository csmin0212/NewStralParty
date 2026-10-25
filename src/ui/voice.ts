// 캐릭터 목소리 · 아나운서. 파일은 public/assets/voice/<목소리>/<줄>.ogg (docs/AUDIO.md 출처 · 목록)
// 캐릭터 목소리는 자리마다 한 채널 (앞 소리를 끊는다), 아나운서는 따로 한 채널.

import type { CharacterId } from '../engine/types';
import { getAnnouncer, getVoiceVolume } from './settings';
import { playUrl, preloadUrls } from './sound';

/** 목소리 종류: 여성 셋 (cicifyre Type 1 · 2 · 3) · 남성 (HaelDB) */
export type VoiceKind = 'cute' | 'calm' | 'cool' | 'male';

/** 목소리가 나는 때 */
export type VoiceCue = 'attack' | 'hurt' | 'skill' | 'healed' | 'dodge' | 'ko';

/** 캐릭터마다 목소리 (바꾸려면 여기만) */
export const CHARACTER_VOICE: Record<CharacterId, VoiceKind> = {
  mutbyeol: 'calm',
  soda: 'cute',
  mona: 'cute',
  laurel: 'cool',
  parunan: 'calm',
  fanny: 'cute',
  alana: 'calm',
  komachi: 'cool',
  padman: 'male',
  papara: 'cute',
  ren: 'cute',
  mimi: 'cute',
  z3000: 'male',
  pandaman: 'male',
  inkshadow: 'cool',
  lulu: 'cute',
  fen: 'cool',
  haiqing: 'calm',
  misaki: 'cool',
  nardis: 'cool',
  jasmine: 'calm',
  al: 'male',
  luka: 'cool',
  nancy: 'calm',
  rin: 'cute',
  megas: 'male',
  zhao: 'calm',
  teru: 'calm',
  moses: 'male',
  mamushi: 'cool',
  bonnie: 'calm',
  lingling: 'cute',
  sykes: 'male',
  kangel: 'cute',
  ame: 'cute',
  jill: 'calm',
  dorothy: 'cute',
  hanna: 'cute',
  sherry: 'cool',
};

/** 액티브를 쓸 때 외치는 주문 (여성 목소리 파일 이름). 없으면 기합 */
const SKILL_LINE: Partial<Record<CharacterId, string>> = {
  soda: 'fire',
  mona: 'bubbles',
  laurel: 'hex',
  alana: 'cure',
  lulu: 'bubbles',
  haiqing: 'cyclone',
  nardis: 'water',
  zhao: 'wind',
  teru: 'burn',
  mamushi: 'corruption',
  hanna: 'freeze',
  sherry: 'hellstorm',
  kangel: 'twister',
  ren: 'heal',
  bonnie: 'curse',
  rin: 'aqua',
};

const root = `${import.meta.env.BASE_URL}assets/voice/`;
const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** 이 목소리 · 때에 고를 수 있는 파일 */
function lines(kind: VoiceKind, cue: VoiceCue, character?: CharacterId): string[] {
  if (kind === 'male') {
    const n = (name: string, count: number) => Array.from({ length: count }, (_, i) => `${name}${i + 1}`);
    if (cue === 'attack') return n('attack', 6);
    if (cue === 'hurt' || cue === 'ko') return n('damaged', 6);
    if (cue === 'skill') return n('skill', 4);
    if (cue === 'dodge') return n('jump', 3);
    return [];
  }
  const n = (name: string) => [1, 2, 3].map((i) => `${name}${i}`);
  switch (cue) {
    case 'attack':
      return n('attack');
    case 'hurt':
      return n('damaged');
    case 'ko':
      return ['damaged3'];
    case 'healed':
      return n('healed');
    case 'dodge':
      return n('jump');
    case 'skill': {
      const line = character && SKILL_LINE[character];
      return line ? [line] : n('attack');
    }
  }
}

/** 캐릭터 목소리 (자리마다 한 채널) */
export function say(character: CharacterId, cue: VoiceCue, seat = 0) {
  const kind = CHARACTER_VOICE[character] ?? 'calm';
  const list = lines(kind, cue, character);
  if (!list.length) return;
  void playUrl(`${root}${kind}/${pick(list)}.ogg`, getVoiceVolume(), `seat${seat}`);
}

/** 판에 나오는 캐릭터 목소리를 미리 풀어 둔다 */
export function preloadVoices(characters: CharacterId[]) {
  const cues: VoiceCue[] = ['attack', 'hurt', 'skill', 'healed', 'dodge'];
  const urls = characters.flatMap((c) => cues.flatMap((cue) => lines(CHARACTER_VOICE[c] ?? 'calm', cue, c).map((l) => `${root}${CHARACTER_VOICE[c] ?? 'calm'}/${l}.ogg`)));
  preloadUrls([...new Set(urls)]);
}

/** 아나운서 줄 (Kenney Voiceover · Fighter). 여성 목소리에 없는 줄은 비슷한 줄로 */
export type AnnounceLine =
  | 'ready'
  | 'go'
  | 'round'
  | 'final_round'
  | 'fight'
  | 'level_up'
  | 'power_up'
  | 'objective_achieved'
  | 'mission_completed'
  | 'mission_failed'
  | 'hurry_up'
  | 'war_look_out'
  | 'war_medic'
  | 'war_target_destroyed'
  | 'congratulations';

const FEMALE_FALLBACK: Partial<Record<AnnounceLine, AnnounceLine>> = { fight: 'go' };

/** 아나운서 (따로 한 채널). 숫자를 붙이면 그 뒤에 1~10을 읽는다 */
export function announce(line: AnnounceLine, number?: number) {
  const male = getAnnouncer() === 'male';
  const file = male ? line : (FEMALE_FALLBACK[line] ?? line);
  const dir = `${root}announcer-${male ? 'm' : 'f'}/`;
  void playUrl(`${dir}${file}.ogg`, getVoiceVolume(), 'announcer');
  if (number !== undefined && number >= 1 && number <= 10) {
    setTimeout(() => void playUrl(`${dir}${number}.ogg`, getVoiceVolume(), 'announcer'), 650);
  }
}

// ───────── 몬스터 울음 (rubberduck 80 CC0 creature SFX) ─────────

export type MonsterVoice = 'beast' | 'slime' | 'cute' | 'robot' | 'boss';
export type MonsterCue = 'attack' | 'hurt' | 'die';

/** 몬스터 종류마다 울음 (없으면 beast) */
const MONSTER_VOICE: Partial<Record<string, MonsterVoice>> = {
  slime: 'slime',
  jellyFighter: 'slime',
  jellyGuard: 'slime',
  jellyWizard: 'slime',
  robot: 'robot',
  drone: 'robot',
  automaton: 'robot',
  missile: 'robot',
  pillar: 'robot',
  ambientRobot: 'robot',
  platform: 'robot',
  snakeDragon: 'robot',
  synth1: 'robot',
  synth2: 'robot',
  synth3: 'robot',
  teapot: 'cute',
  mutantTeapot: 'cute',
  blueSpirit: 'cute',
  redSpirit: 'cute',
  pinata: 'cute',
  monkeyBox: 'cute',
  perorominion: 'cute',
  swallow: 'cute',
  waiter: 'cute',
  goldfish: 'cute',
  owl: 'cute',
  crab: 'cute',
  prawn: 'cute',
};

const MONSTER_COUNT: Record<MonsterVoice, Record<MonsterCue, number>> = {
  beast: { attack: 5, hurt: 5, die: 4 },
  slime: { attack: 3, hurt: 3, die: 2 },
  cute: { attack: 4, hurt: 4, die: 2 },
  robot: { attack: 4, hurt: 4, die: 4 },
  boss: { attack: 3, hurt: 4, die: 3 },
};

/** 몬스터 울음 (몬스터는 한 채널) */
export function growl(enemy: { kind: string; isBoss: boolean }, cue: MonsterCue) {
  const kind: MonsterVoice = enemy.isBoss ? 'boss' : (MONSTER_VOICE[enemy.kind] ?? 'beast');
  const i = 1 + Math.floor(Math.random() * MONSTER_COUNT[kind][cue]);
  void playUrl(`${root}monster/${kind}-${cue}${i}.ogg`, getVoiceVolume() * 0.8, 'monster');
}

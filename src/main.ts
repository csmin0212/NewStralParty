import './ui/style.css';
import './ui/fx.css';
import './ui/battle.css';
import './ui/lobby.css';
import './ui/cards.css';
import './ui/ingame.css';
import './ui/boss.css';
import './ui/meta.css';
import { BACKGROUND_ART } from './ui/assets';
import { renderCharacterScreen } from './ui/characterScreen';
import { startHotseat, type HotseatOptions } from './ui/hotseat';
import { renderLobby } from './ui/lobby';
import { watchUiScale } from './ui/stage';
import { renderSetup } from './ui/setup';
import { renderBossScreen } from './ui/bossScreen';
import { renderCodexScreen } from './ui/codexScreen';
import { loadGame } from './ui/saveGame';
import { playAmbience, playBgm } from './ui/bgm';
import { sfx } from './ui/sound';
import type { DifficultyId } from './data/difficulty';
import type { BossDef } from './engine/types';

document.documentElement.style.setProperty('--sky-art', `url("${BACKGROUND_ART}")`);

const root = document.querySelector<HTMLElement>('#app')!;
watchUiScale();

// 화면 흐름: 로비 → (캐릭터 · 도감) / (보스 · 난이도 → 인원 · 캐릭터 → 게임 → 결과) → 로비
// 버튼 · 탭 누르는 소리 (게임 안 행동 소리는 hotseat · 연출이 낸다)
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('button');
  if (!el || (el as HTMLButtonElement).disabled || el.closest('.hud, .battle')) return;
  sfx(el.classList.contains('ba-tab') ? 'page' : 'click');
});

function showLobby() {
  playBgm('lobby');
  playAmbience(null);
  renderLobby(root, {
    start: showBossSelect,
    resume: resumeGame,
    characters: showCharacters,
    codex: () => renderCodexScreen(root, showLobby),
  });
}

function showCharacters() {
  renderCharacterScreen(root, showLobby);
}

function showBossSelect() {
  playBgm('select');
  renderBossScreen(root, (boss, difficulty) => showSetup(boss, difficulty), showLobby);
}

function showSetup(boss: BossDef, difficulty: DifficultyId) {
  renderSetup(root, boss, difficulty, (players) => play({ players, boss, difficulty }), showBossSelect);
}

function play(opts: HotseatOptions) {
  startHotseat(root, opts, {
    exit: showLobby,
    retry: () => play({ ...opts, resume: undefined }),
  });
}

function resumeGame() {
  const saved = loadGame();
  if (!saved) return showLobby();
  play({ players: saved.players, boss: saved.state.boss, difficulty: saved.state.difficulty, resume: saved.state });
}

showLobby();

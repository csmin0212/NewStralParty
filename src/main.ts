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
import { renderDeckScreen } from './ui/deckScreen';
import { startHotseat, type HotseatOptions } from './ui/hotseat';
import { renderLobby } from './ui/lobby';
import { watchUiScale } from './ui/stage';
import { renderSetup } from './ui/setup';
import { renderBossScreen } from './ui/bossScreen';
import { renderCodexScreen } from './ui/codexScreen';
import { renderMissionScreen } from './ui/missionScreen';
import { renderRecruitScreen } from './ui/recruitScreen';
import { loadGame } from './ui/saveGame';
import { renderShopScreen } from './ui/shopScreen';
import type { DifficultyId } from './data/difficulty';
import type { BossDef } from './engine/types';

document.documentElement.style.setProperty('--sky-art', `url("${BACKGROUND_ART}")`);

const root = document.querySelector<HTMLElement>('#app')!;
watchUiScale();

// 화면 흐름: 로비 → (캐릭터 · 덱 · 모집 · 상점 · 미션 · 도감) / (보스 · 난이도 → 인원 · 캐릭터 → 게임 → 결과) → 로비
function showLobby() {
  renderLobby(root, {
    start: showBossSelect,
    resume: resumeGame,
    characters: showCharacters,
    deck: showDeck,
    recruit: () => renderRecruitScreen(root, showLobby),
    shop: () => renderShopScreen(root, showLobby),
    missions: () => renderMissionScreen(root, showLobby),
    codex: () => renderCodexScreen(root, showLobby),
  });
}

function showDeck() {
  renderDeckScreen(root, showLobby);
}

function showCharacters() {
  renderCharacterScreen(root, showLobby);
}

function showBossSelect() {
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

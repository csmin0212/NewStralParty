import './ui/style.css';
import './ui/fx.css';
import './ui/battle.css';
import './ui/lobby.css';
import './ui/cards.css';
import { BACKGROUND_ART } from './ui/assets';
import { renderCharacterScreen } from './ui/characterScreen';
import { renderDeckScreen } from './ui/deckScreen';
import { startHotseat } from './ui/hotseat';
import { renderLobby } from './ui/lobby';
import { watchUiScale } from './ui/stage';
import { renderSetup } from './ui/setup';

document.documentElement.style.setProperty('--sky-art', `url("${BACKGROUND_ART}")`);

const root = document.querySelector<HTMLElement>('#app')!;
watchUiScale();

// 화면 흐름: 로비 → (캐릭터 목록 · 상세) / (인원 · 캐릭터 고르기 → 게임) → 로비
function showLobby() {
  renderLobby(root, { start: showSetup, characters: showCharacters, deck: showDeck });
}

function showDeck() {
  renderDeckScreen(root, showLobby);
}

function showCharacters() {
  renderCharacterScreen(root, showLobby);
}

function showSetup() {
  renderSetup(root, (players) => startHotseat(root, players, showLobby), showLobby);
}

showLobby();

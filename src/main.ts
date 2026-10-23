import './ui/style.css';
import { BACKGROUND_ART } from './ui/assets';
import { startHotseat } from './ui/hotseat';
import { renderSetup } from './ui/setup';

document.documentElement.style.setProperty('--sky-art', `url("${BACKGROUND_ART}")`);

const root = document.querySelector<HTMLElement>('#app')!;

function showSetup() {
  renderSetup(root, (players) => startHotseat(root, players, showSetup));
}

showSetup();

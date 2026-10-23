import './ui/style.css';
import { startHotseat } from './ui/hotseat';
import { renderSetup } from './ui/setup';

const root = document.querySelector<HTMLElement>('#app')!;

function showSetup() {
  renderSetup(root, (players) => startHotseat(root, players, showSetup));
}

showSetup();

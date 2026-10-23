import type { BossDef } from '../engine/types';
import { movesTab, rulesTab } from './bossScreen';
import { getSpeed, getVolumeSetting, setSpeed, setVolume, type Speed, type Volume } from './settings';
import { sfx } from './sound';

/** 가운데 흰 판 (블루 아카이브 팝업): 남색 머리띠 + 내용 + 아래 버튼. 바깥을 누르면 닫힌다 */
function openModal(title: string, body: string, wide = false): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ba-modal';
  el.innerHTML = `
    <div class="bm-panel ${wide ? 'wide' : ''}">
      <div class="ba-band">${title}</div>
      <div class="bm-body">${body}</div>
    </div>`;
  el.addEventListener('click', (e) => {
    if (e.target === el || (e.target as HTMLElement).closest('[data-modal="close"]')) el.remove();
  });
  document.body.append(el);
  return el;
}

/** 설정: 연출 속도. exit가 있으면 (게임 중) 로비로 나가기 */
export function openSettings(on: { exit?: () => void } = {}) {
  const speeds: [Speed, string][] = [
    ['normal', '보통'],
    ['fast', '빠름'],
  ];
  const volumes: [Volume, string][] = [
    ['off', '끄기'],
    ['low', '작게'],
    ['high', '크게'],
  ];
  const render = () => `
    <div class="set-row">
      <b>연출 속도</b>
      <div class="ba-tabs">${speeds
        .map(([id, label]) => `<button class="ba-tab ${getSpeed() === id ? 'on' : ''}" data-speed="${id}">${label}</button>`)
        .join('')}</div>
    </div>
    <div class="set-row">
      <b>효과음</b>
      <div class="ba-tabs">${volumes
        .map(([id, label]) => `<button class="ba-tab ${getVolumeSetting() === id ? 'on' : ''}" data-volume="${id}">${label}</button>`)
        .join('')}</div>
    </div>
    <div class="bm-foot">
      ${on.exit ? '<button class="ba-btn ba-btn--sky" data-modal="exit">로비로 · 저장됨</button>' : ''}
      <button class="ba-btn ba-btn--yellow" data-modal="close">닫기</button>
    </div>`;
  const el = openModal('설정', render());
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const speed = t.closest<HTMLElement>('[data-speed]')?.dataset.speed as Speed | undefined;
    const volume = t.closest<HTMLElement>('[data-volume]')?.dataset.volume as Volume | undefined;
    if (speed) {
      setSpeed(speed);
      el.querySelector('.bm-body')!.innerHTML = render();
    }
    if (volume) {
      setVolume(volume);
      sfx('coin');
      el.querySelector('.bm-body')!.innerHTML = render();
    }
    if (t.closest('[data-modal="exit"]')) {
      el.remove();
      on.exit?.();
    }
  });
}

/** 게임 중 보스 정보: 행동 · 규칙 */
export function openBossInfo(boss: BossDef) {
  openModal(
    boss.name,
    `<div class="boss-info">${movesTab(boss)}${rulesTab(boss)}</div>
     <div class="bm-foot"><button class="ba-btn ba-btn--yellow" data-modal="close">닫기</button></div>`,
    true,
  );
}

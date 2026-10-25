import type { BossDef } from '../engine/types';
import { movesTab, rulesTab } from './bossScreen';
import { esc } from './html';
import {
  getAnnouncer,
  getBgmSetting,
  getSpeed,
  getVoiceSetting,
  getVolumeSetting,
  setAnnouncer,
  setBgm,
  setSpeed,
  setVoice,
  setVolume,
  type Announcer,
  type Speed,
  type Volume,
} from './settings';
import { announce } from './voice';
import { sfx } from './sound';

/** 가운데 흰 판 (블루 아카이브 팝업): 남색 머리띠 + 내용 + 아래 버튼. 바깥을 누르면 닫힌다 */
export function openModal(title: string, body: string, wide = false): HTMLElement {
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

/** 확인 · 취소 (브라우저 confirm 대신). 바깥 · Esc는 취소, Enter는 확인 */
export function askConfirm(title: string, text: string, ok = '확인', cancel = '취소'): Promise<boolean> {
  return new Promise((resolve) => {
    const el = openModal(
      esc(title),
      `<p class="bm-text">${esc(text)}</p>
       <div class="bm-foot">
         <button class="ba-btn ba-btn--sky" data-answer="0">${esc(cancel)}</button>
         <button class="ba-btn ba-btn--yellow" data-answer="1">${esc(ok)}</button>
       </div>`,
    );
    el.classList.add('ba-confirm');
    const done = (yes: boolean) => {
      document.removeEventListener('keydown', onKey, true);
      el.remove();
      resolve(yes);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      done(e.key === 'Enter');
    };
    document.addEventListener('keydown', onKey, true);
    el.addEventListener('click', (e) => {
      const answer = (e.target as HTMLElement).closest<HTMLElement>('[data-answer]')?.dataset.answer;
      if (answer !== undefined) done(answer === '1');
      else if (e.target === el) done(false);
    });
  });
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
  const announcers: [Announcer, string][] = [
    ['female', '여성'],
    ['male', '남성'],
  ];
  const row = (name: string, key: string, now: string, items: [string, string][]) => `
    <div class="set-row">
      <b>${name}</b>
      <div class="ba-tabs">${items.map(([id, label]) => `<button class="ba-tab ${now === id ? 'on' : ''}" data-${key}="${id}">${label}</button>`).join('')}</div>
    </div>`;
  const render = () => `
    ${row('연출 속도', 'speed', getSpeed(), speeds)}
    ${row('효과음', 'volume', getVolumeSetting(), volumes)}
    ${row('배경 음악', 'bgm', getBgmSetting(), volumes)}
    ${row('목소리', 'voice', getVoiceSetting(), volumes)}
    ${row('아나운서', 'announcer', getAnnouncer(), announcers)}
    <div class="bm-foot">
      ${on.exit ? '<button class="ba-btn ba-btn--sky" data-modal="exit">로비로 · 저장됨</button>' : ''}
      <button class="ba-btn ba-btn--yellow" data-modal="close">닫기</button>
    </div>`;
  const el = openModal('설정', render());
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const speed = t.closest<HTMLElement>('[data-speed]')?.dataset.speed as Speed | undefined;
    const volume = t.closest<HTMLElement>('[data-volume]')?.dataset.volume as Volume | undefined;
    const bgm = t.closest<HTMLElement>('[data-bgm]')?.dataset.bgm as Volume | undefined;
    const voice = t.closest<HTMLElement>('[data-voice]')?.dataset.voice as Volume | undefined;
    const who = t.closest<HTMLElement>('[data-announcer]')?.dataset.announcer as Announcer | undefined;
    if (bgm) setBgm(bgm);
    if (voice) setVoice(voice);
    if (who) setAnnouncer(who);
    if (voice || who) announce('ready');
    if (bgm || voice || who) el.querySelector('.bm-body')!.innerHTML = render();
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

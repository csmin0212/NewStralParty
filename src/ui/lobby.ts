import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import { loadAccount } from '../meta/account';
import { teacherLevel } from '../meta/rules';
import { openSettings } from './modal';
import { CHARACTER_MEMORIAL_ANIMATION, CHARACTER_MEMORIAL_ART, ENEMY_ART, UI_ART } from './assets';
import type { CharacterId } from '../engine/types';
import { loadGame } from './saveGame';
import { myArt } from './skins';

export interface LobbyHandlers {
  start: () => void;
  resume: () => void;
  characters: () => void;
  codex: () => void;
}

/**
 * 로비 (docs/REFERENCE.md 7번). 원작처럼
 *  - 화면 가득 배경 + 왼쪽에 대표 캐릭터 일러스트
 *  - 오른쪽에 기울어진 메뉴 카드 (캐릭터 얼굴이 크게)
 *  - 오른쪽 아래 큰 게임 시작, 아래 공지 띠
 */
/** 로비 배경 (메모리얼). 빈 곳을 누르면 다음 캐릭터 */
const BG_KEY = 'newparty.lobbyBg';
const BG_IDS = CHARACTER_IDS.filter((id) => CHARACTER_MEMORIAL_ART[id]);

function loadBg(): CharacterId {
  try {
    const id = localStorage.getItem(BG_KEY) as CharacterId | null;
    if (id && BG_IDS.includes(id)) return id;
  } catch {
    // 저장소를 못 쓰면 첫 캐릭터
  }
  return BG_IDS[0];
}

function saveBg(id: CharacterId) {
  try {
    localStorage.setItem(BG_KEY, id);
  } catch {
    // 무시
  }
}

function memorialLayer(id: CharacterId): string {
  const anim = CHARACTER_MEMORIAL_ANIMATION[id];
  return `
    <div class="lobby-bgl" data-bg="${id}">
      <img class="lobby-bg" src="${CHARACTER_MEMORIAL_ART[id]}" alt="" draggable="false">
      ${anim ? `<iframe class="lobby-memorial" src="${anim}" title="${CHARACTERS[id].name}" tabindex="-1" aria-hidden="true"></iframe>` : ''}
    </div>`;
}

export function renderLobby(root: HTMLElement, on: LobbyHandlers) {
  let bg = loadBg();
  const featured = CHARACTER_IDS[0];
  const c = CHARACTERS[featured];
  const art = myArt(featured);
  const acc = loadAccount();
  const lv = teacherLevel(acc.exp);
  const saved = loadGame();

  root.innerHTML = `
    <div class="lobby" style="--c:${c.color}">
      <div class="lobby-bgs">${memorialLayer(bg)}</div>
      <div class="stage">

      <header class="lobby-top">
        <img class="lobby-logo" src="${UI_ART.logo}" alt="NewParty">
        <div class="lobby-profile">
          <img src="${art.portrait}" alt="">
          <span class="lp-lv">Lv.<b>${lv.level}</b></span>
          <span class="lp-text"><b>선생님</b><i class="lp-exp"><b style="width:${(lv.into / lv.need) * 100}%"></b></i></span>
        </div>
      </header>
      <div class="lobby-cur"><button class="lobby-gear" data-go="settings" title="설정">⚙</button></div>

      <nav class="lobby-menu">
        <button class="menu-card menu-card--big" data-go="characters" style="--i:0">
          <img class="menu-art" src="${art.portrait}" alt="" draggable="false">
          <span class="menu-tab">CHARACTER</span>
          <b>캐릭터</b>
        </button>
        <button class="menu-card" data-go="codex" style="--i:1">
          <img class="menu-art menu-art--enemy" src="${ENEMY_ART.robot}" alt="" draggable="false">
          <span class="menu-tab">ENEMY</span>
          <b>도감</b>
        </button>
      </nav>

      ${saved ? `<button class="lobby-resume" data-go="resume"><small>CONTINUE</small><b>이어하기</b><span>${saved.state.boss.name} · ROUND ${saved.state.round}</span></button>` : ''}

      <button class="lobby-start" data-go="start" data-primary>
        <small>GAME START</small>
        <b>게임 시작</b>
      </button>

      ${
        BG_IDS.length > 1
          ? `<nav class="lobby-bgpick">${BG_IDS.map(
              (id) => `<button class="${id === bg ? 'on' : ''}" data-bg="${id}" title="${CHARACTERS[id].name}" style="--c:${CHARACTERS[id].color}"><img src="${myArt(id).portrait}" alt=""></button>`,
            ).join('')}</nav>`
          : ''
      }

      <footer class="lobby-news">
        <span class="news-tag">NEW</span>
        <p>신규 캐릭터 <b>${c.name}</b></p>
      </footer>
      <div class="lobby-toast"></div>
      </div>
    </div>`;

  const toast = root.querySelector<HTMLElement>('.lobby-toast')!;
  const lobby = root.querySelector<HTMLElement>('.lobby')!;
  const layers = root.querySelector<HTMLElement>('.lobby-bgs')!;
  const memorial = () => layers.querySelector<HTMLIFrameElement>('.lobby-bgl:last-child .lobby-memorial');
  lobby.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const rect = lobby.getBoundingClientRect();
    memorial()?.contentWindow?.postMessage({ type: 'newparty:memorial-pointer', x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }, location.origin);
  });
  lobby.addEventListener('pointerleave', () => {
    memorial()?.contentWindow?.postMessage({ type: 'newparty:memorial-pointer', reset: true }, location.origin);
  });

  /** 배경 바꾸기: 새 층을 위에 얹고, 그림이 뜨면 서서히 드러낸 뒤 옛 층을 치운다 */
  const showBg = (id: CharacterId) => {
    if (id === bg) return;
    bg = id;
    saveBg(id);
    for (const b of root.querySelectorAll<HTMLElement>('.lobby-bgpick button')) b.classList.toggle('on', b.dataset.bg === id);
    layers.insertAdjacentHTML('beforeend', memorialLayer(id));
    const layer = layers.lastElementChild as HTMLElement;
    layer.classList.add('fade');
    const img = layer.querySelector('img')!;
    // 이 층 아래 (더 옛) 층만 치운다. 그새 더 바꿨으면 위층은 남는다
    const clear = () => {
      while (layer.previousElementSibling) layer.previousElementSibling.remove();
    };
    const reveal = () => {
      void layer.offsetWidth;
      layer.classList.add('in');
      layer.addEventListener('transitionend', clear, { once: true });
      setTimeout(clear, 1500);
    };
    if (img.complete) reveal();
    else img.addEventListener('load', reveal, { once: true });
  };

  root.oninput = null;
  root.onclick = (e) => {
    const target = e.target as HTMLElement;
    const pick = target.closest<HTMLElement>('.lobby-bgpick [data-bg]');
    if (pick) {
      showBg(pick.dataset.bg as CharacterId);
      return;
    }
    // 메뉴 · 버튼이 아닌 빈 곳: 다음 배경
    if (!target.closest('button, a, input, header, nav, footer, .attend, .lobby-cur, [data-go]') && BG_IDS.length > 1) {
      showBg(BG_IDS[(BG_IDS.indexOf(bg) + 1) % BG_IDS.length]);
      return;
    }
    const go = target.closest<HTMLElement>('[data-go]')?.dataset.go;
    if (go === 'start') on.start();
    else if (go === 'resume') on.resume();
    else if (go === 'characters') on.characters();
    else if (go === 'codex') on.codex();
    else if (go === 'settings') openSettings();
    else if (go === 'soon') {
      toast.textContent = '아직 준비 중이에요';
      toast.classList.remove('show');
      void toast.offsetWidth;
      toast.classList.add('show');
    }
  };
}

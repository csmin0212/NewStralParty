import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import { CHARACTER_ART, ENEMY_ART, LOBBY_ART, UI_ART } from './assets';

export interface LobbyHandlers {
  start: () => void;
  characters: () => void;
  deck: () => void;
}

/**
 * 로비 (docs/REFERENCE.md 7번). 원작처럼
 *  - 화면 가득 배경 + 왼쪽에 대표 캐릭터 일러스트
 *  - 오른쪽에 기울어진 메뉴 카드 (캐릭터 얼굴이 크게)
 *  - 오른쪽 아래 큰 게임 시작, 아래 공지 띠
 */
export function renderLobby(root: HTMLElement, on: LobbyHandlers) {
  const featured = CHARACTER_IDS[0];
  const c = CHARACTERS[featured];
  const art = CHARACTER_ART[featured];

  root.innerHTML = `
    <div class="lobby" style="--c:${c.color}">
      <img class="lobby-bg" src="${LOBBY_ART.background}" alt="" draggable="false">
      <div class="lobby-shine"></div>
      <div class="stage">
      <img class="lobby-hero" src="${art.main}" alt="${c.name}" draggable="false">

      <header class="lobby-top">
        <img class="lobby-logo" src="${UI_ART.logo}" alt="NewParty">
        <div class="lobby-profile">
          <img src="${art.portrait}" alt="">
          <b>핫시트</b>
        </div>
      </header>

      <nav class="lobby-menu">
        <button class="menu-card menu-card--big" data-go="characters" style="--i:0">
          <img class="menu-art" src="${art.portrait}" alt="" draggable="false">
          <span class="menu-tab">CHARACTER</span>
          <b>캐릭터</b>
        </button>
        <button class="menu-card" data-go="soon" style="--i:1">
          <img class="menu-art menu-art--enemy" src="${ENEMY_ART.robot}" alt="" draggable="false">
          <span class="menu-tab">ENEMY</span>
          <b>에너미 도감</b>
          <i class="menu-lock">준비 중</i>
        </button>
        <button class="menu-card" data-go="deck" style="--i:2">
          <img class="menu-art menu-art--deck" src="${UI_ART.cardBack}" alt="" draggable="false">
          <span class="menu-tab">DECK</span>
          <b>덱 편성</b>
        </button>
      </nav>

      <button class="lobby-start" data-go="start" data-primary>
        <small>GAME START</small>
        <b>게임 시작</b>
      </button>

      <footer class="lobby-news">
        <span class="news-tag">NEW</span>
        <p>신규 캐릭터 <b>${c.name}</b></p>
      </footer>
      <div class="lobby-toast"></div>
      </div>
    </div>`;

  const toast = root.querySelector<HTMLElement>('.lobby-toast')!;
  root.oninput = null;
  root.onclick = (e) => {
    const go = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')?.dataset.go;
    if (go === 'start') on.start();
    else if (go === 'characters') on.characters();
    else if (go === 'deck') on.deck();
    else if (go === 'soon') {
      toast.textContent = '아직 준비 중이에요';
      toast.classList.remove('show');
      void toast.offsetWidth;
      toast.classList.add('show');
    }
  };
}

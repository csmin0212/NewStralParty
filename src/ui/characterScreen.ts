import { CHARACTER_IDS, CHARACTERS, type StatGrowth } from '../data/characters';
import type { CharacterId } from '../engine/types';
import { LOBBY_ART, UI_ART, type CharacterPose } from './assets';
import { chosenSkin, myArt, skinsOf } from './skins';
import { esc } from './html';
import { RULES } from '../engine/rules';
import { loadAccount, saveAccount } from '../meta/account';
import { bondRank } from '../meta/rules';

type View = 'list' | 'detail';
type Tab = 'skill' | 'skin' | 'bond' | 'growth' | 'potential' | 'profile';

const TABS: [Tab, string][] = [
  ['skill', '기본 정보'],
  ['skin', '스킨'],
  ['bond', '인연'],
  ['growth', '성장'],
  ['potential', '잠재 능력'],
  ['profile', '프로필'],
];

/** 목록 그리드를 채우는 빈 자리 수 (캐릭터가 늘면 줄어든다) */
const SLOTS = 8;

const POSE_NAMES: [CharacterPose, string][] = [
  ['idle', '대기'],
  ['attack', '공격'],
  ['hit', '피격'],
  ['block', '방어'],
  ['evade', '회피'],
  ['down', '쓰러짐'],
];

/**
 * 캐릭터 목록 · 상세. 원작(아스트랄 파티) 구성에 블루 아카이브 학생 정보 화면의 모양을 입혔다:
 * 왼쪽 일러스트 + 왼쪽 아래 남색 이름판, 오른쪽 밝은 회색 패널 · 남색 머리띠 · 기울어진 탭.
 */
export function renderCharacterScreen(root: HTMLElement, onBack: () => void) {
  let selected: CharacterId = CHARACTER_IDS[0];
  let view: View = 'list';
  let tab: Tab = 'skill';
  /** 히어로 그림이 바뀌었는지 (캐릭터 · 스킨) */
  let shown = '';

  const render = () => {
    const c = CHARACTERS[selected];
    const art = myArt(selected);
    const key = `${selected}:${chosenSkin(selected)}`;
    const swap = shown !== '' && shown !== key;
    shown = key;
    root.innerHTML = `
      <div class="chars" style="--c:${c.color}" data-view="${view}">
        <img class="chars-bg" src="${LOBBY_ART.room}" alt="" draggable="false">
        <div class="stage">
        <header class="ba-top">
          <button class="ba-back" data-act="back" title="뒤로"><i></i></button>
          <h2>${view === 'list' ? '캐릭터' : '캐릭터 정보'}</h2>
          <span class="ba-count"><b>${CHARACTER_IDS.length}</b> / ${SLOTS}</span>
        </header>

        <section class="chars-hero">
          <img class="hero-art${swap ? ' swap' : ''}" src="${art.main}" alt="${c.name}" draggable="false">
          <div class="nameplate">
            ${c.title ? `<small>${esc(c.title)}</small>` : ''}
            <b>${c.name}</b>
          </div>
        </section>

        <section class="ba-panel">${view === 'list' ? listPanel() : detailPanel(tab)}</section>
        </div>
      </div>`;
  };

  const listPanel = () => {
    const acc = loadAccount();
    const cards = CHARACTER_IDS.map((id) => {
      const c = CHARACTERS[id];
      const s = acc.students[id];
      return `
        <button class="char-card ${id === selected ? 'selected' : ''}" data-pick="${id}" style="--c:${c.color}">
          <span class="char-card-art"><img src="${myArt(id).portrait}" alt="" draggable="false">
            <i class="cc-bond">♥${bondRank(s.affection).rank}</i>
          </span>
          <span class="char-card-name">${c.name}</span>
        </button>`;
    });
    for (let i = CHARACTER_IDS.length; i < SLOTS; i++) {
      cards.push(`<div class="char-card locked"><span class="char-card-art"></span><span class="char-card-name">?</span></div>`);
    }
    return `
      <div class="ba-band">캐릭터 목록</div>
      <div class="char-grid">${cards.join('')}</div>
      <div class="panel-foot">
        <button class="ba-btn ba-btn--sky" data-act="detail">상세 정보</button>
      </div>`;
  };

  const detailPanel = (current: Tab) => {
    const c = CHARACTERS[selected];
    const art = myArt(selected);
    // 잠재 능력이 없는 캐릭터는 탭을 뺀다
    if (current === 'potential' && !c.potential) current = 'skill';
    const tabs = TABS.filter(([id]) => id !== 'potential' || c.potential)
      .map(([id, label]) => `<button class="ba-tab ${id === current ? 'on' : ''}" data-tab="${id}">${label}</button>`)
      .join('');

    let body = '';
    if (current === 'skill') {
      body = `
        <div class="ba-band">기본 능력치</div>
        <dl class="stat-table">
          <div><dt><img src="${UI_ART.heart}" alt="">체력</dt><dd>${c.hp}</dd></div>
          <div><dt><img src="${UI_ART.coin}" alt="">코인</dt><dd>${RULES.startCoins + (c.startBonus ?? 0)}</dd></div>
          <div><dt><span class="ico">⚔</span>공격력</dt><dd>${c.atk}</dd></div>
          <div><dt><span class="ico">🛡</span>방어력</dt><dd>${c.def}</dd></div>
        </dl>
        <div class="ba-band">스킬</div>
        ${skillCard('액티브', art.skillActive, c.active.name, c.active.description, `⏱ ${c.active.cooldown}`)}
        ${skillCard('패시브', art.skillPassive, c.passive.name, c.passive.description)}
        ${c.passive2 ? skillCard('패시브', art.skillPassive2, c.passive2.name, c.passive2.description) : ''}`;
    } else if (current === 'skin') {
      body = skinTab(selected);
    } else if (current === 'bond') {
      body = bondTab(selected);
    } else if (current === 'growth') {
      const rows = c.stars
        .map(
          (g, i) => `
          <li>
            <span class="stars">${starIcons(i + 1)}</span>
            <b>${i + 1}성</b>
            <span class="growth-gain">${growthText(g)}</span>
          </li>`,
        )
        .join('');
      body = `
        <div class="ba-band">성장</div>
        <ul class="growth-list">
          <li class="base"><span class="stars">${starIcons(0)}</span><b>기본</b><span>체력 ${c.hp} · 공격력 ${c.atk} · 방어력 ${c.def}</span></li>
          ${rows}
          ${c.startBonus ? `<li><span class="stars">🪙</span><b>시작</b><span class="growth-gain">코인 +${c.startBonus}</span></li>` : ''}
          <li><span class="stars">🔷</span><b>유물</b><span class="growth-gain">재선택 2 · 별마다 +1</span></li>
        </ul>`;
    } else if (current === 'potential' && c.potential) {
      body = `
        <div class="ba-band">잠재 능력</div>
        ${skillCard('잠재', art.potential, c.potential.name, c.potential.description)}`;
    } else {
      const poses = POSE_NAMES.map(
        ([p, label]) => `<figure><img src="${art.poses[p]}" alt="" draggable="false"><figcaption>${label}</figcaption></figure>`,
      ).join('');
      body = `
        <div class="ba-band">프로필</div>
        <div class="profile-row">
          <figure class="profile-token"><img src="${art.token}" alt="" draggable="false"></figure>
          <dl class="stat-table stat-table--one">
            <div><dt>이름</dt><dd>${c.name}</dd></div>
            <div><dt>대표 색</dt><dd><i class="swatch"></i>${c.color}</dd></div>
          </dl>
        </div>
        <div class="ba-band">전투 모습</div>
        <div class="pose-grid">${poses}</div>`;
    }

    return `
      <nav class="ba-tabs">${tabs}</nav>
      <div class="detail-body">${body}</div>`;
  };

  root.oninput = null;
  root.onclick = (e) => {
    const target = e.target as HTMLElement;
    const pick = target.closest<HTMLElement>('[data-pick]');
    const t = target.closest<HTMLElement>('[data-tab]');
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    const skin = target.closest<HTMLElement>('[data-skin]');
    if (skin) {
      const acc = loadAccount();
      acc.students[selected].skin = skin.dataset.skin;
      saveAccount(acc);
    } else if (pick) {
      // 이미 고른 카드를 한 번 더 누르면 상세로
      if (pick.dataset.pick === selected) view = 'detail';
      selected = pick.dataset.pick as CharacterId;
    } else if (t) {
      tab = t.dataset.tab as Tab;
    } else if (act === 'detail') {
      view = 'detail';
    } else if (act === 'back') {
      if (view === 'detail') view = 'list';
      else return onBack();
    } else return;
    render();
  };

  render();
}

/** 스킨: 고르면 로비 · 시작 화면 · 게임 그림이 바뀐다 */
function skinTab(id: CharacterId): string {
  const now = chosenSkin(id);
  const list = skinsOf(id);
  const cards = list
    .map(
      (s) => `
      <button class="skin-card ${s.id === now ? 'on' : ''}" data-skin="${s.id}">
        <span class="skin-art"><img src="${s.art.main}" alt="" draggable="false"></span>
        <span class="skin-foot"><img class="skin-token" src="${s.art.token}" alt="" draggable="false"><b>${esc(s.name)}</b>${s.id === now ? '<i>✔</i>' : ''}</span>
      </button>`,
    )
    .join('');
  return `
    <div class="ba-band">스킨 · ${list.length}</div>
    <div class="skin-grid">${cards}</div>`;
}

function skillCard(kind: string, icon: string | undefined, name: string, description: string, tag?: string): string {
  return `
    <div class="skill-card">
      ${icon ? `<img class="skill-icon" src="${icon}" alt="" draggable="false">` : `<span class="skill-icon skill-icon--blank">${esc(name.slice(0, 1))}</span>`}
      <div class="skill-text">
        <div class="skill-head"><small>${kind}</small>${tag ? `<span class="skill-tag">${tag}</span>` : ''}</div>
        <b>${esc(name)}</b>
        <p>${esc(description)}</p>
      </div>
    </div>`;
}

function starIcons(n: number): string {
  return [0, 1, 2].map((i) => `<img class="${i < n ? 'on' : ''}" src="${UI_ART.star}" alt="">`).join('');
}

function growthText(g: StatGrowth): string {
  const parts: string[] = [];
  if (g.maxHp) parts.push(`체력 +${g.maxHp}`);
  if (g.atk) parts.push(`공격력 +${g.atk}`);
  if (g.def) parts.push(`방어력 +${g.def}`);
  if (g.move) parts.push(`이동거리 +${g.move}`);
  if (g.coins) parts.push(`코인 +${g.coins}`);
  return parts.join(' · ');
}

/** 인연 랭크 · 호감도 (블루 아카이브 인연) */
function bondTab(id: CharacterId): string {
  const s = loadAccount().students[id];
  const b = bondRank(s.affection);
  const w = b.need ? (b.into / b.need) * 100 : 100;
  return `
    <div class="ba-band">인연</div>
    <div class="bond-head">
      <span class="bond-heart"><b>${b.rank}</b></span>
      <div class="bond-bar">
        <div><b>인연 랭크 ${b.rank}</b><span>${b.need ? `${b.into} / ${b.need}` : 'MAX'}</span></div>
        <i><b style="width:${w}%"></b></i>
      </div>
    </div>`;
}

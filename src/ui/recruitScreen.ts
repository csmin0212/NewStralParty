import { CHARACTER_IDS, CHARACTERS } from '../data/characters';
import type { CharacterId } from '../engine/types';
import { loadAccount, saveAccount, type Account } from '../meta/account';
import {
  DUPLICATE_CREDITS,
  GIFTS,
  grantStudent,
  recruit,
  RECRUIT_COST,
  RECRUIT_EXCHANGE,
  RECRUIT_RATES,
  STUDENT_RARITY,
  type RecruitResult,
} from '../meta/rules';
import { CHARACTER_ART, LOBBY_ART } from './assets';
import { creditIcon, currencyBar, pyroIcon } from './currency';
import { esc } from './html';

const rarityStars = (r: number) => '★'.repeat(r);

/** 모집 (블루 아카이브 모집 화면): 픽업 배너 · 1회 · 10회 · 모집 포인트 교환 */
export function renderRecruitScreen(root: HTMLElement, onBack: () => void) {
  // 배너 학생: 가장 높은 등급 중 첫 학생
  const featured: CharacterId = [...CHARACTER_IDS].sort((a, b) => STUDENT_RARITY[b] - STUDENT_RARITY[a])[0];
  let results: RecruitResult[] | null = null;
  let exchange = false;

  const render = () => {
    const acc = loadAccount();
    const c = CHARACTERS[featured];
    const art = CHARACTER_ART[featured];
    const pts = Math.min(acc.recruitPoints, RECRUIT_EXCHANGE);
    root.innerHTML = `
      <div class="chars recruit-screen">
        <img class="chars-bg" src="${LOBBY_ART.room}" alt="" draggable="false">
        <div class="stage">
          <header class="ba-top">
            <button class="ba-back" data-act="back" title="뒤로"><i></i></button>
            <h2>모집</h2>
            <div class="top-cur">${currencyBar(acc)}</div>
          </header>
          <section class="rc-banner" style="--c:${c.color}">
            <img class="rc-art" src="${art.main}" alt="" draggable="false">
            <div class="rc-info">
              <span class="rc-tag">PICK UP</span>
              <b class="rc-name">${c.name}</b>
              <span class="rc-stars">${rarityStars(STUDENT_RARITY[featured])}</span>
              <ul class="rc-rates">${RECRUIT_RATES.map(([r, p]) => `<li><span>${rarityStars(r)}</span><b>${(p * 100).toFixed(1).replace('.0', '')}%</b></li>`).join('')}</ul>
            </div>
          </section>
          <section class="rc-actions">
            <div class="rc-points">
              <span>모집 포인트</span><b>${pts}</b>/${RECRUIT_EXCHANGE}
              <i class="rc-pbar"><b style="width:${(pts / RECRUIT_EXCHANGE) * 100}%"></b></i>
              <button class="ba-btn ba-btn--sky rc-exchange" data-act="exchange" ${acc.recruitPoints >= RECRUIT_EXCHANGE ? '' : 'disabled'}>교환</button>
            </div>
            <div class="rc-buttons">
              <button class="rc-btn" data-pull="1" ${acc.pyroxene >= RECRUIT_COST.one ? '' : 'disabled'}>
                <b>1회 모집</b><span>${pyroIcon}${RECRUIT_COST.one}</span>
              </button>
              <button class="rc-btn rc-btn--ten" data-pull="10" ${acc.pyroxene >= RECRUIT_COST.ten ? '' : 'disabled'}>
                <b>10회 모집</b><span>${pyroIcon}${RECRUIT_COST.ten.toLocaleString()}</span>
              </button>
            </div>
          </section>
          ${results ? resultsHtml(results) : ''}
          ${exchange ? exchangeHtml(acc) : ''}
        </div>
      </div>`;
  };

  root.onclick = (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    const pull = t.closest<HTMLButtonElement>('[data-pull]');
    const pickEx = t.closest<HTMLElement>('[data-exchange]')?.dataset.exchange as CharacterId | undefined;
    if (act === 'back') {
      root.onclick = null;
      onBack();
    } else if (pull && !pull.disabled) {
      const n = Number(pull.dataset.pull);
      const acc = loadAccount();
      const cost = n === 10 ? RECRUIT_COST.ten : RECRUIT_COST.one;
      if (acc.pyroxene < cost) return;
      acc.pyroxene -= cost;
      results = recruit(acc, n);
      saveAccount(acc);
      render();
    } else if (act === 'close') {
      results = null;
      exchange = false;
      render();
    } else if (act === 'exchange') {
      exchange = true;
      render();
    } else if (pickEx) {
      const acc = loadAccount();
      if (acc.recruitPoints < RECRUIT_EXCHANGE) return;
      acc.recruitPoints -= RECRUIT_EXCHANGE;
      results = [grantStudent(acc, pickEx)];
      exchange = false;
      saveAccount(acc);
      render();
    }
  };

  render();
}

/** 결과: 카드가 한 장씩 뒤집힌다 (★3은 분홍 · ★2는 노랑 · ★1은 하늘) */
function resultsHtml(list: RecruitResult[]): string {
  const cards = list
    .map((r, i) => {
      const face =
        r.kind === 'student'
          ? `<img src="${CHARACTER_ART[r.id].portrait}" alt=""><b>${CHARACTERS[r.id].name}</b>${r.isNew ? '<em class="rr-new">NEW</em>' : `<span class="rr-eleph">${creditIcon}+${r.credits.toLocaleString()}</span>`}`
          : `<span class="rr-gift">${GIFTS[r.id].icon}</span><b>${GIFTS[r.id].name}</b>`;
      return `
        <div class="rr-card r${r.rarity}" style="--i:${i}">
          <div class="rr-back"></div>
          <div class="rr-face">${face}<span class="rr-stars">${rarityStars(r.rarity)}</span></div>
        </div>`;
    })
    .join('');
  return `
    <div class="rc-results">
      <div class="rr-grid ${list.length === 1 ? 'one' : ''}">${cards}</div>
      <button class="ba-btn ba-btn--yellow" data-act="close">확인</button>
    </div>`;
}

function exchangeHtml(acc: Account): string {
  const pool = CHARACTER_IDS.filter((id) => STUDENT_RARITY[id] === 3);
  return `
    <div class="rc-results">
      <div class="ex-panel">
        <div class="ba-band">모집 포인트 교환 · ${RECRUIT_EXCHANGE}</div>
        <div class="ex-list">
          ${pool
            .map(
              (id) => `
            <button class="ex-card" data-exchange="${id}">
              <img src="${CHARACTER_ART[id].portrait}" alt=""><b>${esc(CHARACTERS[id].name)}</b>
              <small>${acc.students[id].owned ? `보유 · 크레딧 +${DUPLICATE_CREDITS[3].toLocaleString()}` : 'NEW'}</small>
            </button>`,
            )
            .join('')}
        </div>
        <button class="ba-btn ba-btn--sky" data-act="close">닫기</button>
      </div>
    </div>`;
}

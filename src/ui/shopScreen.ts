import { loadAccount, saveAccount, type Account } from '../meta/account';
import { GIFT_IDS, GIFTS, type GiftId } from '../meta/rules';
import { LOBBY_ART } from './assets';
import { creditIcon, currencyBar, pyroIcon } from './currency';
import { esc } from './html';

type Tab = 'credit' | 'pyro';

interface Item {
  id: string;
  name: string;
  icon: string;
  /** 무엇으로 사는지 */
  pay: 'credits' | 'pyroxene';
  price: number;
  give: (acc: Account) => void;
  owned?: (acc: Account) => number;
}

const giftItem = (id: GiftId): Item => ({
  id: `gift-${id}`,
  name: GIFTS[id].name,
  icon: GIFTS[id].icon,
  pay: 'credits',
  price: GIFTS[id].price,
  give: (acc) => (acc.gifts[id] = (acc.gifts[id] ?? 0) + 1),
  owned: (acc) => acc.gifts[id] ?? 0,
});

const ITEMS: Record<Tab, Item[]> = {
  credit: GIFT_IDS.map(giftItem),
  pyro: [
    {
      id: 'credits-s',
      name: '크레딧 20,000',
      icon: '💰',
      pay: 'pyroxene',
      price: 60,
      give: (acc) => (acc.credits += 20000),
    },
    {
      id: 'credits-l',
      name: '크레딧 100,000',
      icon: '🏦',
      pay: 'pyroxene',
      price: 240,
      give: (acc) => (acc.credits += 100000),
    },
    {
      id: 'gift-box',
      name: '선물 상자 (홀 케이크 ×2)',
      icon: '🎁',
      pay: 'pyroxene',
      price: 120,
      give: (acc) => (acc.gifts.cake = (acc.gifts.cake ?? 0) + 2),
      owned: (acc) => acc.gifts.cake ?? 0,
    },
  ],
};

/** 상점 (블루 아카이브 상점): 크레딧 · 청휘석 탭, 카드 칸 */
export function renderShopScreen(root: HTMLElement, onBack: () => void) {
  let tab: Tab = 'credit';
  let bought = '';

  const render = () => {
    const acc = loadAccount();
    const items = ITEMS[tab]
      .map((it) => {
        const can = (it.pay === 'credits' ? acc.credits : acc.pyroxene) >= it.price;
        const n = it.owned?.(acc);
        return `
          <div class="store-item ${bought === it.id ? 'bought' : ''}">
            <span class="si-icon">${it.icon}</span>
            <b class="si-name">${esc(it.name)}</b>
            ${n !== undefined ? `<small class="si-owned">보유 ${n}</small>` : ''}
            <button class="si-buy" data-buy="${it.id}" ${can ? '' : 'disabled'}>
              ${it.pay === 'credits' ? creditIcon : pyroIcon}<b>${it.price.toLocaleString()}</b>
            </button>
          </div>`;
      })
      .join('');
    root.innerHTML = `
      <div class="chars shop-screen">
        <img class="chars-bg" src="${LOBBY_ART.room}" alt="" draggable="false">
        <div class="stage">
          <header class="ba-top">
            <button class="ba-back" data-act="back" title="뒤로"><i></i></button>
            <h2>상점</h2>
            <div class="top-cur">${currencyBar(acc)}</div>
          </header>
          <section class="ba-panel meta-panel">
            <nav class="ba-tabs">
              <button class="ba-tab ${tab === 'credit' ? 'on' : ''}" data-tab="credit">일반</button>
              <button class="ba-tab ${tab === 'pyro' ? 'on' : ''}" data-tab="pyro">청휘석</button>
            </nav>
            <div class="shop-grid">${items}</div>
          </section>
        </div>
      </div>`;
  };

  root.onclick = (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    const tabBtn = t.closest<HTMLElement>('[data-tab]');
    const buy = t.closest<HTMLButtonElement>('[data-buy]');
    if (act === 'back') {
      root.onclick = null;
      onBack();
    } else if (tabBtn) {
      tab = tabBtn.dataset.tab as Tab;
      bought = '';
      render();
    } else if (buy && !buy.disabled) {
      const it = ITEMS[tab].find((x) => x.id === buy.dataset.buy)!;
      const acc = loadAccount();
      const wallet = it.pay === 'credits' ? 'credits' : 'pyroxene';
      if (acc[wallet] < it.price) return;
      acc[wallet] -= it.price;
      it.give(acc);
      saveAccount(acc);
      bought = it.id;
      render();
    }
  };

  render();
}

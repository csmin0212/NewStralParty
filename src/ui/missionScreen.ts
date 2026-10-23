import { loadAccount, rollDaily, saveAccount, type Account } from '../meta/account';
import { ACHIEVEMENTS, DAILY_MISSIONS, grantReward, rewardText, type Mission } from '../meta/rules';
import { LOBBY_ART } from './assets';
import { currencyBar } from './currency';
import { esc } from './html';

type Tab = 'daily' | 'achievements';

/** 미션 (블루 아카이브 과제): 일일 · 업적, 받기 · 모두 받기 */
export function renderMissionScreen(root: HTMLElement, onBack: () => void) {
  let tab: Tab = 'daily';

  const rows = (acc: Account) => {
    const list: { m: Mission; value: number; done: boolean }[] =
      tab === 'daily'
        ? DAILY_MISSIONS.map((m) => ({ m, value: acc.daily.progress[m.id] ?? 0, done: acc.daily.claimed.includes(m.id) }))
        : ACHIEVEMENTS.map((a) => ({ m: a, value: a.value(acc), done: acc.achievements.includes(a.id) }));
    return list;
  };

  const render = () => {
    const acc = loadAccount();
    rollDaily(acc);
    const list = rows(acc);
    const ready = list.filter((x) => !x.done && x.value >= x.m.goal).length;
    const html = list
      .map(({ m, value, done }) => {
        const ok = !done && value >= m.goal;
        const w = Math.min(100, (value / m.goal) * 100);
        return `
          <li class="ms-row ${done ? 'done' : ok ? 'ready' : ''}">
            <div class="ms-main">
              <b>${esc(m.name)}</b>
              <div class="ms-progress"><i><b style="width:${w}%"></b></i><span>${Math.min(value, m.goal)}/${m.goal}</span></div>
            </div>
            <span class="ms-reward">${esc(rewardText(m.reward))}</span>
            <button class="ms-claim" data-claim="${m.id}" ${ok ? '' : 'disabled'}>${done ? '완료' : '받기'}</button>
          </li>`;
      })
      .join('');
    root.innerHTML = `
      <div class="chars mission-screen">
        <img class="chars-bg" src="${LOBBY_ART.room}" alt="" draggable="false">
        <div class="stage">
          <header class="ba-top">
            <button class="ba-back" data-act="back" title="뒤로"><i></i></button>
            <h2>미션</h2>
            <div class="top-cur">${currencyBar(acc)}</div>
          </header>
          <section class="ba-panel meta-panel">
            <nav class="ba-tabs">
              <button class="ba-tab ${tab === 'daily' ? 'on' : ''}" data-tab="daily">일일</button>
              <button class="ba-tab ${tab === 'achievements' ? 'on' : ''}" data-tab="achievements">업적</button>
            </nav>
            <ul class="ms-list">${html}</ul>
            <div class="panel-foot">
              <button class="ba-btn ba-btn--yellow" data-act="all" ${ready ? '' : 'disabled'}>모두 받기</button>
            </div>
          </section>
        </div>
      </div>`;
  };

  const claim = (acc: Account, id: string) => {
    if (tab === 'daily') {
      const m = DAILY_MISSIONS.find((x) => x.id === id);
      if (!m || acc.daily.claimed.includes(id) || (acc.daily.progress[id] ?? 0) < m.goal) return;
      acc.daily.claimed.push(id);
      grantReward(acc, m.reward);
    } else {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a || acc.achievements.includes(id) || a.value(acc) < a.goal) return;
      acc.achievements.push(id);
      grantReward(acc, a.reward);
    }
  };

  root.onclick = (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    const tabBtn = t.closest<HTMLElement>('[data-tab]');
    const claimBtn = t.closest<HTMLButtonElement>('[data-claim]');
    if (act === 'back') {
      root.onclick = null;
      onBack();
    } else if (tabBtn) {
      tab = tabBtn.dataset.tab as Tab;
      render();
    } else if (claimBtn && !claimBtn.disabled) {
      const acc = loadAccount();
      rollDaily(acc);
      claim(acc, claimBtn.dataset.claim!);
      saveAccount(acc);
      render();
    } else if (act === 'all') {
      const acc = loadAccount();
      rollDaily(acc);
      for (const x of rows(acc)) if (!x.done && x.value >= x.m.goal) claim(acc, x.m.id);
      saveAccount(acc);
      render();
    }
  };

  render();
}

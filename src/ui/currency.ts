import type { Account } from '../meta/account';

/** 오른쪽 위 재화 (블루 아카이브: 크레딧 · 청휘석) */
export function currencyBar(acc: Account): string {
  return `
    <div class="cur-bar">
      <span class="cur cur-credit" title="크레딧"><i class="cur-icon credit"></i><b>${acc.credits.toLocaleString()}</b></span>
      <span class="cur cur-pyro" title="청휘석"><i class="cur-icon pyro"></i><b>${acc.pyroxene.toLocaleString()}</b></span>
    </div>`;
}

export const creditIcon = '<i class="cur-icon credit"></i>';
export const pyroIcon = '<i class="cur-icon pyro"></i>';

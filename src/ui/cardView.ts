import { CARD_TYPE_NAMES, CARDS } from '../data/cards';
import type { CardId } from '../engine/types';
import { CARD_ART, UI_ART } from './assets';

/**
 * 카드 한 장의 앞면. 덱 화면 · 손패 · 전투 선택지 · 덱 정비에서 같이 쓴다.
 * 위 띠는 종류 색 (부스트 하늘 · 지원 민트 · 이벤트 보라 · 전투 분홍), 왼쪽 위에 비용.
 */
export function cardFace(id: CardId, opts: { count?: number; tag?: string } = {}): string {
  const c = CARDS[id];
  const art = CARD_ART[id];
  const timing = c.type === 'battle' ? (c.timing === 'attack' ? '공격' : '반격') : '';
  return `
    <span class="cf cf--${c.type}">
      <span class="cf-band">${CARD_TYPE_NAMES[c.type]}${timing ? `<i>${timing}</i>` : ''}</span>
      ${c.cost ? `<span class="cf-cost"><img src="${UI_ART.coin}" alt="">${c.cost}</span>` : ''}
      ${opts.count !== undefined ? `<span class="cf-count">×${opts.count}</span>` : ''}
      <span class="cf-art">${art ? `<img src="${art}" alt="" draggable="false">` : `<b>${c.icon}</b>`}</span>
      <span class="cf-name">${c.name}</span>
      <span class="cf-text">${c.text}</span>
      ${opts.tag ? `<span class="cf-tag">${opts.tag}</span>` : ''}
    </span>`;
}

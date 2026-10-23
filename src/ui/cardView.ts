import { CARD_TYPE_NAMES, CARDS } from '../data/cards';
import type { CardId } from '../engine/types';
import { CARD_ART, UI_ART } from './assets';

/**
 * 카드 한 장의 앞면. 덱 화면 · 손패 · 전투 선택지 · 상점 · 덱 정비에서 같이 쓴다.
 * 위 띠는 종류 색 (부스트 하늘 · 지원 민트 · 이벤트 보라 · 전투 분홍).
 * 왼쪽 위: 필요한 성 · 코인 비용, 오른쪽 위: 전투 코스트 · 장수, 아래: 덱 포인트.
 */
export function cardFace(id: CardId, opts: { count?: number; tag?: string } = {}): string {
  const c = CARDS[id];
  const art = CARD_ART[id];
  const timing = c.type === 'battle' ? (c.timing === 'attack' ? '공격' : '반격') : '';
  const pips = c.battleCost ? `<span class="cf-bcost" title="전투 코스트 ${c.battleCost}">${'◆'.repeat(c.battleCost)}</span>` : '';
  return `
    <span class="cf cf--${c.type}">
      <span class="cf-band">${CARD_TYPE_NAMES[c.type]}${timing ? `<i>${timing}</i>` : ''}</span>
      <span class="cf-corner cf-corner--left">
        ${c.level ? `<span class="cf-level" title="${c.level}성 이상">${c.level}성</span>` : ''}
        ${c.cost ? `<span class="cf-cost" title="코인 ${c.cost}"><img src="${UI_ART.coin}" alt="">${c.cost}</span>` : ''}
      </span>
      <span class="cf-corner cf-corner--right">
        ${pips}
        ${opts.count !== undefined ? `<span class="cf-count">×${opts.count}</span>` : ''}
        ${opts.tag ? `<span class="cf-tag">${opts.tag}</span>` : ''}
      </span>
      <span class="cf-art">${art ? `<img src="${art}" alt="" draggable="false">` : `<b>${c.icon}</b>`}</span>
      <span class="cf-name">${c.name}</span>
      <span class="cf-text">${c.text}</span>
      ${c.limit > 0 ? `<span class="cf-points" title="덱 포인트">${c.points}<small>P</small></span>` : ''}
    </span>`;
}

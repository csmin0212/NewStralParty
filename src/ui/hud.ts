import { CARDS, DECK_CARD_IDS } from '../data/cards';
import {
  canAddToDeck,
  canEditDeck,
  cardBlocker,
  cardTargets,
  deckBudget,
  deckPoints,
  distances,
} from '../engine/cards';
import { currentPlayer, describeGimmick } from '../engine/game';
import { skillTargets } from '../engine/skills';
import { RULES } from '../engine/rules';
import type { Action, CardId, GameState, Player } from '../engine/types';
import { tileLabel } from './boardView';
import { campusVector } from './campusMap';
import { esc } from './html';
import { CHARACTERS } from '../data/characters';
import { CHARACTER_ART, UI_ART } from './assets';
import { cardFace } from './cardView';

export interface HudHandlers {
  dispatch(action: Action): void;
  newGame(): void;
  toggleLog(): void;
  toggleDeck(): void;
  /** 화면만 다시 그린다 (대상 고르기 창) */
  refresh(): void;
}

/** 대상이나 눈을 골라야 하는 카드를 눌렀을 때 그 손패 번호. SKILL_PICK이면 대상을 고르는 액티브 */
let picking: number | null = null;
const SKILL_PICK = -1;
/** 모나 역조공: 고른 아군과 줄 카드 */
let giftTo: number | null = null;
let giftCards: number[] = [];

/**
 * 게임 화면 위에 떠 있는 HUD. 맵이 화면을 꽉 채우고, 정보는 네 모서리에 띄운다.
 *   위: 라운드 · 맵 이름 / 진행도 트랙 / 도구
 *   왼쪽: 플레이어 카드
 *   왼쪽 아래: 지금 차례인 플레이어 (캐릭터 그림 자리)
 *   아래 가운데: 손패
 *   오른쪽 아래: 큰 행동 버튼 (+ 갈림길 선택)
 * 기본 행동 버튼에는 data-primary를 붙인다 (스페이스바).
 */
export function renderHud(
  el: HTMLElement,
  state: GameState,
  busy: boolean,
  logOpen: boolean,
  deckOpen: boolean,
  h: HudHandlers,
) {
  el.innerHTML = `
    <div class="hud-top">
      ${roundBadge(state)}
      ${progressTrack(state)}
      <div class="hud-tools">
        <button class="icon-btn ${logOpen ? 'on' : ''}" data-action="log" title="기록">📜</button>
      </div>
    </div>
    <ul class="hud-players">${state.players.map((p) => playerCard(state, p)).join('')}</ul>
    ${currentCard(state)}
    ${handCards(state)}
    <div class="hud-action ${busy ? 'busy' : ''}">${actionArea(state)}</div>
    ${deckOpen && canEditDeck(state, currentPlayer(state)) ? deckEditor(state) : ''}
    ${state.phase.kind === 'shop' ? shopPanel(state) : ''}
    ${picking !== null ? targetPicker(state, picking) : ''}
    <aside class="hud-log ${logOpen ? 'open' : ''}">
      <h3>기록</h3>
      <ol>${state.log.map((line) => `<li>${esc(line)}</li>`).join('')}</ol>
    </aside>`;

  el.querySelectorAll<HTMLButtonElement>('button:not([data-action="log"]):not([data-action="menu"])').forEach(
    (b) => (b.disabled ||= busy),
  );
  const log = el.querySelector('.hud-log ol')!;
  log.scrollTop = log.scrollHeight;

  el.onclick = (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn || btn.disabled) return;
    const player = state.current;
    const { action, card, path, add, remove, buy, target, value, gift } = btn.dataset;
    if (action === 'roll') h.dispatch({ type: 'ROLL', player });
    else if (action === 'skill') {
      if (skillTargets(state, currentPlayer(state))) {
        picking = SKILL_PICK;
        giftTo = null;
        giftCards = [];
        h.refresh();
      } else h.dispatch({ type: 'USE_SKILL', player });
    } else if (action === 'end') h.dispatch({ type: 'END_TURN', player });
    else if (action === 'new') h.newGame();
    else if (action === 'menu') {
      if (confirm('지금 게임을 그만두고 새 게임을 시작할까요?')) h.newGame();
    } else if (action === 'log') h.toggleLog();
    else if (action === 'deck') h.toggleDeck();
    else if (add) h.dispatch({ type: 'EDIT_DECK', player, add: add as CardId });
    else if (remove) h.dispatch({ type: 'EDIT_DECK', player, remove: remove as CardId });
    else if (buy !== undefined) h.dispatch({ type: 'BUY_CARD', player, offer: Number(buy) });
    else if (action === 'leave-shop') h.dispatch({ type: 'LEAVE_SHOP', player });
    else if (action === 'cancel-pick') {
      picking = null;
      h.refresh();
    } else if (target !== undefined && picking === SKILL_PICK) {
      if (CHARACTERS[currentPlayer(state).character].active.target === 'ally') {
        giftTo = Number(target); // 다음: 줄 카드 고르기
        h.refresh();
      } else {
        picking = null;
        h.dispatch({ type: 'USE_SKILL', player, target: Number(target) });
        h.refresh();
      }
    } else if (gift !== undefined) {
      const i = Number(gift);
      giftCards = giftCards.includes(i) ? giftCards.filter((x) => x !== i) : [...giftCards, i].slice(-2);
      h.refresh();
    } else if (action === 'gift-confirm') {
      picking = null;
      h.dispatch({ type: 'USE_SKILL', player, target: giftTo!, cards: giftCards });
      giftTo = null;
      giftCards = [];
      h.refresh();
    } else if (target !== undefined || value !== undefined) {
      const handIndex = picking!;
      picking = null;
      h.dispatch({
        type: 'PLAY_CARD',
        player,
        handIndex,
        target: target !== undefined ? Number(target) : undefined,
        value: value !== undefined ? Number(value) : undefined,
      });
      h.refresh();
    } else if (card !== undefined) {
      const hand = currentPlayer(state).hand[Number(card)];
      // 대상 · 눈을 골라야 하는 카드는 고르기 창을 먼저 띄운다
      if (CARDS[hand.card].target || hand.card === 'remoteDice') {
        picking = Number(card);
        h.refresh();
      } else h.dispatch({ type: 'PLAY_CARD', player, handIndex: Number(card) });
    } else if (path !== undefined) h.dispatch({ type: 'CHOOSE_PATH', player, to: Number(path) });
  };
}

function roundBadge(state: GameState): string {
  return `
    <div class="hud-round">
      <button class="icon-btn" data-action="menu" title="메뉴">☰</button>
      <div class="round-box"><b>${String(state.round).padStart(2, '0')}</b><span>라운드</span></div>
      <div class="map-name"><small>ACADEMY DISTRICT / 01</small>${esc(state.board.name)}</div>
    </div>`;
}

/** 진행도 트랙: 지금 진행도 주변 칸만 보여 주고, 기믹 칸에는 아이콘을 띄운다 */
function progressTrack(state: GameState): string {
  const { boss, progress } = state;
  const WINDOW = 8;
  const start = Math.max(1, Math.min(progress - 2, boss.defeatAt - WINDOW + 1));
  const cells: string[] = [];
  for (let n = start; n < start + WINDOW && n <= boss.defeatAt; n++) {
    const gimmick = boss.timeline.find((g) => g.at === n);
    const isBoss = gimmick?.actions.some((a) => a.type === 'bossAppear');
    const isEnd = n === boss.defeatAt;
    const cls = [
      'cell',
      n < progress ? 'past' : '',
      n === progress ? 'now' : '',
      gimmick ? 'gimmick' : '',
      isBoss ? 'boss' : '',
      isEnd ? 'end' : '',
    ].join(' ');
    const title = isEnd
      ? `진행도 ${n}: 패배`
      : gimmick
        ? `진행도 ${n}: ${describeGimmick(state, gimmick.actions)}`
        : `진행도 ${n}`;
    const label = isEnd ? '💫' : isBoss ? boss.icon : gimmick ? '⚠' : String(n);
    cells.push(`<span class="${cls}" title="${esc(title)}">${label}</span>`);
  }

  const next = boss.timeline.find((g) => g.at > state.gimmicksDone);
  const caption = next
    ? `<b>${next.at - progress <= 0 ? '곧' : `${next.at - progress}칸 뒤`}</b> ${esc(describeGimmick(state, next.actions))}`
    : `<b>${boss.defeatAt - progress}칸 뒤</b> 패배`;
  const danger = boss.defeatAt - progress <= 3 ? 'danger' : '';

  return `
    <div class="hud-progress ${danger}">
      <div class="track">
        <span class="track-label">진행도 <b>${progress}</b></span>
        ${cells.join('')}
      </div>
      <div class="track-caption">${caption}</div>
    </div>`;
}

/** 별(성): 코인 아이콘이 별 모양이라, 헷갈리지 않게 하늘색 "N성" 배지 + 칸(pip)으로 표시한다 */
function levelBadge(level: number): string {
  const max = Object.keys(RULES.levelUpCost).length;
  const pips = Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('');
  return `<span class="lv-badge" title="${level}성 / ${max}성"><b>${level}</b>성<span class="pips">${pips}</span></span>`;
}

function playerCard(state: GameState, p: Player): string {
  const cls = ['hud-player', p.id === state.current ? 'current' : '', p.ko ? 'ko' : ''].join(' ');
  const cost = RULES.levelUpCost[p.level];
  return `
    <li class="${cls}" style="--c:${p.color}">
      <div class="pc-avatar"><img src="${CHARACTER_ART[p.character].portrait}" alt="" draggable="false"><span>${p.id + 1}</span></div>
      <div class="pc-hp"><img class="hp-icon" src="${UI_ART.heart}" alt="HP"><b>${p.hp}</b>/${p.maxHp}</div>
      <div class="pc-body">
        <div class="pc-name">${esc(p.name)}${p.ko ? ` <span class="ko-tag">KO · ${p.reviveRound}R 부활</span>` : ''}</div>
        <div class="pc-row">
          <span class="coin"><img class="ui-icon" src="${UI_ART.coin}" alt="코인"> <b>${p.coins}</b>${cost !== undefined ? `<small>/${cost}</small>` : ''}</span>
          ${levelBadge(p.level)}
          <span class="hand-count" title="손패"><img class="card-back-icon" src="${UI_ART.cardBack}" alt="손패">${p.hand.length}</span>
        </div>
      </div>
    </li>`;
}

/** 지금 차례인 플레이어: 원작처럼 왼쪽 아래에 캐릭터 일러스트를 크게 + 공격력 · 방어력 */
function currentCard(state: GameState): string {
  const p = currentPlayer(state);
  const c = CHARACTERS[p.character];
  return `
    <div class="hud-me" style="--c:${p.color}">
      <div class="me-art"><img src="${CHARACTER_ART[p.character].main}" alt="${esc(c.name)}" draggable="false"></div>
      <div class="me-info">
        <div class="me-turn">지금 차례</div>
        <div class="me-name">${esc(p.name)} <small>${c.name} · ${p.level}성</small></div>
        <div class="me-stats">
          <span title="공격력">⚔ ${p.atk}</span><span title="방어력">🛡 ${p.def}</span>${p.move ? `<span title="이동거리">👟 +${p.move}</span>` : ''}
          ${c.stack ? `<span class="me-stack" title="${esc(c.passive.description)}">${c.stack.name} ${p.stacks}/${c.stack.max}</span>` : ''}
          ${p.potential && c.potential ? `<span class="me-pot" title="${esc(c.potential.description)}">잠재 해방</span>` : ''}
        </div>
      </div>
    </div>`;
}

/** 원작의 분홍 "스킬" 버튼. 재사용 대기 중이면 남은 라운드, 효과 중이면 표시 */
function skillButton(state: GameState): string {
  const p = currentPlayer(state);
  const c = CHARACTERS[p.character];
  const targets = skillTargets(state, p);
  const ready =
    state.phase.kind === 'preRoll' &&
    !state.turn.skillUsed &&
    p.skillCooldown === 0 &&
    (!targets || targets.length > 0) &&
    (c.active.target !== 'ally' || p.hand.length > 0);
  const status = p.skillActiveUntil !== null ? '효과 중' : p.skillCooldown > 0 ? `${p.skillCooldown}R` : '';
  const tip = `액티브 「${c.active.name}」 (재사용 ${c.active.cooldown}라운드)\n${c.active.description}\n\n패시브 「${c.passive.name}」\n${c.passive.description}${c.passive2 ? `\n\n패시브 「${c.passive2.name}」\n${c.passive2.description}` : ''}`;
  return `
    <button class="skill-btn ${p.skillActiveUntil !== null ? 'active' : status ? 'cooling' : ''}" data-action="skill" title="${esc(tip)}" ${ready ? '' : 'disabled'}>
      <b>스킬</b>${status ? `<small>${status}</small>` : ''}
    </button>`;
}

function handCards(state: GameState): string {
  const p = currentPlayer(state);
  const pile = `<span class="pile-count" title="뽑을 카드 · 버린 카드"><img src="${UI_ART.cardBack}" alt="">${p.drawPile.length}<i>${p.discard.length}</i></span>`;
  if (p.hand.length === 0) return `<div class="hud-hand empty">${pile}</div>`;
  // 원작처럼 부채꼴로 겹치고 화면 아래로 반쯤 잘린다. --o: 가운데에서 얼마나 떨어졌는지 (-1 ~ 1)
  // 전투 카드는 전투 화면에서 쓴다
  const mid = (p.hand.length - 1) / 2;
  return `
    <div class="hud-hand fan">
      ${pile}
      ${p.hand
        .map((h, i) => {
          const o = mid === 0 ? 0 : (i - mid) / Math.max(mid, 1);
          const blocker = cardBlocker(state, p, h);
          return `
            <button class="hand-card" data-card="${i}" style="--o:${o}" title="${blocker ?? ''}" ${blocker ? 'disabled' : ''}>
              ${cardFace(h.card, { tag: h.shop ? '상점' : h.from !== undefined ? '선물' : undefined })}
            </button>`;
        })
        .join('')}
    </div>`;
}

/** 본부에서 덱 정비: 지금 덱(뽑을 · 버린 더미에 있는 카드만 뺄 수 있다)과 넣을 수 있는 카드 */
function deckEditor(state: GameState): string {
  const p = currentPlayer(state);
  const counts = new Map<CardId, number>();
  for (const id of p.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  const mine = DECK_CARD_IDS.filter((id) => counts.has(id))
    .map((id) => {
      const removable = (p.drawPile.includes(id) || p.discard.includes(id)) && p.deck.length > RULES.deckMin;
      return `<button class="deck-card" data-remove="${id}" ${removable ? '' : 'disabled'}>${cardFace(id, { count: counts.get(id) })}</button>`;
    })
    .join('');
  const pool = DECK_CARD_IDS.map((id) => {
    const ok = canAddToDeck(p.deck, id, deckBudget(p));
    const maxed =
      p.deck.filter((c) => c === id).length >= CARDS[id].limit || deckPoints(p.deck) + CARDS[id].points > deckBudget(p);
    return `<button class="deck-card ${maxed ? 'off' : ''}" data-add="${id}" ${ok ? '' : 'disabled'}>${cardFace(id)}</button>`;
  }).join('');
  return `
    <div class="deck-edit">
      <div class="deck-edit-panel">
        <div class="ba-band">덱 <b>${p.deck.length}</b> / ${RULES.deckSize}</div>
        <div class="deck-grid deck-grid--edit">${mine}</div>
        <div class="ba-band">카드 넣기</div>
        <div class="deck-grid deck-grid--edit">${pool}</div>
        <div class="panel-foot"><button class="ba-btn ba-btn--sky" data-action="deck">닫기</button></div>
      </div>
    </div>`;
}

/** 상점: 산 카드는 손패로 가고 쓰면 사라진다 */
function shopPanel(state: GameState): string {
  if (state.phase.kind !== 'shop') return '';
  const p = currentPlayer(state);
  const { offers, free } = state.phase;
  const full = p.hand.length >= RULES.handLimit;
  const items = offers
    .map((o, i) => {
      const price = free ? 0 : o.price;
      const ok = !o.sold && !full && p.coins >= price;
      return `
        <div class="shop-item ${o.sold ? 'sold' : ''}">
          <div class="shop-card">${cardFace(o.card)}</div>
          <button class="ba-btn ba-btn--yellow" data-buy="${i}" ${ok ? '' : 'disabled'}>
            ${o.sold ? '구매함' : `<img src="${UI_ART.coin}" alt="">${price}`}
          </button>
        </div>`;
    })
    .join('');
  return `
    <div class="shop-overlay">
      <div class="shop-panel">
        <div class="ba-band">상점${free ? ' · 첫 구매 무료' : ''}</div>
        <div class="shop-items">${items}</div>
        <div class="shop-foot"><span class="shop-coins"><img src="${UI_ART.coin}" alt="">${p.coins}</span>${full ? '<span class="shop-full">손패가 가득 참</span>' : ''}</div>
      </div>
    </div>`;
}

/** 대상 고르기: 아군 · 사거리 안 에너미 · 리모컨 주사위 눈 */
function targetPicker(state: GameState, handIndex: number): string {
  const p = currentPlayer(state);
  if (handIndex === SKILL_PICK) {
    const active = CHARACTERS[p.character].active;
    const dist = distances(state.board, p.tile);
    if (active.target === 'ally') {
      if (giftTo === null) {
        const allies = (skillTargets(state, p) ?? [])
          .map((id) => allyOption(state, id, dist.get(state.players[id].tile)!))
          .join('');
        return pickerPanel(active.name, allies);
      }
      // 줄 카드 1~2장
      const room = RULES.handLimit - state.players[giftTo].hand.length;
      const cards = p.hand
        .map(
          (h, i) =>
            `<button class="pick-card ${giftCards.includes(i) ? 'on' : ''}" data-gift="${i}">${cardFace(h.card)}</button>`,
        )
        .join('');
      const ok = giftCards.length >= 1 && giftCards.length <= Math.min(2, room);
      return pickerPanel(
        `${active.name} → ${state.players[giftTo].name}`,
        cards,
        `<button class="ba-btn ba-btn--yellow" data-action="gift-confirm" ${ok ? '' : 'disabled'}>주기 ${giftCards.length}/2</button>`,
      );
    }
    const options = (skillTargets(state, p) ?? [])
      .map((id) => enemyOption(state, id, dist.get(state.enemies.find((e) => e.id === id)!.tile)!))
      .join('');
    return pickerPanel(active.name, options);
  }
  const hand = p.hand[handIndex];
  if (!hand) return '';
  const info = CARDS[hand.card];
  let options = '';
  if (hand.card === 'remoteDice') {
    options = [1, 2, 3, 4, 5, 6].map((n) => `<button class="pick-num" data-value="${n}">${n}</button>`).join('');
  } else if (info.target === 'enemy') {
    const dist = distances(state.board, p.tile);
    options = (cardTargets(state, p, hand.card) ?? [])
      .map((id) => {
        const e = state.enemies.find((x) => x.id === id)!;
        return enemyOption(state, id, dist.get(e.tile)!);
      })
      .join('');
  } else {
    options = (cardTargets(state, p, hand.card) ?? [])
      .map((id) => {
        const o = state.players[id];
        return `<button class="pick-target" data-target="${id}" style="--c:${o.color}"><img class="pick-face" src="${CHARACTER_ART[o.character].portrait}" alt=""><b>${esc(o.name)}</b><span><img src="${UI_ART.heart}" alt="">${o.hp}/${o.maxHp}</span></button>`;
      })
      .join('');
  }
  return pickerPanel(info.name, options);
}

function enemyOption(state: GameState, id: number, distance: number): string {
  const e = state.enemies.find((x) => x.id === id)!;
  return `<button class="pick-target" data-target="${id}"><b>${esc(e.name)}</b><span><img src="${UI_ART.heart}" alt="">${e.hp}/${e.maxHp}</span><small>${distance}칸</small></button>`;
}

function allyOption(state: GameState, id: number, distance: number): string {
  const o = state.players[id];
  return `<button class="pick-target" data-target="${id}" style="--c:${o.color}"><img class="pick-face" src="${CHARACTER_ART[o.character].portrait}" alt=""><b>${esc(o.name)}</b><span><img class="card-back-icon" src="${UI_ART.cardBack}" alt="">${o.hand.length}/${RULES.handLimit}</span><small>${distance}칸</small></button>`;
}

function pickerPanel(title: string, options: string, extra = ''): string {
  return `
    <div class="shop-overlay pick-overlay">
      <div class="shop-panel pick-panel">
        <div class="ba-band">${esc(title)}</div>
        <div class="pick-options">${options}</div>
        <div class="shop-foot">${extra}<button class="ba-btn ba-btn--white" data-action="cancel-pick">취소</button></div>
      </div>
    </div>`;
}

function deckButton(state: GameState): string {
  if (!canEditDeck(state, currentPlayer(state))) return '';
  return `<button class="ba-btn ba-btn--sky deck-btn" data-action="deck">덱 정비</button>`;
}

function actionArea(state: GameState): string {
  const p = currentPlayer(state);
  const phase = state.phase;
  const cardInfo = `<span class="card-count">카드 ${state.turn.cardPlayed ? 1 : 0}/1</span>`;

  switch (phase.kind) {
    case 'preRoll': {
      const mods = [
        state.turn.diceCount > 1 ? `🎲 ×${state.turn.diceCount}` : '',
        state.turn.extraSteps > 0 ? `+${state.turn.extraSteps}칸` : '',
      ].filter(Boolean);
      return `
        <div class="action-info">${mods.length ? `<span class="mods">${mods.join(' · ')}</span>` : ''}${deckButton(state)}${skillButton(state)}${cardInfo}</div>
        <button class="go-btn" data-action="roll" data-primary>
          <span class="go-dice">🎲</span><b>이동</b><small>GO GO GO</small>
        </button>`;
    }

    case 'choosePath': {
      const from = state.board.tiles[p.tile];
      const options = phase.options
        .map((id) => {
          const to = state.board.tiles[id];
          return `<button class="path-btn" data-path="${id}">${direction(to.x - from.x, to.y - from.y)}<small>${tileLabel(state.board, id)}</small></button>`;
        })
        .join('');
      return `
        <div class="path-pick">
          <div class="path-title">남은 <b>${phase.stepsLeft}</b>칸</div>
          ${options}
        </div>
        <button class="go-btn wait" disabled><b>선택</b><small>WHICH WAY</small></button>`;
    }

    case 'encounter':
    case 'defend':
      return `<button class="go-btn wait" disabled><b>전투 중</b><small>BATTLE</small></button>`;

    case 'shop':
      return `<button class="go-btn end" data-action="leave-shop" data-primary><b>나가기</b><small>${phase.stepsLeft > 0 ? `${phase.stepsLeft}칸 더` : 'EXIT'}</small></button>`;

    case 'endTurn': {
      const result = p.ko ? `K.O. · ${p.reviveRound}R 부활` : `${tileLabel(state.board, p.tile)} 도착`;
      return `
        <div class="action-info">${deckButton(state)}<span class="result">${result}</span></div>
        <button class="go-btn end" data-action="end" data-primary><b>턴 종료</b><small>NEXT</small></button>`;
    }

    case 'gameOver':
      return `
        <div class="action-info"><span class="result">${phase.result === 'victory' ? '🎉 모두의 승리!' : '💫 패배…'}</span></div>
        <button class="go-btn" data-action="new" data-primary><b>새 게임</b><small>AGAIN</small></button>`;
  }
}

function direction(dx: number, dy: number): string {
  const screen = campusVector(dx, dy);
  if (screen.y >= 0) return screen.x >= 0 ? '↘ 오른쪽 아래' : '↙ 왼쪽 아래';
  return screen.x >= 0 ? '↗ 오른쪽 위' : '↖ 왼쪽 위';
}

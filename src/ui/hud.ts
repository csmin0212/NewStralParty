import { CARDS } from '../data/cards';
import { cardBlocker, cardTargets, distances, handLimit } from '../engine/cards';
import { KEYWORD_INFO, RARITY_NAME, RELICS, type RelicId } from '../data/relics';
import { relicPrice } from '../engine/game';
import { cardPlayLimit, taskProgress } from '../engine/relics';
import { currentPlayer, describeGimmick } from '../engine/game';
import { skillTargets } from '../engine/skills';
import { skillCardOk, skillCards } from '../engine/kits';
import { RULES } from '../engine/rules';
import type { Action, GameState, MapRes, Player } from '../engine/types';
import { MAP_RES_INFO } from '../data/board';
import { EVENTS, type EventId } from '../data/events';
import { tileLabel } from './boardView';
import { campusVector } from './campusMap';
import { esc } from './html';
import { CHARACTERS } from '../data/characters';
import { RELIC_ART, UI_ART } from './assets';
import { skinArt } from './skins';
import { cardFace } from './cardView';
import { bossBar } from './bossHud';
import { openBossInfo, openSettings } from './modal';

export interface HudHandlers {
  dispatch(action: Action): void;
  newGame(): void;
  toggleLog(): void;
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
  h: HudHandlers,
) {
  el.innerHTML = `
    <div class="hud-top">
      ${roundBadge(state)}
      <div class="hud-center">${progressTrack(state)}${bossBar(state)}</div>
      <div class="hud-tools">
        <button class="icon-btn ${logOpen ? 'on' : ''}" data-action="log" title="기록">📜</button>
      </div>
    </div>
    <ul class="hud-players">${state.players.map((p) => playerCard(state, p)).join('')}</ul>
    ${currentCard(state)}
    ${handCards(state)}
    <div class="hud-action ${busy ? 'busy' : ''}">${actionArea(state)}</div>
    ${state.phase.kind === 'shop' ? shopPanel(state) : ''}
    ${picking !== null ? targetPicker(state, picking) : ''}
    ${!busy && showRelicPicker(state) ? relicPicker(state) : ''}
    <aside class="hud-log ${logOpen ? 'open' : ''}">
      <h3>기록</h3>
      <ol>${state.log.map((line) => `<li>${esc(line)}</li>`).join('')}</ol>
    </aside>`;

  el.querySelectorAll<HTMLButtonElement>('button:not([data-action="log"]):not([data-action="menu"]):not([data-action="boss-info"])').forEach(
    (b) => (b.disabled ||= busy),
  );
  const log = el.querySelector('.hud-log ol')!;
  log.scrollTop = log.scrollHeight;

  el.onclick = (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn || btn.disabled) return;
    const player = state.current;
    const { action, card, path, buy, target, value, gift, send, relic, stop, event } = btn.dataset;
    if (relic) h.dispatch({ type: 'PICK_RELIC', player, relic: relic as RelicId });
    else if (action === 'reroll-relic') h.dispatch({ type: 'REROLL_RELIC', player });
    else if (action === 'buy-relic') h.dispatch({ type: 'BUY_RELIC', player });
    else if (action === 'roll') h.dispatch({ type: 'ROLL', player });
    else if (action === 'skill') {
      const me = currentPlayer(state);
      const def = CHARACTERS[me.character].active;
      // 대상 없이 손패만 고르는 액티브 (루카 잠재)는 바로 카드 고르기
      const selfCards = !def.target && skillCards(me);
      if (skillTargets(state, me) || def.value || selfCards) {
        picking = SKILL_PICK;
        giftTo = selfCards ? me.id : null;
        giftCards = [];
        h.refresh();
      } else h.dispatch({ type: 'USE_SKILL', player });
    } else if (action === 'end') h.dispatch({ type: 'END_TURN', player });
    else if (action === 'new') h.newGame();
    else if (action === 'menu') openSettings({ exit: h.newGame });
    else if (action === 'boss-info') openBossInfo(state.boss);
    else if (action === 'log') h.toggleLog();
    else if (stop !== undefined) h.dispatch({ type: 'STOP_HERE', player, stop: stop === '1' });
    else if (event) h.dispatch({ type: 'PICK_EVENT', player, event: event as EventId });
    else if (buy !== undefined) h.dispatch({ type: 'BUY_CARD', player, offer: Number(buy) });
    else if (send !== undefined) h.dispatch({ type: 'SEND_COINS', player, to: Number(send) });
    else if (action === 'leave-shop') h.dispatch({ type: 'LEAVE_SHOP', player });
    else if (action === 'cancel-pick') {
      picking = null;
      h.refresh();
    } else if (value !== undefined && picking === SKILL_PICK) {
      picking = null;
      h.dispatch({ type: 'USE_SKILL', player, value: Number(value) });
      h.refresh();
    } else if (target !== undefined && picking === SKILL_PICK) {
      if (skillCards(currentPlayer(state))) {
        giftTo = Number(target); // 다음: 줄 카드 고르기
        h.refresh();
      } else {
        picking = null;
        h.dispatch({ type: 'USE_SKILL', player, target: Number(target) });
        h.refresh();
      }
    } else if (gift !== undefined) {
      const i = Number(gift);
      const max = skillCards(currentPlayer(state))?.[1] ?? 2;
      giftCards = giftCards.includes(i) ? giftCards.filter((x) => x !== i) : [...giftCards, i].slice(-max);
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
      if (CARDS[hand.card].target || CARDS[hand.card].pick) {
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
      <div class="pc-avatar"><img src="${skinArt(p.character, p.skin).portrait}" alt="" draggable="false"><span>${p.id + 1}</span></div>
      <div class="pc-hp"><img class="hp-icon" src="${UI_ART.heart}" alt="HP"><b>${p.hp}</b>/${p.maxHp}</div>
      <div class="pc-body">
        <div class="pc-name">${p.cpu ? '<span class="cpu-tag">CPU</span>' : ''}${esc(p.name)}${p.ko ? ` <span class="ko-tag">KO · ${p.reviveRound}R 부활</span>` : ''}</div>
        <div class="pc-row">
          <span class="coin" title="${cost !== undefined ? `${p.level + 1}성까지 코인 ${cost}` : '3성'}"><img class="ui-icon" src="${UI_ART.coin}" alt="코인"> <b>${p.coins}</b></span>
          ${levelBadge(p.level)}
          <span class="hand-count" title="손패"><img class="card-back-icon" src="${UI_ART.cardBack}" alt="손패">${p.hand.length}</span>
        </div>
        ${statusChips(p)}
        ${relicRow(p)}
      </div>
    </li>`;
}

/** 유물 아이콘 줄 + 힐 · 스타라이트 · 에너지 스택 */
function relicRow(p: Player): string {
  const stacks = [
    p.healStacks ? `<i class="rs heal" title="${esc(`힐 ${p.healStacks} · ${KEYWORD_INFO.heal.text}`)}">💚${p.healStacks}</i>` : '',
    p.starlight ? `<i class="rs star" title="${esc(`스타라이트 ${p.starlight} · ${KEYWORD_INFO.starlight.text}`)}">✦${p.starlight}</i>` : '',
    p.energy ? `<i class="rs energy" title="${esc(`에너지 ${p.energy} · ${KEYWORD_INFO.energy.text}`)}">⚡${p.energy}</i>` : '',
    ...(Object.entries(p.mapRes ?? {}) as [MapRes, number][])
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `<i class="rs res-${k}" title="${esc(`${MAP_RES_INFO[k].name} ${n} · ${MAP_RES_INFO[k].text}`)}">${MAP_RES_INFO[k].icon}${n}</i>`),
  ].join('');
  const icons = p.relics
    .map((id) => `<i class="ri r-${RELICS[id].rarity}" title="${esc(`${RELICS[id].name} · ${RELICS[id].text}`)}">${relicIcon(id)}</i>`)
    .join('');
  if (!stacks && !icons) return '';
  return `<div class="pc-relics">${stacks}${icons}</div>`;
}

function relicIcon(id: RelicId): string {
  const art = RELIC_ART[id];
  return art ? `<img src="${art}" alt="">` : RELICS[id].icon;
}

function showRelicPicker(state: GameState): boolean {
  const p = currentPlayer(state);
  const k = state.phase.kind;
  return !!p.relicOffer && !p.cpu && (k === 'preRoll' || k === 'endTurn' || k === 'shop');
}

/** 유물 3개 중 하나 (아스트랄 파티 강화 칩 고르기). 테두리 색 = 등급, 아래 띠 = 키워드 */
function relicPicker(state: GameState): string {
  const p = currentPlayer(state);
  const offer = p.relicOffer!;
  const cards = offer.ids
    .map((id) => {
      const r = RELICS[id];
      const kw = r.keyword ? KEYWORD_INFO[r.keyword] : null;
      return `
      <button class="relic-card r-${r.rarity}" data-relic="${id}">
        <span class="rc-rarity">${RARITY_NAME[r.rarity]}</span>
        <span class="relic-icon">${relicIcon(id)}</span>
        <b>${esc(r.name)}</b>
        <small>${esc(r.text)}</small>
        ${kw ? `<span class="rc-kw kw-${r.keyword}" title="${esc(kw.text)}">${kw.icon} ${kw.name}</span>` : ''}
      </button>`;
    })
    .join('');
  const rerolls = p.relicVars.rerolls ?? 0;
  return `
    <div class="relic-pick" style="--c:${p.color}">
      <div class="relic-panel">
        <div class="ba-band">${esc(p.name)} · 유물</div>
        <div class="relic-row">${cards}</div>
        ${rerolls ? `<div class="relic-foot"><button class="ba-btn ba-btn--sky" data-action="reroll-relic">다시 뽑기 · ${rerolls}</button></div>` : ''}
      </div>
    </div>`;
}

/** 카드 강화 · 보스 약화 (턴 수는 자기 차례 시작마다 줄어든다) */
function statusChips(p: Player): string {
  const st = p.status;
  const chips: string[] = [];
  const chip = (cls: string, text: string, tip: string) => chips.push(`<i class="st-chip ${cls}" title="${esc(tip)}">${text}</i>`);
  if (st.atkUp) chip('buff', `⚔+${st.atkUp.amount}`, `공격력 +${st.atkUp.amount} · ${st.atkUp.turns}턴`);
  if (st.defUp) chip('buff', `🛡+${st.defUp.amount}`, `방어력 +${st.defUp.amount} · ${st.defUp.turns}턴`);
  if (st.regen) chip('buff', `♥+${st.regen.amount}`, `차례마다 체력 +${st.regen.amount} · ${st.regen.turns}턴`);
  if (st.nextBattleAtk) chip('buff', `⚔+${st.nextBattleAtk}`, `다음 전투 공격력 +${st.nextBattleAtk}`);
  if (st.extend) chip('buff', '보충', '쓰러지면 다음 차례에 부활');
  if (st.atkDown) chip('debuff', `⚔-${st.atkDown.amount}`, `공격력 -${st.atkDown.amount} · ${st.atkDown.turns}턴`);
  if (st.defDown) chip('debuff', `🛡-${Math.min(st.defDown.amount, 9)}`, `방어력 -${st.defDown.amount} · ${st.defDown.turns}턴`);
  if (st.erode) chip('debuff', '위압', '차례 시작마다 체력 -1 · 회복하면 해제');
  if (st.curse) chip('debuff hot', `저주 ${st.curse}`, '보스 차례에 주변 1칸 3 피해 · 그때 체력이 가득 차 있으면 해제');
  if (st.skipTurn) chip('debuff', '기절', '다음 차례 쉼');
  if (st.slow) chip('debuff', `👟-${st.slow}`, `다음 이동 -${st.slow}`);
  return chips.length ? `<div class="pc-status">${chips.join('')}</div>` : '';
}

/** 지금 차례인 플레이어: 원작처럼 왼쪽 아래에 캐릭터 일러스트를 크게 + 공격력 · 방어력 */
function currentCard(state: GameState): string {
  const p = currentPlayer(state);
  const c = CHARACTERS[p.character];
  return `
    <div class="hud-me" style="--c:${p.color}">
      <div class="me-art"><img src="${skinArt(p.character, p.skin).main}" alt="${esc(c.name)}" draggable="false"></div>
      <div class="me-info">
        <div class="me-turn">지금 차례</div>
        <div class="me-name">${esc(p.name)} <small>${c.name} · ${p.level}성</small></div>
        <div class="me-stats">
          <span title="공격력">⚔ ${p.atk}</span><span title="방어력">🛡 ${p.def}</span>${p.move ? `<span title="이동거리">👟 +${p.move}</span>` : ''}
          ${c.stack ? `<span class="me-stack" title="${esc(c.passive.description)}">${c.stack.name} ${p.stacks}/${c.stack.max}</span>` : ''}
          ${p.potential && c.potential ? `<span class="me-pot" title="${esc(c.potential.description)}">잠재 해방</span>` : ''}
        </div>
        ${taskLine(state, p)}
      </div>
    </div>`;
}

/** 임무: 마치면 유물 (원작 Tasks) */
function taskLine(state: GameState, p: Player): string {
  const prog = taskProgress(state, p);
  if (!prog) return '';
  const w = Math.min(100, (prog.value / prog.def.goal) * 100);
  return `<div class="me-task" title="임무 · 마치면 유물"><span>임무</span><b>${esc(prog.def.text)}</b><i><b style="width:${w}%"></b></i><em>${Math.min(prog.value, prog.def.goal)}/${prog.def.goal}</em></div>`;
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
  const over = p.hand.length > handLimit(p);
  const pile = `<span class="pile-count ${over ? 'over' : ''}" title="손패 · 한도"><img src="${UI_ART.cardBack}" alt="">${p.hand.length}<i>${handLimit(p)}</i></span>`;
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
              ${cardFace(h.card, { tag: h.from !== undefined ? '선물' : undefined })}
            </button>`;
        })
        .join('')}
    </div>`;
}

/** 상점: 산 카드는 손패로 가고 쓰면 사라진다 */
function shopPanel(state: GameState): string {
  if (state.phase.kind !== 'shop') return '';
  const p = currentPlayer(state);
  const { offers, free, chips, sent } = state.phase;
  const { stepsLeft } = state.phase;
  const leave = `<button class="ba-btn ba-btn--sky shop-leave" data-action="leave-shop" data-primary>나가기${stepsLeft > 0 ? ` · ${stepsLeft}칸 더` : ''}</button>`;
  // 칩 상점: 유물만 (원작 筹码商店)
  if (chips) {
    return `
    <div class="shop-overlay">
      <div class="shop-panel">
        <div class="ba-band">칩 상점</div>
        <div class="relic-buy">
          <button class="ba-btn ba-btn--yellow" data-action="buy-relic" ${p.coins >= relicPrice(p) && !p.relicOffer ? '' : 'disabled'}>유물 고르기 · <img src="${UI_ART.coin}" alt="">${relicPrice(p)}</button>
          <span>${p.relics.length}개</span>
        </div>
        <div class="shop-foot">
          <span class="shop-coins"><img src="${UI_ART.coin}" alt="">${p.coins}</span>
          ${leave}
        </div>
      </div>
    </div>`;
  }
  const items = offers
    .map((o, i) => {
      const price = free ? 0 : o.price;
      const ok = !o.sold && p.coins >= price;
      return `
        <div class="shop-item ${o.sold ? 'sold' : ''}">
          <div class="shop-card">${cardFace(o.card)}</div>
          <button class="ba-btn ba-btn--yellow" data-buy="${i}" ${ok ? '' : 'disabled'}>
            ${o.sold ? '구매함' : `<img src="${UI_ART.coin}" alt="">${price}`}
          </button>
        </div>`;
    })
    .join('');
  // 송금: 아군에게 코인 5씩
  const canSend = p.coins >= RULES.transferCoins && !sent;
  const allies = state.players
    .filter((o) => o.id !== p.id)
    .map(
      (o) => `
        <button class="send-btn" data-send="${o.id}" style="--c:${o.color}" ${canSend ? '' : 'disabled'} title="${esc(o.name)}에게 코인 ${RULES.transferCoins}">
          <img class="send-face" src="${skinArt(o.character, o.skin).portrait}" alt="">
          <span><b>${esc(o.name)}</b><small><img src="${UI_ART.coin}" alt="">${o.coins}</small></span>
          <em>+${RULES.transferCoins}</em>
        </button>`,
    )
    .join('');
  return `
    <div class="shop-overlay">
      <div class="shop-panel">
        <div class="ba-band">상점${free ? ' · 1장 무료' : ''}</div>
        <div class="shop-items">${items}</div>
        <div class="ba-band ba-band--sub">송금</div>
        <div class="send-row">${allies}</div>
        <div class="shop-foot">
          <span class="shop-coins"><img src="${UI_ART.coin}" alt="">${p.coins}</span>
          ${leave}
        </div>
      </div>
    </div>`;
}

/** 대상 고르기: 아군 · 사거리 안 에너미 · 고르는 숫자 */
function targetPicker(state: GameState, handIndex: number): string {
  const p = currentPlayer(state);
  if (handIndex === SKILL_PICK) {
    const active = CHARACTERS[p.character].active;
    const dist = distances(state.board, p.tile);
    // 숫자 고르기 (링링 돌진)
    if (active.value && !active.target) {
      const [lo, hi] = active.value;
      const nums = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
        .map((n) => `<button class="pick-num" data-value="${n}">${n}</button>`)
        .join('');
      return pickerPanel(active.name, nums);
    }
    if (active.target === 'ally' || active.target === 'anyAlly' || giftTo === p.id) {
      if (giftTo === null) {
        const allies = (skillTargets(state, p) ?? [])
          .map((id) => allyOption(state, id, dist.get(state.players[id].tile)!))
          .join('');
        return pickerPanel(active.name, allies);
      }
      // 함께 고르는 손패 (모나 1~2 · 알 1~3 · 질 3)
      const [min, max] = skillCards(p) ?? [1, 2];
      const cards = p.hand
        .map(
          (h, i) =>
            `<button class="pick-card ${giftCards.includes(i) ? 'on' : ''}" data-gift="${i}" ${skillCardOk(p, h.card) ? '' : 'disabled'}>${cardFace(h.card)}</button>`,
        )
        .join('');
      const ok = giftCards.length >= min && giftCards.length <= max;
      return pickerPanel(
        giftTo === p.id ? active.name : `${active.name} → ${state.players[giftTo].name}`,
        cards,
        `<button class="ba-btn ba-btn--yellow" data-action="gift-confirm" ${ok ? '' : 'disabled'}>확인 ${giftCards.length}/${max}</button>`,
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
  if (info.pick) {
    const [lo, hi] = info.pick;
    options = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
      .map((n) => `<button class="pick-num" data-value="${n}">${n}</button>`)
      .join('');
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
        return `<button class="pick-target" data-target="${id}" style="--c:${o.color}"><img class="pick-face" src="${skinArt(o.character, o.skin).portrait}" alt=""><b>${esc(o.name)}</b><span><img src="${UI_ART.heart}" alt="">${o.hp}/${o.maxHp}</span></button>`;
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
  return `<button class="pick-target" data-target="${id}" style="--c:${o.color}"><img class="pick-face" src="${skinArt(o.character, o.skin).portrait}" alt=""><b>${esc(o.name)}</b><span><img class="card-back-icon" src="${UI_ART.cardBack}" alt="">${o.hand.length}/${handLimit(o)}</span><small>${distance}칸</small></button>`;
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

function actionArea(state: GameState): string {
  const p = currentPlayer(state);
  const phase = state.phase;

  switch (phase.kind) {
    case 'preRoll': {
      const mods = [
        state.turn.diceCount > 1 ? `🎲 ×${state.turn.diceCount}` : '',
        state.turn.extraSteps > 0 ? `+${state.turn.extraSteps}칸` : '',
      ].filter(Boolean);
      return `
        <div class="action-info">${mods.length ? `<span class="mods">${mods.join(' · ')}</span>` : ''}${skillButton(state)}<span class="play-count" title="효과 카드">카드 <b>${state.turn.cardsPlayed}</b>/${cardPlayLimit(state, p)}</span></div>
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
      return `<button class="go-btn wait" disabled><b>상점</b><small>SHOP</small></button>`;

    case 'eventPick': {
      const options = phase.options
        .map((id) => `<button class="path-btn" data-event="${id}">${EVENTS[id].icon} ${esc(EVENTS[id].name)}<small>${esc(EVENTS[id].text)}</small></button>`)
        .join('');
      return `
        <div class="path-pick">
          <div class="path-title">이벤트</div>
          ${options}
        </div>
        <button class="go-btn wait" disabled><b>선택</b><small>EVENT</small></button>`;
    }

    case 'stopChoice': {
      const tile = state.board.tiles[p.tile];
      return `
        <div class="path-pick">
          <div class="path-title">${esc(tileLabel(state.board, tile.id))} · 남은 <b>${phase.stepsLeft}</b>칸</div>
          <button class="path-btn" data-stop="1">멈추기<small>체력 +2 · 성 오름</small></button>
          <button class="path-btn" data-stop="0">계속<small>${phase.stepsLeft}칸</small></button>
        </div>
        <button class="go-btn wait" disabled><b>선택</b><small>STOP?</small></button>`;
    }

    case 'endTurn': {
      const result = p.ko ? `K.O. · ${p.reviveRound}R 부활` : `${tileLabel(state.board, p.tile)} 도착`;
      return `
        <div class="action-info"><span class="result">${result}</span></div>
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

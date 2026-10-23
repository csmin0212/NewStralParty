import { CARDS } from '../data/cards';
import { currentPlayer, describeGimmick } from '../engine/game';
import { RULES } from '../engine/rules';
import type { Action, GameState, Player } from '../engine/types';
import { tileLabel } from './boardView';
import { campusVector } from './campusMap';
import { esc } from './html';
import { CHARACTERS } from '../data/characters';
import { CARD_ART, CHARACTER_ART, UI_ART } from './assets';

export interface HudHandlers {
  dispatch(action: Action): void;
  newGame(): void;
  toggleLog(): void;
}

/**
 * 게임 화면 위에 떠 있는 HUD. 맵이 화면을 꽉 채우고, 정보는 네 모서리에 띄운다.
 *   위: 라운드 · 맵 이름 / 진행도 트랙 / 도구
 *   왼쪽: 플레이어 카드
 *   왼쪽 아래: 지금 차례인 플레이어 (캐릭터 그림 자리)
 *   아래 가운데: 손패
 *   오른쪽 아래: 큰 행동 버튼 (+ 갈림길 선택)
 * 기본 행동 버튼에는 data-primary를 붙인다 (스페이스바).
 */
export function renderHud(el: HTMLElement, state: GameState, busy: boolean, logOpen: boolean, h: HudHandlers) {
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
    const { action, card, path } = btn.dataset;
    if (action === 'roll') h.dispatch({ type: 'ROLL', player });
    else if (action === 'skill') h.dispatch({ type: 'USE_SKILL', player });
    else if (action === 'end') h.dispatch({ type: 'END_TURN', player });
    else if (action === 'new') h.newGame();
    else if (action === 'menu') {
      if (confirm('지금 게임을 그만두고 새 게임을 시작할까요?')) h.newGame();
    } else if (action === 'log') h.toggleLog();
    else if (card !== undefined) h.dispatch({ type: 'PLAY_CARD', player, handIndex: Number(card) });
    else if (path !== undefined) h.dispatch({ type: 'CHOOSE_PATH', player, to: Number(path) });
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
          <span title="공격력">⚔ ${p.atk}</span><span title="방어력">🛡 ${p.def}</span>
          ${p.potential ? `<span class="me-pot" title="${esc(c.potential.description)}">잠재 해방</span>` : ''}
        </div>
      </div>
    </div>`;
}

/** 원작의 분홍 "스킬" 버튼. 재사용 대기 중이면 남은 라운드, 효과 중이면 표시 */
function skillButton(state: GameState): string {
  const p = currentPlayer(state);
  const c = CHARACTERS[p.character];
  const ready = state.phase.kind === 'preRoll' && !state.turn.skillUsed && p.skillCooldown === 0;
  const status = p.skillActiveUntil !== null ? '효과 중' : p.skillCooldown > 0 ? `${p.skillCooldown}R` : '';
  const tip = `액티브 「${c.active.name}」 (재사용 ${c.active.cooldown}라운드)\n${c.active.description}\n\n패시브 「${c.passive.name}」\n${c.passive.description}`;
  return `
    <button class="skill-btn ${p.skillActiveUntil !== null ? 'active' : status ? 'cooling' : ''}" data-action="skill" title="${esc(tip)}" ${ready ? '' : 'disabled'}>
      <b>스킬</b>${status ? `<small>${status}</small>` : ''}
    </button>`;
}

function handCards(state: GameState): string {
  const p = currentPlayer(state);
  if (p.hand.length === 0) return '<div class="hud-hand empty"><span>손패 없음</span></div>';
  const usable = state.phase.kind === 'preRoll' && !state.turn.cardPlayed;
  // 원작처럼 부채꼴로 겹치고 화면 아래로 반쯤 잘린다. --o: 가운데에서 얼마나 떨어졌는지 (-1 ~ 1)
  const mid = (p.hand.length - 1) / 2;
  return `
    <div class="hud-hand fan">
      ${p.hand
        .map((id, i) => {
          const c = CARDS[id];
          const o = mid === 0 ? 0 : (i - mid) / Math.max(mid, 1);
          return `
            <button class="hand-card" data-card="${i}" style="--o:${o};--i:${i}" ${usable ? '' : 'disabled'}>
              <span class="hc-art"><img src="${CARD_ART[id]}" alt="" draggable="false"></span>
              <span class="hc-name">${c.name}</span>
              <span class="hc-desc">${c.description}</span>
            </button>`;
        })
        .join('')}
    </div>`;
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
        <div class="action-info">${mods.length ? `<span class="mods">${mods.join(' · ')}</span>` : ''}${skillButton(state)}${cardInfo}</div>
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
          <div class="path-title">갈림길! 남은 <b>${phase.stepsLeft}</b>칸</div>
          ${options}
          <div class="path-hint">빛나는 칸을 눌러도 돼요</div>
        </div>
        <button class="go-btn wait" disabled><b>선택</b><small>WHICH WAY</small></button>`;
    }

    case 'encounter':
    case 'defend':
      return `<button class="go-btn wait" disabled><b>전투 중</b><small>BATTLE</small></button>`;

    case 'endTurn': {
      const result = p.ko
        ? `💀 쓰러졌다… ${p.reviveRound}라운드에 부활`
        : `${tileLabel(state.board, p.tile)} 도착`;
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

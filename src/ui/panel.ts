import { CARDS } from '../data/cards';
import { currentPlayer } from '../engine/game';
import { RULES } from '../engine/rules';
import type { Action, GameState, Player } from '../engine/types';
import { tileLabel } from './boardView';
import { esc } from './html';

export interface PanelHandlers {
  dispatch(action: Action): void;
  newGame(): void;
}

/** 오른쪽 패널: 플레이어 정보, 행동 버튼, 로그. 기본 행동 버튼에는 data-primary를 붙인다 (스페이스바) */
export function renderPanel(el: HTMLElement, state: GameState, busy: boolean, h: PanelHandlers) {
  el.innerHTML = `
    <div class="round">라운드 ${state.round} · ${esc(state.board.name)}</div>
    <ul class="players">${state.players.map((p) => playerRow(state, p)).join('')}</ul>
    <section class="actions ${busy ? 'busy' : ''}">${actions(state)}</section>
    <ol class="log">${state.log.map((line) => `<li>${esc(line)}</li>`).join('')}</ol>`;

  el.querySelectorAll('button').forEach((b) => (b.disabled ||= busy));
  const log = el.querySelector('.log')!;
  log.scrollTop = log.scrollHeight;

  el.onclick = (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!btn || btn.disabled) return;
    const player = state.current;
    const { action, card, path } = btn.dataset;
    if (action === 'roll') h.dispatch({ type: 'ROLL', player });
    else if (action === 'end') h.dispatch({ type: 'END_TURN', player });
    else if (action === 'new') h.newGame();
    else if (card !== undefined) h.dispatch({ type: 'PLAY_CARD', player, handIndex: Number(card) });
    else if (path !== undefined) h.dispatch({ type: 'CHOOSE_PATH', player, to: Number(path) });
  };
}

function playerRow(state: GameState, p: Player): string {
  const cost = RULES.levelUpCost[p.level];
  const goal = cost === undefined ? '' : `<span class="muted">/ ${cost}</span>`;
  const classes = ['player', p.id === state.current ? 'current' : '', p.ko ? 'ko' : ''].join(' ');
  return `
    <li class="${classes}" style="--c:${p.color}">
      <span class="dot"></span>
      <div class="pinfo">
        <div class="pname">${esc(p.name)} <span class="lv">Lv.${p.level}</span>${p.ko ? ' <span class="ko-tag">KO</span>' : ''}</div>
        <div class="stats">
          <span>🪙 ${p.coins} ${goal}</span>
          <span>❤️ ${p.hp}/${p.maxHp}</span>
          <span>🃏 ${p.hand.length}</span>
        </div>
        <div class="hpbar"><i style="width:${(p.hp / p.maxHp) * 100}%"></i></div>
      </div>
    </li>`;
}

function actions(state: GameState): string {
  const p = currentPlayer(state);
  const who = `<span class="who" style="color:${p.color}">${esc(p.name)}</span>`;
  const phase = state.phase;

  switch (phase.kind) {
    case 'preRoll': {
      const mods = [
        state.turn.diceCount > 1 ? `주사위 ${state.turn.diceCount}개` : '',
        state.turn.extraSteps > 0 ? `이동 +${state.turn.extraSteps}` : '',
      ].filter(Boolean);
      const hand =
        p.hand.length === 0
          ? '<p class="muted">손패 없음</p>'
          : p.hand
              .map((id, i) => {
                const c = CARDS[id];
                const disabled = state.turn.cardPlayed ? 'disabled' : '';
                return `<button class="card" data-card="${i}" ${disabled}>${c.icon} ${c.name}<small>${c.description}</small></button>`;
              })
              .join('');
      return `
        <h2>${who}의 차례</h2>
        <div class="hand">${hand}</div>
        ${mods.length ? `<p class="mods">이번 턴: ${mods.join(', ')}</p>` : ''}
        <button class="primary" data-action="roll" data-primary>🎲 주사위 굴리기 <kbd>Space</kbd></button>`;
    }

    case 'choosePath': {
      const from = state.board.tiles[p.tile];
      const options = phase.options
        .map((id) => {
          const to = state.board.tiles[id];
          return `<button data-path="${id}">${direction(to.x - from.x, to.y - from.y)} · ${tileLabel(state.board, id)}</button>`;
        })
        .join('');
      return `
        <h2>${who}: 갈림길!</h2>
        <p>남은 이동 <b>${phase.stepsLeft}</b>칸. 어느 쪽으로 갈까요?</p>
        <div class="paths">${options}</div>
        <p class="muted">보드에서 빛나는 칸을 눌러도 돼요</p>`;
    }

    case 'encounter':
    case 'defend':
      return `
        <h2>${who}: ⚔ 전투 중</h2>
        <p class="muted">전투 창에서 선택하세요</p>`;

    case 'endTurn':
      return `
        <h2>${who}의 차례</h2>
        <p>🎲 ${state.turn.dice.join(' + ') || '-'} → ${tileLabel(state.board, p.tile)} 도착</p>
        <button class="primary" data-action="end" data-primary>턴 종료 <kbd>Space</kbd></button>`;

    case 'gameOver': {
      const winner = state.players[phase.winner];
      return `
        <h2>🏆 <span class="who" style="color:${winner.color}">${esc(winner.name)}</span> 승리!</h2>
        <button class="primary" data-action="new" data-primary>새 게임</button>`;
    }
  }
}

function direction(dx: number, dy: number): string {
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? '➡️ 오른쪽' : '⬅️ 왼쪽';
  return dy > 0 ? '⬇️ 아래쪽' : '⬆️ 위쪽';
}

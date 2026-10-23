import { TILE_INFO } from '../data/board';
import { ENEMIES } from '../data/enemies';
import type { Board, GameState } from '../engine/types';
import { esc } from './html';

const UNIT = 88; // 격자 한 칸 간격(px)
const TILE = 70; // 칸 크기(px)
const PAD = 16;
const STEP_MS = 180;

const SVG_NS = 'http://www.w3.org/2000/svg';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 보드와 말. 이동은 한 칸씩 애니메이션한다 */
export class BoardView {
  onTileClick: (tileId: number) => void = () => {};

  private readonly el: HTMLElement;
  private readonly tileEls: HTMLElement[];
  private readonly tokenEls: HTMLElement[];
  private readonly diceEl: HTMLElement;
  private readonly enemyEls = new Map<number, HTMLElement>();
  /** 화면에 표시 중인 각 플레이어의 칸 */
  private shown: number[];
  private lastSeq = 0;

  constructor(root: HTMLElement, private readonly board: Board, state: GameState) {
    const cols = Math.max(...board.tiles.map((t) => t.x)) + 1;
    const rows = Math.max(...board.tiles.map((t) => t.y)) + 1;

    const width = (cols - 1) * UNIT + TILE + PAD * 2;
    const height = (rows - 1) * UNIT + TILE + PAD * 2;
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;
    this.el.append(this.drawEdges());

    this.tileEls = board.tiles.map((tile) => {
      const info = TILE_INFO[tile.kind];
      const t = document.createElement('button');
      t.className = `tile kind-${tile.kind}`;
      t.style.left = `${PAD + tile.x * UNIT}px`;
      t.style.top = `${PAD + tile.y * UNIT}px`;
      t.title = `${tile.id}번 · ${info.name}`;
      t.innerHTML = `<span class="icon">${info.icon}</span><span class="label">${info.name}</span>`;
      t.onclick = () => this.onTileClick(tile.id);
      this.el.append(t);
      return t;
    });

    this.tokenEls = state.players.map((p) => {
      const tok = document.createElement('div');
      tok.className = 'token';
      tok.style.setProperty('--c', p.color);
      tok.textContent = String(p.id + 1);
      tok.title = p.name;
      this.el.append(tok);
      return tok;
    });

    this.diceEl = document.createElement('div');
    this.diceEl.className = 'dice-pop';
    this.el.append(this.diceEl);

    // 화면 크기에 맞춰 보드 전체를 확대/축소한다
    const fit = document.createElement('div');
    fit.className = 'board-fit';
    fit.append(this.el);
    root.append(fit);
    // 좁은 화면에서는 패널이 아래로 내려가고 높이가 보드를 따라가므로 너비만 본다 (style.css와 같은 기준)
    const stacked = matchMedia('(max-width: 900px)');
    new ResizeObserver(() => {
      const style = getComputedStyle(root);
      const availW = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const availH = root.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const scale = Math.min(1.5, availW / width, stacked.matches ? Infinity : availH / height);
      this.el.style.transform = `scale(${scale})`;
      fit.style.width = `${width * scale}px`;
      fit.style.height = `${height * scale}px`;
    }).observe(root);

    this.shown = state.players.map((p) => p.tile);
    this.layoutTokens(state.current);
    this.renderEnemies(state);
    this.highlight(state);
  }

  /** 새 상태를 보여 준다. 새 이동이 있으면 말이 다 움직인 뒤에 resolve */
  async show(state: GameState) {
    this.highlight({ ...state, phase: { kind: 'endTurn' } }); // 이동 중에는 선택지 숨김
    const move = state.lastMove;
    if (move && move.seq > this.lastSeq) {
      this.lastSeq = move.seq;
      for (const tileId of move.path.slice(1)) {
        this.shown[move.player] = tileId;
        this.layoutTokens(move.player);
        await sleep(STEP_MS);
      }
    }
    this.shown = state.players.map((p) => p.tile);
    this.layoutTokens(state.current);
    this.renderEnemies(state);
    this.highlight(state);
  }

  /** 에너미는 칸 오른쪽 위에 배지로 붙는다 (말은 칸 가운데) */
  private renderEnemies(state: GameState) {
    const alive = new Set(state.enemies.map((e) => e.id));
    for (const [id, el] of this.enemyEls) {
      if (alive.has(id)) continue;
      this.enemyEls.delete(id);
      el.classList.add('gone');
      setTimeout(() => el.remove(), 400);
    }

    for (const enemy of state.enemies) {
      const info = ENEMIES[enemy.kind];
      let el = this.enemyEls.get(enemy.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'enemy';
        el.innerHTML = `<span class="face">${info.icon}</span><i class="ehp"><b></b></i>`;
        this.el.append(el);
        this.enemyEls.set(enemy.id, el);
      }
      const tile = this.board.tiles[enemy.tile];
      el.style.left = `${PAD + tile.x * UNIT + TILE - 8}px`;
      el.style.top = `${PAD + tile.y * UNIT + 8}px`;
      el.classList.toggle('counter', enemy.counter);
      el.title = `${info.name} HP ${enemy.hp}/${enemy.maxHp}${enemy.counter ? ' · 반격형' : ''}`;
      el.querySelector<HTMLElement>('.ehp b')!.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    }
  }

  showDice(dice: number[], extra: number) {
    const bonus = extra > 0 ? `<small>+${extra}</small>` : '';
    this.diceEl.innerHTML = `🎲 ${dice.map((d) => `<b>${d}</b>`).join(' ')}${bonus}`;
    this.diceEl.classList.remove('pop');
    void this.diceEl.offsetWidth; // 애니메이션 재시작
    this.diceEl.classList.add('pop');
  }

  showMessage(html: string) {
    const overlay = document.createElement('div');
    overlay.className = 'board-overlay';
    overlay.innerHTML = html;
    this.el.append(overlay);
  }

  private highlight(state: GameState) {
    const options = state.phase.kind === 'choosePath' ? state.phase.options : [];
    this.tileEls.forEach((t, id) => t.classList.toggle('choice', options.includes(id)));
    this.tokenEls.forEach((tok, id) => {
      tok.classList.toggle('current', id === state.current);
      tok.classList.toggle('ko', state.players[id].ko);
    });
  }

  /** 같은 칸의 말은 겹치지 않게 펼친다. front는 맨 위에 그린다 */
  private layoutTokens(front: number) {
    const byTile = new Map<number, number[]>();
    this.shown.forEach((tileId, player) => {
      byTile.set(tileId, [...(byTile.get(tileId) ?? []), player]);
    });

    for (const [tileId, players] of byTile) {
      const tile = this.board.tiles[tileId];
      const cx = PAD + tile.x * UNIT + TILE / 2;
      const cy = PAD + tile.y * UNIT + TILE / 2;
      players.forEach((player, i) => {
        const [dx, dy] = players.length === 1 ? [0, 0] : [(i % 2 ? 1 : -1) * 15, (i < 2 ? -1 : 1) * 15];
        const tok = this.tokenEls[player];
        tok.style.transform = `translate(${cx + dx}px, ${cy + dy}px) translate(-50%, -50%)`;
        tok.style.zIndex = player === front ? '6' : '5';
      });
    }
  }

  private drawEdges(): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('edges');
    svg.innerHTML = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
      </defs>`;

    const center = (id: number) => {
      const t = this.board.tiles[id];
      return { x: PAD + t.x * UNIT + TILE / 2, y: PAD + t.y * UNIT + TILE / 2 };
    };

    const midX = PAD + (Math.max(...this.board.tiles.map((t) => t.x)) * UNIT + TILE) / 2;
    const midY = PAD + (Math.max(...this.board.tiles.map((t) => t.y)) * UNIT + TILE) / 2;

    for (const tile of this.board.tiles) {
      const a = center(tile.id);
      for (const n of tile.next) {
        const b = center(n);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const ux = (b.x - a.x) / len;
        const uy = (b.y - a.y) / len;
        const r = TILE / 2 + 2;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(a.x + ux * r));
        line.setAttribute('y1', String(a.y + uy * r));
        line.setAttribute('x2', String(b.x - ux * r));
        line.setAttribute('y2', String(b.y - uy * r));
        line.setAttribute('marker-end', 'url(#arrow)');
        line.classList.add(tile.next.length > 1 ? 'fork' : 'path');
        svg.append(line);
      }
      if (tile.kind === 'warp' && tile.warpTo !== undefined) {
        const b = center(tile.warpTo);
        const curve = document.createElementNS(SVG_NS, 'path');
        curve.setAttribute('d', `M${a.x},${a.y} Q${midX},${midY} ${b.x},${b.y}`);
        curve.classList.add('warp-link');
        svg.append(curve);
      }
    }
    return svg;
  }
}

export function tileLabel(board: Board, tileId: number): string {
  const info = TILE_INFO[board.tiles[tileId].kind];
  return esc(`${info.icon} ${info.name}`.trim());
}

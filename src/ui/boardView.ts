import { TILE_INFO } from '../data/board';
import type { Board, GameState } from '../engine/types';
import { esc } from './html';
import { CHARACTER_ART, ENEMY_ART, TILE_ART } from './assets';
import { campusLayout, campusScenery } from './campusMap';

const TILE = 70; // 칸 크기(px)
const STEP_MS = 230;

const SVG_NS = 'http://www.w3.org/2000/svg';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 보드와 말. 이동은 한 칸씩 애니메이션한다 */
export class BoardView {
  onTileClick: (tileId: number) => void = () => {};

  private readonly el: HTMLElement;
  private readonly tileEls: HTMLElement[];
  private readonly tokenEls: HTMLElement[];
  private readonly enemyEls = new Map<number, HTMLElement>();
  private readonly layout: ReturnType<typeof campusLayout>;
  /** 화면에 표시 중인 각 플레이어의 칸 */
  private shown: number[];
  private lastSeq = 0;

  constructor(root: HTMLElement, private readonly board: Board, state: GameState) {
    this.layout = campusLayout(board);
    const { width, height } = this.layout;
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;
    this.el.append(campusScenery(board, this.layout), this.drawEdges());

    this.tileEls = board.tiles.map((tile) => {
      const info = TILE_INFO[tile.kind];
      const t = document.createElement('button');
      t.className = `tile kind-${tile.kind}`;
      const center = this.layout.centers[tile.id];
      t.style.left = `${center.x - TILE / 2}px`;
      t.style.top = `${center.y - TILE / 2}px`;
      t.style.zIndex = String(Math.round(center.y));
      t.title = `${tile.id}번 · ${info.name}`;
      const art = TILE_ART[tile.kind];
      t.classList.toggle('has-art', !!art);
      t.innerHTML = `${art ? `<img class="tile-art" src="${art}" alt="" draggable="false">` : `<span class="icon">${info.icon}</span>`}<span class="label">${info.name}</span>`;
      t.onclick = () => this.onTileClick(tile.id);
      this.el.append(t);
      return t;
    });

    this.tokenEls = state.players.map((p) => {
      const tok = document.createElement('div');
      tok.className = 'token';
      tok.style.setProperty('--c', p.color);
      // 캐릭터 말 그림이 있으면 발판 위에 선 꼬마 캐릭터로, 없으면 번호 원
      const art = CHARACTER_ART[p.character]?.token;
      if (art) {
        tok.classList.add('has-art');
        tok.innerHTML = `<img class="token-art" src="${art}" alt="" draggable="false"><b>${p.id + 1}</b><i class="steps"></i>`;
      } else {
        tok.textContent = String(p.id + 1);
      }
      tok.title = p.name;
      this.el.append(tok);
      return tok;
    });

    // 거점: 자리 색 깃발
    for (const p of state.players) {
      const flag = document.createElement('div');
      flag.className = 'home-flag';
      flag.style.setProperty('--c', p.color);
      const c = this.layout.centers[p.home];
      flag.style.left = `${c.x - 26}px`;
      flag.style.top = `${c.y - 30}px`;
      flag.style.zIndex = String(Math.round(c.y) + 1);
      flag.innerHTML = `<i></i><b>${p.id + 1}</b>`;
      flag.title = `${p.name}의 거점`;
      this.el.append(flag);
    }

    // 화면 크기에 맞춰 보드 전체를 확대/축소한다. HUD가 차지할 여백은 .board-area의 padding으로 CSS가 정한다
    const fit = document.createElement('div');
    fit.className = 'board-fit';
    fit.append(this.el);
    root.append(fit);
    new ResizeObserver(() => {
      const style = getComputedStyle(root);
      const availW = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const availH = root.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const scale = Math.min(1.6, availW / width, availH / height);
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
      // 원작처럼 한 칸마다 폴짝, 머리 위에 남은 칸 수
      const tok = this.tokenEls[move.player];
      const steps = tok.querySelector<HTMLElement>('.steps');
      const path = move.path.slice(1);
      for (const [i, tileId] of path.entries()) {
        this.shown[move.player] = tileId;
        this.layoutTokens(move.player);
        tok.classList.remove('hop');
        void tok.offsetWidth;
        tok.classList.add('hop');
        if (steps) {
          const left = path.length - 1 - i;
          steps.textContent = left > 0 ? String(left) : '';
          steps.classList.toggle('show', left > 0);
        }
        await sleep(STEP_MS);
      }
      tok.classList.remove('hop');
      steps?.classList.remove('show');
      this.tileEls[path.at(-1)!]?.classList.remove('landed');
      void this.el.offsetWidth;
      this.tileEls[path.at(-1)!]?.classList.add('landed');
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
      let el = this.enemyEls.get(enemy.id);
      if (!el) {
        el = document.createElement('div');
        el.className = `enemy enemy-${enemy.kind}${enemy.isBoss ? ' boss' : ''}`;
        const art = ENEMY_ART[enemy.kind];
        el.innerHTML = `${art ? `<span class="enemy-art-clip"><img class="enemy-art" src="${art}" alt="" draggable="false"></span>` : `<span class="face">${enemy.icon}</span>`}<i class="ehp"><b></b></i>
          <span class="elabel"><b class="ename">${esc(enemy.name)}</b><span class="ehp-text"></span></span>`;
        this.el.append(el);
        this.enemyEls.set(enemy.id, el);
      }
      const center = this.layout.centers[enemy.tile];
      el.style.left = `${center.x + 25}px`;
      el.style.top = `${center.y - 29}px`;
      el.style.zIndex = String(1000 + Math.round(center.y));
      el.classList.toggle('counter', enemy.counter);
      el.title = `${enemy.name} HP ${enemy.hp}/${enemy.maxHp} · 공격 ${enemy.atk} 방어 ${enemy.def}${enemy.counter ? ' · 반격형' : ''}`;
      el.querySelector<HTMLElement>('.ehp b')!.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
      // 원작처럼 머리 위에 이름 · ⚔공격, 그 아래 HP 숫자
      el.querySelector('.ename')!.innerHTML = `${esc(enemy.name)} <small>⚔${enemy.atk}</small>`;
      el.querySelector('.ehp-text')!.textContent = `${enemy.hp}/${enemy.maxHp}`;
    }
  }

  /** 연출용: 플레이어 말의 화면 좌표 (말 머리 위) */
  tokenPoint(player: number): { x: number; y: number } {
    const r = this.tokenEls[player].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
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
      const { x: cx, y: cy } = this.layout.centers[tileId];
      players.forEach((player, i) => {
        const [dx, dy] = players.length === 1 ? [0, 0] : [(i % 2 ? 1 : -1) * 15, (i < 2 ? -1 : 1) * 15];
        const tok = this.tokenEls[player];
        tok.style.transform = `translate(${cx + dx}px, ${cy + dy}px) translate(-50%, -50%)`;
        tok.style.zIndex = String(2000 + Math.round(cy) + (player === front ? 1 : 0));
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

    const center = (id: number) => this.layout.centers[id];
    const midX = this.layout.width / 2;
    const midY = this.layout.height / 2;

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

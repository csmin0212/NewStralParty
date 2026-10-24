import { TILE_INFO } from '../data/board';
import { ENEMIES } from '../data/enemies';
import { bossEnemy, dangerTiles, markName } from '../engine/boss';
import type { Board, BossTurn, Enemy, EnemyKind, GameState, Mark } from '../engine/types';
import { esc } from './html';
import { BOSS_ART, ENEMY_ART, MARK_ART, TILE_ART } from './assets';
import { campusLayout, campusScenery } from './campusMap';
import { MAP_THEMES } from '../data/maps';
import { mapScenery } from './mapScenery';
import { wait as sleep } from './settings';
import { sfx } from './sound';
import { skinArt } from './skins';

const TILE = 70; // 칸 크기(px)
const STEP_MS = 230;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 보드와 말. 이동은 한 칸씩 애니메이션한다 */
export class BoardView {
  onTileClick: (tileId: number) => void = () => {};

  private readonly el: HTMLElement;
  private readonly tileEls: HTMLElement[];
  private readonly tokenEls: HTMLElement[];
  private readonly enemyEls = new Map<number, HTMLElement>();
  private readonly markEls = new Map<number, HTMLElement>();
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
    const theme = board.id ? MAP_THEMES[board.id] : undefined;
    this.el.append(theme ? mapScenery(board, this.layout, theme) : campusScenery(board, this.layout), this.drawEdges());
    if (theme) root.style.setProperty('--map-sky', theme.sky);

    this.tileEls = board.tiles.map((tile) => {
      const info = TILE_INFO[tile.kind];
      const t = document.createElement('button');
      t.className = `tile kind-${tile.kind}`;
      const center = this.layout.centers[tile.id];
      t.style.left = `${center.x - TILE / 2}px`;
      t.style.top = `${center.y - TILE / 2}px`;
      t.style.zIndex = String(Math.round(center.y));
      t.title = `${tile.id}번 · ${info.name}${info.text ? ` · ${info.text}` : ''}`;
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
      const art = skinArt(p.character, p.skin).token;
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
    // 이어하기: 마지막 이동은 이미 끝난 것으로
    this.lastSeq = state.lastMove?.seq ?? 0;
    this.layoutTokens(state.current);
    this.renderEnemies(state);
    this.renderMarks(state);
    this.highlight(state);
  }

  /**
   * 보스 차례: 에너미(보스 포함)가 지나간 칸을 한 칸씩 따라 움직이고, 맞은 아군 말이 흔들린다.
   * 끝나면 밀려난 말 · 새 표식까지 모두 새 상태로 맞춘다
   */
  async playBossTurn(state: GameState, turn: BossTurn) {
    await Promise.all(
      turn.moved.map(async ({ enemy, path }) => {
        const el = this.enemyEls.get(enemy);
        if (!el) return;
        for (const tileId of path.slice(1)) {
          this.placeEnemy(el, tileId);
          await sleep(STEP_MS);
        }
      }),
    );
    for (const hit of turn.hits) {
      if (hit.amount <= 0) continue;
      const tok = this.tokenEls[hit.player];
      tok.classList.remove('struck');
      void tok.offsetWidth;
      tok.classList.add('struck');
    }
    this.shown = state.players.map((p) => p.tile);
    this.layoutTokens(state.current);
    this.renderEnemies(state);
    this.renderMarks(state);
    this.highlight(state);
  }

  /** 이 보드 그림인지 (매직 아카데미 2단처럼 맵이 바뀌면 새로 그린다) */
  isFor(board: Board): boolean {
    return board.id === this.board.id && board.tiles.length === this.board.tiles.length;
  }

  /** 칸 종류가 바뀌었으면 (건물) 다시 그린다 */
  private syncTiles(state: GameState) {
    state.board.tiles.forEach((tile, i) => {
      const t = this.tileEls[i];
      if (!t || t.classList.contains(`kind-${tile.kind}`)) return;
      const info = TILE_INFO[tile.kind];
      t.className = `tile kind-${tile.kind}`;
      const art = TILE_ART[tile.kind];
      t.classList.toggle('has-art', !!art);
      t.title = `${tile.id}번 · ${info.name}${info.text ? ` · ${info.text}` : ''}`;
      t.innerHTML = `${art ? `<img class="tile-art" src="${art}" alt="" draggable="false">` : `<span class="icon">${info.icon}</span>`}<span class="label">${info.name}</span>`;
    });
  }

  /** 새 상태를 보여 준다. 새 이동이 있으면 말이 다 움직인 뒤에 resolve */
  async show(state: GameState) {
    this.syncTiles(state);
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
        sfx('step');
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
    this.renderMarks(state);
    this.highlight(state);
  }

  private placeEnemy(el: HTMLElement, tileId: number) {
    const center = this.layout.centers[tileId];
    el.style.left = `${center.x + 25}px`;
    el.style.top = `${center.y - 29}px`;
    el.style.zIndex = String(1000 + Math.round(center.y));
  }

  /** 표식은 칸 왼쪽 아래에 둥근 배지로 (폭탄은 남은 차례, 난로는 남은 불) */
  private renderMarks(state: GameState) {
    const live = new Set(state.marks.map((m) => m.id));
    for (const [id, el] of this.markEls) {
      if (live.has(id)) continue;
      this.markEls.delete(id);
      el.classList.add('gone');
      setTimeout(() => el.remove(), 400);
    }
    for (const m of state.marks) {
      let el = this.markEls.get(m.id);
      if (!el) {
        el = document.createElement('div');
        el.className = `mark mark-${m.kind}`;
        const art = MARK_ART[m.kind];
        el.innerHTML = `${art ? `<img src="${art}" alt="" draggable="false">` : `<span>${MARK_ICON[m.kind]}</span>`}<b class="mark-count"></b>`;
        this.el.append(el);
        this.markEls.set(m.id, el);
      }
      const c = this.layout.centers[m.tile];
      el.style.left = `${c.x - 22}px`;
      el.style.top = `${c.y + 4}px`;
      el.style.zIndex = String(1500 + Math.round(c.y));
      const count = markCount(state, m);
      el.querySelector('.mark-count')!.textContent = count;
      el.classList.toggle('players', m.kind === 'organ' && state.bossState.organ === 'players');
      el.title = markTitle(state, m);
    }
  }
  private renderEnemies(state: GameState) {
    const alive = new Set(state.enemies.map((e) => e.id));
    for (const [id, el] of this.enemyEls) {
      if (alive.has(id)) continue;
      this.enemyEls.delete(id);
      el.classList.add('gone');
      setTimeout(() => el.remove(), 400);
    }

    const boss = bossEnemy(state);
    for (const enemy of state.enemies) {
      // 고즈 분신은 화면에서 진짜 보스와 똑같이 보인다 (체력 · 공격력까지 보스 값)
      const decoy = !enemy.isBoss && ENEMIES[enemy.kind as EnemyKind].decoy;
      const shown: Enemy = decoy && boss ? { ...boss, id: enemy.id, tile: enemy.tile } : enemy;
      const looksBoss = enemy.isBoss || decoy;
      let el = this.enemyEls.get(enemy.id);
      if (!el) {
        el = document.createElement('div');
        el.className = `enemy enemy-${looksBoss ? 'boss' : enemy.kind}${looksBoss ? ' boss' : ''}`;
        el.innerHTML = `<span class="enemy-art-clip"></span><i class="ehp"><b></b></i><i class="emark"></i>
          <span class="elabel"><b class="ename"></b><span class="ehp-text"></span></span>`;
        this.el.append(el);
        this.enemyEls.set(enemy.id, el);
        this.placeEnemy(el, enemy.tile);
      }
      // 2페이즈에서 모습이 바뀌면 그림 · 아이콘도 바꾼다
      const art = looksBoss ? BOSS_ART[state.boss.id]?.[state.bossState.phase === 2 ? 'phase2' : 'token'] : ENEMY_ART[enemy.kind];
      const face = art ? `<img class="enemy-art" src="${art}" alt="" draggable="false">` : `<span class="face">${shown.icon}</span>`;
      const clip = el.querySelector<HTMLElement>('.enemy-art-clip')!;
      if (clip.dataset.face !== face) {
        clip.dataset.face = face;
        clip.innerHTML = face;
      }
      this.placeEnemy(el, enemy.tile);
      el.classList.toggle('counter', shown.counter);
      el.classList.toggle('burrowed', enemy.isBoss && state.bossState.hidden);
      el.classList.toggle('groggy', enemy.isBoss && state.bossState.groggy > 0);
      el.title = `${shown.name} HP ${shown.hp}/${shown.maxHp} · 공격 ${shown.atk} 방어 ${shown.def}${shown.counter ? ' · 반격형' : ''}${enemyTrait(enemy)}`;
      el.querySelector<HTMLElement>('.ehp b')!.style.width = `${(shown.hp / shown.maxHp) * 100}%`;
      // 원작처럼 머리 위에 이름 · ⚔공격, 그 아래 HP 숫자
      el.querySelector('.ename')!.innerHTML = `${esc(shown.name)} <small>⚔${shown.atk}</small>`;
      el.querySelector('.ehp-text')!.textContent = enemy.isBoss && state.bossState.hidden ? '땅속' : `${shown.hp}/${shown.maxHp}`;
      const markEl = el.querySelector<HTMLElement>('.emark')!;
      markEl.textContent = enemy.mark ? `🎯${enemy.mark}` : '';
      markEl.title = enemy.mark ? `표식 ${enemy.mark} · 모든 피해 +1` : '';
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
    const danger = dangerTiles(state);
    this.tileEls.forEach((t, id) => {
      t.classList.toggle('choice', options.includes(id));
      t.classList.toggle('danger', danger.has(id));
    });
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
        // 양방향 길은 한 번만, 화살표 없이
        const both = this.board.twoWay && this.board.tiles[n].next.includes(tile.id);
        if (both && n < tile.id) continue;
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
        if (!both) line.setAttribute('marker-end', 'url(#arrow)');
        line.classList.add(!both && tile.next.length > 1 ? 'fork' : 'path');
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

const MARK_ICON: Record<Mark['kind'], string> = {
  bomb: '💣',
  relicGreen: '💚',
  relicRed: '❤️',
  hat: '🎩',
  organ: '🎹',
  heater: '🔥',
  fire: '🔥',
  egg: '🥚',
  gourd: '🍶',
  mist: '🌫️',
  mushroom: '🍄',
  starfruit: '⭐',
  peach: '🍑',
  moneyTree: '💰',
};

function markCount(state: GameState, m: Mark): string {
  if (m.kind === 'bomb') return String(m.timer ?? '');
  if (m.kind === 'heater') return String(state.bossState.heater);
  return '';
}

function markTitle(state: GameState, m: Mark): string {
  switch (m.kind) {
    case 'bomb':
      return `폭탄 · ${m.timer === 1 ? '다음 보스 차례에' : `${m.timer}번째 보스 차례에`} 주변 1칸 ${m.power} 피해 · 멈추면 해체 (코인 +2)`;
    case 'relicGreen':
      return '초록 성유물 · 멈추면 보스가 받는 피해 +1';
    case 'relicRed':
      return '빨강 성유물 · 멈추면 보스의 다음 행동을 끊는다';
    case 'hat':
      return '모자 · 하나에만 코인 6. 빈 모자는 2 피해, 다음 보스 차례에 터진다';
    case 'organ':
      return `파이프 오르간 · 지금 ${state.bossState.organ === 'players' ? '아군' : '보스'} 쪽. 멈추면 아군 쪽으로`;
    case 'heater':
      return `난로 ${state.bossState.heater} / ${state.boss.passive?.heater?.hp ?? 0} · 멈추면 +3 · 체력 +2`;
    case 'fire':
      return `불길 · 멈추면 ${m.power} 피해`;
  }
  return markName(m.kind);
}

/** 에너미 특성 한 줄 (툴팁) */
function enemyTrait(e: Enemy): string {
  if (e.isBoss) return '';
  const info = ENEMIES[e.kind as EnemyKind];
  const parts: string[] = [];
  if (info.decoy) return '';
  if (info.steal) parts.push(`덮치면 코인 ${info.steal} 훔침${e.loot ? ` (훔친 코인 ${e.loot})` : ''}`);
  else if (info.roam) parts.push(`보스 차례마다 ${info.chase ? '가까운 아군을 쫓아' : ''} 1~${info.roam}칸 이동`);
  if (info.fuse) parts.push(`${e.timer ?? info.fuse.turns}차례 뒤 자폭 (주변 ${info.fuse.range}칸 ${info.fuse.amount})`);
  if (info.calls) parts.push(`${info.calls.every}차례마다 ${ENEMIES[info.calls.kind].name} 호출`);
  if (info.link) parts.push('받은 피해를 보스도 받는다');
  return parts.length ? `\n${parts.join(' · ')}` : '';
}

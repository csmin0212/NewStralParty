import type { Board } from '../engine/types';

const NS = 'http://www.w3.org/2000/svg';
const MARGIN = 92;

export function campusVector(x: number, y: number) {
  return { x: x * 90 - y * 56, y: x * 29 + y * 65 };
}

/** 화면 좌표만 바꾼다. 칸 번호와 이동 그래프는 보드 데이터가 계속 관리한다. */
export function campusLayout(board: Board) {
  const maxX = Math.max(...board.tiles.map(t => t.x));
  const maxY = Math.max(...board.tiles.map(t => t.y));
  const project = (x: number, y: number) => {
    const v = campusVector(x, y);
    return { x: MARGIN + maxY * 56 + v.x, y: MARGIN + v.y };
  };
  return {
    project,
    centers: board.tiles.map(t => project(t.x, t.y)),
    width: MARGIN * 2 + maxX * 90 + maxY * 56,
    height: MARGIN * 2 + maxX * 29 + maxY * 65,
    maxX, maxY,
  };
}

type Layout = ReturnType<typeof campusLayout>;

/** 지형과 건물 위에 이벤트 그림과 이동하는 말을 별도 레이어로 올린다. */
export function campusScenery(board: Board, layout: Layout): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('campus-scenery');
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('aria-hidden', 'true');
  const p = layout.project;
  const point = (x: number, y: number, z = 0) => {
    const a = p(x, y);
    return `${a.x},${a.y - z}`;
  };
  const quad = (x: number, y: number, w: number, d: number, z = 0) =>
    [point(x, y, z), point(x + w, y, z), point(x + w, y + d, z), point(x, y + d, z)].join(' ');
  const polygon = (points: string, fill: string, stroke = '#b3cde2') =>
    `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const block = (x: number, y: number, w: number, d: number, h: number, roof = '#fff', side = '#c3dced') => {
    return polygon([point(x, y + d), point(x + w, y + d), point(x + w, y + d, h), point(x, y + d, h)].join(' '), side)
      + polygon([point(x + w, y), point(x + w, y + d), point(x + w, y + d, h), point(x + w, y, h)].join(' '), '#91b8d4')
      + polygon(quad(x, y, w, d, h), roof);
  };
  const { maxX, maxY } = layout;
  let markup = `<defs><pattern id="campus-grid" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="matrix(1 .322 -.862 1 0 0)"><path d="M48 0H0V48" fill="none" stroke="#c8dce9" stroke-width=".7"/></pattern></defs>`;
  markup += `<g class="campus-island">${block(-.65, -.6, maxX + 1.3, maxY + 1.2, -18, '#e5eff5', '#92b9d3')}`;
  markup += polygon(quad(-.65, -.6, maxX + 1.3, maxY + 1.2), 'url(#campus-grid)', 'transparent');

  // 교차점까지 같은 지면으로 이어지는 넓은 보행로.
  const roads = board.tiles.flatMap(tile => tile.next.map(id => {
    const a = layout.centers[tile.id], b = layout.centers[id];
    return `M${a.x},${a.y}L${b.x},${b.y}`;
  })).join(' ');
  markup += `<path d="${roads}" fill="none" stroke="#b8cedd" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/>`;
  markup += `<path d="${roads}" fill="none" stroke="#fff" stroke-width="65" stroke-linecap="round" stroke-linejoin="round"/>`;
  markup += `<path d="${roads}" fill="none" stroke="#e6f4ff" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>`;

  // 루프 안쪽에 교사와 중정 배치. 작은 커스텀 맵에서는 지면만 그린다.
  if (maxX >= 7 && maxY >= 4) {
    markup += polygon(quad(.7, .75, 1.6, 2.5), '#b8dfcf', '#94c4b4');
    markup += polygon(quad(4.05, .8, 2.15, 2.5), '#c4e7d8', '#a6cfbe');
    markup += block(1.02, 1.22, 1.05, .95, 63);
    markup += block(1.14, 1.34, .81, .7, 67, '#b4e2f6');
    // 건물 정면의 큰 창.
    for (let i = 0; i < 4; i++) {
      const x = 1.11 + i * .23;
      markup += polygon([point(x, 2.175, 21), point(x + .16, 2.175, 21), point(x + .16, 2.175, 48), point(x, 2.175, 48)].join(' '), '#68b9e5', '#ecf9ff');
    }
    markup += block(4.42, 1.13, 1.4, 1.04, 82);
    markup += block(4.56, 1.27, 1.12, .78, 86, '#91d2f1');
    markup += block(4.7, 1.39, .84, .54, 92, '#eaf8ff');
    for (let i = 0; i < 5; i++) {
      const x = 4.51 + i * .25;
      markup += polygon([point(x, 2.175, 21), point(x + .17, 2.175, 21), point(x + .17, 2.175, 66), point(x, 2.175, 66)].join(' '), '#6cbce9', '#e7f6ff');
    }
    // 중정의 수반과 벤치.
    markup += block(4.55, 2.78, 1.05, .42, 5, '#95d9ee');
    markup += block(1.01, 2.8, .66, .16, 10, '#f3d9a5', '#c3a77e');
    for (const [x, y] of [[.9, .9], [2.12, 2.9], [4.13, 2.95], [6.03, .96], [6.03, 3.02]]) {
      const a = p(x, y);
      markup += `<ellipse cx="${a.x}" cy="${a.y + 3}" rx="20" ry="8" fill="#79b79d" opacity=".25"/><path d="M${a.x} ${a.y}v-25" stroke="#9aadb1" stroke-width="5"/><ellipse cx="${a.x}" cy="${a.y - 30}" rx="19" ry="24" fill="#8dceba" stroke="#72baa5"/><ellipse cx="${a.x - 5}" cy="${a.y - 37}" rx="11" ry="15" fill="#b7e4ce"/>`;
    }
    const plaza = p(5.1, 3.08);
    markup += `<text x="${plaza.x}" y="${plaza.y + 35}" text-anchor="middle" fill="#7ba2b9" font-size="10" font-family="sans-serif" letter-spacing="3" transform="rotate(18 ${plaza.x} ${plaza.y + 35})">CENTRAL CAMPUS</text>`;
  }
  markup += '</g>';
  svg.innerHTML = markup;
  return svg;
}

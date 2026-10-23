// 보스 맵 배경: 섬 · 길 · 소품 · 랜드마크를 맵 테마(data/maps.ts)대로 그린다. 좌표 변환은 campusMap과 같다.

import type { MapTheme, Prop, PropKind } from '../data/maps';
import type { Board } from '../engine/types';
import type { campusLayout } from './campusMap';

const NS = 'http://www.w3.org/2000/svg';

type Layout = ReturnType<typeof campusLayout>;

/** 맵 id로 정해지는 난수 (소품 자리 · 종류가 판마다 같다) */
function seeded(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function mapScenery(board: Board, layout: Layout, theme: MapTheme): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('campus-scenery', `map-${board.id}`);
  svg.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute('aria-hidden', 'true');
  const p = layout.project;
  const pt = (x: number, y: number, z = 0) => {
    const a = p(x, y);
    return `${a.x},${a.y - z}`;
  };
  const quad = (x: number, y: number, w: number, d: number, z = 0) =>
    [pt(x, y, z), pt(x + w, y, z), pt(x + w, y + d, z), pt(x, y + d, z)].join(' ');
  const poly = (points: string, fill: string, stroke = 'none', sw = 1.2) =>
    `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  /** 상자: 앞 · 옆 · 윗면 */
  const box = (x: number, y: number, w: number, d: number, h: number, top: string, side = shade(top, -0.18)) =>
    poly([pt(x, y + d), pt(x + w, y + d), pt(x + w, y + d, h), pt(x, y + d, h)].join(' '), side, shade(side, -0.15)) +
    poly([pt(x + w, y), pt(x + w, y + d), pt(x + w, y + d, h), pt(x + w, y, h)].join(' '), shade(side, -0.14), shade(side, -0.25)) +
    poly(quad(x, y, w, d, h), top, shade(top, -0.12));
  const shadow = (x: number, y: number, rx = 18, ry = 7) => {
    const a = p(x, y);
    return `<ellipse cx="${a.x}" cy="${a.y + 2}" rx="${rx}" ry="${ry}" fill="#000" opacity=".12"/>`;
  };
  const { a: A, b: B, c: C } = theme.palette;

  /** 소품 하나. (x, y): 칸 가운데 */
  const prop = (pr: Prop): string => {
    const { x, y } = pr;
    const at = p(x, y);
    const cx = at.x;
    const cy = at.y;
    const h = pr.h ?? 0;
    const w = pr.w ?? 0.5;
    const d = pr.d ?? 0.5;
    switch (pr.t) {
      case 'block': {
        // 흩어 놓은 건물: 크기 · 높이를 자리마다 조금씩, 색은 땅에서
        const bw = pr.w ?? 0.45 + ((x * 7 + y * 3) % 1) * 0.25;
        const bh = h || 22 + Math.round(((x * 13 + y * 5) % 1) * 30);
        return shadow(x, y, 30, 11) + box(x - bw / 2, y - bw / 2, pr.w ? w : bw, pr.d ? d : bw, bh, pr.c ?? shade(theme.ground, 0.35), pr.c2 ?? shade(theme.side, 0.35));
      }
      case 'tower': {
        const top = pr.c ?? '#ffffff';
        const hh = h || 90;
        return (
          shadow(x, y, 44, 16) +
          box(x - w / 2, y - d / 2, w, d, hh, top, pr.c2) +
          box(x - w / 3, y - d / 3, (w * 2) / 3, (d * 2) / 3, hh + 18, shade(top, 0.25), pr.c2) +
          `<circle cx="${p(x, y).x}" cy="${p(x, y).y - hh - 30}" r="5" fill="${B}"/>`
        );
      }
      case 'tree':
        return `${shadow(x, y)}<path d="M${cx} ${cy}v-22" stroke="#8d7a66" stroke-width="5"/><ellipse cx="${cx}" cy="${cy - 30}" rx="18" ry="22" fill="${B}" stroke="${shade(B, -0.2)}"/><ellipse cx="${cx - 5}" cy="${cy - 37}" rx="9" ry="12" fill="${shade(B, 0.35)}"/>`;
      case 'pine':
        return `${shadow(x, y, 16, 6)}<path d="M${cx} ${cy}v-12" stroke="#7a6550" stroke-width="5"/><path d="M${cx - 20} ${cy - 10}L${cx} ${cy - 40}L${cx + 20} ${cy - 10}Z" fill="${B}"/><path d="M${cx - 15} ${cy - 30}L${cx} ${cy - 58}L${cx + 15} ${cy - 30}Z" fill="${shade(B, 0.12)}"/><path d="M${cx - 9} ${cy - 50}L${cx} ${cy - 64}L${cx + 9} ${cy - 50}Z" fill="#fff"/>`;
      case 'palm':
        return `${shadow(x, y, 16, 6)}<path d="M${cx} ${cy}q4 -26 -4 -50" fill="none" stroke="#b08a5a" stroke-width="6" stroke-linecap="round"/>${[-50, -15, 20, 55, 160, 200]
          .map((r) => `<ellipse cx="${cx - 4}" cy="${cy - 50}" rx="22" ry="6" fill="${C}" transform="rotate(${r} ${cx - 4} ${cy - 50}) translate(16 0)"/>`)
          .join('')}`;
      case 'cactus':
        return `${shadow(x, y, 12, 5)}<rect x="${cx - 6}" y="${cy - 40}" width="12" height="40" rx="6" fill="${B}"/><path d="M${cx - 6} ${cy - 20}h-8v-12" fill="none" stroke="${B}" stroke-width="7" stroke-linecap="round"/><path d="M${cx + 6} ${cy - 26}h8v-10" fill="none" stroke="${B}" stroke-width="7" stroke-linecap="round"/>`;
      case 'rock':
        return `${shadow(x, y, 16, 6)}<path d="M${cx - 18} ${cy}L${cx - 12} ${cy - 14}L${cx + 2} ${cy - 20}L${cx + 16} ${cy - 10}L${cx + 18} ${cy}Z" fill="#b6b2ab" stroke="#8f8a82"/><path d="M${cx - 12} ${cy - 14}L${cx + 2} ${cy - 20}L${cx + 4} ${cy - 8}Z" fill="#d6d2cb"/>`;
      case 'dune':
        return `<ellipse cx="${cx}" cy="${cy}" rx="34" ry="11" fill="${shade(theme.ground, -0.08)}"/><path d="M${cx - 28} ${cy}q20 -16 50 -2" fill="none" stroke="${shade(theme.ground, 0.35)}" stroke-width="2"/>`;
      case 'pool':
        return poly(quad(x - w / 2, y - d / 2, w, d), pr.c ?? '#5ec8e8', '#ffffff', 3) + poly(quad(x - w / 2 + 0.15, y - d / 2 + 0.15, w - 0.3, d - 0.3), shade(pr.c ?? '#5ec8e8', 0.25));
      case 'lamp':
        return `${shadow(x, y, 8, 3)}<path d="M${cx} ${cy}v-42" stroke="${shade(C, -0.2)}" stroke-width="3"/><circle cx="${cx}" cy="${cy - 44}" r="10" fill="${A}" opacity=".25"/><circle cx="${cx}" cy="${cy - 44}" r="5" fill="#fffbe6"/>`;
      case 'lantern':
        return `${shadow(x, y, 8, 3)}<path d="M${cx} ${cy}v-30" stroke="#5a4636" stroke-width="2"/><ellipse cx="${cx}" cy="${cy - 40}" rx="10" ry="13" fill="${A}"/><ellipse cx="${cx}" cy="${cy - 40}" rx="16" ry="18" fill="${A}" opacity=".2"/><path d="M${cx - 10} ${cy - 40}h20" stroke="${shade(A, -0.3)}" stroke-width="1.5"/>`;
      case 'crate':
        return shadow(x, y, 16, 6) + box(x - 0.2, y - 0.17, 0.4, 0.34, 20, '#d9b27c', '#b58a52');
      case 'pipe':
        return shadow(x, y, 30, 8) + box(x - 0.42, y - 0.08, 0.84, 0.16, 14, '#c3ccd6', '#8a96a5') + box(x + 0.25, y - 0.12, 0.12, 0.24, 30, B);
      case 'tent': {
        const tw = (pr.w ?? 0.8) * 46;
        const th = h || 40;
        const col = pr.c ?? A;
        return `${shadow(x, y, tw * 0.9, tw * 0.32)}<path d="M${cx - tw} ${cy}L${cx} ${cy - th}L${cx + tw} ${cy}Z" fill="${col}"/><path d="M${cx - tw * 0.33} ${cy}L${cx} ${cy - th}L${cx + tw * 0.33} ${cy}Z" fill="#fff" opacity=".85"/><path d="M${cx} ${cy - th}v-12" stroke="${shade(col, -0.3)}" stroke-width="2"/><path d="M${cx} ${cy - th - 12}l10 4l-10 4z" fill="${B}"/>`;
      }
      case 'shelf': {
        const sw = pr.w ?? 0.6;
        const sh = h || 40;
        let out = shadow(x, y, 26, 9) + box(x - sw / 2, y - 0.12, sw, 0.24, sh, '#8a5a3c', '#6d4429');
        // 책등
        const cols = [A, B, C, '#e8405f', '#ffd166'];
        for (let i = 0; i < Math.round(sw * 8); i++) {
          const bx = x - sw / 2 + 0.04 + i * 0.12;
          for (let row = 0; row < 3; row++) {
            const z0 = 4 + row * (sh / 3);
            out += poly([pt(bx, y + 0.12, z0), pt(bx + 0.09, y + 0.12, z0), pt(bx + 0.09, y + 0.12, z0 + sh / 3 - 6), pt(bx, y + 0.12, z0 + sh / 3 - 6)].join(' '), cols[(i + row) % cols.length]);
          }
        }
        return out;
      }
      case 'pillar':
        return shadow(x, y, 12, 5) + box(x - 0.1, y - 0.1, 0.2, 0.2, h || 46, '#fbf6ea', '#d8cdb5') + box(x - 0.15, y - 0.15, 0.3, 0.3, (h || 46) + 6, '#ffffff', '#d8cdb5');
      case 'seat': {
        let out = '';
        for (let r = 0; r < 3; r++) out += box(x - 0.4, y - 0.3 + r * 0.2, 0.8, 0.16, 6 + r * 8, r % 2 ? A : shade(A, 0.3));
        return out;
      }
      case 'umbrella':
        return `${shadow(x, y, 20, 7)}<path d="M${cx} ${cy}v-36" stroke="#8d7a66" stroke-width="3"/><path d="M${cx - 24} ${cy - 30}Q${cx} ${cy - 56} ${cx + 24} ${cy - 30}Z" fill="${B}"/><path d="M${cx - 8} ${cy - 30}Q${cx} ${cy - 56} ${cx + 8} ${cy - 30}Z" fill="#fff"/>`;
      case 'snowman':
        return `${shadow(x, y, 14, 5)}<circle cx="${cx}" cy="${cy - 12}" r="13" fill="#fff" stroke="#c9dbee"/><circle cx="${cx}" cy="${cy - 32}" r="9" fill="#fff" stroke="#c9dbee"/><path d="M${cx} ${cy - 32}l8 2l-8 2z" fill="#ff9a3c"/><path d="M${cx - 9} ${cy - 25}h18" stroke="#e8405f" stroke-width="3"/>`;
      case 'ice':
        return `<path d="M${cx - 28} ${cy}L${cx} ${cy - 10}L${cx + 28} ${cy}L${cx} ${cy + 10}Z" fill="#cfeaff" stroke="#fff" stroke-width="2"/><path d="M${cx - 10} ${cy - 2}l14 -4" stroke="#fff" stroke-width="2"/>`;
      case 'torii': {
        const th = h || 56;
        return `${shadow(x, y, 30, 8)}<path d="M${cx - 20} ${cy}v-${th}M${cx + 20} ${cy}v-${th}" stroke="#e8405f" stroke-width="7"/><path d="M${cx - 32} ${cy - th}h64" stroke="#2b1d2e" stroke-width="7" stroke-linecap="round"/><path d="M${cx - 24} ${cy - th + 12}h48" stroke="#e8405f" stroke-width="5"/>`;
      }
      case 'flag':
        return `${shadow(x, y, 8, 3)}<path d="M${cx} ${cy}v-48" stroke="#7a7a7a" stroke-width="2.5"/><path d="M${cx} ${cy - 48}l22 7l-22 7z" fill="${A}"/>`;
      case 'server': {
        let out = shadow(x, y, 16, 6) + box(x - 0.18, y - 0.18, 0.36, 0.36, 50, '#3d5478', '#24365a');
        for (let i = 0; i < 4; i++) {
          const a = p(x - 0.08, y + 0.18);
          out += `<rect x="${a.x - 4}" y="${a.y - 12 - i * 10}" width="14" height="3" rx="1.5" fill="${i % 2 ? C : A}"/>`;
        }
        return out;
      }
    }
  };

  const { maxX, maxY } = layout;
  const pad = 0.75;
  let markup = `<defs><pattern id="grid-${board.id}" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="matrix(1 .322 -.862 1 0 0)"><path d="M48 0H0V48" fill="none" stroke="${theme.grid}" stroke-width=".8"/></pattern></defs>`;
  markup += `<g class="campus-island">`;
  markup += box(-pad, -pad, maxX + pad * 2, maxY + pad * 2, -22, theme.ground, theme.side);
  markup += poly(quad(-pad, -pad, maxX + pad * 2, maxY + pad * 2), `url(#grid-${board.id})`);

  // 길
  const roads = board.tiles
    .flatMap((tile) =>
      tile.next.map((id) => {
        const a = layout.centers[tile.id];
        const b = layout.centers[id];
        return `M${a.x},${a.y}L${b.x},${b.y}`;
      }),
    )
    .join(' ');
  const [edge, mid, inner] = theme.road;
  markup += `<path d="${roads}" fill="none" stroke="${edge}" stroke-width="72" stroke-linecap="round" stroke-linejoin="round"/>`;
  markup += `<path d="${roads}" fill="none" stroke="${mid}" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>`;
  markup += `<path d="${roads}" fill="none" stroke="${inner}" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>`;

  // 바닥 글자 (아래 가장자리)
  const lab = p(maxX / 2 + 1, maxY + 0.5);
  markup += `<text x="${lab.x}" y="${lab.y + 8}" text-anchor="middle" fill="${shade(theme.side, 0.2)}" font-size="13" font-weight="700" font-family="sans-serif" letter-spacing="4" transform="rotate(18 ${lab.x} ${lab.y + 8})">${theme.label}</text>`;

  // 소품: 길에서 떨어진 빈 격자 (가로 · 세로로 0.5칸씩)
  const rand = seeded(board.id ?? 'map');
  const tileAt = board.tiles.map((t) => [t.x, t.y] as const);
  const near = (x: number, y: number, r: number) => tileAt.some(([tx, ty]) => Math.abs(tx - x) < r && Math.abs(ty - y) < r);
  const inLandmark = (x: number, y: number) =>
    theme.landmarks.some((l) => Math.abs(l.x - x) < (l.w ?? 0.6) / 2 + 0.7 && Math.abs(l.y - y) < (l.d ?? 0.6) / 2 + 0.7);
  const total = theme.scatter.reduce((a, [, w]) => a + w, 0);
  const pick = (): PropKind => {
    let r = rand() * total;
    for (const [k, w] of theme.scatter) if ((r -= w) < 0) return k;
    return theme.scatter[0][0];
  };
  const items: Prop[] = [...theme.landmarks];
  for (let gy = -0.25; gy <= maxY + 0.25; gy += 0.5) {
    for (let gx = -0.25; gx <= maxX + 0.25; gx += 0.5) {
      if (near(gx, gy, 0.75) || inLandmark(gx, gy)) continue;
      if (rand() > theme.density) continue;
      const jx = (rand() - 0.5) * 0.2;
      const jy = (rand() - 0.5) * 0.2;
      items.push({ t: pick(), x: gx + jx, y: gy + jy });
    }
  }
  // 앞에 있는 것(화면 아래)을 나중에
  items.sort((a, b) => p(a.x, a.y).y - p(b.x, b.y).y);
  for (const it of items) markup += prop(it);
  markup += '</g>';
  svg.innerHTML = markup;
  return svg;
}

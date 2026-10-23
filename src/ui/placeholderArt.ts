/**
 * 캐릭터 그림이 오기 전까지 쓰는 임시 실루엣 (SVG data URI). 캐릭터 색 실루엣 + 이름 첫 글자.
 * 그림이 오면 assets.ts의 CHARACTER_ART에서 이 함수를 빼고 파일 경로로 바꾼다.
 */
export function placeholderFigure(initial: string, color: string, shape: 'tall' | 'square'): string {
  const [w, h] = shape === 'tall' ? [400, 600] : [400, 400];
  const cx = w / 2;
  const head = shape === 'tall' ? 150 : 140;
  const r = shape === 'tall' ? 70 : 62;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${color}" stop-opacity="0.95"/>
          <stop offset="1" stop-color="${color}" stop-opacity="0.55"/>
        </linearGradient>
      </defs>
      <circle cx="${cx}" cy="${head}" r="${r}" fill="url(#g)" stroke="#fff" stroke-width="8"/>
      <path d="M${cx - r * 1.6} ${h - 10} Q${cx - r * 1.5} ${head + r * 1.25} ${cx} ${head + r * 1.15} Q${cx + r * 1.5} ${head + r * 1.25} ${cx + r * 1.6} ${h - 10} Z"
        fill="url(#g)" stroke="#fff" stroke-width="8"/>
      <text x="${cx}" y="${head + r * 0.36}" text-anchor="middle" font-family="Exo 2, sans-serif" font-style="italic"
        font-weight="900" font-size="${r * 1.05}" fill="#fff">${initial}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

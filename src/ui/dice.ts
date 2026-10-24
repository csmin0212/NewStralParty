/** 주사위 면마다 점 위치 (3×3 칸 번호 0~8) */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** 앞면에 n이 오도록 돌리는 각도 (앞 1 · 뒤 6 · 오른쪽 3 · 왼쪽 4 · 위 5 · 아래 2) */
const FACE_ROT: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  5: [-90, 0],
  2: [90, 0],
};

const face = (n: number, side: string) =>
  `<span class="die-face die-${side}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'pip' : ''}"></i>`).join('')}</span>`;

/**
 * 원작처럼 화면 가운데에서 굴러가다 멈추는 3D 주사위. 멈춘 뒤 합계를 띄운다.
 * fixed: 스마트 주사위처럼 정해 둔 눈이면 굴리지 않고 바로 보여 준다.
 */
export function diceHtml(values: number[], extra: number, fixed = false): string {
  const dice = values
    .map((v, i) => {
      const [rx, ry] = FACE_ROT[Math.min(6, Math.max(1, v))];
      // 주사위마다 도는 바퀴 수를 조금씩 다르게
      const spin = 2 + i;
      return `
        <span class="die-drop" style="--i:${i}">
          <span class="die ${fixed ? 'fixed' : ''}" style="--rx:${rx}deg;--ry:${ry}deg;--spin:${spin}">
            ${face(1, 'front')}${face(6, 'back')}${face(3, 'right')}${face(4, 'left')}${face(5, 'top')}${face(2, 'bottom')}
          </span>
          <i class="die-shadow"></i>
        </span>`;
    })
    .join('');
  const sum = values.reduce((a, b) => a + b, 0);
  const parts = values.join(' + ') + (extra > 0 ? ` + ${extra}` : '');
  const formula = values.length > 1 || extra > 0 ? `<small>${parts} =</small>` : '';
  return `
    <div class="dice-roll">
      <div class="dice-row">${dice}</div>
      <div class="dice-total">${formula}<b>${sum + extra}</b><span>칸</span></div>
    </div>`;
}

/** 사용자 입력(플레이어 이름 등)을 innerHTML에 넣기 전에 반드시 거친다 */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** 파스텔 우주 팔레트에 맞춘 플레이어 색: 핑크, 하늘, 민트, 버터 */
export const PLAYER_COLORS = ['#ff8fb8', '#7fb2ff', '#6ee0b5', '#ffd66b'];

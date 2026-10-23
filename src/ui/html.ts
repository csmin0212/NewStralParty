/** 사용자 입력(플레이어 이름 등)을 innerHTML에 넣기 전에 반드시 거친다 */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** 밝은 화면에서도 또렷한 플레이어 색: 핑크, 파랑, 민트, 노랑 */
export const PLAYER_COLORS = ['#ff6fa8', '#3d9cf5', '#2fcf9a', '#ffb627'];

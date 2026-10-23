/** 사용자 입력(플레이어 이름 등)을 innerHTML에 넣기 전에 반드시 거친다 */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export const PLAYER_COLORS = ['#ef5b5b', '#4f8cff', '#3cc47c', '#f2c230'];

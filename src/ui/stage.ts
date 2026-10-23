/** 화면 설계 기준 크기. 로비 · 캐릭터 · 덱 · 시작 화면은 이 크기로 그리고 창 크기에 맞춰 통째로 줄이거나 키운다 */
export const STAGE_W = 1600;
export const STAGE_H = 900;

/** 창 크기가 바뀔 때마다 --ui-scale을 갱신한다 */
export function watchUiScale() {
  const update = () => {
    const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    document.documentElement.style.setProperty('--ui-scale', scale.toFixed(4));
    // 게임 화면 HUD는 1440×810에서 1배. 너무 작거나 크게는 안 만든다
    const hud = Math.min(1.3, Math.max(0.6, Math.min(window.innerWidth / 1440, window.innerHeight / 810)));
    document.documentElement.style.setProperty('--hud-scale', hud.toFixed(4));
  };
  update();
  window.addEventListener('resize', update);
}

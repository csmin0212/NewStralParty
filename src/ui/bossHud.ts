import { ENEMIES } from '../data/enemies';
import { activePart, bossEnemy, currentIntent } from '../engine/boss';
import { bossDefBonus } from '../engine/skills';
import type { BossDef, Enemy, GameState } from '../engine/types';
import { BOSS_ART } from './assets';
import { esc } from './html';

/** 보스 얼굴: 그림이 있으면 그림, 없으면 아이콘 */
export function bossFace(def: BossDef, phase: 1 | 2 = 1): string {
  const art = BOSS_ART[def.id];
  const src = phase === 2 ? (art?.phase2 ?? art?.portrait) : art?.portrait;
  return src ? `<img src="${src}" alt="" draggable="false">` : `<span>${phase === 2 && def.phase2 ? def.phase2.icon : def.icon}</span>`;
}

/**
 * 진행도 트랙 아래 보스 띠 (OJ 코옵 보스 HUD 자리): 체력 · 다음 행동 · 보스 규칙 상태.
 * 보스가 나오기 전에는 언제 나오는지만.
 */
export function bossBar(state: GameState): string {
  const def = state.boss;
  const st = state.bossState;
  const boss = bossEnemy(state);
  if (!boss) {
    if (!def.moves && !def.ap) return '';
    const at = def.timeline.find((g) => g.actions.some((a) => a.type === 'bossAppear'))?.at;
    const early = def.passive?.appearWhenCleared ? ` · ${ENEMIES[def.passive.appearWhenCleared].name}를 모두 쓰러뜨리면 바로` : '';
    return `
      <div class="boss-bar incoming">
        <button class="bb-face" data-action="boss-info" title="보스 정보">${bossFace(def)}</button>
        <div class="bb-main">
          <div class="bb-name"><i>BOSS</i>${esc(def.name)}${def.title ? `<small>${esc(def.title)}</small>` : ''}</div>
          <div class="bb-wait">${at !== undefined ? `진행도 <b>${at}</b>에 등장` : '곧 등장'}${early}</div>
        </div>
      </div>`;
  }

  const pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
  const half = def.phase2 && st.phase === 1 ? `<i class="bb-mark" style="left:${def.phase2.at * 100}%" title="${esc(def.phase2.name)}"></i>` : '';
  const bonus = bossDefBonus(state, boss);
  const defText = st.groggy > 0 ? '0' : `${boss.def}${bonus ? `+${bonus}` : ''}`;

  const chips: string[] = [];
  const chip = (cls: string, text: string, tip: string) => chips.push(`<span class="bb-chip ${cls}" title="${esc(tip)}">${text}</span>`);
  if (st.groggy > 0) chip('groggy', '그로기', '방어력 0 · 받는 피해 +1');
  if (st.hidden) chip('hidden', '땅속', '공격받지 않는다');
  if (st.vuln > 0) chip('vuln', `받는 피해 +${st.vuln}`, '성유물');
  const passive = def.passive;
  if (passive?.gauge) {
    const g = passive.gauge;
    const w = Math.min(100, (st.gauge / g.max) * 100);
    chip(
      `gauge ${st.gauge >= g.max ? 'full' : ''}`,
      `게이지 <i class="mini"><b style="width:${w}%"></b></i> ${st.gauge}/${g.max}`,
      `${g.perMinion ? `${ENEMIES[g.perMinion].name} 1마리마다 보스 차례에 +1. ` : ''}가득 차면 「${def.moves?.[g.release]?.name ?? ''}」`,
    );
  }
  if (passive?.parts && st.parts.length) {
    const on = activePart(state);
    for (const p of passive.parts) {
      const alive = st.parts.includes(p.id);
      const active = on?.id === p.id;
      chip(
        `part part-${p.id} ${active ? 'on' : ''} ${alive ? '' : 'broken'}`,
        `${p.name}${active ? ` ${st.partDealt}/${p.breakAt}` : ''}`,
        alive ? `${p.text} · 켜져 있을 때 ${p.breakAt} 피해를 주면 파괴` : '파괴됨',
      );
    }
  }
  if (passive?.resort) chip(`resort ${st.resort <= 2 ? 'low' : ''}`, `리조트 ${st.resort}/${passive.resort.hp}`, '0이 되면 패배');
  if (passive?.heater) {
    chip(
      `heater ${st.heater === 0 ? 'out' : ''}`,
      st.heater === 0 ? '난로 꺼짐' : `난로 ${st.heater}/${passive.heater.hp}`,
      `보스 차례마다 -${passive.heater.decay}. 꺼지면 보스 차례마다 모든 아군 1 피해 · 보스 방어 +2`,
    );
  }
  if (passive?.organ) chip(`organ ${st.organ}`, `오르간 · ${st.organ === 'players' ? '아군' : '보스'} 쪽`, '성가가 이쪽을 치유한다');
  apChips(state, boss, chip);

  return `
    <div class="boss-bar ${st.groggy > 0 ? 'is-groggy' : ''} ${st.hidden ? 'is-hidden' : ''}">
      <button class="bb-face" data-action="boss-info" title="보스 정보">${bossFace(def, st.phase)}</button>
      <div class="bb-main">
        <div class="bb-name"><i>BOSS</i>${esc(boss.name)}<span class="bb-stats">⚔${boss.atk} 🛡${defText}</span></div>
        <div class="bb-hp"><b style="width:${pct}%"></b>${half}<span>${boss.hp} / ${boss.maxHp}</span></div>
        ${chips.length ? `<div class="bb-chips">${chips.join('')}</div>` : ''}
      </div>
      ${nextMove(state)}
    </div>`;
}

/** 원작 맵 보스 상태: 잠 · 스킬 재사용 · 심도 개조 · 금린 · 역린 · 정력 · 기세 */
function apChips(state: GameState, boss: Enemy, chip: (cls: string, text: string, tip: string) => void) {
  const a = state.ap;
  const ap = state.boss.ap;
  if (!a || !ap) return;
  if (!a.awake) chip('sleep', '💤 잠', '깨어나기 전에는 움직이지도 스킬을 쓰지도 않는다');
  if (ap.skill) {
    const cd = boss.cd ?? 0;
    chip('skill', `${esc(ap.skill.name)} ${cd > 0 ? `${cd}R` : '준비'}`, ap.skill.text);
  }
  const st = boss.st ?? {};
  if ((a.vars.shield ?? 0) > 0) chip('shield', `심도 개조 ${a.vars.shield}`, '인공생명체를 쓰러뜨릴 때마다 -1. 남아 있으면 공격 · 지정할 수 없다');
  if (st.scale) chip('scale', `금린 ${st.scale}`, '층마다 공격력 · 방어력 +1');
  if (st.scaleRev) chip('scale', `역린 ${st.scaleRev}`, '층마다 공격력 +2 · 받는 피해 -2 (라운드 끝까지)');
  if (st.energy) chip('energy', `초강 정력 ${st.energy}`, '층마다 공격력 +2 · 도전받으면 -1');
  if (st.momentum) chip('energy', `기세 +${st.momentum}`, '공격이 맞을 때마다 공격력 +2 · 고승포로 해제');
  if (a.vars.defDown) chip('vuln', `방어력 -${a.vars.defDown}`, '과제 보상');
}

/** 다음 행동 카드. 끊을 수 있는 행동이면 남은 피해 막대 */
function nextMove(state: GameState): string {
  const move = currentIntent(state);
  const intent = state.bossState.intent;
  if (!move || !intent) return '';
  const meter = move.breakAt
    ? `<div class="bn-break" title="공개된 뒤 보스에게 ${move.breakAt} 피해를 주면 저지">
        <i><b style="width:${Math.min(100, (intent.dealt / move.breakAt) * 100)}%"></b></i>
        <span>${intent.broken ? '저지!' : `저지 ${intent.dealt}/${move.breakAt}`}</span>
      </div>`
    : '';
  return `
    <div class="bb-next ${move.breakAt ? 'breakable' : ''} ${intent.broken ? 'broken' : ''}">
      <small>NEXT</small>
      <b>${esc(move.name)}</b>
      <span>${esc(move.text)}</span>
      ${meter}
    </div>`;
}

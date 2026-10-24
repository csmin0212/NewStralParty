import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { KEYWORD_INFO, RARITY_NAME, RELICS } from '../data/relics';
import { MAP_RES_INFO } from '../data/board';
import { apAggro, apIntent, AP_MOVE_DIE } from '../engine/ap';
import { statusAtk, statusDef } from '../engine/cards';
import { kitDef } from '../engine/kits';
import { relicDefense } from '../engine/relics';
import type { Enemy, EnemyKind, GameState, MapRes, Player } from '../engine/types';
import { esc } from './html';
import { apStatusChips, relicIcon, statusChips } from './hud';
import { openBossInfo, openModal } from './modal';
import { skinArt } from './skins';

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function stat(icon: string, label: string, base: number, mod = 0): string {
  return `<div class="pi-stat" title="${label}"><span>${icon}</span><b>${base + mod}</b>${mod ? `<small class="${mod > 0 ? 'up' : 'down'}">${signed(mod)}</small>` : ''}</div>`;
}

function skillRow(tag: string, name: string, text: string, extra = '', cls = ''): string {
  return `
    <div class="bm-card pi-skill ${cls}">
      <div class="bm-head"><span class="pi-kind">${tag}</span><b>${esc(name)}</b>${extra}</div>
      <p>${esc(text)}</p>
    </div>`;
}

/** 이 캐릭터를 노리는 몬스터: 쫓아옴 · 스킬 */
function aimedBy(s: GameState, p: Player): string {
  if (!s.ap) return '';
  const rows = s.enemies
    .map((e) => ({ e, it: apIntent(s, e) }))
    .filter(({ it }) => it.prey === p.id || it.skill?.targets.includes(p.id))
    .map(({ e, it }) => {
      const how = [it.prey === p.id ? '👣 추격' : '', it.skill?.targets.includes(p.id) ? `✦ ${esc(it.skill.name)}` : ''].filter(Boolean).join(' · ');
      return `<li><b>${e.icon} ${esc(e.name)}</b><span>${how}</span></li>`;
    })
    .join('');
  return rows ? `<h4 class="bs-h">노리는 몬스터</h4><ul class="bs-rows pi-aim">${rows}</ul>` : '';
}

/** 플레이어 정보: 능력치 · 상태 · 유물 · 스킬 */
export function openPlayerInfo(s: GameState, id: number) {
  const p = s.players[id];
  const c = CHARACTERS[p.character];
  const cd = p.skillActiveUntil !== null ? '효과 중' : p.skillCooldown > 0 ? `${p.skillCooldown}R` : '준비';
  const stacks = [
    p.healStacks ? `<span class="pi-chip" title="${esc(KEYWORD_INFO.heal.text)}">💚 힐 ${p.healStacks}</span>` : '',
    p.starlight ? `<span class="pi-chip" title="${esc(KEYWORD_INFO.starlight.text)}">✦ 스타라이트 ${p.starlight}</span>` : '',
    p.energy ? `<span class="pi-chip" title="${esc(KEYWORD_INFO.energy.text)}">⚡ 에너지 ${p.energy}</span>` : '',
    c.stack ? `<span class="pi-chip">${esc(c.stack.name)} ${p.stacks}/${c.stack.max}</span>` : '',
    ...(Object.entries(p.mapRes ?? {}) as [MapRes, number][])
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `<span class="pi-chip" title="${esc(MAP_RES_INFO[k].text)}">${MAP_RES_INFO[k].icon} ${esc(MAP_RES_INFO[k].name)} ${n}</span>`),
  ].join('');
  const status = `${statusChips(p)}${apStatusChips(p) ? `<div class="pc-status">${apStatusChips(p)}</div>` : ''}`;
  const relics = p.relics.length
    ? p.relics
        .map((r) => {
          const info = RELICS[r];
          return `<li class="r-${info.rarity}"><i class="ri r-${info.rarity}">${relicIcon(r)}</i><div><b>${esc(info.name)}</b><small>${RARITY_NAME[info.rarity]}</small><p>${esc(info.text)}</p></div></li>`;
        })
        .join('')
    : '';
  const aggro = s.ap ? apAggro(s)[p.id] : 0;
  const body = `
    <div class="pi" style="--c:${p.color}">
      <div class="pi-top">
        <div class="pi-art"><img src="${skinArt(p.character, p.skin).portrait}" alt="" draggable="false"><span>${p.id + 1}</span></div>
        <div class="pi-head">
          <div class="pi-name"><b>${esc(c.name)}</b>${c.title ? `<small>${esc(c.title)}</small>` : ''}</div>
          <div class="pi-sub">${p.level}성${p.ko ? ` · KO ${p.reviveRound}R` : ''}${p.potential && c.potential ? ' · 잠재 해방' : ''}${aggro ? ` · <span class="pi-aggro">👹 ${aggro}</span>` : ''}</div>
          <div class="pi-hp"><i style="width:${Math.max(0, (p.hp / p.maxHp) * 100)}%"></i><span>${p.hp}/${p.maxHp}</span></div>
          <div class="pi-stats">
            ${stat('⚔', '공격력', p.atk, statusAtk(p))}
            ${stat('🛡', '방어력', p.def, statusDef(p) + kitDef(s, p) + relicDefense(p))}
            ${stat('👟', '이동', p.move)}
            ${stat('🪙', '코인', p.coins)}
            ${stat('🂠', '손패', p.hand.length)}
          </div>
        </div>
      </div>
      ${status || stacks ? `<div class="pi-chips">${stacks}${status}</div>` : ''}
      <div class="pi-skills">
        ${skillRow('액티브', c.active.name, c.active.description, `<span class="bm-tag ${cd === '준비' ? 'gauge' : ''}">${cd} · ${c.active.cooldown}R</span>`)}
        ${skillRow('패시브', c.passive.name, c.passive.description)}
        ${c.passive2 ? skillRow('패시브', c.passive2.name, c.passive2.description) : ''}
        ${c.potential ? skillRow('잠재', c.potential.name, c.potential.description, '', p.potential ? 'on' : 'off') : ''}
      </div>
      ${relics ? `<h4 class="bs-h">유물 ${p.relics.length}</h4><ul class="pi-relics">${relics}</ul>` : ''}
      ${aimedBy(s, p)}
    </div>
    <div class="bm-foot"><button class="ba-btn ba-btn--yellow" data-modal="close">닫기</button></div>`;
  openModal(`${p.id + 1} · ${esc(p.name)}`, body, true);
}

/** 몬스터 정보: 능력치 · 스킬 · 다음 차례에 노리는 캐릭터 */
export function openEnemyInfo(s: GameState, e: Enemy) {
  const info = e.isBoss ? null : ENEMIES[e.kind as EnemyKind];
  const it = s.ap ? apIntent(s, e) : null;
  const name = (id: number) => `<b style="color:${s.players[id].color}">${id + 1}</b> ${esc(s.players[id].name)}`;
  const rows: string[] = [];
  if (it?.sleeping) rows.push('<li><b>💤</b><span>잠</span></li>');
  if (it?.moves) rows.push(`<li><b>👣 이동</b><span>1~${info?.fixedMove ?? AP_MOVE_DIE}칸${it.prey !== null ? ` → ${name(it.prey)}` : ''}</span></li>`);
  if (it?.skill)
    rows.push(
      `<li><b>✦ ${esc(it.skill.name)}</b><span>${it.skill.ready ? (it.skill.targets.length ? it.skill.targets.map(name).join(' · ') : '준비') : `${it.skill.cd}R`}</span></li>`,
    );
  const traits = [info?.fly ? '비행' : '', e.counter ? '반격' : '', info?.ally ? '아군' : ''].filter(Boolean).join(' · ');
  const tags = [e.mark ? `🎯 표식 ${e.mark}` : '', e.tags?.unluck ? `🌀 불운 ${e.tags.unluck}` : ''].filter(Boolean);
  const body = `
    <div class="pi">
      <div class="pi-top">
        <div class="pi-art enemy-face">${e.icon}</div>
        <div class="pi-head">
          <div class="pi-name"><b>${esc(e.name)}</b>${traits ? `<small>${traits}</small>` : ''}</div>
          <div class="pi-hp boss"><i style="width:${Math.max(0, (e.hp / e.maxHp) * 100)}%"></i><span>${e.hp}/${e.maxHp}</span></div>
          <div class="pi-stats">${stat('⚔', '공격력', e.atk)}${stat('🛡', '방어력', e.def)}</div>
        </div>
      </div>
      ${tags.length ? `<div class="pi-chips">${tags.map((t) => `<span class="pi-chip">${t}</span>`).join('')}</div>` : ''}
      ${it?.skill ? skillRow('스킬', it.skill.name, it.skill.text) : ''}
      ${rows.length ? `<h4 class="bs-h">다음 차례</h4><ul class="bs-rows pi-aim">${rows.join('')}</ul>` : ''}
    </div>
    <div class="bm-foot">
      ${e.isBoss ? '<button class="ba-btn ba-btn--sky" data-modal="boss">보스 정보</button>' : ''}
      <button class="ba-btn ba-btn--yellow" data-modal="close">닫기</button>
    </div>`;
  const el = openModal(esc(e.name), body);
  el.querySelector('[data-modal="boss"]')?.addEventListener('click', () => {
    el.remove();
    openBossInfo(s.boss);
  });
}

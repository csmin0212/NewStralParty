import { BOSSES } from '../data/bosses';
import { MAP_DEFS, MAPS } from '../data/maps';
import { KEYWORD_INFO, RARITY_NAME, RELIC_IDS, RELICS, type RelicId } from '../data/relics';
import { ENEMIES } from '../data/enemies';
import type { EnemyKind } from '../engine/types';
import { loadAccount } from '../meta/account';
import { DIFFICULTIES, DIFFICULTY_IDS } from '../data/difficulty';
import { ENEMY_ART, LOBBY_ART, RELIC_ART } from './assets';
import { bossFace } from './bossHud';
import { esc } from './html';

type Tab = 'enemies' | 'bosses' | 'relics';

const RARITY_ORDER = { blue: 0, purple: 1, gold: 2 };

function relicCard(id: RelicId): string {
  const r = RELICS[id];
  const kw = r.keyword ? KEYWORD_INFO[r.keyword] : null;
  const art = RELIC_ART[id];
  return `
    <div class="cx-card relic r-${r.rarity}">
      <span class="cx-face">${art ? `<img src="${art}" alt="">` : r.icon}</span>
      <b>${esc(r.name)}</b>
      <small>${esc(r.text)}</small>
      <span class="cx-tags"><i class="rar">${RARITY_NAME[r.rarity]}</i>${kw ? `<i class="kw-${r.keyword}">${kw.icon} ${kw.name}</i>` : ''}</span>
    </div>`;
}

/** 유물: 공통 + 맵 전용 (맵 이름 순) */
function relicSections(): string {
  const sorted = (ids: RelicId[]) => [...ids].sort((a, b) => RARITY_ORDER[RELICS[a].rarity] - RARITY_ORDER[RELICS[b].rarity]);
  const common = RELIC_IDS.filter((id) => !RELICS[id].map);
  const groups = [
    { name: '공통', ids: common },
    ...MAP_DEFS.map((m) => ({ name: m.name, ids: RELIC_IDS.filter((id) => RELICS[id].map === m.id) })).filter((g) => g.ids.length),
  ];
  return groups
    .map((g) => `<div class="ba-band ba-band--sub cx-sec">${esc(g.name)} · ${g.ids.length}</div><div class="cx-grid relics">${sorted(g.ids).map(relicCard).join('')}</div>`)
    .join('');
}

/** 에너미 도감: 게임에서 본 에너미 · 보스만 드러난다 */
export function renderCodexScreen(root: HTMLElement, onBack: () => void) {
  let tab: Tab = 'enemies';
  const kinds = Object.keys(ENEMIES).filter((k) => k !== 'gozClone') as EnemyKind[];

  const render = () => {
    const acc = loadAccount();
    const cards =
      tab === 'enemies'
        ? kinds
            .map((k) => {
              const e = ENEMIES[k];
              if (!acc.seenEnemies.includes(k)) return `<div class="cx-card unknown"><span class="cx-face">?</span><b>???</b></div>`;
              const art = ENEMY_ART[k];
              const traits = [
                e.counter ? '반격' : '',
                e.defense === 'evade' ? '회피' : '',
                e.roam ? `이동 1~${e.roam}` : '',
                e.steal ? `훔치기 ${e.steal}` : '',
                e.fuse ? `자폭 ${e.fuse.turns}` : '',
                e.calls ? '호출' : '',
                e.link ? '피해 공유' : '',
              ].filter(Boolean);
              return `
                <div class="cx-card">
                  <span class="cx-face">${art ? `<img src="${art}" alt="">` : e.icon}</span>
                  <b>${esc(e.name)}</b>
                  <small>체력 ${e.hp} · 공격 ${e.atk} · 방어 ${e.def}</small>
                  ${traits.length ? `<span class="cx-tags">${traits.map((x) => `<i>${x}</i>`).join('')}</span>` : ''}
                </div>`;
            })
            .join('')
        : BOSSES.map((b) => {
            if (!acc.seenBosses.includes(b.id)) return `<div class="cx-card boss unknown"><span class="cx-face">?</span><b>???</b><small>${esc(b.title ?? '')}</small></div>`;
            const rec = acc.records[b.id] ?? {};
            const clears = DIFFICULTY_IDS.filter((d) => (rec[d]?.clears ?? 0) > 0);
            const tries = DIFFICULTY_IDS.reduce((a, d) => a + (rec[d]?.tries ?? 0), 0);
            return `
              <div class="cx-card boss">
                <span class="cx-face">${bossFace(b)}</span>
                <b>${esc(b.name)}</b>
                <small>${esc(b.title ?? '')} · 도전 ${tries}</small>
                ${b.map && MAPS[b.map] ? `<small class="cx-map">🗺️ ${esc(MAPS[b.map].name)}</small>` : ''}
                <span class="cx-tags">${clears.map((d) => `<i class="lv" style="--lv:${DIFFICULTIES[d].color}">${DIFFICULTIES[d].name}</i>`).join('')}</span>
              </div>`;
          }).join('');
    const relicTotal = RELIC_IDS.filter((id) => RELICS[id].map !== 'none').length;
    const seen =
      tab === 'enemies'
        ? kinds.filter((k) => acc.seenEnemies.includes(k)).length
        : tab === 'bosses'
          ? BOSSES.filter((b) => acc.seenBosses.includes(b.id)).length
          : relicTotal;
    const total = tab === 'enemies' ? kinds.length : tab === 'bosses' ? BOSSES.length : relicTotal;
    root.innerHTML = `
      <div class="chars codex-screen">
        <img class="chars-bg" src="${LOBBY_ART.room}" alt="" draggable="false">
        <div class="stage">
          <header class="ba-top">
            <button class="ba-back" data-act="back" title="뒤로"><i></i></button>
            <h2>도감</h2>
            <span class="ba-count"><b>${seen}</b> / ${total}</span>
          </header>
          <section class="ba-panel meta-panel">
            <nav class="ba-tabs">
              <button class="ba-tab ${tab === 'enemies' ? 'on' : ''}" data-tab="enemies">에너미</button>
              <button class="ba-tab ${tab === 'bosses' ? 'on' : ''}" data-tab="bosses">보스</button>
              <button class="ba-tab ${tab === 'relics' ? 'on' : ''}" data-tab="relics">유물</button>
            </nav>
            ${tab === 'relics' ? `<div class="cx-scroll">${relicSections()}</div>` : `<div class="cx-grid">${cards}</div>`}
          </section>
        </div>
      </div>`;
  };

  root.onclick = (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-act="back"]')) {
      root.onclick = null;
      onBack();
    }
    const tabBtn = t.closest<HTMLElement>('[data-tab]');
    if (tabBtn) {
      tab = tabBtn.dataset.tab as Tab;
      render();
    }
  };

  render();
}

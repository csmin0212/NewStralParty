import { CHARACTERS } from '../data/characters';
import { DIFFICULTIES } from '../data/difficulty';
import type { CharacterId, GameState } from '../engine/types';
import { bondRank, type MatchRewards } from '../meta/rules';
import { myArt, skinArt } from './skins';
import { bossFace } from './bossHud';
import { esc } from './html';

/**
 * 결과 화면 (블루 아카이브 총력전 결과). 플레이어 기록 · MVP · 보상 · 호감도.
 * before: 보상을 넣기 전 학생별 호감도 (랭크 업 표시용)
 */
export function showResult(
  root: HTMLElement,
  s: GameState,
  r: MatchRewards,
  before: Record<string, number>,
  on: { lobby: () => void; retry: () => void },
) {
  const level = DIFFICULTIES[s.difficulty];
  const rows = s.players
    .map((p, i) => {
      const st = s.stats[i];
      return `
        <tr class="${r.mvp === i ? 'mvp' : ''}" style="--c:${p.color}">
          <td class="rs-who"><img src="${skinArt(p.character, p.skin).portrait}" alt=""><span><b>${esc(p.name)}</b><small>${CHARACTERS[p.character].name}</small></span>${r.mvp === i ? '<em>MVP</em>' : ''}</td>
          <td class="num boss">${st.bossDamage}</td>
          <td class="num">${st.damage}</td>
          <td class="num">${st.kills}</td>
          <td class="num">${st.breaks}</td>
          <td class="num">${st.kos}</td>
          <td class="num">${st.cardsUsed}</td>
        </tr>`;
    })
    .join('');

  // 같은 학생을 여럿이 썼으면 호감도를 합쳐 한 번만 보여 준다
  const gains = new Map<string, number>();
  for (const a of r.affection) gains.set(a.character, (gains.get(a.character) ?? 0) + a.amount);
  const bonds = [...gains]
    .map(([id, amount]) => {
      const c = CHARACTERS[id as keyof typeof CHARACTERS];
      const was = bondRank(before[id] ?? 0).rank;
      const now = bondRank((before[id] ?? 0) + amount);
      const w = now.need ? (now.into / now.need) * 100 : 100;
      return `
        <div class="rs-bond">
          <img src="${myArt(id as CharacterId).portrait}" alt="">
          <div><b>${c.name}</b><span class="rs-heart">♥ ${now.rank}</span>${now.rank > was ? '<em>RANK UP</em>' : ''}
            <i class="rs-bar"><b style="width:${w}%"></b></i><small>호감도 +${amount}</small></div>
        </div>`;
    })
    .join('');

  const el = document.createElement('div');
  el.className = `match-result ${r.victory ? 'win' : 'lose'}`;
  el.innerHTML = `
    <div class="rs-panel">
      <div class="rs-head">
        <div class="rs-title">${r.victory ? 'VICTORY' : 'DEFEAT'}</div>
        <div class="rs-boss">
          <span class="bt-face">${bossFace(s.boss, s.bossState.phase)}</span>
          <span class="bt-text"><small>${esc(s.boss.title ?? 'BOSS')}</small><b>${esc(s.boss.name)}</b></span>
          <span class="rs-level" style="--lv:${level.color}">${level.name}</span>
          <span class="rs-meta">ROUND <b>${s.round}</b> · 진행도 <b>${s.progress}</b>/${s.boss.defeatAt}</span>
        </div>
      </div>
      <table class="rs-table">
        <thead><tr><th></th><th>보스 피해</th><th>피해</th><th>처치</th><th>저지</th><th>KO</th><th>카드</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="rs-rewards">
        <div class="rs-loot">
          <span class="rs-exp">EXP <b>+${r.exp}</b></span>
          ${r.firstClear ? '<em>첫 처치</em>' : ''}
        </div>
        <div class="rs-bonds">${bonds}</div>
      </div>
      <div class="rs-foot">
        <button class="ba-btn ba-btn--sky" data-res="lobby">로비</button>
        <button class="ba-btn ba-btn--yellow" data-res="retry">다시 도전</button>
      </div>
    </div>`;
  el.onclick = (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-res]')?.dataset.res;
    if (act === 'lobby') on.lobby();
    if (act === 'retry') on.retry();
  };
  root.append(el);
}

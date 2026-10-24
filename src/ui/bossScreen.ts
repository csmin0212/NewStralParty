import { AP_BOSSES as BOSSES, AP_VARIANTS } from '../data/apMaps';
import { DIFFICULTIES, DIFFICULTY_IDS, OPEN_DIFFICULTIES, type DifficultyId } from '../data/difficulty';
import { loadAccount, type Account } from '../meta/account';
import { ENEMIES } from '../data/enemies';
import type { BossDef, BossMove, EnemyKind, GimmickAction } from '../engine/types';
import { LOBBY_ART } from './assets';
import { bossFace } from './bossHud';
import { esc } from './html';

type Tab = 'moves' | 'rules' | 'enemies';
const KEY = 'newparty.boss';
const LEVEL_KEY = 'newparty.difficulty';

function loadChoice(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveChoice(key: string, id: string) {
  try {
    localStorage.setItem(key, id);
  } catch {
    // 저장이 막혀 있어도 고르기는 된다
  }
}

/** 이 보스를 처치한 가장 높은 난이도 */
function bestClear(acc: Account, bossId: string): DifficultyId | null {
  const rec = acc.records[bossId] ?? {};
  return [...DIFFICULTY_IDS].reverse().find((d) => (rec[d]?.clears ?? 0) > 0) ?? null;
}

const stars = (n = 1) => `<span class="bs-stars" title="난이도">${'★'.repeat(n)}<i>${'★'.repeat(3 - n)}</i></span>`;

/**
 * 보스 고르기 (블루 아카이브 총력전 선택 화면 구성): 왼쪽 보스 목록, 오른쪽 고른 보스의 행동 · 규칙 · 등장 에너미.
 */
export function renderBossScreen(root: HTMLElement, onPick: (boss: BossDef, difficulty: DifficultyId) => void, onBack: () => void) {
  let current = BOSSES.find((b) => b.id === loadChoice(KEY, BOSSES[0].id)) ?? BOSSES[0];
  let level = loadChoice(LEVEL_KEY, 'normal') as DifficultyId;
  if (!OPEN_DIFFICULTIES.includes(level)) level = OPEN_DIFFICULTIES[0];
  let tab: Tab = 'moves';
  const acc = loadAccount();

  const render = () => {
    const list = BOSSES.map((b) => {
      const best = bestClear(acc, b.id);
      const seen = acc.seenBosses.includes(b.id);
      return `
        <button class="boss-ticket ${b.id === current.id ? 'on' : ''}" data-boss="${b.id}">
          <span class="bt-face">${bossFace(b)}</span>
          <span class="bt-text"><small>${esc(b.title ?? '')}</small><b>${esc(b.name)}</b></span>
          ${best ? `<span class="bt-clear" style="--lv:${DIFFICULTIES[best].color}" title="처치">${DIFFICULTIES[best].name}</span>` : seen ? '' : '<span class="bt-new">NEW</span>'}
          ${stars(b.stars)}
        </button>`;
    }).join('');
    const rec = acc.records[current.id] ?? {};
    const levels = OPEN_DIFFICULTIES.map((d) => {
      const r = rec[d];
      return `
        <button class="lv-btn ${d === level ? 'on' : ''} ${r?.clears ? 'clear' : ''}" data-level="${d}" style="--lv:${DIFFICULTIES[d].color}">
          <b>${DIFFICULTIES[d].name}</b>
          <small>${r?.clears ? `CLEAR · ${r.bestRound}R` : `×${DIFFICULTIES[d].reward}`}</small>
        </button>`;
    }).join('');

    root.innerHTML = `
      <div class="chars boss-screen">
        <img class="chars-bg" src="${LOBBY_ART.room}" alt="" draggable="false">
        <div class="stage">
          <header class="ba-top">
            <button class="ba-back" data-act="back" title="뒤로"><i></i></button>
            <h2>협동 챌린지</h2>
            <span class="ba-count">맵 <b>${BOSSES.length}</b></span>
          </header>
          <nav class="boss-list">${list}</nav>
          <section class="ba-panel boss-detail">
            ${hero(current)}
            <nav class="ba-tabs">
              <button class="ba-tab ${tab === 'moves' ? 'on' : ''}" data-tab="moves">${current.ap ? '보스 · 과제' : '행동'}</button>
              <button class="ba-tab ${tab === 'rules' ? 'on' : ''}" data-tab="rules">규칙 · 진행도</button>
              <button class="ba-tab ${tab === 'enemies' ? 'on' : ''}" data-tab="enemies">등장 에너미</button>
            </nav>
            <div class="detail-body boss-body">${tab === 'moves' ? movesTab(current) : tab === 'rules' ? rulesTab(current) : enemiesTab(current)}</div>
            <div class="panel-foot boss-foot">
              <div class="lv-row">${levels}</div>
              <button class="ba-btn ba-btn--yellow" data-act="go">출격 준비</button>
            </div>
          </section>
        </div>
      </div>`;
  };

  root.onclick = (e) => {
    const t = e.target as HTMLElement;
    const pick = t.closest<HTMLElement>('[data-boss]');
    const tabBtn = t.closest<HTMLElement>('[data-tab]');
    const levelBtn = t.closest<HTMLElement>('[data-level]');
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (pick) {
      current = BOSSES.find((b) => b.id === pick.dataset.boss) ?? current;
      saveChoice(KEY, current.id);
      render();
    } else if (levelBtn) {
      level = levelBtn.dataset.level as DifficultyId;
      saveChoice(LEVEL_KEY, level);
      render();
    } else if (tabBtn) {
      tab = tabBtn.dataset.tab as Tab;
      render();
    } else if (act === 'back') {
      root.onclick = null;
      onBack();
    } else if (act === 'go') {
      root.onclick = null;
      saveChoice(KEY, current.id);
      onPick(current, level);
    }
  };

  render();
}

function hero(b: BossDef): string {
  const appear = b.timeline.find((g) => g.actions.some((a) => a.type === 'bossAppear'))?.at;
  const stat = (label: string, value: string) => `<div><small>${label}</small><b>${value}</b></div>`;
  return `
    <div class="bd-hero">
      <div class="bd-face">${bossFace(b)}</div>
      <div class="bd-text">
        <div class="bd-tags">${b.title ? `<span class="bd-title">${esc(b.title)}</span>` : ''}</div>
        <div class="bd-name">${esc(b.name)} ${stars(b.stars)}</div>
        ${b.summary ? `<p class="bd-summary">${esc(b.summary)}</p>` : ''}
        <div class="bd-stats">
          ${stat('체력', b.ap ? String(b.ap.hp) : `${b.hpPerPlayer} × 인원`)}
          ${stat('공격', String(b.atk))}
          ${stat('방어', String(b.def))}
          ${stat('반격', b.counter ? '함' : '안 함')}
          ${stat('등장', appear !== undefined ? `진행도 ${appear}` : '-')}
          ${stat('제한', `진행도 ${b.defeatAt}`)}
        </div>
      </div>
    </div>`;
}

function moveCard(b: BossDef, id: string, order?: number): string {
  const m: BossMove = b.moves![id];
  const release = b.passive?.gauge?.release === id;
  return `
    <div class="bm-card ${m.breakAt ? 'breakable' : ''}">
      <div class="bm-head">${order !== undefined ? `<i>${order}</i>` : ''}<b>${esc(m.name)}</b>
        ${m.breakAt ? `<span class="bm-tag break" title="공개된 뒤 이만큼 피해를 주면 저지">저지 ${m.breakAt}</span>` : ''}
        ${release ? '<span class="bm-tag gauge">게이지</span>' : ''}</div>
      <p>${esc(m.text)}</p>
    </div>`;
}

/** 원작 맵 보스 규칙 */
const AP_RULE: Record<string, string> = {
  chaseRandom: '진행도 11에 깨어나 무작위 캐릭터를 쫓는다',
  spiritLink: '검 영혼마다 방어력 +2 · 창 영혼마다 공격력 +2 · 검 · 창 영혼이 쓰러지면 체력 -10%',
  momentum: '공격이 맞을 때마다 공격력 +2 (고승포로 해제)',
  sharedHp: '지휘대와 체력 공유 · 지휘대는 도전할 수 없다 (카드 · 스킬로만)',
  sugar: '찻주전자를 흡수하지 못한 라운드 끝에 최대 체력 10%를 잃는다',
  fury: '그놈 탓이야! 3장마다 공격력 +1 · 젤리 호위병 · 문제아를 공격할 때 공격력 +2',
  reverseScale: '피해를 받으면 역린 1 (공격력 +2 · 받는 피해 -2, 라운드 끝까지) · 한 번에 20 넘게 받으면 풀리고 스킬 봉인',
  goldScale: '반격하면 금린 2 (층마다 공격력 · 방어력 +1)',
  shield: '심도 개조 3 · 인공생명체를 쓰러뜨릴 때마다 -1 · 남아 있으면 공격 · 지정할 수 없다',
  kidGawu: '차례마다 초강 정력 +1 (공격력 +2) · 5칸 안 주목받은 캐릭터 3 피해 · 도전받으면 도전자 주목 · 정력 -1 · 체력 60% 이하 반격',
  flameHit: '맞히면 온염 2',
  solitude: '4칸 안에 아무도 없으면 이동 +2 · 방어력 +2 · 맞히면 연리 · 연리 대상 공격력 +3',
  rebirth: '차례마다 5칸 안 온염 1 · 지금 체력 10% 잃음 · 잃은 체력 30마다 공격력 +1 · 절반 이하 이동 +2 · 공격력 +2',
  vote: '큰목소리 · 무술 수련생을 쓰러뜨리면 투표로 보스를 고른다',
  route: '가금 종업원 · 신비한 알 2개로 루트를 고른다',
};

/** 이 맵에서 나올 수 있는 보스 (갈래) */
function apForms(b: BossDef): BossDef[] {
  if (b.map === 'academy') return [AP_VARIANTS.dean, AP_VARIANTS.officer];
  if (b.map === 'dragonpalace') return [AP_VARIANTS.mamushi, AP_VARIANTS.souri];
  if (b.map === 'garden') return [AP_VARIANTS.peacock, AP_VARIANTS.lovebird, AP_VARIANTS.phoenix];
  return [b];
}

function apMovesTab(b: BossDef): string {
  const forms = apForms(b)
    .map((f) => {
      const ap = f.ap!;
      const rules = (ap.rules ?? []).map((r) => AP_RULE[r]).filter(Boolean);
      return `
        <div class="bm-card">
          <div class="bm-head"><b>${f.icon} ${esc(f.name)}</b><span class="bm-tag">체력 ${ap.hp} · 공격 ${f.atk} · 방어 ${f.def}${f.counter ? ' · 반격' : ''}</span></div>
          ${ap.skill ? `<p><b>${esc(ap.skill.name)}</b> · 재사용 ${ap.skill.cd} · ${esc(ap.skill.text)}</p>` : ''}
          ${rules.map((r) => `<p>${esc(r)}</p>`).join('')}
        </div>`;
    })
    .join('');
  const tasks = apForms(b)
    .flatMap((f) => f.ap!.tasks)
    .filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i)
    .map((t) => {
      const r = t.reward;
      const reward = [r.chip ? `유물 ${r.chip}` : '', r.progress ? `진행도 ${r.progress}` : '', r.coins ? `코인 +${r.coins}` : '', r.card ? '카드' : '']
        .filter(Boolean)
        .join(' · ');
      return `<li><b>${esc(t.name)} ${t.count}</b><span>${esc(reward || '맵 진행')}</span></li>`;
    })
    .join('');
  return `
    <div class="bm-grid">${forms}</div>
    <h4 class="bs-h">과제</h4>
    <ul class="bs-rows">${tasks}</ul>`;
}

export function movesTab(b: BossDef): string {
  if (b.ap) return apMovesTab(b);
  if (!b.moves) return '<p class="bs-empty">행동 카드 없음</p>';
  const order = b.deckOrder === 'shuffle' ? '무작위' : '순서';
  const deck = (b.deck ?? []).map((id, i) => moveCard(b, id, i + 1)).join('');
  const used = new Set([...(b.deck ?? []), ...(b.phase2?.deck ?? [])]);
  const extra = Object.keys(b.moves).filter((id) => !used.has(id) && (b.passive?.gauge?.release === id || isQueued(b, id)));
  const p2 = b.phase2
    ? `<h4 class="bs-h">체력 ${Math.round(b.phase2.at * 100)}% · ${esc(b.phase2.name)}</h4>
       <div class="bm-grid">${b.phase2.deck.map((id, i) => moveCard(b, id, i + 1)).join('')}</div>`
    : '';
  return `
    <h4 class="bs-h">행동 덱 · ${order}</h4>
    <div class="bm-grid">${deck}</div>
    ${extra.length ? `<h4 class="bs-h">조건</h4><div class="bm-grid">${extra.map((id) => moveCard(b, id)).join('')}</div>` : ''}
    ${p2}`;
}

/** 잠행 뒤에 오는 행동처럼 다른 행동이 불러오는 행동 */
function isQueued(b: BossDef, id: string): boolean {
  const all = [...Object.values(b.moves ?? {}).flatMap((m) => m.effects), ...(b.phase2?.enter ?? [])];
  return all.some((fx) => fx.type === 'hide' && fx.then === id);
}

function gimmickText(b: BossDef, a: GimmickAction): string {
  switch (a.type) {
    case 'summon':
      return `${countKinds(a.enemies)} 소환`;
    case 'bossAppear':
      return `${b.name} 등장`;
    case 'buffEnemies':
      return `모든 에너미 공격 +${a.atk}${a.def ? ` · 방어 +${a.def}` : ''}`;
    case 'move':
      return b.moves?.[a.move]?.text ?? a.move;
    case 'wake':
      return `${b.name} 행동 시작`;
    case 'apEvent':
      return '';
  }
}

function countKinds(kinds: EnemyKind[]): string {
  const counts = new Map<EnemyKind, number>();
  for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts].map(([k, n]) => `${ENEMIES[k].name}${n > 1 ? ` ${n}` : ''}`).join(' · ');
}

export function rulesTab(b: BossDef): string {
  const rows: string[] = [];
  const p = b.passive;
  const row = (name: string, text: string) => rows.push(`<li><b>${name}</b><span>${esc(text)}</span></li>`);
  if (p?.guard) row('보호', `${ENEMIES[p.guard.kind].name} 1개당 보스 방어 +${p.guard.def}`);
  if (p?.drain) row('침식', `${ENEMIES[p.drain.kind].name} ${p.drain.range}칸 안 · 보스 차례마다 코인 -${p.drain.amount}`);
  if (p?.gauge) {
    const g = p.gauge;
    row('게이지', `${g.perMinion ? `${ENEMIES[g.perMinion].name} 1마리당 +1 · ` : ''}${g.max} → 「${b.moves?.[g.release]?.name}」${g.perMinion ? ` · 전멸 시 0 · 그로기` : ''}`);
  }
  if (p?.parts) for (const part of p.parts) row(part.name, `${part.text} · 파괴 ${part.breakAt}`);
  if (p?.parts) row('부위 순환', p.parts.map((x) => x.name).join(' → '));
  if (p?.appearWhenCleared) row('조기 등장', `${ENEMIES[p.appearWhenCleared].name} 전멸`);
  if (p?.resort) row('리조트', `${p.resort.hp} · ${ENEMIES[p.resort.kind].name}가 있으면 보스 차례마다 -1 · 0 패배`);
  if (p?.heater) row('난로', `${p.heater.hp} · 보스 차례마다 -${p.heater.decay} · 멈추면 +3, 체력 +2 · 0: 모든 아군 1 피해, 보스 방어 +2`);
  if (p?.organ) row('오르간', '성가 방향 · 멈추면 아군 쪽 · 성가 뒤 보스 쪽');
  row('그로기', '방어 0 · 받는 피해 +1');
  const timeline = b.timeline
    .map((g) => `<li><b>진행도 ${g.at}</b><span>${esc(g.actions.map((a) => gimmickText(b, a)).filter(Boolean).join(' · '))}</span></li>`)
    .join('');
  return `
    <ul class="bs-rows">${rows.join('')}</ul>
    <h4 class="bs-h">진행도 · ${b.defeatAt} 패배</h4>
    <ul class="bs-rows timeline">${timeline}</ul>
    ${b.ref ? `<p class="bs-ref">참고: ${esc(b.ref)}</p>` : ''}`;
}

function enemiesTab(b: BossDef): string {
  const kinds = new Set<EnemyKind>();
  for (const g of b.timeline) for (const a of g.actions) if (a.type === 'summon') a.enemies.forEach((k) => kinds.add(k));
  const effects = [...Object.values(b.moves ?? {}).flatMap((m) => m.effects), ...(b.phase2?.enter ?? [])];
  for (const fx of effects) if (fx.type === 'summon') fx.enemies.forEach((k) => kinds.add(k));
  for (const k of [b.passive?.gauge?.perMinion, b.passive?.resort?.kind, b.passive?.guard?.kind]) if (k) kinds.add(k);
  for (const f of b.ap ? apForms(b) : []) {
    if (f.ap?.skill?.kind) kinds.add(f.ap.skill.kind);
    for (const g of f.timeline) for (const x of g.actions) if (x.type === 'summon') x.enemies.forEach((k) => kinds.add(k));
  }
  return `<div class="be-grid">${[...kinds].map(enemyCard).join('')}</div>`;
}

function enemyCard(kind: EnemyKind): string {
  const e = ENEMIES[kind];
  const traits: string[] = [];
  if (e.counter) traits.push('반격');
  if (e.defense === 'evade') traits.push('회피형');
  if (e.roam) traits.push(`보스 차례마다 1~${e.roam}칸${e.chase ? ' · 아군 추격' : ''}`);
  if (e.steal) traits.push(`덮치면 코인 ${e.steal} 훔침 · 쓰러뜨리면 돌려받음`);
  else if (e.roam) traits.push(`덮치면 ${e.atk} 피해`);
  if (e.fuse) traits.push(`${e.fuse.turns}차례 뒤 자폭 (주변 ${e.fuse.range}칸 ${e.fuse.amount})`);
  if (e.calls) traits.push(`${e.calls.every}차례마다 ${ENEMIES[e.calls.kind].name} 호출`);
  if (e.link) traits.push('받은 피해를 보스도 받는다');
  if (e.decoy) traits.push('보스와 똑같이 보이는 분신 · 맞으면 사라진다');
  if (e.fly) traits.push('비행 · 도전할 수 없다');
  if (e.skill) traits.push(`${e.skill.name} (재사용 ${e.skill.cd}): ${e.skill.text}`);
  return `
    <div class="be-card">
      <span class="be-face">${e.icon}</span>
      <div class="be-text">
        <b>${esc(e.name)}</b>
        <small>체력 ${e.hp} · 공격 ${e.atk} · 방어 ${e.def}${e.reward ? ` · 코인 ${e.reward}` : ''}</small>
        ${traits.length ? `<span>${esc(traits.join(' · '))}</span>` : ''}
      </div>
    </div>`;
}

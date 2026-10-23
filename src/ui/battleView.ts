import { CARDS } from '../data/cards';
import { battleBudget, cardBlocker } from '../engine/cards';
import { evadeDice } from '../engine/skills';
import type { AttackResult, Battle, BattleEvent, CharacterId, DefenseMode, GameState } from '../engine/types';
import { cardFace } from './cardView';
import { esc } from './html';
import {
  BATTLE_ART,
  CHARACTER_ART,
  ENEMY_ART,
  ENEMY_ENCOUNTER_ART,
  ENEMY_POSES,
  UI_ART,
  type CharacterPose,
  type EnemyPose,
} from './assets';

export type BattleChoice =
  | { type: 'ENCOUNTER'; choice: 'attack' | 'release' }
  | { type: 'DEFEND'; mode: DefenseMode }
  | { type: 'PLAY_CARD'; handIndex: number };

type Side = 'player' | 'enemy';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 인카운터 화면에 흩뿌리는 만화풍 글자 (원작의 FIGHT! DUEL! 決斗!) — [글자, 왼쪽%, 위%, 기울기, 크기 배율] */
const WORDS: [string, number, number, number, number][] = [
  ['FIGHT!', 8, 16, -8, 1.1],
  ['DUEL!', 74, 74, 6, 1],
  ['勝負!', 72, 20, 10, 0.8],
  ['決闘!', 64, 38, -6, 0.7],
  ['FIGHT!', 12, 80, 4, 0.95],
  ['배틀!', 20, 40, -12, 0.75],
];

/**
 * 전투 화면. 원작처럼 두 장면으로 나뉜다 (docs/REFERENCE.md 2 · 3번).
 *  1. 인카운터: 에너미 그림이 화면 가득 + 흩뿌린 글자 + 원형 [놓아주기] [ATTACK]
 *  2. 아레나: 위아래 검은 띠 + 뒤에 거대한 BATTLE 글자 + 둥근 무대 위 스티커 둘 + 머리 위 주사위 배지 + 발밑 HP 알약
 * 엔진이 남긴 Battle.events를 순서대로 연출한다.
 */
export class BattleView {
  onChoice: (choice: BattleChoice) => void = () => {};

  private readonly el: HTMLElement;
  /** 열려 있는 전투 */
  private battle: Battle | null = null;
  /** 연출을 마친 이벤트 수 */
  private shown = 0;
  private lastSeq = 0;
  private playerMaxHp = 1;
  private enemyPoseTimer: ReturnType<typeof setTimeout> | undefined;
  private playerPoseTimer: ReturnType<typeof setTimeout> | undefined;
  private character: CharacterId | null = null;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'battle';
    root.append(this.el);

    this.el.onclick = (e) => {
      const cardBtn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-card]');
      if (cardBtn && !cardBtn.disabled) return this.onChoice({ type: 'PLAY_CARD', handIndex: Number(cardBtn.dataset.card) });
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-choice]');
      if (!btn || btn.disabled) return;
      const choice = btn.dataset.choice!;
      if (choice === 'attack' || choice === 'release') this.onChoice({ type: 'ENCOUNTER', choice });
      else this.onChoice({ type: 'DEFEND', mode: choice as DefenseMode });
    };
  }

  /** 열려 있는 전투의 새 이벤트를 연출한다. 전투가 끝났으면 닫는다 */
  async playPending(state: GameState) {
    if (!this.battle) return;
    const record = state.battles.find((b) => b.seq === this.battle!.seq);
    if (!record) return this.close();

    this.choices.innerHTML = '';
    for (const event of record.events.slice(this.shown)) {
      await this.play(record, event);
      this.shown += 1;
    }
    if (record.done) {
      await sleep(500);
      this.close();
    }
  }

  /** 새로 시작된 전투가 있으면 인카운터 화면으로 연다 */
  async openIfNew(state: GameState) {
    const record = state.battles.at(-1);
    if (!record || record.seq <= this.lastSeq || record.done) return;
    this.lastSeq = record.seq;
    this.battle = record;
    this.shown = 0;

    const p = state.players[record.player];
    const e = record.enemy;
    const idle = ENEMY_ART[e.kind];
    const big = ENEMY_ENCOUNTER_ART[e.kind] ?? idle;
    const poses = CHARACTER_ART[p.character].poses;
    this.character = p.character;
    for (const src of [...Object.values(ENEMY_POSES[e.kind] ?? {}), ...Object.values(poses), BATTLE_ART.impact, BATTLE_ART.smoke]) {
      if (src) new Image().src = src;
    }
    this.playerMaxHp = p.maxHp;

    const enemyFigure = (src: string | undefined, cls: string) =>
      src ? `<img class="${cls}" src="${src}" alt="${esc(e.name)}" draggable="false">` : `<span class="${cls} icon">${e.icon}</span>`;
    const words = WORDS.map(
      ([w, x, y, r, s], i) =>
        `<b class="enc-word${x < 50 ? ' left' : ''}" style="left:${x}%;top:${y}%;--r:${r}deg;--s:${s};--i:${i}">${w}</b>`,
    ).join('');

    this.el.className = `battle scene-encounter${e.isBoss ? ' boss' : ''}`;
    this.el.innerHTML = `
      <section class="enc">
        <div class="enc-bg"></div>
        ${words}
        ${enemyFigure(big, 'enc-art')}
        <div class="enc-stats">
          <div class="enc-name">${e.isBoss ? '<i>BOSS</i>' : ''}${esc(e.name)}</div>
          <div class="enc-stat"><img src="${UI_ART.heart}" alt=""><b>${e.hp}</b><small>/${e.maxHp}</small></div>
          <div class="enc-stat"><span class="ico">⚔</span><b>${e.atk}</b></div>
          <div class="enc-stat"><span class="ico">🛡</span><b>${e.def}</b></div>
          <div class="enc-tags">
            <span class="${e.counter ? 'warn' : ''}">${e.counter ? '반격형' : '반격 없음'}</span>
            <span>${e.defense === 'block' ? '방어형' : '회피형'}</span>
          </div>
        </div>
      </section>
      <section class="arena">
        <div class="arena-bg">${BATTLE_ART.background ? `<img src="${BATTLE_ART.background}" alt="">` : ''}<b class="arena-word">BATTLE</b></div>
        <div class="arena-stage">${BATTLE_ART.stage ? `<img src="${BATTLE_ART.stage}" alt="">` : ''}</div>
        <div class="unit" data-side="player" style="--c:${p.color}">
          <div class="badge"><span>?</span><em></em></div>
          <div class="sticker"><img class="player-art" src="${poses.idle}" alt="${esc(p.name)}" draggable="false"><i class="seat-no">${p.id + 1}</i></div>
          <div class="hp-pill"><img src="${UI_ART.heart}" alt=""><b></b></div>
          <div class="impact"></div>
          <div class="pop"></div>
        </div>
        <div class="unit" data-side="enemy">
          <div class="badge"><span>?</span><em></em></div>
          <div class="sticker">${enemyFigure(idle, 'enemy-art')}</div>
          <div class="hp-pill"><img src="${UI_ART.heart}" alt=""><b></b></div>
          <div class="impact"></div>
          <div class="pop"></div>
        </div>
        <div class="arena-names">
          <span style="--c:${p.color}">${esc(p.name)}</span><em>VS</em><span>${esc(e.name)}</span>
        </div>
      </section>
      <div class="battle-msg"></div>
      <div class="battle-choices"></div>`;
    this.setHp('player', p.hp, p.maxHp);
    this.setHp('enemy', e.hp, e.maxHp);

    void this.el.offsetWidth;
    this.el.classList.add('open');
    await sleep(500);
  }

  /** 지금 단계에 맞는 원형 선택 버튼을 그린다 */
  renderChoices(state: GameState, busy: boolean) {
    if (!this.battle) return;
    const p = state.players[state.current];
    const phase = state.phase;

    if (phase.kind === 'encounter') {
      this.choices.innerHTML = `
        <button class="rbtn rbtn--blue" data-choice="release"><b>놓아주기</b><small>LET GO</small></button>
        <button class="rbtn rbtn--green" data-choice="attack" data-primary><b>ATTACK</b><small>d6 + ${p.atk}</small></button>`;
    } else if (phase.kind === 'defend') {
      this.showArena();
      this.message(`${this.battle.enemy.name} 반격`);
      const dice = evadeDice(p);
      this.choices.innerHTML = `
        <button class="rbtn rbtn--blue" data-choice="block"><b>방어</b><small>d6 + ${p.def}</small></button>
        <button class="rbtn rbtn--pink${dice > 1 ? ' boosted' : ''}" data-choice="evade"><b>회피</b><small>${dice > 1 ? `d6 ×${dice}` : 'd6'}</small></button>`;
    } else {
      this.choices.innerHTML = '';
    }
    // 이번 장면에 쓸 수 있는 전투 카드 (공격 카드 / 반격 카드)
    if (phase.kind === 'encounter' || phase.kind === 'defend') {
      const timing = phase.kind === 'encounter' ? 'attack' : 'defend';
      const cards = p.hand
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => CARDS[h.card].type === 'battle' && CARDS[h.card].timing === timing)
        .map(({ h, i }) => {
          const blocker = cardBlocker(state, p, h);
          return `<button class="battle-card" data-card="${i}" title="${blocker ?? ''}" ${blocker ? 'disabled' : ''}>${cardFace(h.card)}</button>`;
        })
        .join('');
      // 전투 코스트 (아스트랄 파티): 인카운터마다 3 + 성
      const budget = battleBudget(p);
      const used = state.turn.battle.costUsed;
      const pips = Array.from({ length: budget }, (_, i) => `<i class="${i < used ? 'used' : ''}"></i>`).join('');
      if (cards) {
        this.choices.insertAdjacentHTML(
          'afterbegin',
          `<div class="battle-cards"><span class="battle-cost" title="전투 코스트"><b>${budget - used}</b>${pips}</span>${cards}</div>`,
        );
      }
    }
    this.choices.querySelectorAll('button').forEach((b) => (b.disabled ||= busy));
  }

  // ───────── 연출 ─────────

  private async play(record: Battle, event: BattleEvent) {
    const enemyName = record.enemy.name;
    switch (event.type) {
      case 'attack': {
        await this.showArena();
        const attacker: Side = event.attacker;
        const defender: Side = attacker === 'player' ? 'enemy' : 'player';
        const r = event.result;
        this.message(attacker === 'player' ? '공격!' : `${enemyName}의 반격!`);
        await this.rollBadges(attacker, r);

        this.pose(attacker, 'lunge');
        await sleep(200);
        if (r.damage === 0) {
          this.pose(defender, 'dodge');
          this.burst(defender, 'smoke');
          this.pop(defender, 'MISS', 'miss');
          this.message('회피 성공');
        } else {
          // 막았으면 방어 자세로 버틴다
          this.pose(defender, r.mode === 'block' ? 'block' : 'hit');
          this.burst(defender, 'impact');
          this.pop(defender, `-${r.damage}`, 'dmg');
          const max = defender === 'player' ? this.playerMaxHp : record.enemy.maxHp;
          this.setHp(defender, event.targetHp, max);
          this.message(r.mode === 'evade' ? `회피 실패! ${r.damage} 피해` : `${r.damage} 피해`);
        }
        await sleep(1000);
        break;
      }
      case 'enemyDefeated':
        this.pose('enemy', 'down');
        this.message(record.enemy.isBoss ? `🎉 ${enemyName} 처치!` : `${enemyName} 처치! 코인 +${event.reward}`);
        await sleep(record.enemy.isBoss ? 1600 : 1100);
        break;
      case 'playerKO':
        this.pose('player', 'down');
        this.message('K.O. · 진행도 +1');
        await sleep(1200);
        break;
      case 'skill':
        this.skillFlash(event.name);
        this.message(event.damage ? `${event.name} · ${event.damage} 피해` : event.name);
        if (event.damage) {
          await sleep(250);
          this.pose('player', 'lunge');
          this.pose('enemy', 'hit');
          this.burst('enemy', 'impact');
          this.pop('enemy', `-${event.damage}`, 'dmg');
          if (event.targetHp !== undefined) this.setHp('enemy', event.targetHp, record.enemy.maxHp);
        }
        await sleep(event.damage ? 1000 : 800);
        break;
      case 'card': {
        const name = CARDS[event.card].name;
        this.skillFlash(name, 'CARD');
        const gain = CARDS[event.card].timing === 'defend' ? '방어력' : '공격력';
        this.message(event.damage ? `${name} · ${event.damage} 피해` : event.value ? `${name} · ${gain} +${event.value}` : name);
        if (event.value) this.pop('player', `+${event.value}`, 'buff');
        if (event.damage) {
          await sleep(250);
          this.pose('enemy', 'hit');
          this.burst('enemy', 'impact');
          this.pop('enemy', `-${event.damage}`, 'dmg');
          if (event.targetHp !== undefined) this.setHp('enemy', event.targetHp, record.enemy.maxHp);
        }
        await sleep(event.damage ? 1000 : 700);
        break;
      }
      case 'escape':
        this.burst('player', 'smoke');
        this.pose('player', 'dodge');
        this.message('이탈');
        this.el.classList.add('leaving');
        await sleep(700);
        break;
      case 'release':
        this.message('놓아주기');
        this.el.classList.add('leaving');
        await sleep(700);
        break;
    }
  }

  /** 인카운터 화면 → 아레나로 바꾼다 (이미 아레나면 그대로) */
  private async showArena() {
    if (this.el.classList.contains('scene-arena')) return;
    this.el.classList.remove('scene-encounter');
    this.el.classList.add('scene-arena');
    this.burst('player', 'smoke');
    this.burst('enemy', 'smoke');
    await sleep(450);
  }

  /** 머리 위 원형 배지에서 숫자가 굴러가다 멈춘다. 공격하는 쪽은 공격값, 막는 쪽은 방어/회피값 */
  private async rollBadges(attacker: Side, r: AttackResult) {
    const defender: Side = attacker === 'player' ? 'enemy' : 'player';
    const atkBadge = this.badge(attacker);
    const defBadge = this.badge(defender);
    atkBadge.dataset.kind = 'atk';
    defBadge.dataset.kind = r.mode === 'block' ? 'block' : 'evade';
    atkBadge.title = `공격 ${r.attackRoll} + ${r.attackValue - r.attackRoll}`;
    defBadge.title =
      r.mode === 'block'
        ? `방어 ${r.defenseRoll} + ${r.defenseValue - r.defenseRoll}`
        : `회피 주사위 ${r.defenseRolls.join(' · ')} vs 상대 주사위 ${r.attackRoll}`;
    // 회피는 공격 주사위 눈끼리 비교하니 배지 아래에 맞붙는 눈을 적어 둔다
    atkBadge.querySelector('em')!.textContent = r.mode === 'evade' ? `🎲${r.attackRoll}` : '';
    defBadge.querySelector('em')!.textContent = r.mode === 'evade' ? `🎲${r.defenseRolls.join('·')}` : '';

    for (const b of [atkBadge, defBadge]) b.classList.add('rolling');
    for (let i = 0; i < 9; i++) {
      for (const b of [atkBadge, defBadge]) b.querySelector('span')!.textContent = String(1 + Math.floor(Math.random() * 12));
      await sleep(55);
    }
    atkBadge.querySelector('span')!.textContent = String(r.attackValue);
    defBadge.querySelector('span')!.textContent = String(r.defenseValue);
    for (const b of [atkBadge, defBadge]) {
      b.classList.remove('rolling');
      b.classList.remove('land');
      void b.offsetWidth;
      b.classList.add('land');
    }
    await sleep(500);
  }

  private setHp(side: Side, hp: number, max: number) {
    const pill = this.unit(side).querySelector('.hp-pill b')!;
    pill.textContent = `${hp}`;
    pill.parentElement!.title = `HP ${hp} / ${max}`;
  }

  private pose(side: Side, pose: 'lunge' | 'hit' | 'dodge' | 'block' | 'down') {
    const u = this.unit(side);
    u.classList.remove('lunge', 'hit', 'dodge', 'block');
    void u.offsetWidth; // 같은 애니메이션 다시 재생
    u.classList.add(pose);
    if (side === 'player' && this.character) {
      clearTimeout(this.playerPoseTimer);
      const art = CHARACTER_ART[this.character].poses;
      const image = u.querySelector<HTMLImageElement>('.player-art');
      const key: CharacterPose =
        pose === 'lunge' ? 'attack' : pose === 'dodge' ? 'evade' : pose === 'hit' ? 'hit' : pose === 'block' ? 'block' : 'down';
      if (image) {
        image.src = art[key];
        if (pose !== 'down') this.playerPoseTimer = setTimeout(() => { image.src = art.idle; }, 750);
      }
    }
    if (side === 'enemy' && this.battle) {
      clearTimeout(this.enemyPoseTimer);
      const art = ENEMY_POSES[this.battle.enemy.kind];
      const image = u.querySelector<HTMLImageElement>('.enemy-art');
      const key: EnemyPose =
        pose === 'lunge' ? 'attack' : pose === 'dodge' ? 'evade' : pose === 'hit' || pose === 'block' ? 'hit' : 'idle';
      if (image && art?.idle) {
        image.src = art[key] ?? art.idle;
        if (pose !== 'down') this.enemyPoseTimer = setTimeout(() => { image.src = art.idle!; }, 750);
      }
    }
  }

  /** 맞으면 충격, 피하면 연기. 그림이 오면 그림을, 없으면 CSS 모양을 쓴다 */
  private burst(side: Side, kind: 'impact' | 'smoke') {
    const el = this.unit(side).querySelector<HTMLElement>('.impact')!;
    const art = BATTLE_ART[kind];
    el.innerHTML = art ? `<img src="${art}" alt="">` : '';
    el.className = `impact ${kind}${art ? ' has-art' : ''}`;
    void el.offsetWidth;
    el.classList.add('show');
  }

  private pop(side: Side, text: string, kind: 'dmg' | 'miss' | 'buff') {
    const el = this.unit(side).querySelector<HTMLElement>('.pop')!;
    el.textContent = text;
    el.className = `pop ${kind}`;
    void el.offsetWidth;
    el.classList.add('show');
  }

  /** 스킬이 발동하면 플레이어 쪽에 스킬 이름 띠가 번쩍인다 */
  private skillFlash(name: string, label = 'SKILL') {
    const unit = this.unit('player');
    unit.querySelector('.skill-flash')?.remove();
    const el = document.createElement('div');
    el.className = 'skill-flash';
    el.innerHTML = `<small>${label}</small><b>${esc(name)}</b>`;
    unit.append(el);
    setTimeout(() => el.remove(), 1600);
  }

  private message(text: string) {
    const el = this.el.querySelector<HTMLElement>('.battle-msg')!;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  private unit(side: Side): HTMLElement {
    return this.el.querySelector<HTMLElement>(`.unit[data-side="${side}"]`)!;
  }

  private badge(side: Side): HTMLElement {
    return this.unit(side).querySelector<HTMLElement>('.badge')!;
  }

  private get choices(): HTMLElement {
    return this.el.querySelector<HTMLElement>('.battle-choices')!;
  }

  private close() {
    clearTimeout(this.enemyPoseTimer);
    clearTimeout(this.playerPoseTimer);
    this.el.classList.remove('open');
    this.battle = null;
  }
}

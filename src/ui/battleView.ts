import { ENEMIES } from '../data/enemies';
import type { AttackResult, Battle, BattleEvent, DefenseMode, GameState } from '../engine/types';
import { esc } from './html';

export type BattleChoice =
  | { type: 'ENCOUNTER'; choice: 'attack' | 'release' }
  | { type: 'DEFEND'; mode: DefenseMode };

type Side = 'player' | 'enemy';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 인카운터 전투 화면. 엔진이 남긴 Battle.events를 순서대로 연출한다.
 * 캐릭터 · 에너미 그림이 생기면 .avatar 안만 바꾸면 된다 (포즈별 클래스: lunge / hit / dodge / down).
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

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'battle';
    root.append(this.el);

    this.el.onclick = (e) => {
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

    this.actions.innerHTML = '';
    for (const event of record.events.slice(this.shown)) {
      await this.play(record, event);
      this.shown += 1;
    }
    if (record.done) {
      await sleep(500);
      this.close();
    }
  }

  /** 새로 시작된 전투가 있으면 연다 */
  async openIfNew(state: GameState) {
    const record = state.battles.at(-1);
    if (!record || record.seq <= this.lastSeq || record.done) return;
    this.lastSeq = record.seq;
    this.battle = record;
    this.shown = 0;

    const p = state.players[record.player];
    const e = record.enemy;
    const info = ENEMIES[e.kind];
    this.playerMaxHp = p.maxHp;

    this.el.innerHTML = `
      <div class="battle-card">
        <div class="battle-title">⚔ 인카운터</div>
        <div class="fighters">
          <div class="fighter" data-side="player" style="--c:${p.color}">
            <div class="avatar"><span>${p.id + 1}</span></div>
            <div class="fname">${esc(p.name)}</div>
            <div class="fstats">ATK ${p.atk} · DEF ${p.def} · EVA ${p.eva}</div>
            <div class="bar"><i></i></div>
            <div class="hptext"></div>
            <div class="pop"></div>
          </div>
          <div class="vs">VS</div>
          <div class="fighter" data-side="enemy">
            <div class="avatar enemy-avatar"><span>${info.icon}</span></div>
            <div class="fname">${info.name}</div>
            <div class="ftags">
              <span class="tag ${e.counter ? 'warn' : ''}">${e.counter ? '반격형' : '반격 없음'}</span>
              <span class="tag">${e.defense === 'block' ? '🛡 방어형' : '💨 회피형'}</span>
            </div>
            <div class="fstats">ATK ${e.atk} · DEF ${e.def} · EVA ${e.eva}</div>
            <div class="bar"><i></i></div>
            <div class="hptext"></div>
            <div class="pop"></div>
          </div>
        </div>
        <div class="dice-row"></div>
        <div class="battle-msg">${info.name}이(가) 길을 막았다!</div>
        <div class="battle-actions"></div>
      </div>`;
    this.setHp('player', p.hp, p.maxHp);
    this.setHp('enemy', e.hp, e.maxHp);

    this.el.classList.add('open');
    await sleep(350);
  }

  /** 지금 단계에 맞는 선택 버튼을 그린다 */
  renderChoices(state: GameState, busy: boolean) {
    if (!this.battle) return;
    const p = state.players[state.current];
    const phase = state.phase;

    if (phase.kind === 'encounter') {
      const enemy = state.enemies.find((e) => e.id === phase.enemy)!;
      this.actions.innerHTML = `
        <p class="hint">공격: 🎲 d6 + ATK ${p.atk} · ${enemy.counter ? '살아남으면 <b>반격</b>해 와요' : '반격하지 않아요'}</p>
        <div class="choice-row">
          <button class="primary" data-choice="attack" data-primary>⚔ 공격 <kbd>Space</kbd></button>
          <button data-choice="release">🕊 놓아주기</button>
        </div>`;
    } else if (phase.kind === 'defend') {
      this.message(`${ENEMIES[this.battle.enemy.kind].name}의 반격이 온다!`);
      this.actions.innerHTML = `
        <div class="choice-row">
          <button class="defense" data-choice="block">
            <b>🛡 방어</b><small>d6 + DEF ${p.def}</small><small>피해를 줄인다 (최소 1)</small>
          </button>
          <button class="defense" data-choice="evade">
            <b>💨 회피</b><small>d6 + EVA ${p.eva}</small><small>성공하면 0, 실패하면 전부</small>
          </button>
        </div>`;
    } else {
      this.actions.innerHTML = '';
    }
    this.actions.querySelectorAll('button').forEach((b) => (b.disabled = busy));
  }

  // ───────── 연출 ─────────

  private async play(record: Battle, event: BattleEvent) {
    const enemyName = ENEMIES[record.enemy.kind].name;
    switch (event.type) {
      case 'attack': {
        const attacker: Side = event.attacker;
        const defender: Side = attacker === 'player' ? 'enemy' : 'player';
        const r = event.result;
        this.message(attacker === 'player' ? '공격!' : `${enemyName}의 반격!`);
        await this.rollDice(attacker, r);

        this.pose(attacker, 'lunge');
        await sleep(180);
        if (r.damage === 0) {
          this.pose(defender, 'dodge');
          this.pop(defender, '회피!', 'miss');
          this.message('회피 성공! 피해 0');
        } else {
          this.pose(defender, 'hit');
          this.pop(defender, `-${r.damage}`, 'dmg');
          const max = defender === 'player' ? this.playerMaxHp : record.enemy.maxHp;
          this.setHp(defender, event.targetHp, max);
          this.message(r.mode === 'evade' ? `회피 실패! ${r.damage} 피해` : `${r.damage} 피해`);
        }
        await sleep(950);
        break;
      }
      case 'enemyDefeated':
        this.pose('enemy', 'down');
        this.message(`${enemyName} 처치! 🪙 +${event.reward}`);
        await sleep(1000);
        break;
      case 'playerKO':
        this.pose('player', 'down');
        this.message(`쓰러졌다… 🪙 -${event.coinsLost}`);
        await sleep(1200);
        break;
      case 'release':
        this.message('🕊 놓아주고 지나간다');
        await sleep(600);
        break;
    }
  }

  /** 주사위 두 개를 굴리는 연출. 왼쪽은 플레이어, 오른쪽은 에너미 쪽 주사위 */
  private async rollDice(attacker: Side, r: AttackResult) {
    const defenseLabel = r.mode === 'block' ? '🛡 방어' : '💨 회피';
    const atk = { roll: r.attackRoll, bonus: r.attackValue - r.attackRoll, total: r.attackValue, label: '⚔ 공격' };
    const def = { roll: r.defenseRoll, bonus: r.defenseValue - r.defenseRoll, total: r.defenseValue, label: defenseLabel };
    const [left, right] = attacker === 'player' ? [atk, def] : [def, atk];

    const box = (d: typeof atk) => `
      <div class="die-box">
        <label>${d.label}</label>
        <span class="die rolling">?</span>
        <small class="sum">${d.roll} + ${d.bonus} = <b>${d.total}</b></small>
      </div>`;
    const row = this.el.querySelector<HTMLElement>('.dice-row')!;
    row.innerHTML = `${box(left)}<span class="vs-mini">vs</span>${box(right)}`;

    const dice = [...row.querySelectorAll<HTMLElement>('.die')];
    for (let i = 0; i < 8; i++) {
      dice.forEach((d) => (d.textContent = String(1 + Math.floor(Math.random() * 6))));
      await sleep(55);
    }
    dice[0].textContent = String(left.roll);
    dice[1].textContent = String(right.roll);
    dice.forEach((d) => d.classList.remove('rolling'));
    row.classList.add('settled');
    await sleep(450);
    row.classList.remove('settled');
  }

  private setHp(side: Side, hp: number, max: number) {
    const f = this.fighter(side);
    f.querySelector<HTMLElement>('.bar i')!.style.width = `${(hp / max) * 100}%`;
    f.querySelector('.hptext')!.textContent = `HP ${hp} / ${max}`;
  }

  private pose(side: Side, pose: 'lunge' | 'hit' | 'dodge' | 'down') {
    const f = this.fighter(side);
    f.classList.remove('lunge', 'hit', 'dodge');
    void f.offsetWidth; // 같은 애니메이션 다시 재생
    f.classList.add(pose);
  }

  private pop(side: Side, text: string, kind: 'dmg' | 'miss') {
    const el = this.fighter(side).querySelector<HTMLElement>('.pop')!;
    el.textContent = text;
    el.className = `pop ${kind}`;
    void el.offsetWidth;
    el.classList.add('show');
  }

  private message(text: string) {
    this.el.querySelector('.battle-msg')!.textContent = text;
  }

  private fighter(side: Side): HTMLElement {
    return this.el.querySelector<HTMLElement>(`.fighter[data-side="${side}"]`)!;
  }

  private get actions(): HTMLElement {
    return this.el.querySelector<HTMLElement>('.battle-actions')!;
  }

  private close() {
    this.el.classList.remove('open');
    this.battle = null;
  }
}

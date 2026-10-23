// 화면 연출 (컷인 · 띠 · 숫자 팝업).
// trpg-vtt의 연출 모음(src/components/session/fxevents.css · FxEvents.tsx)을 바닐라 DOM으로 옮기고 학원 도시 색으로 바꿨다.
// 연출은 한 번에 하나씩 순서대로 재생하고, 화면을 누르면 건너뛴다.

export type FxKind =
  | 'encounter'
  | 'round'
  | 'turn'
  | 'skill'
  | 'card'
  | 'dice'
  | 'banner'
  | 'warning'
  | 'levelup'
  | 'ko'
  | 'victory'
  | 'defeat';

/** 연출마다 전체 길이(ms). CSS의 --dur로도 넘어간다 */
const DUR: Record<FxKind, number> = {
  encounter: 1300,
  round: 1500,
  turn: 1600,
  skill: 1700,
  card: 1200,
  dice: 1500,
  banner: 2000,
  warning: 2800,
  levelup: 2400,
  ko: 1700,
  victory: 3600,
  defeat: 3600,
};

/** 화면을 막지 않는 연출 (지나가는 띠). 나머지는 누르면 건너뛸 수 있다 */
const PASS_THROUGH: FxKind[] = ['round', 'turn', 'skill', 'card', 'banner'];

export interface FxSpec {
  kind: FxKind;
  text: string;
  sub?: string;
  /** 띠 · 선 색. 플레이어 색을 넘기면 그 색으로 */
  color?: string;
  /** 턴 컷인의 얼굴 자리. 캐릭터 그림이 생기면 이미지 주소를 넣는다 */
  face?: { label: string; image?: string };
  /** 스킬 컷인에 크게 들어오는 캐릭터 메인 일러스트 */
  art?: string;
  /** 카드 앞면 (cardFace) · 주사위 (diceHtml) 같은 미리 만든 내용 */
  html?: string;
}

export type FloatKind = 'coin' | 'hurt' | 'heal' | 'level' | 'card';

/** 글자마다 <span style="--i:n">으로 나눠서 한 글자씩 튀어나오게 한다 */
function letters(text: string): string {
  return Array.from(text)
    .map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : escapeHtml(ch)}</span>`)
    .join('');
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function markup(spec: FxSpec): string {
  const big = (content: string) => `<div class="fxe-big">${content}</div>`;
  const sub = spec.sub ? `<div class="fxe-sub">${escapeHtml(spec.sub)}</div>` : '';
  const text = escapeHtml(spec.text);

  switch (spec.kind) {
    case 'encounter':
      return `<div class="fxe-flash"></div><div class="fxe-slash"></div><div class="fxe-slash fxe-slash--2"></div><div class="fxe-slash fxe-slash--3"></div>${big(text)}${sub}`;
    case 'round':
      return `<div class="fxe-line fxe-line--l"></div><div class="fxe-line fxe-line--r"></div><div class="fxe-glint"></div>${big(text)}${sub}`;
    case 'turn':
    case 'banner': {
      const face = spec.face
        ? `<div class="fxe-face">${spec.face.image ? `<img src="${spec.face.image}" alt="">` : `<span>${escapeHtml(spec.face.label)}</span>`}</div>`
        : '';
      return `<div class="fxe-band">${face}<div class="fxe-band-text">${big(text)}${sub}</div></div>`;
    }
    case 'skill': {
      const art = spec.art ? `<img class="fxe-skill-art" src="${spec.art}" alt="">` : '';
      return `<div class="fxe-band fxe-band--skill"><div class="fxe-band-text">${sub}${big(text)}</div></div>${art}`;
    }
    case 'card':
      return `<div class="fxe-card">${spec.html ?? ''}</div>`;
    case 'dice':
      return spec.html ?? '';
    case 'warning':
      return `<div class="fxe-hazard fxe-hazard--top"></div><div class="fxe-hazard fxe-hazard--bottom"></div>${big(text)}${sub}`;
    case 'levelup':
    case 'victory':
      return `<div class="fxe-rays"></div><div class="fxe-sparkle"></div>${big(letters(spec.text))}${sub}`;
    case 'ko':
      return `${big(letters(spec.text))}${sub}`;
    case 'defeat':
      return `<div class="fxe-crack"></div>${big(letters(spec.text))}${sub}`;
  }
}

export class FxLayer {
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly root: HTMLElement) {}

  /** 연출을 줄에 세운다. 앞 연출이 끝난 뒤 재생되고, 이 연출이 끝나면 resolve */
  play(spec: FxSpec): Promise<void> {
    this.chain = this.chain.then(() => this.run(spec));
    return this.chain;
  }

  private run(spec: FxSpec): Promise<void> {
    const ms = DUR[spec.kind];
    const el = document.createElement('div');
    el.className = `fxe fxe--${spec.kind}`;
    el.style.setProperty('--dur', `${ms}ms`);
    if (spec.color) el.style.setProperty('--fx', spec.color);
    el.innerHTML = markup(spec);
    this.root.append(el);

    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        el.remove();
        resolve();
      };
      const timer = setTimeout(done, ms);
      if (!PASS_THROUGH.includes(spec.kind)) el.onclick = done;
    });
  }

  /** 말 머리 위에 숫자가 떠올랐다 사라진다 (기다리지 않는다) */
  float(point: { x: number; y: number }, text: string, kind: FloatKind, delay = 0) {
    const el = document.createElement('span');
    el.className = `fx-float fx-float--${kind}`;
    el.style.left = `${point.x}px`;
    el.style.top = `${point.y}px`;
    el.style.animationDelay = `${delay}ms`;
    el.textContent = text;
    el.onanimationend = () => el.remove();
    this.root.append(el);
  }

  /** 칸 위에 퍼지는 동그라미 두 겹 (차례 시작 위치 표시) */
  ping(point: { x: number; y: number }, color: string) {
    const el = document.createElement('div');
    el.className = 'fx-ping';
    el.style.left = `${point.x}px`;
    el.style.top = `${point.y + 16}px`;
    el.style.setProperty('--c', color);
    el.innerHTML = '<span></span><span></span>';
    setTimeout(() => el.remove(), 3200);
    this.root.append(el);
  }
}

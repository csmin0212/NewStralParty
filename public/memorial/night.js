(() => {
  const frame = document.querySelector('#frame');
  const play = document.querySelector('#play');
  const compare = document.querySelector('#compare');
  const panel = document.querySelector('#panel');
  const layers = document.querySelector('#layers');
  const reaction = document.querySelector('#reaction');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, comparing = false, parallax = true;
  let targetX = 0, targetY = 0, x = 0, y = 0, raf = 0;
  const refresh = () => {
    frame.classList.toggle('paused', paused);
    frame.classList.toggle('compare', comparing);
    play.textContent = paused ? '재생' : '일시 정지';
    play.setAttribute('aria-pressed', String(paused));
    compare.setAttribute('aria-pressed', String(comparing));
  };
  play.addEventListener('click', () => { paused = !paused; refresh(); });
  document.querySelector('#eye-preview').addEventListener('click', e => {
    const closed = frame.classList.toggle('force-blink');
    e.currentTarget.setAttribute('aria-pressed', String(closed));
  });
  compare.addEventListener('click', () => { comparing = !comparing; refresh(); });
  layers.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    layers.setAttribute('aria-expanded', String(!panel.hidden));
  });
  panel.addEventListener('change', e => {
    const input = e.target;
    if (input.dataset.toggle) document.querySelector(`[data-layer="${input.dataset.toggle}"]`).classList.toggle('hidden-layer', !input.checked);
    if (input.dataset.effect) frame.classList.toggle(`still-${input.dataset.effect}`, !input.checked);
    if (input.id === 'parallax') {
      parallax = input.checked;
      frame.classList.toggle('no-parallax', !parallax);
      if (!parallax) targetX = targetY = x = y = 0;
    }
  });
  document.querySelector('#clean').addEventListener('click', () => {
    frame.classList.add('clean');
    panel.hidden = true;
    layers.setAttribute('aria-expanded', 'false');
  });
  const lines = ['…밖에 별, 꽤 잘 보이지?', '조금만 더, 여기 같이 있을래?', '이런 밤엔 음악도 더 잘 들리는 것 같아.'];
  let lineIndex = 0;
  frame.addEventListener('click', () => {
    if (frame.classList.contains('clean')) { frame.classList.remove('clean'); return; }
    if (paused || comparing || reduced.matches || document.querySelector('[data-layer="character"]').classList.contains('hidden-layer')) return;
    reaction.classList.remove('respond');
    void reaction.offsetWidth;
    reaction.classList.add('respond');
    lineIndex = (lineIndex + 1) % lines.length;
    document.querySelector('#line').textContent = lines[lineIndex];
  });
  reaction.addEventListener('animationend', () => reaction.classList.remove('respond'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      frame.classList.remove('clean'); panel.hidden = true;
      layers.setAttribute('aria-expanded', 'false');
    }
  });
  for (let i = 0; i < 32; i++) {
    const star = document.createElement('i');
    star.style.cssText = `--left:${64 + (i * 17 % 35)}%;--top:${1 + (i * 11 % 25)}%;--size:${i % 5 === 0 ? 2.2 : 1.3}px;--duration:${3 + i % 7}s;--delay:-${i * 1.3}s`;
    document.querySelector('#stars').append(star);
  }
  frame.addEventListener('pointermove', e => {
    const rect = frame.getBoundingClientRect();
    targetX = Math.max(-1, Math.min(1, (e.clientX - rect.left) / rect.width * 2 - 1));
    targetY = Math.max(-1, Math.min(1, (e.clientY - rect.top) / rect.height * 2 - 1));
  });
  frame.addEventListener('pointerleave', () => { targetX = targetY = 0; });
  function tick() {
    if (!paused && !comparing && parallax && !reduced.matches) {
      x += (targetX - x) * .035; y += (targetY - y) * .035;
      frame.style.setProperty('--px', x.toFixed(4));
      frame.style.setProperty('--py', y.toFixed(4));
    }
    raf = requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf); else { cancelAnimationFrame(raf); tick(); }
  });
  reduced.addEventListener('change', () => { if (reduced.matches) paused = true; refresh(); });
  refresh(); tick();
  Promise.all([...frame.querySelectorAll('img')].map(image => image.decode())).then(() => {
    document.querySelector('#loader').hidden = true;
  }).catch(() => {
    const loader = document.querySelector('#loader');
    loader.textContent = '이미지를 불러오지 못했습니다.';
    const retry = document.createElement('button'); retry.textContent = '다시 불러오기';
    retry.addEventListener('click', () => location.reload()); loader.append(retry);
  });
})();

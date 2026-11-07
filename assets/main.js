/* ARKÉ — interaction layer: loader, kinetic type, scroll-driven camera, cursor, tilt. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = t => t * t * (3 - 2 * t);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ---------- WebGL scene ---------- */
  const canvas = $('#gl');
  const scene = window.ArkeScene && window.ArkeScene.init(canvas);
  if (!scene) document.documentElement.classList.add('no-gl'), document.body.classList.add('no-gl');

  /* ---------- kinetic type: split into masked words + chars ---------- */
  function split(el) {
    let n = 0;
    (function walk(node) {
      Array.from(node.childNodes).forEach(c => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok.replace(/ /g, ' ') || ' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            Array.from(tok).forEach(chr => {
              const s = document.createElement('span'); s.className = 'ch';
              s.style.setProperty('--i', n++); s.textContent = chr === ' ' ? ' ' : chr;
              w.appendChild(s);
            });
            frag.appendChild(w);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
      });
    })(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  }
  $$('[data-split]').forEach(split);

  // scroll-lit manifesto words
  const wordsEl = $('[data-words]');
  let wordSpans = [];
  if (wordsEl) {
    const txt = wordsEl.textContent.trim();
    wordsEl.setAttribute('aria-label', txt);
    wordsEl.innerHTML = txt.split(/\s+/).map(w => `<span class="wd" aria-hidden="true">${w}</span>`).join(' ');
    wordSpans = $$('.wd', wordsEl);
  }

  /* ---------- loader ---------- */
  const nEl = $('.loader-n');
  let readyFired = false;
  function ready() {
    if (readyFired) return; readyFired = true;
    document.body.classList.add('ready');
    setTimeout(() => document.body.classList.remove('is-loading'), 700);
    startObservers();
  }
  (function count() {
    const dur = reduced ? 200 : 1700, t0 = performance.now();
    (function tick(now) {
      const p = clamp((now - t0) / dur, 0, 1);
      nEl.textContent = String(Math.round(ss(p) * 100)).padStart(3, '0');
      if (p < 1) requestAnimationFrame(tick); else setTimeout(ready, 250);
    })(t0);
  })();
  setTimeout(ready, 5000); // failsafe

  /* ---------- reveal observers ---------- */
  function startObservers() {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      if (e.target.hasAttribute('data-split')) setTimeout(() => e.target.classList.add('done'), 2400);
      io.unobserve(e.target);
    }), { threshold: .2 });
    $$('[data-split],.reveal').forEach(el => io.observe(el));

    const co = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, target = +el.dataset.count, t0 = performance.now();
      (function tick(now) {
        const p = clamp((now - t0) / 1700, 0, 1);
        el.textContent = Math.round((1 - Math.pow(1 - p, 4)) * target);
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
      co.unobserve(el);
    }), { threshold: .6 });
    $$('[data-count]').forEach(el => co.observe(el));
  }

  /* ---------- layout metrics ---------- */
  const secs = $$('.sec');
  const collection = $('.collection');
  const track = $('.track');
  let vw = innerWidth, vh = innerHeight, tops = [], hs = [];
  function measure() {
    vw = innerWidth; vh = innerHeight;
    if (collection && track) {
      collection.style.height = '';
      const dist = Math.max(0, track.scrollWidth - vw + 40);
      collection.style.height = (vh + dist) + 'px';
      collection._dist = dist;
    }
    const sy = scrollY;
    tops = secs.map(s => s.getBoundingClientRect().top + sy);
    hs = secs.map(s => s.offsetHeight);
  }
  addEventListener('resize', measure);
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();

  /* ---------- pointer ---------- */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: -100, py: -100, cx: -100, cy: -100 };
  addEventListener('pointermove', e => {
    mouse.px = e.clientX; mouse.py = e.clientY;
    mouse.x = (e.clientX / vw - .5) * 2; mouse.y = -(e.clientY / vh - .5) * 2;
  }, { passive: true });
  const cursor = $('.cursor');
  if (fine) {
    document.addEventListener('pointerover', e => {
      cursor.classList.toggle('hot', !!e.target.closest('a,button,.tilt'));
    });
  }

  // magnetic buttons
  const mags = $$('.magnetic');
  // card tilt
  $$('.tilt').forEach(card => {
    const art = $('.art', card), inner = $('.art i', card);
    card.addEventListener('pointermove', e => {
      const r = art.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      art.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg)`;
      inner.style.transform = inner.style.transform.replace(/translate3d\([^)]*\)/, '');
      inner.style.translate = `${x * 24}px ${y * 24}px`;
    });
    card.addEventListener('pointerleave', () => { art.style.transform = ''; inner.style.translate = ''; });
  });

  // marquees
  const marquees = $$('.marquee').map(m => {
    const inner = $('.marquee-in', m);
    return { inner, dir: +m.dataset.dir, off: 0, half: 1 };
  });
  function measureMarquee() { marquees.forEach(m => m.half = m.inner.scrollWidth / 2 || 1); }
  addEventListener('load', measureMarquee); addEventListener('resize', measureMarquee);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureMarquee);
  measureMarquee();

  // waving headline
  const waveChars = $$('.wave .ch');

  /* ---------- smooth anchor scroll ---------- */
  let anim = 0;
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    const y = id === '#top' ? 0 : target.getBoundingClientRect().top + scrollY;
    const y0 = scrollY, t0 = performance.now(), dur = reduced ? 1 : 1600; const my = ++anim;
    (function step(now) {
      if (my !== anim) return;
      const p = clamp((now - t0) / dur, 0, 1), k = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      scrollTo(0, lerp(y0, y, k));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }));
  addEventListener('wheel', () => anim++, { passive: true });
  addEventListener('touchstart', () => anim++, { passive: true });

  /* ---------- main loop ---------- */
  const S = { time: 0, morph: 0, spin: 0, zoom: 0, camY: 0, roll: 0, light: 0, vel: 0, ox: .34, oy: 0, mx: 0, my: 0 };
  const key = el => ({
    morph: +el.dataset.morph || 0, ox: +el.dataset.ox || 0, oy: +el.dataset.oy || 0, zoom: +el.dataset.zoom || 0, light: +el.dataset.light || 0
  });
  let last = performance.now(), smoothY = scrollY, prevY = scrollY, vel = 0, firstFrame = true;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, .05); last = now;
    S.time += dt * (reduced ? .25 : 1);
    const k = 1 - Math.pow(.001, dt); // frame-rate independent ease

    const y = scrollY;
    smoothY = firstFrame ? y : lerp(smoothY, y, 1 - Math.pow(.0008, dt));
    const rawV = (y - prevY) / Math.max(dt, .001) / 2400; prevY = y;
    vel = lerp(vel, clamp(rawV, -1.5, 1.5), 1 - Math.pow(.01, dt));

    // find the keyframe pair for the viewport centre
    const pos = smoothY + vh * .5;
    let i = 0;
    for (let j = 0; j < secs.length; j++) if (pos >= tops[j]) i = j;
    const a = key(secs[i]);
    let tgt = a;
    if (i < secs.length - 1) {
      const L = Math.min(vh * .95, hs[i] * .6);
      const t = ss(clamp((pos - (tops[i] + hs[i] - L)) / L, 0, 1));
      const b = key(secs[i + 1]);
      tgt = { morph: lerp(a.morph, b.morph, t), ox: lerp(a.ox, b.ox, t), oy: lerp(a.oy, b.oy, t), zoom: lerp(a.zoom, b.zoom, t), light: lerp(a.light, b.light, t) };
    }
    const aspect = vw / vh, narrow = vw <= 820;
    const oxScale = clamp(aspect / 1.78, .6, 1.3);
    const ox = narrow ? 0 : tgt.ox * oxScale;
    const oy = narrow ? (i === 0 ? .27 : i >= secs.length - 2 ? 0 : .2) : tgt.oy;
    const zoom = tgt.zoom - (narrow ? 4.6 : 0);

    const e = firstFrame ? 1 : k * .55;
    S.morph = lerp(S.morph, tgt.morph, e);
    S.ox = lerp(S.ox, ox, e); S.oy = lerp(S.oy, oy, e);
    S.zoom = lerp(S.zoom, zoom, e);
    S.light = lerp(S.light, tgt.light, firstFrame ? 1 : k * .7);

    const maxY = Math.max(1, document.documentElement.scrollHeight - vh);
    const prog = smoothY / maxY;
    S.spin = S.time * (reduced ? .05 : .14) + prog * Math.PI * 2.6;
    S.camY = Math.sin(prog * 7) * .45;
    S.roll = Math.sin(prog * 5 + 1) * .07 + vel * .05;
    S.vel = clamp(Math.abs(vel), 0, 1);
    mouse.sx = lerp(mouse.sx, mouse.x, k * .35); mouse.sy = lerp(mouse.sy, mouse.y, k * .35);
    S.mx = mouse.sx; S.my = mouse.sy;
    document.body.classList.toggle('is-light', S.light > .5);

    if (scene) scene.render(S);

    // horizontal collection
    if (collection && collection._dist != null) {
      const r = collection.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, collection.offsetHeight - vh), 0, 1);
      track.style.transform = `translate3d(${-p * collection._dist}px,0,0)`;
    }

    // manifesto word light-up
    if (wordSpans.length) {
      const r = wordsEl.getBoundingClientRect();
      const p = clamp((vh * .82 - r.top) / (r.height + vh * .35), 0, 1);
      const n = wordSpans.length;
      for (let w = 0; w < n; w++) {
        const o = .14 + .86 * clamp(p * (n + 5) - w, 0, 1);
        wordSpans[w].style.opacity = o.toFixed(3);
      }
    }

    // marquees: constant drift + scroll velocity push + skew
    marquees.forEach(m => {
      m.off += m.dir * (60 + Math.abs(vel) * 900) * dt * (reduced ? .2 : 1);
      const x = ((m.off % m.half) + m.half) % m.half - m.half;
      m.inner.style.transform = `translate3d(${x}px,0,0) skewX(${(-vel * 9).toFixed(2)}deg)`;
    });

    // cursor + magnets
    if (fine) {
      mouse.cx = lerp(mouse.cx, mouse.px, k * .5); mouse.cy = lerp(mouse.cy, mouse.py, k * .5);
      cursor.style.transform = `translate3d(${mouse.cx}px,${mouse.cy}px,0)`;
      mags.forEach(b => {
        const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = mouse.px - cx, dy = mouse.py - cy, d = Math.hypot(dx, dy), reach = Math.max(r.width, 160) * .75;
        const f = d < reach ? (1 - d / reach) : 0;
        b._x = lerp(b._x || 0, dx * f * .35, k * .5); b._y = lerp(b._y || 0, dy * f * .35, k * .5);
        b.style.transform = `translate3d(${b._x.toFixed(1)}px,${b._y.toFixed(1)}px,0)`;
      });
    }

    // wave headline follows the pointer
    if (waveChars.length && fine) {
      const host = waveChars[0].closest('.wave');
      if (host.classList.contains('done')) {
        const hr = host.getBoundingClientRect();
        if (hr.bottom > 0 && hr.top < vh) {
          waveChars.forEach(c => {
            const r = c.getBoundingClientRect();
            const dx = mouse.px - (r.left + r.width / 2), dy = mouse.py - (r.top + r.height / 2);
            const f = Math.exp(-(dx * dx + dy * dy) / (2 * 190 * 190));
            c.style.setProperty('--wy', (-f * 26).toFixed(1) + 'px');
          });
        }
      }
    }

    firstFrame = false;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

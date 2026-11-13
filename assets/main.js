/* SELENE — motion layer: loader, kinetic type, scroll-driven fluid camera, pinned scenes, cursor, drag-to-spin. */
(function () {
  'use strict';
  const Sel = window.Selene;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = t => t * t * (3 - 2 * t);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const home = document.body.dataset.page === 'home';
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

  /* ---------- WebGL ---------- */
  const canvas = $('#gl');
  let scene = window.SeleneScene && window.SeleneScene.init(canvas);
  const glFail = on => { document.documentElement.classList.toggle('no-gl', on); document.body.classList.toggle('no-gl', on); };
  glFail(!scene);
  // recover from GPU context loss instead of leaving a black screen
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); scene = null; glFail(true); });
  canvas.addEventListener('webglcontextrestored', () => { scene = window.SeleneScene.init(canvas); glFail(!scene); });

  /* ---------- kinetic type ---------- */
  const FX = ['', 'fx-flip', 'fx-blur'];
  function split(el, idx) {
    let n = 0;
    (function walk(node) {
      Array.from(node.childNodes).forEach(c => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            Array.from(tok).forEach(chr => {
              const s = document.createElement('span'); s.className = 'ch';
              s.style.setProperty('--i', n++); s.textContent = chr; s.setAttribute('aria-hidden', 'true');
              w.appendChild(s);
            });
            frag.appendChild(w);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
      });
    })(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    const fx = FX[idx % FX.length]; if (fx && !el.classList.contains('mega')) el.classList.add(fx);
  }
  $$('[data-split]').forEach(split);

  // scroll-lit words
  const wordsEl = $('[data-words]');
  let wordSpans = [];
  if (wordsEl) {
    const txt = wordsEl.textContent.trim();
    wordsEl.setAttribute('aria-label', txt);
    wordsEl.innerHTML = txt.split(/\s+/).map(w => `<span class="wd" aria-hidden="true">${w}</span>`).join(' ');
    wordSpans = $$('.wd', wordsEl);
  }

  // text scramble for mono labels
  const GL = '▮▯◐◑◒◓01#/\\<>_—+*';
  function scramble(el) {
    const final = el.dataset.final || (el.dataset.final = el.textContent);
    if (reduced) { el.textContent = final; return; }
    const t0 = performance.now(), dur = 700 + final.length * 14;
    (function tick(now) {
      const p = clamp((now - t0) / dur, 0, 1), keep = Math.floor(p * final.length);
      el.textContent = final.slice(0, keep) + Array.from(final.slice(keep)).map(c => (c === ' ' ? ' ' : GL[(Math.random() * GL.length) | 0])).join('');
      if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
    })(t0);
  }

  /* ---------- loader ---------- */
  const nEl = $('.loader-n');
  let readyFired = false;
  const first = home && !sessionStorage.getItem('selene_seen');
  function ready() {
    if (readyFired) return; readyFired = true;
    document.body.classList.add('ready');
    setTimeout(() => document.body.classList.remove('is-loading'), 900);
    startObservers();
  }
  if (first) {
    try { sessionStorage.setItem('selene_seen', '1'); } catch (e) {}
    const dur = reduced ? 200 : 1900, t0 = performance.now();
    (function tick(now) {
      const p = clamp((now - t0) / dur, 0, 1);
      nEl.textContent = String(Math.round(ss(p) * 100)).padStart(3, '0');
      if (p < 1) requestAnimationFrame(tick); else setTimeout(ready, 250);
    })(t0);
    setTimeout(ready, 5000);
  } else {
    document.body.classList.add('quick');
    setTimeout(ready, 80);
  }

  function startObservers() {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      if (e.target.hasAttribute('data-split')) setTimeout(() => e.target.classList.add('done'), 2400);
      io.unobserve(e.target);
    }), { threshold: .15 });
    $$('[data-split],.reveal,.rv,.step,.card,.panel,.spec-list > div,.acc .q').forEach(el => io.observe(el));

    const so = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { scramble(e.target); so.unobserve(e.target); } }), { threshold: .6 });
    $$('.eyebrow').forEach(el => so.observe(el));

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
  const features = $('.features'), track = $('.features .track');
  const stmt = $('.stmt'), slides = $$('[data-slide]');
  let vw = innerWidth, vh = innerHeight, tops = [], hs = [];
  function measure() {
    vw = innerWidth; vh = innerHeight;
    if (features && track) {
      features.style.height = '';
      const dist = Math.max(0, track.scrollWidth - vw + 40);
      features.style.height = (vh + dist) + 'px';
      features._dist = dist;
    }
    const sy = scrollY;
    tops = secs.map(s => s.getBoundingClientRect().top + sy);
    hs = secs.map(s => s.offsetHeight);
  }
  addEventListener('resize', measure); addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();
  setTimeout(measure, 1200);

  /* ---------- pointer ---------- */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: -100, py: -100, cx: -100, cy: -100 };
  addEventListener('pointermove', e => {
    mouse.px = e.clientX; mouse.py = e.clientY;
    mouse.x = (e.clientX / vw - .5) * 2; mouse.y = -(e.clientY / vh - .5) * 2;
  }, { passive: true });
  const cursor = $('.cursor');
  if (fine) document.addEventListener('pointerover', e => cursor.classList.toggle('hot', !!e.target.closest('a,button,.tilt,label,summary,input,select,textarea')));
  const mags = $$('.magnetic');

  // card tilt
  $$('.tilt').forEach(card => {
    const art = $('.art', card), inner = $('.art i', card);
    card.addEventListener('pointermove', e => {
      const r = art.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      art.style.transform = `rotateY(${x * 16}deg) rotateX(${-y * 16}deg)`;
      inner.style.translate = `${x * 28}px ${y * 28}px`;
    });
    card.addEventListener('pointerleave', () => { art.style.transform = ''; inner.style.translate = ''; });
  });

  // marquees
  const marquees = $$('.marquee').map(m => ({ inner: $('.marquee-in', m), dir: +m.dataset.dir, off: 0, half: 1 }));
  const measureMarquee = () => marquees.forEach(m => (m.half = m.inner.scrollWidth / 2 || 1));
  addEventListener('load', measureMarquee); addEventListener('resize', measureMarquee);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureMarquee);
  measureMarquee();

  const waveChars = $$('.wave .ch');

  /* ---------- smooth anchors ---------- */
  let anim = 0;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]'); if (!a) return;
    const u = new URL(a.href, location.href);
    if (u.pathname !== location.pathname || !u.hash && a.getAttribute('href') !== '#top') return;
    const id = u.hash || '#top';
    const target = id === '#top' ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    const y = id === '#top' ? 0 : target.getBoundingClientRect().top + scrollY;
    const y0 = scrollY, t0 = performance.now(), dur = reduced ? 1 : clamp(Math.abs(y - y0) * .6, 900, 2000), my = ++anim;
    (function step(now) {
      if (my !== anim) return;
      const p = clamp((now - t0) / dur, 0, 1), k = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      scrollTo(0, lerp(y0, y, k));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  });
  addEventListener('wheel', () => anim++, { passive: true });
  addEventListener('touchstart', () => anim++, { passive: true });
  if (location.hash) setTimeout(() => { const t = $(location.hash); if (t) scrollTo(0, t.getBoundingClientRect().top + scrollY); }, 120);

  /* ---------- drag to spin ---------- */
  let dragSpin = 0, dragV = 0, dragging = false, lastX = 0;
  const shopEl = $('#shop');
  if (shopEl) {
    addEventListener('pointerdown', e => {
      if (e.target.closest('.buy,button,a,input,select,.drawer')) return;
      const r = shopEl.getBoundingClientRect();
      if (r.top > vh * .6 || r.bottom < vh * .4) return;
      dragging = true; lastX = e.clientX; cursor && cursor.classList.add('drag');
    });
    addEventListener('pointermove', e => { if (dragging) { const dx = e.clientX - lastX; lastX = e.clientX; dragV = dx * .012; dragSpin += dragV; } });
    addEventListener('pointerup', () => { dragging = false; cursor && cursor.classList.remove('drag'); });
  }

  /* ---------- state ---------- */
  const SCN = { time: 0, spin: 0, zoom: 0, camY: 0, orbit: 0, lookY: 0, roll: 0, light: 0, vel: 0, ring: 0, mag: 0, crater: 1, glowAmt: 1, bob: 0, ox: .34, oy: 0, mx: 0, my: 0, glow: [1, .85, .62] };
  const num = (el, k, d) => (el.dataset[k] !== undefined && el.dataset[k] !== '' ? +el.dataset[k] : d);
  const key = el => ({ ox: num(el, 'ox', 0), oy: num(el, 'oy', 0), zoom: num(el, 'zoom', 0), light: num(el, 'light', 0), ring: num(el, 'ring', 0), crater: num(el, 'crater', 1), orbit: num(el, 'orbit', 0), look: num(el, 'look', 0), bob: num(el, 'bob', 0) });
  const mix = (a, b, t) => { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k], t); return o; };

  let last = performance.now(), smoothY = scrollY, prevY = scrollY, vel = 0, firstFrame = true, slowAcc = 0, fcount = 0;
  const root = document.documentElement, bar = $('.progress i');
  let glowTarget = hexRgb(Sel.CAT.colors[0].hex), autoIdx = -1;

  function frame(now) {
    const dtRaw = (now - last) / 1000, dt = Math.min(dtRaw, .05); last = now;
    SCN.time += dt * (reduced ? .25 : 1);
    const k = 1 - Math.pow(.001, dt);

    const y = scrollY;
    smoothY = firstFrame ? y : lerp(smoothY, y, 1 - Math.pow(.0008, dt));
    const rawV = (y - prevY) / Math.max(dt, .001) / 2400; prevY = y;
    vel = lerp(vel, clamp(rawV, -1.5, 1.5), 1 - Math.pow(.01, dt));
    root.style.setProperty('--vel', vel.toFixed(3));

    // keyframe pair for the viewport centre
    const pos = smoothY + vh * .5;
    let i = 0;
    for (let j = 0; j < secs.length; j++) if (pos >= tops[j]) i = j;
    const a = key(secs[i]);
    let tgt = a;
    if (i < secs.length - 1) {
      const L = Math.min(vh * .95, hs[i] * .6);
      const t = ss(clamp((pos - (tops[i] + hs[i] - L)) / L, 0, 1));
      tgt = mix(a, key(secs[i + 1]), t);
    }
    // product options drive the 3D object while the shop is in view
    const inShop = shopEl ? ss(clamp(1 - Math.abs((tops[secs.indexOf(shopEl)] + hs[secs.indexOf(shopEl)] / 2) - pos) / (vh * 1.1), 0, 1)) : 0;
    const wantMag = Sel.opt && Sel.opt.base === 'float' ? 1 : 0;
    const sizeZ = Sel.opt ? { '15': .3, '18': -.05, '20': -.4 }[Sel.opt.size] : 0;
    const aspect = vw / vh, narrow = vw <= 820;
    const oxScale = clamp(aspect / 1.78, .6, 1.3);
    const ox = narrow ? 0 : tgt.ox * oxScale;
    const oy = narrow ? (i === 0 ? .27 : .24) : tgt.oy;
    const zoom = tgt.zoom + sizeZ * inShop - (narrow ? 4.2 : 0);

    const e = firstFrame ? 1 : k * .55;
    SCN.ox = lerp(SCN.ox, ox, e); SCN.oy = lerp(SCN.oy, oy, e);
    SCN.zoom = lerp(SCN.zoom, zoom, e);
    SCN.light = lerp(SCN.light, tgt.light, firstFrame ? 1 : k * .7);
    SCN.ring = lerp(SCN.ring, tgt.ring, e);
    SCN.mag = lerp(SCN.mag, tgt.ring > .5 ? (inShop > .3 ? wantMag : 1) : SCN.mag, e);
    SCN.crater = lerp(SCN.crater, tgt.crater, e);
    SCN.bob = lerp(SCN.bob, tgt.bob, e);
    SCN.lookY = lerp(SCN.lookY, tgt.look + inShop * (1 - SCN.mag) * .28, e);

    const maxY = Math.max(1, root.scrollHeight - vh);
    const prog = smoothY / maxY;
    if (bar) bar.style.transform = `scaleX(${prog.toFixed(4)})`;
    dragV *= Math.pow(.04, dt); if (!dragging) dragSpin += dragV;
    SCN.spin = SCN.time * (reduced ? .05 : .16) + prog * Math.PI * 2.4 + dragSpin;
    SCN.orbit = lerp(SCN.orbit, tgt.orbit + Math.sin(prog * 9) * .12, e);
    SCN.camY = lerp(SCN.camY, Math.sin(prog * 7) * .32, e);
    SCN.roll = Math.sin(prog * 5 + 1) * .05 + vel * .06;
    SCN.vel = clamp(Math.abs(vel), 0, 1);
    mouse.sx = lerp(mouse.sx, mouse.x, k * .35); mouse.sy = lerp(mouse.sy, mouse.y, k * .35);
    SCN.mx = mouse.sx; SCN.my = mouse.sy;

    // lamp colour: auto-cycles in the hero until the visitor picks one
    if (home && !Sel.userColor && !reduced && scrollY < vh * .8 && readyFired) {
      const idx = Math.floor(SCN.time / 3.2) % Sel.CAT.colors.length;
      if (idx !== autoIdx) { autoIdx = idx; Sel.setColor(idx, false); }
    }
    glowTarget = hexRgb(Sel.CAT.colors[Sel.color].hex);
    for (let c = 0; c < 3; c++) SCN.glow[c] = lerp(SCN.glow[c], glowTarget[c], 1 - Math.pow(.02, dt));
    SCN.glowAmt = 1 + Math.sin(SCN.time * 1.7) * .04 + vel * .1;
    document.body.classList.toggle('is-light', SCN.light > .5);

    if (scene) scene.render(SCN);

    // adaptive resolution: sample frame cost every 20 frames
    if (scene && !firstFrame) { slowAcc += dtRaw * 1000; if (++fcount === 20) { scene.quality(slowAcc / 20); slowAcc = 0; fcount = 0; } }

    // horizontal features
    if (features && features._dist != null) {
      const r = features.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, features.offsetHeight - vh), 0, 1);
      track.style.transform = `translate3d(${-p * features._dist}px,0,0)`;
    }

    // pinned kinetic statement
    if (stmt) {
      const r = stmt.getBoundingClientRect(), p = clamp(-r.top / Math.max(1, stmt.offsetHeight - vh), 0, 1);
      slides.forEach((s, n) => {
        const dir = +s.dataset.slide, x = dir * lerp(46, -46, p) ;
        const sc = 1 + (n === 2 ? ss(clamp((p - .4) / .5, 0, 1)) * .12 : 0);
        s.style.transform = `translate3d(${x}vw,0,0) scale(${sc})`;
        s.style.opacity = clamp(1 - Math.abs(p - .5) * 0.2, 0, 1);
      });
    }

    // scroll-lit words
    if (wordSpans.length) {
      const r = wordsEl.getBoundingClientRect(), p = clamp((vh * .82 - r.top) / (r.height + vh * .35), 0, 1), n = wordSpans.length;
      for (let w = 0; w < n; w++) wordSpans[w].style.opacity = (.14 + .86 * clamp(p * (n + 5) - w, 0, 1)).toFixed(3);
    }

    // marquees: drift + scroll push + skew
    marquees.forEach(m => {
      m.off += m.dir * (70 + Math.abs(vel) * 1100) * dt * (reduced ? .2 : 1);
      const x = ((m.off % m.half) + m.half) % m.half - m.half;
      m.inner.style.transform = `translate3d(${x}px,0,0) skewX(${(-vel * 10).toFixed(2)}deg)`;
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

    // wave headline follows pointer
    if (waveChars.length && fine) {
      const host = waveChars[0].closest('.wave');
      if (host.classList.contains('done')) {
        const hr = host.getBoundingClientRect();
        if (hr.bottom > 0 && hr.top < vh) waveChars.forEach(c => {
          const r = c.getBoundingClientRect(), dx = mouse.px - (r.left + r.width / 2), dy = mouse.py - (r.top + r.height / 2);
          c.style.setProperty('--wy', (-Math.exp(-(dx * dx + dy * dy) / (2 * 190 * 190)) * 28).toFixed(1) + 'px');
        });
      }
    }

    firstFrame = false;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

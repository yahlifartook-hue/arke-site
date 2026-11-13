/* GALE — shared layer: page chrome, cart, cookie consent, page transitions, effects helpers. */
(function () {
  'use strict';
  const CFG = window.GALE_CONFIG, CAT = window.GALE_CATALOG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: CFG.currency });
  const money = c => fmt.format(c / 100);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const page = document.body.dataset.page || 'page';
  const home = page === 'home';

  /* ---------------- state shared with the 3D scene ---------------- */
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const Gale = window.Gale = {
    CFG, CAT, money, esc, store, $, $$,
    color: 0, userColor: false, events: new EventTarget(),
    setColor(i, user) {
      this.color = (i + CAT.colors.length) % CAT.colors.length;
      if (user) this.userColor = true;
      const c = CAT.colors[this.color];
      document.documentElement.style.setProperty('--glow', c.accent);
      this.events.dispatchEvent(new CustomEvent('color', { detail: c }));
    },
    // scene-only preview (hero auto-cycle): updates the accent + hero label without changing the selected variant
    preview(i) {
      const c = CAT.colors[i];
      document.documentElement.style.setProperty('--glow', c.accent);
      const h = document.getElementById('hero-cname'); if (h) h.textContent = c.name;
    },
    toast(msg) {
      const t = document.createElement('div');
      t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
      document.body.appendChild(t);
      requestAnimationFrame(() => t.classList.add('on'));
      setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 600); }, 2800);
    }
  };

  /* ---------------- cart ---------------- */
  const Cart = Gale.cart = {
    items: (store.get('gale_cart_v1', []) || []).filter(i => CAT.skus[i.sku]),
    save() { store.set('gale_cart_v1', this.items); render(); },
    add(sku, qty = 1) {
      if (!CAT.skus[sku]) return;
      const l = this.items.find(i => i.sku === sku);
      if (l) l.qty = Math.min(20, l.qty + qty); else this.items.push({ sku, qty });
      this.save();
    },
    set(sku, qty) {
      const l = this.items.find(i => i.sku === sku); if (!l) return;
      l.qty = Math.max(0, Math.min(20, qty));
      this.items = this.items.filter(i => i.qty > 0); this.save();
    },
    clear() { this.items = []; this.save(); },
    count() { return this.items.reduce((a, i) => a + i.qty, 0); },
    subtotal() { return this.items.reduce((a, i) => a + CAT.skus[i.sku].price * i.qty, 0); },
    shipping() { const s = this.subtotal(); return !s || s >= CFG.freeShippingOver * 100 ? 0 : Math.round(CFG.shippingFlat * 100); },
    total() { return this.subtotal() + this.shipping(); }
  };

  /* ---------------- chrome ---------------- */
  const H = home ? '' : 'index.html';
  const GH = 'https://github.com/yahlifartook-hue/arke-site';
  const chrome = `
<canvas id="gl" aria-hidden="true"></canvas>
<div class="grain" aria-hidden="true"></div>
<div class="cursor" aria-hidden="true"><i></i></div>
<div class="progress" aria-hidden="true"><i></i></div>
<div class="loader" aria-hidden="true"><span class="loader-label">${esc(CFG.brand)} — Neck fans</span><span class="loader-n">000</span></div>
<div class="wipe" aria-hidden="true"></div>
<a class="skip" href="#main">Skip to content</a>
<header class="nav">
  <a href="${H || '#top'}" class="logo" aria-label="${esc(CFG.brand)} home">${esc(CFG.brand)}<sup>≋</sup></a>
  <nav aria-label="Primary">
    <a href="${H}#shop" class="roll" data-t="Shop"><span>Shop</span></a>
    <a href="${H}#features" class="roll hide-s" data-t="Features"><span>Features</span></a>
    <a href="reviews.html" class="roll hide-s" data-t="Reviews"><span>Reviews</span></a>
    <a href="returns.html" class="roll hide-s" data-t="Returns"><span>Returns</span></a>
    <button class="roll cart-btn" data-t="Cart" data-open-cart aria-label="Open cart"><span>Cart <b class="cart-n">0</b></span></button>
  </nav>
</header>
<div class="scrim" data-close-cart></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="Shopping cart" aria-hidden="true">
  <div class="d-head"><h2>Your cart</h2><button class="x" data-close-cart aria-label="Close cart">✕</button></div>
  <div class="ship"><p class="ship-t"></p><div class="bar"><i></i></div></div>
  <ul class="lines"></ul>
  <div class="empty"><i class="orb"></i><p>Nothing here yet.<br>Your neck is still hot.</p><a href="${H}#shop" class="btn sm" data-close-cart><span>Shop the fan</span><b>→</b></a></div>
  <div class="d-foot">
    <dl><div><dt>Subtotal</dt><dd class="d-sub"></dd></div><div><dt>Shipping</dt><dd class="d-ship"></dd></div></dl>
    <a href="checkout.html" class="btn magnetic checkout-link"><span>Checkout</span><b>→</b></a>
    <small>Taxes, if any, are calculated at payment. ${CFG.returnDays}-day returns.</small>
  </div>
</aside>`;

  const footer = `
<footer class="foot" role="contentinfo">
  <div class="foot-top">
    <div class="foot-col"><h3>Shop</h3><a href="${H}#shop">The Neck Fan</a><a href="${H}#features">Features</a><a href="${H}#specs">Specs</a><a href="${H}#faq">FAQ</a></div>
    <div class="foot-col"><h3>Help</h3><a href="shipping.html">Shipping</a><a href="returns.html">Returns &amp; refunds</a><a href="reviews.html">Reviews</a><a data-mail href="#"></a></div>
    <div class="foot-col"><h3>Legal</h3><a href="privacy.html">Privacy policy</a><a href="cookies.html">Cookies</a><a href="terms.html">Terms of sale</a><button data-open-consent>Cookie settings</button></div>
    <div class="foot-col"><h3>Build</h3><a href="${GH}" target="_blank" rel="noopener">Source on GitHub ↗</a><span class="muted">Static front-end · serverless checkout</span></div>
  </div>
  <div class="foot-word" aria-hidden="true">${esc(CFG.brand)}</div>
  <div class="foot-row"><span>© ${new Date().getFullYear()} ${esc(CFG.legalName)}</span><span>Secure card payments by Stripe</span><a href="#top" class="roll" data-t="Back to top"><span>Back to top</span></a></div>
</footer>`;

  const consentHTML = `
<div class="cc" id="cc" role="dialog" aria-live="polite" aria-label="Cookie preferences" hidden>
  <div class="cc-main">
    <h2>Cookies, but make it honest.</h2>
    <p>We use essential storage to run your cart and checkout. Optional analytics &amp; marketing only switch on if you say so. <a href="cookies.html">Read the cookie policy</a>.</p>
    <div class="cc-btns"><button class="btn sm solid" data-cc="all"><span>Accept all</span></button><button class="btn sm" data-cc="none"><span>Essential only</span></button><button class="link" data-cc="custom">Customise</button></div>
  </div>
  <div class="cc-pref" hidden>
    <label class="sw"><input type="checkbox" checked disabled><i></i><span><b>Essential</b> Cart, checkout, security, your consent choice. Always on.</span></label>
    <label class="sw"><input type="checkbox" data-k="prefs"><i></i><span><b>Preferences</b> Remembers things like your chosen colour.</span></label>
    <label class="sw"><input type="checkbox" data-k="analytics"><i></i><span><b>Analytics</b> Anonymous usage stats to improve the site.</span></label>
    <label class="sw"><input type="checkbox" data-k="marketing"><i></i><span><b>Marketing</b> Ad measurement &amp; retargeting pixels.</span></label>
    <div class="cc-btns"><button class="btn sm solid" data-cc="save"><span>Save choices</span></button><button class="link" data-cc="back">Back</button></div>
  </div>
</div>`;

  document.body.insertAdjacentHTML('afterbegin', chrome);
  document.body.insertAdjacentHTML('beforeend', consentHTML);
  if (!document.body.hasAttribute('data-nofoot')) document.body.insertAdjacentHTML('beforeend', footer);
  // config-driven text
  $$('[data-cfg]').forEach(el => { el.textContent = CFG[el.dataset.cfg] || ''; });
  $$('[data-mail]').forEach(el => { el.href = 'mailto:' + CFG.supportEmail; el.textContent = CFG.supportEmail; });
  $$('[data-days]').forEach(el => { el.textContent = CFG.returnDays; });
  $$('[data-free]').forEach(el => { el.textContent = money(CFG.freeShippingOver * 100); });
  $$('[data-flat]').forEach(el => { el.textContent = money(CFG.shippingFlat * 100); });
  $$('[data-today]').forEach(el => { el.textContent = 'Last updated: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); });

  /* ---------------- cart drawer ---------------- */
  const drawer = $('#drawer'), scrim = $('.scrim');
  let lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    drawer.classList.add('open'); scrim.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('lock');
    setTimeout(() => $('.x', drawer).focus(), 50);
  }
  function closeCart() {
    drawer.classList.remove('open'); scrim.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  Gale.openCart = openCart; Gale.closeCart = closeCart;
  document.addEventListener('click', e => {
    if (e.target.closest('[data-open-cart]')) openCart();
    else if (e.target.closest('[data-close-cart]')) closeCart();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); } });

  function lineHTML(i) {
    const s = CAT.skus[i.sku];
    return `<li data-sku="${i.sku}"><i class="orb" style="--c:${s.hex}"></i>
      <div><b>${esc(s.name.replace('GALE Neck Fan — ', ''))}</b><span>${money(s.price)} each</span>
      <div class="qty"><button data-dec aria-label="Decrease quantity">−</button><output>${i.qty}</output><button data-inc aria-label="Increase quantity">+</button></div></div>
      <div class="lt"><span>${money(s.price * i.qty)}</span><button data-rm>Remove</button></div></li>`;
  }
  $('.lines', drawer).addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    const sku = li.dataset.sku, l = Cart.items.find(i => i.sku === sku);
    if (e.target.closest('[data-inc]')) Cart.set(sku, l.qty + 1);
    else if (e.target.closest('[data-dec]')) Cart.set(sku, l.qty - 1);
    else if (e.target.closest('[data-rm]')) Cart.set(sku, 0);
  });

  let prevCount = Cart.count();
  function render() {
    const n = Cart.count(), sub = Cart.subtotal(), goal = CFG.freeShippingOver * 100;
    $$('.cart-n').forEach(el => { el.textContent = n; if (n !== prevCount) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } });
    prevCount = n;
    $('.lines', drawer).innerHTML = Cart.items.map(lineHTML).join('');
    drawer.classList.toggle('is-empty', !n);
    $('.d-sub', drawer).textContent = money(sub);
    $('.d-ship', drawer).textContent = !n ? '—' : Cart.shipping() ? money(Cart.shipping()) : 'Free';
    const left = goal - sub;
    $('.ship-t', drawer).innerHTML = !n ? `Free shipping over <b>${money(goal)}</b>` : left > 0 ? `<b>${money(left)}</b> away from free shipping` : `<b>Free shipping unlocked.</b> 🌕`;
    $('.bar i', drawer).style.transform = `scaleX(${Math.min(1, sub / goal)})`;
    Gale.events.dispatchEvent(new CustomEvent('cart'));
  }
  addEventListener('storage', e => { if (e.key === 'gale_cart_v1') { Cart.items = (store.get('gale_cart_v1', []) || []).filter(i => CAT.skus[i.sku]); render(); } });
  render();

  /* ---------------- consent ---------------- */
  const cc = $('#cc'), KEY = 'gale_consent_v1';
  const Consent = Gale.consent = {
    get() { return store.get(KEY, null); },
    set(c) {
      c = Object.assign({ necessary: true, prefs: false, analytics: false, marketing: false }, c, { ts: Date.now() });
      store.set(KEY, c);
      try { document.cookie = `gale_consent=${(c.prefs ? 'p' : '') + (c.analytics ? 'a' : '') + (c.marketing ? 'm' : '') || 'n'};max-age=15552000;path=/;SameSite=Lax`; } catch (e) {}
      apply(c);
    }
  };
  function apply(c) {
    if (c.analytics && CFG.analyticsSrc && !$('script[data-analytics]')) {
      const s = document.createElement('script'); s.src = CFG.analyticsSrc; s.async = true; s.dataset.analytics = '1'; document.head.appendChild(s);
    }
    if (!c.prefs) store.del('gale_prefs_v1');
    Gale.events.dispatchEvent(new CustomEvent('consent', { detail: c }));
  }
  function showCC(custom) {
    const c = Consent.get() || {};
    $$('[data-k]', cc).forEach(i => { i.checked = !!c[i.dataset.k]; });
    $('.cc-main', cc).hidden = !!custom; $('.cc-pref', cc).hidden = !custom;
    cc.hidden = false; requestAnimationFrame(() => cc.classList.add('on'));
  }
  function hideCC() { cc.classList.remove('on'); setTimeout(() => (cc.hidden = true), 600); }
  Gale.openConsent = () => showCC(true);
  cc.addEventListener('click', e => {
    const b = e.target.closest('[data-cc]'); if (!b) return;
    const a = b.dataset.cc;
    if (a === 'all') { Consent.set({ prefs: true, analytics: true, marketing: true }); hideCC(); }
    else if (a === 'none') { Consent.set({}); hideCC(); }
    else if (a === 'custom') showCC(true);
    else if (a === 'back') showCC(false);
    else if (a === 'save') { const o = {}; $$('[data-k]', cc).forEach(i => (o[i.dataset.k] = i.checked)); Consent.set(o); hideCC(); Gale.toast('Cookie choices saved'); }
  });
  document.addEventListener('click', e => { if (e.target.closest('[data-open-consent]')) showCC(true); });
  const existing = Consent.get();
  if (existing) apply(existing); else setTimeout(() => showCC(false), home ? 4200 : 1400);

  // remember chosen colour only with "preferences" consent
  const prefs = store.get('gale_prefs_v1', null);
  if (prefs && existing && existing.prefs && typeof prefs.color === 'number') { Gale.setColor(prefs.color, true); } else Gale.setColor(0);
  Gale.events.addEventListener('color', () => { const c = Consent.get(); if (c && c.prefs && Gale.userColor) store.set('gale_prefs_v1', { color: Gale.color }); });

  /* ---------------- page transitions + anchors ---------------- */
  const wipe = $('.wipe');
  addEventListener('pageshow', () => { document.body.classList.remove('leaving'); });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return;
    if (u.pathname === location.pathname && u.hash) return; // handled by smooth scroll in main.js
    if (u.pathname === location.pathname && !u.hash && u.search === location.search) return;
    e.preventDefault();
    document.body.classList.add('leaving');
    setTimeout(() => (location.href = a.href), 520);
  });

  /* ---------------- fx helpers ---------------- */
  Gale.fx = {
    burst(x, y, n = 22) {
      for (let i = 0; i < n; i++) {
        const s = document.createElement('i'); s.className = 'spark';
        const ang = Math.random() * Math.PI * 2, d = 40 + Math.random() * 110;
        s.style.cssText = `left:${x}px;top:${y}px;width:${3 + Math.random() * 5}px;height:${3 + Math.random() * 5}px`;
        document.body.appendChild(s);
        s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * d - 50}%,${Math.sin(ang) * d - 50}%) scale(0)`, opacity: 0 }],
          { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.2,.9,.1,1)' }).onfinish = () => s.remove();
      }
    },
    fly(from, to, done) {
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      const o = document.createElement('i'); o.className = 'flyer';
      document.body.appendChild(o);
      const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
      o.animate([
        { transform: `translate(${x0}px,${y0}px) scale(1)`, offset: 0 },
        { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 140}px) scale(1.5)`, offset: .5 },
        { transform: `translate(${x1}px,${y1}px) scale(.3)`, offset: 1 }
      ], { duration: 850, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => { o.remove(); done && done(); };
    }
  };
})();

/* GALE — page-specific behaviour: product panel, reviews, checkout, returns, success, FAQ. */
(function () {
  'use strict';
  const S = window.Gale, CFG = S.CFG, CAT = S.CAT, $ = S.$, $$ = S.$$, money = S.money, esc = S.esc, store = S.store;
  const page = document.body.dataset.page;

  S.opt = { size: '4', qty: 1 };
  const uid = p => p + '-' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const stars = v => `<span class="stars" style="--v:${v}" role="img" aria-label="${(+v).toFixed(1)} out of 5 stars">★★★★★</span>`;
  const mailto = (subject, body) => `mailto:${CFG.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  async function post(url, data) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r;
  }

  /* ---------------- reviews store ---------------- */
  const SAMPLES = [
    { id: 's1', name: 'Sample · Alex M.', rating: 5, title: 'Sample review', text: 'Placeholder text showing how a five-star review looks. Replace with real customer feedback at launch.', ts: Date.parse('2026-10-02'), sample: true },
    { id: 's2', name: 'Sample · Priya K.', rating: 5, title: 'Sample review', text: 'Placeholder text: describe how it feels on a hot day, the airflow and the battery life.', ts: Date.parse('2026-10-09'), sample: true },
    { id: 's3', name: 'Sample · Jonas B.', rating: 4, title: 'Sample review', text: 'Placeholder text for a four-star review, where a customer mentions one small thing they would improve.', ts: Date.parse('2026-10-15'), sample: true }
  ];
  const Reviews = {
    real() { return store.get('gale_reviews_v1', []) || []; },
    all() { return this.real().concat(CFG.showSampleReviews ? SAMPLES : []).sort((a, b) => b.ts - a.ts); },
    add(r) {
      const list = this.real(); list.push(r); store.set('gale_reviews_v1', list);
      if (CFG.reviewsEndpoint) post(CFG.reviewsEndpoint, r).catch(() => {});
    },
    stats(list) {
      const n = list.length, c = [0, 0, 0, 0, 0, 0];
      list.forEach(r => c[r.rating]++);
      return { n, c, avg: n ? list.reduce((a, r) => a + r.rating, 0) / n : 0 };
    }
  };
  const when = ts => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const reviewHTML = r => `<article class="rv"><header>${stars(r.rating)}<b>${esc(r.title)}</b>${r.sample ? '<span class="chip">Sample</span>' : ''}</header>
    <p>${esc(r.text)}</p><footer><span>${esc(r.name)}</span><time>${when(r.ts)}</time></footer></article>`;

  /* rating line near the buy box + preview on home */
  function ratingLine() {
    const el = $('[data-rating-line]'); if (!el) return;
    const st = Reviews.stats(Reviews.all());
    el.innerHTML = st.n ? `${stars(st.avg)} <a href="reviews.html">${st.avg.toFixed(1)} · ${st.n} review${st.n > 1 ? 's' : ''}${Reviews.real().length ? '' : ' (samples)'}</a>`
      : `<a href="reviews.html">Be the first to review →</a>`;
  }
  function preview() {
    const el = $('#rv-preview'); if (!el) return;
    const list = Reviews.all().slice(0, 3);
    el.innerHTML = list.length ? list.map(reviewHTML).join('') : '<p class="muted">No reviews yet. Be the first to light up the night.</p>';
  }
  ratingLine(); preview();

  /* ---------------- product panel ---------------- */
  if ($('#buy')) {
    const sw = $('#swatches'), sizes = $('#sizes');
    const cname = $('#cname'), price = $('#price');
    sw.innerHTML = CAT.colors.map((c, i) => `<button role="radio" aria-checked="${i === 0}" aria-label="${c.name}" title="${c.name}" style="--c:${c.hex}"></button>`).join('');
    sizes.innerHTML = CAT.sizes.map(s => `<button role="radio" data-id="${s.id}" aria-checked="${s.id === S.opt.size}"><b>${s.label}</b><span>${money(s.price)} · ${s.note}</span></button>`).join('');

    const sku = () => CAT.skus[`gale-${S.opt.size}-${CAT.colors[S.color].id}`];
    function sync() {
      const s = sku();
      price.textContent = money(s.price);
      $('#add span').textContent = `Add to cart — ${money(s.price * S.opt.qty)}`;
      $('#q').textContent = S.opt.qty;
      $$('[data-from]').forEach(e => (e.textContent = money(CAT.sizes[0].price)));
    }
    function colorSync() {
      cname.textContent = CAT.colors[S.color].name;
      $$('button', sw).forEach((b, i) => b.setAttribute('aria-checked', i === S.color));
      sync();
    }
    sw.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.setColor($$('button', sw).indexOf(b), true); });
    S.events.addEventListener('color', colorSync); colorSync();
    sizes.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      S.opt.size = b.dataset.id; $$('button', sizes).forEach(x => x.setAttribute('aria-checked', x === b)); sync();
    });
    $('#q-').onclick = () => { S.opt.qty = Math.max(1, S.opt.qty - 1); sync(); };
    document.getElementById('q+').onclick = () => { S.opt.qty = Math.min(10, S.opt.qty + 1); sync(); };
    sync();

    const add = $('#add');
    add.addEventListener('click', () => {
      const r = add.getBoundingClientRect();
      S.fx.burst(r.left + r.width / 2, r.top + r.height / 2);
      S.fx.fly(add, $('.cart-btn'), () => { S.cart.add(sku().id, S.opt.qty); S.toast('Added to cart'); });
      add.classList.add('pop'); setTimeout(() => add.classList.remove('pop'), 600);
    });
    $('#buynow').addEventListener('click', () => { S.cart.add(sku().id, S.opt.qty); document.body.classList.add('leaving'); setTimeout(() => (location.href = 'checkout.html'), 520); });
  }


  /* ---------------- FAQ accordion ---------------- */
  $$('.acc .q button').forEach(b => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') === 'true';
    $$('.acc .q button').forEach(x => { x.setAttribute('aria-expanded', 'false'); x.parentElement.classList.remove('open'); });
    if (!open) { b.setAttribute('aria-expanded', 'true'); b.parentElement.classList.add('open'); }
  }));

  /* ---------------- reviews page ---------------- */
  if (page === 'reviews') {
    let filter = 0, sort = 'new';
    const summary = $('#rv-summary'), list = $('#rv-list'), fbar = $('#rv-filter');
    function draw() {
      const all = Reviews.all(), st = Reviews.stats(all);
      summary.innerHTML = `<div class="rv-big"><b>${st.n ? st.avg.toFixed(1) : '—'}</b>${stars(st.avg)}<span>${st.n} review${st.n === 1 ? '' : 's'}</span></div>
        <div class="bars">${[5, 4, 3, 2, 1].map(n => `<button data-f="${n}" class="${filter === n ? 'on' : ''}"><span>${n}★</span><i><u style="transform:scaleX(${st.n ? st.c[n] / st.n : 0})"></u></i><em>${st.c[n]}</em></button>`).join('')}</div>`;
      let rows = all.filter(r => !filter || r.rating === filter);
      rows.sort((a, b) => sort === 'new' ? b.ts - a.ts : sort === 'hi' ? b.rating - a.rating || b.ts - a.ts : a.rating - b.rating || b.ts - a.ts);
      list.innerHTML = rows.length ? rows.map(reviewHTML).join('') : '<p class="muted">No reviews match this filter yet.</p>';
      $$('.rv', list).forEach((el, i) => { el.style.setProperty('--d', i * 70 + 'ms'); requestAnimationFrame(() => el.classList.add('in')); });
      fbar.querySelector('button[data-f="0"]').classList.toggle('on', !filter);
    }
    summary.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filter = filter === +b.dataset.f ? 0 : +b.dataset.f; draw(); } });
    fbar.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filter = +b.dataset.f; draw(); } });
    $('#rv-sort').addEventListener('change', e => { sort = e.target.value; draw(); });
    draw();

    const form = $('#rv-form'), starIn = $('#star-in'); let rating = 0;
    starIn.innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? 's' : ''}" data-n="${n}">★</button>`).join('');
    const paint = n => $$('button', starIn).forEach((b, i) => { b.classList.toggle('on', i < n); b.setAttribute('aria-checked', i + 1 === rating); });
    starIn.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { rating = +b.dataset.n; paint(rating); } });
    starIn.addEventListener('mouseover', e => { const b = e.target.closest('button'); if (b) paint(+b.dataset.n); });
    starIn.addEventListener('mouseleave', () => paint(rating));
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!rating) { S.toast('Pick a star rating first'); return; }
      const fd = new FormData(form);
      Reviews.add({ id: uid('rv'), name: String(fd.get('name')).trim().slice(0, 40) || 'Anonymous', rating, title: String(fd.get('title')).trim().slice(0, 80), text: String(fd.get('text')).trim().slice(0, 1200), ts: Date.now() });
      form.reset(); rating = 0; paint(0); draw(); S.toast('Thank you — review posted');
      S.fx.burst(innerWidth / 2, innerHeight / 2, 30);
      $('#rv-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------------- checkout ---------------- */
  if (page === 'checkout') {
    const wrap = $('#co'), form = $('#co-form'), sum = $('#co-lines'), err = $('#co-err'), btn = $('#co-pay');
    function drawSum() {
      const items = S.cart.items;
      wrap.classList.toggle('empty', !items.length);
      sum.innerHTML = items.map(i => { const s = CAT.skus[i.sku]; return `<li><i class="orb" style="--s:${s.size}"></i><div><b>${esc(s.short)}</b><span>Qty ${i.qty}</span></div><em>${money(s.price * i.qty)}</em></li>`; }).join('');
      $('#co-sub').textContent = money(S.cart.subtotal());
      $('#co-ship').textContent = S.cart.shipping() ? money(S.cart.shipping()) : 'Free';
      $('#co-total').textContent = money(S.cart.total());
    }
    drawSum(); S.events.addEventListener('cart', drawSum);
    $('#demo-note').hidden = !CFG.demoMode;

    form.addEventListener('submit', async e => {
      e.preventDefault(); err.textContent = '';
      if (!S.cart.items.length) return;
      const fd = Object.fromEntries(new FormData(form).entries());
      const customer = { email: fd.email, name: fd.name, phone: fd.phone || '', address: { line1: fd.line1, line2: fd.line2 || '', city: fd.city, state: fd.state || '', postal: fd.postal, country: fd.country } };
      const order = { id: uid('GAL'), ts: Date.now(), items: S.cart.items.map(i => ({ sku: i.sku, qty: i.qty })), subtotal: S.cart.subtotal(), shipping: S.cart.shipping(), total: S.cart.total(), customer, notes: fd.notes || '' };
      btn.disabled = true; btn.classList.add('busy');
      const orders = store.get('gale_orders_v1', []) || [];
      let res = null, data = {};
      try {
        res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: order.items, customer, orderId: order.id, notes: order.notes }) });
        data = await res.json().catch(() => ({}));
      } catch (x) { res = null; }
      if (res && res.ok && data.url) {
        orders.push(Object.assign(order, { status: 'awaiting-payment' })); store.set('gale_orders_v1', orders);
        document.body.classList.add('leaving'); setTimeout(() => (location.href = data.url), 450); return;
      }
      if (res && res.status !== 404 && res.status !== 405 && res.status !== 501 && data.error !== 'not_configured') {
        err.textContent = data.error || 'Payment could not be started. Please try again.';
        btn.disabled = false; btn.classList.remove('busy'); return;
      }
      // fallback: order request (no payment backend yet)
      order.status = 'request';
      orders.push(order); store.set('gale_orders_v1', orders);
      const lines = order.items.map(i => `${i.qty} × ${CAT.skus[i.sku].name} (${money(CAT.skus[i.sku].price)})`).join('\n');
      const body = `Order ${order.id}\n\n${lines}\n\nSubtotal: ${money(order.subtotal)}\nShipping: ${money(order.shipping)}\nTotal: ${money(order.total)}\n\nShip to:\n${customer.name}\n${customer.address.line1} ${customer.address.line2}\n${customer.address.city} ${customer.address.state} ${customer.address.postal}\n${customer.address.country}\n${customer.email} ${customer.phone}\n\nNotes: ${order.notes}`;
      let sent = false;
      if (CFG.orderEndpoint) { try { await post(CFG.orderEndpoint, Object.assign({ _subject: 'New order request ' + order.id }, order)); sent = true; } catch (x) {} }
      S.cart.clear();
      if (!sent) window.open(mailto('Order request ' + order.id, body), '_self');
      document.body.classList.add('leaving');
      setTimeout(() => (location.href = `success.html?mode=request&order=${order.id}&sent=${sent ? 1 : 0}`), 600);
    });
  }

  /* ---------------- success ---------------- */
  if (page === 'success') {
    const q = new URLSearchParams(location.search), id = q.get('order') || '';
    const orders = store.get('gale_orders_v1', []) || [], o = orders.find(x => x.id === id);
    const mode = q.get('mode');
    if (mode === 'request') {
      $('#ok-title').innerHTML = 'Order request <em>received.</em>';
      $('#ok-text').innerHTML = q.get('sent') === '1'
        ? `We've got it. We'll email you a secure payment link and confirmation within one business day.`
        : `Your email app should have opened with the order details. <b>Press send</b> to finish. If it didn't open, email <a href="mailto:${esc(CFG.supportEmail)}">${esc(CFG.supportEmail)}</a> quoting your order number. We'll reply with a secure payment link. <b>No payment has been taken.</b>`;
    } else {
      S.cart.clear();
      if (o) { o.status = 'paid'; store.set('gale_orders_v1', orders); }
      $('#ok-text').innerHTML = `Payment received. A receipt is on its way to your inbox, and you'll get tracking as soon as your fan ships.`;
    }
    $('#ok-id').textContent = id || '—';
    if (o) $('#ok-items').innerHTML = o.items.map(i => `<li>${i.qty} × ${esc(CAT.skus[i.sku] ? CAT.skus[i.sku].short : i.sku)}</li>`).join('');
    setTimeout(() => S.fx.burst(innerWidth / 2, innerHeight * .4, 60), 900);
  }

  /* ---------------- returns ---------------- */
  if (page === 'returns') {
    const form = $('#rt-form'), out = $('#rt-out');
    const orders = store.get('gale_orders_v1', []) || [];
    $('#rt-orders').innerHTML = orders.map(o => `<option value="${esc(o.id)}">`).join('');
    $('#rt-item').innerHTML = Object.values(CAT.skus).map(s => `<option value="${s.id}">${esc(s.short)}</option>`).join('');
    $('#rt-demo').hidden = !CFG.demoMode;
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(form).entries());
      const rma = { id: uid('RMA'), ts: Date.now(), order: fd.order.trim(), email: fd.email.trim(), item: fd.item, reason: fd.reason, resolution: fd.resolution, details: fd.details.trim() };
      const list = store.get('gale_returns_v1', []) || []; list.push(rma); store.set('gale_returns_v1', list);
      let sent = false;
      if (CFG.returnsEndpoint) { try { await post(CFG.returnsEndpoint, Object.assign({ _subject: 'Return request ' + rma.id }, rma)); sent = true; } catch (x) {} }
      const body = `Return request ${rma.id}\nOrder: ${rma.order}\nEmail: ${rma.email}\nItem: ${CAT.skus[rma.item].name}\nReason: ${rma.reason}\nWants: ${rma.resolution}\n\n${rma.details}`;
      form.hidden = true; out.hidden = false;
      $('#rt-id').textContent = rma.id;
      $('#rt-mail').href = mailto('Return request ' + rma.id, body);
      $('#rt-mail').hidden = sent;
      $('#rt-sent').textContent = sent ? "Your request has been sent. We'll reply within 2 business days." : 'Last step: send the pre-filled email so we receive it. Include photos if the item arrived damaged or faulty.';
      S.fx.burst(innerWidth / 2, innerHeight / 2, 40);
      out.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
})();

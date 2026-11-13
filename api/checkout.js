/* POST /api/checkout — creates a Stripe Checkout Session from the cart.
   Prices are looked up server-side from assets/catalog.js, so the browser can never set its own price.
   Needs env var STRIPE_SECRET_KEY. Without it, responds 501 {error:"not_configured"} and the site falls back to order-request mode. */
const CAT = require('../assets/catalog.js');
const CFG = (() => { const w = {}; new Function('window', require('fs').readFileSync(require('path').join(__dirname, '../assets/config.js'), 'utf8'))(w); return w.SELENE_CONFIG; })();

// flatten nested objects into Stripe's form encoding: a[b][0][c]=1
function enc(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') enc(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out;
}
const str = (v, n) => String(v == null ? '' : v).slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(501).json({ error: 'not_configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const c = body.customer || {}, a = c.address || {};

  const line_items = []; let subtotal = 0;
  for (const it of items.slice(0, 20)) {
    const sku = CAT.skus[it && it.sku]; const qty = Math.floor(Number(it && it.qty));
    if (!sku || !(qty >= 1 && qty <= 20)) return res.status(400).json({ error: 'Invalid cart item.' });
    subtotal += sku.price * qty;
    line_items.push({ quantity: qty, price_data: { currency: CAT.currency, unit_amount: sku.price, product_data: { name: sku.name, metadata: { sku: sku.id } } } });
  }
  if (!line_items.length) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(str(c.email, 200))) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!/^[A-Za-z]{2}$/.test(str(a.country, 2))) return res.status(400).json({ error: 'Please choose a country.' });

  const shipping = subtotal >= CFG.freeShippingOver * 100 ? 0 : Math.round(CFG.shippingFlat * 100);
  const origin = CFG.siteUrl || `https://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const orderId = str(body.orderId, 40);

  const params = {
    mode: 'payment',
    customer_email: str(c.email, 200),
    client_reference_id: orderId,
    line_items,
    shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', display_name: shipping ? 'Standard shipping (7–20 business days)' : 'Free shipping (7–20 business days)', fixed_amount: { amount: shipping, currency: CAT.currency } } }],
    payment_intent_data: { shipping: { name: str(c.name, 100) || 'Customer', phone: str(c.phone, 30), address: { line1: str(a.line1, 200), line2: str(a.line2, 200), city: str(a.city, 100), state: str(a.state, 100), postal_code: str(a.postal, 20), country: str(a.country, 2).toUpperCase() } }, description: 'SELENE order ' + orderId },
    metadata: { order_id: orderId, notes: str(body.notes, 450) },
    success_url: `${origin}/success.html?order=${encodeURIComponent(orderId)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout.html`
  };
  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: enc(params).join('&')
    });
    const data = await r.json();
    if (!r.ok) { console.error('Stripe error', data && data.error); return res.status(502).json({ error: 'Payment provider error. Please try again.' }); }
    return res.status(200).json({ url: data.url });
  } catch (e) {
    console.error(e); return res.status(502).json({ error: 'Could not reach the payment provider.' });
  }
};

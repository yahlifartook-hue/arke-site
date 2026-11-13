/* Offline test of api/checkout.js with a stubbed Stripe. Run: npm test */
const assert = require('assert');
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
let captured;
global.fetch = async (url, opt) => { captured = { url, opt }; return { ok: true, json: async () => ({ url: 'https://checkout.stripe.com/c/pay/test' }) }; };
const handler = require('../api/checkout.js');
const mk = () => { const r = { code: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; return r; };
const customer = { email: 'a@b.co', name: 'A B', address: { line1: '1 St', city: 'X', postal: '1', country: 'GB' } };
(async () => {
  let r = mk(); await handler({ method: 'POST', headers: { host: 'x.test' }, body: { items: [{ sku: 'gale-4-black', qty: 2 }], customer, orderId: 'SEL-1' } }, r);
  assert.strictEqual(r.code, 200); assert.ok(r.body.url);
  const form = decodeURIComponent(captured.opt.body);
  assert.ok(form.includes('line_items[0][price_data][unit_amount]=2990'), 'server price used');
  assert.ok(form.includes('shipping_options[0][shipping_rate_data][fixed_amount][amount]=0'), 'free shipping over threshold');
  r = mk(); await handler({ method: 'POST', headers: {}, body: { items: [{ sku: 'hacked', qty: 1 }], customer } }, r); assert.strictEqual(r.code, 400);
  r = mk(); await handler({ method: 'POST', headers: {}, body: { items: [{ sku: 'gale-4-black', qty: 999 }], customer } }, r); assert.strictEqual(r.code, 400);
  r = mk(); await handler({ method: 'GET', headers: {} }, r); assert.strictEqual(r.code, 405);
  delete process.env.STRIPE_SECRET_KEY;
  r = mk(); await handler({ method: 'POST', headers: {}, body: {} }, r); assert.strictEqual(r.code, 501);
  console.log('api/checkout tests passed');
})();

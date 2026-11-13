/* Single source of truth for products + prices. Used by the browser AND by api/checkout.js (so prices can't be tampered with). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GALE_CATALOG = factory();
})(this, function () {
  // Battery tiers (prices in cents)
  const sizes = [
    { id: '4', label: '4000 mAh', note: 'Everyday', price: 2990 },
    { id: '5', label: '5000 mAh', note: 'Longer runtime', price: 3490 },
    { id: '7', label: '7000 mAh', note: 'All-day max', price: 4490 }
  ];
  // body = product colour, accent = the glow/UI colour used for that variant
  const colors = [
    { id: 'black', name: 'Void Black', hex: '#1a1c22', accent: '#35e0ff' },
    { id: 'white', name: 'Glacier White', hex: '#e8ecf1', accent: '#7fb8ff' },
    { id: 'blue', name: 'Storm Blue', hex: '#2c5fe0', accent: '#5ee1ff' },
    { id: 'rose', name: 'Rose Gold', hex: '#e88aa4', accent: '#ff8fb0' },
    { id: 'lime', name: 'Volt Lime', hex: '#b8f02a', accent: '#d8ff3d' }
  ];
  const skus = {};
  sizes.forEach(s => colors.forEach(c => {
    const id = `gale-${s.id}-${c.id}`;
    skus[id] = { id, name: `GALE Neck Fan — ${s.label}, ${c.name}`, short: `${s.label} · ${c.name}`, price: s.price, size: s.id, color: c.id, hex: c.hex };
  }));
  return { currency: 'usd', product: { id: 'gale', name: 'GALE Neck Fan' }, sizes, colors, skus };
});

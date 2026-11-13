/* Single source of truth for products + prices. Used by the browser AND by api/checkout.js (so prices can't be tampered with). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SELENE_CATALOG = factory();
})(this, function () {
  const sizes = [
    { id: '15', label: '15 cm', price: 3490 },
    { id: '18', label: '18 cm', price: 4490 },
    { id: '20', label: '20 cm', price: 5490 }
  ];
  const bases = [
    { id: 'stand', label: 'Wooden stand', add: 0 },
    { id: 'float', label: 'Levitating base', add: 4500 }
  ];
  const colors = [
    ['Warm White', '#ffd9a0'], ['Cool White', '#dbe9ff'], ['Amber', '#ffb020'], ['Sunset', '#ff6a2b'],
    ['Red', '#ff2e4d'], ['Rose', '#ff4fa3'], ['Magenta', '#e03bff'], ['Violet', '#9a5cff'],
    ['Indigo', '#5a6bff'], ['Blue', '#2f8bff'], ['Sky', '#34d2ff'], ['Cyan', '#2ff0d0'],
    ['Mint', '#3dff9a'], ['Green', '#8dff3a'], ['Lime', '#d6ff3a'], ['Gold', '#ffe14a']
  ].map(c => ({ name: c[0], hex: c[1] }));

  const skus = {};
  sizes.forEach(s => bases.forEach(b => {
    const id = `selene-${s.id}-${b.id}`;
    skus[id] = { id, name: `SELENE Lunar Lamp — ${s.label}, ${b.label}`, short: `${s.label} · ${b.label}`, price: s.price + b.add, size: s.id, base: b.id };
  }));
  return { currency: 'usd', product: { id: 'selene', name: 'SELENE Lunar Lamp' }, sizes, bases, colors, skus };
});

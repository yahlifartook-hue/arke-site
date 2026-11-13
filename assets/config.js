/* SELENE — store configuration. Edit this file; nothing else needs touching to rebrand or go live. */
window.SELENE_CONFIG = {
  brand: "SELENE",
  legalName: "Selene Lunar Ltd.",            // <- your registered business name
  address: "123 Example Street, City, Country", // <- your business address
  supportEmail: "support@example.com",       // <- receives order requests / returns / privacy requests
  siteUrl: "",                                // optional, e.g. https://selene.example.com
  currency: "USD",
  freeShippingOver: 50,
  shippingFlat: 4.99,
  returnDays: 30,
  /* --- going live ------------------------------------------------------------------------ */
  // 1) Card payments: deploy on Vercel and set env var STRIPE_SECRET_KEY (see README). /api/checkout does the rest.
  // 2) No-backend fallback: paste a Formspree/Getform style endpoint here and orders/returns/reviews get POSTed to it.
  orderEndpoint: "",
  returnsEndpoint: "",
  reviewsEndpoint: "",
  analyticsSrc: "",                           // loaded ONLY after the visitor accepts analytics cookies
  /* --- honesty switches ------------------------------------------------------------------ */
  demoMode: true,            // shows small "not connected yet" notices where a backend is missing
  showSampleReviews: true    // shows clearly-labelled SAMPLE reviews until you have real ones. Set false at launch.
};

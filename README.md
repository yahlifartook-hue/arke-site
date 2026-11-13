# GALE — Neck Fan storefront

A cinematic, fully working one-product store. **Product:** a wearable bladeless neck fan (3 speeds, USB-C rechargeable, 5 colours, 3 battery sizes), a perennial best-seller category on AliExpress and similar marketplaces, and dropshipping-friendly.

Source: <https://github.com/yahlifartook-hue/arke-site>

## What's inside
- **Raw WebGL (no libraries):** a raymarched glossy neck fan with vent slits, an animated LED strip and airflow glow, plus wind streaks that speed up as you scroll. Colour and battery options change the 3D product live; scroll flies the camera around and into the fan; drag to spin it.
- **Motion:** kinetic masked type (rise / flip / blur variants), text scramble, scroll-lit words, pinned sliding statement, horizontal pinned feature scroll, scroll-velocity marquees + skew, magnetic buttons, custom cursor, film grain, page-wipe transitions, add-to-cart orb flight + sparks.
- **Working shop:** product options, cart drawer (persisted), free-shipping progress bar, checkout form, success page.
- **Pages:** `privacy.html`, `cookies.html` (+ working consent banner / preferences), `returns.html` (policy + working return request form), `reviews.html` (rating summary, filter, sort, write a review), `terms.html`, `shipping.html`, `404.html`.

## Run locally
    npm run dev        # python3 -m http.server 8000  → http://localhost:8000
    npm test           # offline test of the checkout function

## Take payments (Vercel + Stripe)
1. Import this repo in Vercel (no build command, output dir `.`).
2. Add env var `STRIPE_SECRET_KEY` (start with a `sk_test_…` key).
3. Redeploy. `/api/checkout` creates a Stripe Checkout Session; **prices come from `assets/catalog.js` on the server**, so the browser can't change them.
4. Optional: add a Stripe webhook for fulfilment emails.

Without a key (or on GitHub Pages) checkout falls back to **order-request mode**: the order is saved, optionally POSTed to `orderEndpoint` (Formspree etc.) or opened as a pre-filled email, and **no money is taken**.

## Make it yours: `assets/config.js`
Business name, address, support email, free-shipping threshold, return window, endpoints, analytics script (loaded only after consent), and the `demoMode` / `showSampleReviews` switches. Set both to `false` when you launch. Prices and options live in `assets/catalog.js`.

## Before you launch
- Replace the placeholder name/address/email in `config.js`; the legal pages read from it.
- The privacy/terms/cookie/returns/shipping texts are **templates, not legal advice**. Have them checked for your country.
- Match specs, sizes, battery and delivery claims to your actual supplier listing; test-order a sample first.
- Sample reviews are labelled "Sample". Never publish invented reviews as real ones.
- Reviews are stored in the visitor's browser until you point `reviewsEndpoint` at a service. For real social proof, collect reviews from real buyers.
- Check the GALE name/domain for trademark conflicts in your market.

## Structure
    index.html            home + product
    checkout.html …       inner pages (static HTML, chrome injected by assets/shop.js)
    api/checkout.js       Stripe Checkout Session (Vercel function)
    assets/scene.js       WebGL shader        assets/main.js   scroll camera + motion
    assets/shop.js        cart, drawer, consent, transitions   assets/pages.js   page logic

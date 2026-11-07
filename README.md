# ARKÉ — cinematic luxury site

Zero-dependency static site. Raw WebGL raymarched 3D form that morphs between shapes as you scroll,
1-bit ordered-dither "halftone" light section, kinetic masked type, scroll-velocity marquees,
horizontal pinned collection, magnetic buttons, custom cursor, film grain.

- `index.html` — content
- `assets/scene.js` — WebGL shader scene
- `assets/main.js` — scroll camera, kinetic type, interactions
- `assets/style.css` — styling

## Run locally
    python3 -m http.server 8000

## Deploy
Static site, no build step. Import the repo in Vercel (Framework: Other, no build command, output dir `.`)
or run `npx vercel --prod`.

## Customise
- Brand/copy: `index.html`. Replace `studio@example.com`.
- Colours: CSS variables at top of `style.css`.
- Per-section 3D state: `data-morph` (0-3 shape), `data-ox/oy` (position), `data-zoom`, `data-light` on each `.sec`.

# PIXFILM COLLECTIVE / CHEMICAL LOG

A responsive film-processing log for Madi and Jesus. Built with plain HTML, CSS and JavaScript, with GSAP transitions and a subtle Three.js monitor background.

## Editing

- `index.html`: page structure and labels.
- `css/styles.css`: palette, spacing, responsive layouts and glass/glow styles.
- `js/form-rules.js`: Film/Chemical options and validation.
- `js/main.js`: form, navigation, history and delete confirmation.
- `js/data.js`: shared Firestore storage.
- `js/config.js`: public Firebase web configuration.
- `js/monitor.js`: texture and color fringing settings.

## Local preview

Open `preview.html` directly, or run `node server.mjs` and visit `http://127.0.0.1:4173`.
After changing source files, run `node prepare-preview.mjs` to update the double-clickable preview.
Run `node --test tests/*.test.mjs` for the automated checks.

## Hosting and shared data

GitHub Pages serves `index.html` and the static assets. Configure Pages to deploy from the `main` branch, root folder. No build service or paid hosting is required.

The app reads and writes `log_entries` in the existing Firebase project `pixfilm-chemical-log`, default Firestore database in Toronto. Entries are stored in Firestore, not in GitHub or browser storage. History refreshes when opened or revisited; it is not a continuous real-time feed. An internet connection is required to save and load logs.

The Firebase web configuration is public client configuration, not an administrator credential. Firestore rules enforce allowed fields, choices, positive Feet, custom text limits and server timestamps. Updates are denied. The intended no-sign-in model permits anyone who can access the app to read, create valid entries and delete entries. The Madi/Jesus selection is a label, not authentication.

`firestore.rules` is the source for the database rules. GitHub commits do not deploy database rules automatically; publish rule changes separately in the Firebase console. Keep Firebase on the Spark plan unless you explicitly choose otherwise.

## Appearance

Modern DOS 8x16 is supplied locally. GSAP and Three.js load from pinned CDN versions; the form initializes independently of these optional effects. See `MONITOR-EFFECT.md` for adjustments and fallback behavior.

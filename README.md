# Financial Tools

Matthew's client-management platform: login → CRM/client pipeline → live
client-meeting tool (fact-find, planning, compliance record). Split out from
`the-steward` repo so The Steward can remain the single canonical source for
the calculator engine — see the implementation plan this was built from
("Separate Financial Tools into its own repo") for the full rationale.

Domain: `financialtools.co.za` — a fully separate domain, deliberately no
relation to `thesteward.co.za`.

## How calculators work here now

This repo does **not** contain any of the 12 standalone calculators
(`tools/standalone/*` in `the-steward`) — they stay there as the one
canonical source. Instead:

- On load, `meeting-dashboard.html` fetches `https://thesteward.co.za/api/calculators`
  and registers each one as a lightweight "module" in the existing `App`
  tool-mounting system (same `register`/`_mountCalc`/`_wrappers` pipeline every
  meeting-tools panel already uses — nothing new to learn).
- Opening a calculator during a meeting renders an `<iframe>` pointed at
  `https://thesteward.co.za/?calc=<id>&embed=1` — The Steward's own "embed mode"
  (chrome-free: no nav, no guide panel, no mobile toolbar, just the calculator).
- **Known, accepted trade-off**: because the calculator now runs in a
  cross-origin iframe, its input values no longer auto-resume via
  `_pendingToolStates` after closing and reopening the browser mid-meeting —
  that mechanism reads a calculator's DOM/`CalcState` directly, in-page, which
  can't reach into an iframe. Everything else about resuming a meeting (client
  record, every other panel's answers) is unaffected.
- The API's `guide` field (each calculator's intro/per-field heading+html — see
  The Steward's `resources/calc-guides.js`) drives this page's own guide panel
  two ways: the intro text is set directly from `calc.guide.intro` when a
  calculator is registered, and a click on a field label or chart bar *inside*
  the iframe reaches this page via `postMessage` (The Steward's `index.html`
  broadcasts every guide update it makes while embedded — see its
  `_broadcastGuide` — and `meeting-dashboard.html` listens for
  `{ type: "steward:guide" }` messages from `https://thesteward.co.za`).

## Demo mode

`financialtools.co.za/demo` (routed by `_redirects` to
`meeting-dashboard.html?demo=1`) is the same file as the real, logged-in
dashboard — not a separate page. `window.IS_DEMO` (set at the top of
`meeting-dashboard.html`'s first script) branches every place demo mode
differs: no Supabase auth or client load, no autosave (nothing persists —
not even to `localStorage`, so a refresh starts clean), an editable advisor
name/photo in the guide panel instead of the real profile (kept on
`window.ACTIVE_ADVISER` in memory only), and a "Reset Demo" button instead of
"Back to Client List". There used to be a separately maintained
`meeting-demo.html` for this; it drifted from the real dashboard (missing
calculator icons was the bug that prompted the merge) and is now just a
redirect stub to `/demo`, kept so old links don't break.

## What actually needed to move here (audited, not assumed)

Besides the platform HTML/`tools/` files themselves:
- `resources/supabase.js`, `resources/constants.js` — real dependencies of
  `meeting-dashboard.html` and the meeting-tools panels.
- `components/input-format.js` (`moneyToNumber`/`numToRand`/`numberToMoney`) —
  used throughout `tools/*` and `meeting-summary.js`.
- `components/tool-hero.js` (`CalcHero`) — used by `existing-portfolio.js`,
  `existing-policies.js`, `cashflow.js`, `estate-planning.js`,
  `financial-planning.js`.
- `style.css`, `tools/meeting-shared.css`.

Confirmed **not** needed (their only consumers were the standalone
calculators, which don't live here anymore): Chart.js CDN,
`components/simulation-engine.js`, `chart.js`, `donut-chart.js`,
`tool-input.js`, `tool-nav.js`, `mobile-menu.js`, `resources/nav-tools.js`.

## Local development

No build step. Serve the directory with any static server that can run
alongside a real backend call to The Steward's API (plain `python3 -m http.server`
or similar works, since nothing here needs Cloudflare Pages Functions —
unlike `the-steward`/`adviser-pages`, this repo has none). It does have a
`_redirects` file (for the `/demo` clean URL) — that's a Cloudflare Pages
redirect rule, not a Function, and a local static server won't apply it; hit
`meeting-dashboard.html?demo=1` directly when developing demo mode locally.

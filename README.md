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

## What actually needed to move here (audited, not assumed)

Besides the platform HTML/`tools/meeting-tools/`/`tools/fa-tools/` files
themselves:
- `resources/supabase.js`, `resources/constants.js` — real dependencies of
  `meeting-dashboard.html` and the meeting-tools panels.
- `components/input-format.js` (`moneyToNumber`/`numToRand`/`numberToMoney`) —
  used throughout `tools/meeting-tools/*` and `meeting-summary.js`.
- `components/tool-hero.js` (`CalcHero`) — used by `existing-portfolio.js`,
  `existing-policies.js`, `cashflow.js`, `estate-planning.js`,
  `financial-planning.js`.
- `style.css`, `tools/meeting-tools/meeting-shared.css`.

Confirmed **not** needed (their only consumers were the standalone
calculators, which don't live here anymore): Chart.js CDN,
`components/simulation-engine.js`, `chart.js`, `donut-chart.js`,
`tool-input.js`, `tool-nav.js`, `mobile-menu.js`, `resources/nav-tools.js`.

## Local development

No build step. Serve the directory with any static server that can run
alongside a real backend call to The Steward's API (plain `python3 -m http.server`
or similar works, since nothing here needs Cloudflare Pages Functions —
unlike `the-steward`/`adviser-pages`, this repo has none).

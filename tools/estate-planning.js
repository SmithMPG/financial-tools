// tools/estate-planning.js
// Estate Planner — reads gross estate from Existing Portfolio via MeetingState.
// Only captures deductions & designations; calculates estate duty and gap.

(function () {
  "use strict";

  const EXECUTOR_RATE = 0.035 * 1.15; // 3.5% + 15% VAT

  function _masterFee(gross) {
    if (gross <= 250000) return 0;
    let fee = 600;
    if (gross > 400000) fee += Math.ceil((gross - 400000) / 100000) * 200;
    return Math.min(fee, 7000);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Delegates to components/input-format.js — the single source of truth for
  // money parsing/formatting — rather than a local regex copy.
  function _parseMoney(v) {
    return window.moneyToNumber(v);
  }

  // Gross monthly income lives only on Timeline's "Current Job" card
  // (Cashflow captures Net only) — shared via MtUI so estate-planning.js and
  // financial-planning.js can't silently drift apart on Timeline's job-event
  // shape.
  function _grossMonthlyFromTimeline() {
    return MtUI.grossMonthlyFromTimeline();
  }

  // abs() first since these format money for display only — negative inputs
  // here would only ever come from a defensive edge case, never a value this
  // tool intends to show with a sign.
  function _fmt(n) {
    return window.numberToMoney(Math.abs(n));
  }

  function _R(n) { return "R " + _fmt(n); }

  function _getPortfolioTotals() {
    const cp = window.MeetingState?.get("currentPortfolio") || {};
    return {
      assets:      (cp.totalFixed  || 0) + (cp.totalLiquid || 0),
      investments: cp.totalInvestments   || 0,
      liabilities: cp.totalLiabilities   || 0,
    };
  }

  // Raw line items from Existing Portfolio (not just the totals) — used to
  // break Gross Estate's Assets and Net Estate's Liabilities down the same
  // way Existing Portfolio itself is organised.
  function _getPortfolioItems() {
    const cp = window.MeetingState?.get("currentPortfolio") || {};
    return {
      liquid:        cp.liquid        || [],
      investments:   cp.investments   || [],
      fixed:         cp.fixed         || [],
      stLiabilities: cp.stLiabilities || [],
      ltLiabilities: cp.ltLiabilities || [],
    };
  }

  function _portfolioRowsHTML(items, emptyMsg, valueKey = "value") {
    return items.length > 0
      ? items.map(i => `
          <div class="epn-auto">
            <span class="epn-auto-lbl">${i.type || "Untitled"}${i.provider ? ` <span class="epn-from-badge">${i.provider}</span>` : ""}</span>
            <span class="epn-auto-val">${_R(i[valueKey] || 0)}</span>
          </div>`).join("")
      : `<div class="epn-auto"><span class="epn-auto-lbl" style="color:var(--navy-5);font-style:italic">${emptyMsg}</span></div>`;
  }

  // existing-policies.js keeps risk cover (life/disability/dreadDisease/incomeProtection) on
  // `policies[]` with a single top-level beneficiary and a per-type cover breakdown, and funeral
  // cover on `funeral[]` — one policy per insurer, broken down per covered person (no beneficiary
  // concept there, same as before). Flatten both into one list of {label, provider, coverAmount,
  // beneficiary} entries so estate calcs don't care which bucket a benefit type lives in.
  //
  // Only "life" is pulled from the per-type breakdown — Disability, Dread Disease, and
  // Income Protection all pay out during the client's life (on disability, diagnosis, or
  // incapacity), not on death, so they have no place in a death-triggered estate duty
  // calculation. Funeral cover is kept since it specifically pays out on death.
  function _flattenPolicies(ep) {
    const out = [];
    (ep.policies || []).forEach(p => {
      const t = p.types?.life;
      const cover = t?.cover || 0;
      if (cover > 0) out.push({ label: "Life", provider: p.insurer || "", coverAmount: cover, beneficiary: p.beneficiary || "" });
    });
    (ep.funeral || []).forEach(p => {
      (p.people || []).forEach(person => {
        if ((person.coverAmount || 0) > 0) {
          const label = person.relationship ? `Funeral Cover — ${person.relationship}` : "Funeral Cover";
          out.push({ label, provider: p.insurer || "", coverAmount: person.coverAmount, beneficiary: "" });
        }
      });
    });
    return out;
  }

  // A life policy is dutiable regardless of who's nominated as beneficiary —
  // naming someone directly just bypasses the executor for a faster payout, it
  // doesn't exempt the proceeds from Estate Duty. The one real exemption is the
  // S4(q) deduction for property accruing to a spouse, so everything except a
  // Spouse/Partner nomination counts toward the dutiable estate here.
  function _getEstatePolicies() {
    const ep = window.MeetingState?.get("existingPolicies") || {};
    return _flattenPolicies(ep).reduce((sum, p) => sum + (p.beneficiary !== "Spouse / Partner" ? p.coverAmount : 0), 0);
  }

  function _calcMarginalRate(grossAnnual) {
    if (grossAnnual <= 237100)  return 0.18;
    if (grossAnnual <= 370500)  return 0.26;
    if (grossAnnual <= 512800)  return 0.31;
    if (grossAnnual <= 673000)  return 0.36;
    if (grossAnnual <= 857900)  return 0.39;
    if (grossAnnual <= 1817000) return 0.41;
    return 0.45;
  }

  const REGIME_MAP = {
    "Community of Property": "cop",
    "ANC with Accrual":      "ooc-accrual",
    "ANC without Accrual":   "ooc",
  };

  // Marital regime comes straight from Timeline's Marriage card (a real
  // "regime" field, captured directly) instead of guessing from free-text, and
  // is the single source of truth — no manual override lives here. Three
  // outcomes: pending (no personal card yet, or a Marriage card with no regime
  // chosen yet — needs the FA to go complete it on Timeline), confirmed "Not
  // Married" (the latest personal card is a Divorce/Separation, a real
  // complete answer), or a confirmed regime key.
  function _regimeStatus() {
    const events = window.MeetingState?.get("timeline")?.events || [];
    const personal = events
      .filter(e => e.category === "personal")
      .sort((a, b) => (parseFloat(b.year) || 0) - (parseFloat(a.year) || 0));
    if (!personal.length) return { pending: true };
    const latest = personal[0];
    if (latest.field === "regime") {
      if (latest.regime) return { pending: false, key: REGIME_MAP[latest.regime] ?? "none", label: latest.regime };
      return { pending: true };
    }
    return { pending: false, key: "none", label: "Not Married" };
  }

  function _applyProfileDefaults(w) {
    const status = _regimeStatus();
    const badge = w.querySelector("#epn-regime-badge");
    if (badge) {
      badge.textContent = status.pending ? "Add on Timeline" : status.label;
      badge.classList.toggle("epn-from-badge--warn", status.pending);
    }
    const accrualGroup = w.querySelector("#epn-accrual-group");
    if (accrualGroup) accrualGroup.style.display = status.key === "ooc-accrual" ? "" : "none";

    // Per-asset "rolls over to spouse" toggles only make sense with a
    // confirmed spouse — hide them all via one class rather than a
    // single or not-yet-confirmed client seeing a pointless control.
    w.classList.toggle("epn-no-spouse", status.pending || status.key === "none");

    const grossAnnual = _grossMonthlyFromTimeline() * 12;
    const rateBadge = w.querySelector("#epn-rate-badge");
    if (rateBadge) {
      if (grossAnnual > 0) {
        rateBadge.textContent = `${Math.round(_calcMarginalRate(grossAnnual) * 100)}%`;
        rateBadge.classList.remove("epn-from-badge--warn");
      } else {
        rateBadge.textContent = "Add on Timeline";
        rateBadge.classList.add("epn-from-badge--warn");
      }
    }
  }

  const CGT_EXEMPT = new Set([
    "Retirement Annuity (RA)",
    "Employer Pension / Provident Fund",
    "Preservation Fund (Pension)",
    "Preservation Fund (Provident)",
    "Tax-Free Savings Account (TFSA)",
    "Living Annuity",
    "Endowment",
  ]);

  const _bc = {}; // base costs per taxable investment idx, persisted across renders
  const _spouseFlags = {}; // per-asset "rolls over to spouse" flags, keyed by asset key, persisted across renders

  function _getInvestmentGains() {
    const cp = window.MeetingState?.get("currentPortfolio") || {};
    return (cp.investments || [])
      .filter(inv => (inv.value || 0) > 0 && !CGT_EXEMPT.has(inv.type))
      .map((inv, idx) => {
        const bc   = _bc[String(idx)] || 0;
        const gain = bc > 0 ? Math.max(0, inv.value - bc) : 0;
        return {
          idx: String(idx),
          key: `invest:${idx}`,
          desc: inv.type || "Investment",
          provider: inv.provider || "",
          cv: inv.value, bc, gain,
        };
      });
  }

  function _getAssetGains() {
    const cp = window.MeetingState?.get("currentPortfolio") || {};
    return (cp.fixed || [])
      .filter(a => a.value > 0)
      .map((a, idx) => {
        const pp   = a.purchasePrice || 0;
        const gain = pp > 0 ? Math.max(0, a.value - pp) : 0;
        const isPrimary = a.type === "Primary Residence";
        return {
          idx: String(idx), desc: a.type || "Asset", type: a.type || "",
          cv: a.value, pp, gain, isPrimary,
          key: isPrimary ? "primary" : `fixed:${idx}`,
        };
      });
  }

  function _getLiquidAssets() {
    const cp = window.MeetingState?.get("currentPortfolio") || {};
    return (cp.liquid || []).filter(a => (a.value || 0) > 0);
  }

  // Only a policy paid directly to the Estate is cash the executor actually
  // holds — proceeds paid to a named beneficiary (spouse, child, trust)
  // bypass the executor entirely and can't be assumed available to settle
  // costs. Funeral cover is excluded here since it's already netted against
  // the Funeral & Admin cost line in the Estate Duty pillar, not treated as
  // a separate liquid asset.
  function _getEstateBeneficiaryPolicies() {
    const ep = window.MeetingState?.get("existingPolicies") || {};
    return _flattenPolicies(ep)
      .filter(p => p.label === "Life" && (!p.beneficiary || p.beneficiary === "Estate"))
      .map(p => ({ desc: p.label, value: p.coverAmount }));
  }

  function _getAllPolicies() {
    const ep = window.MeetingState?.get("existingPolicies") || {};
    return _flattenPolicies(ep).map(p => ({
      label: p.label,
      provider: p.provider,
      coverAmount: p.coverAmount,
      inEstate: p.beneficiary !== "Spouse / Partner",
      beneficiary: p.beneficiary,
    }));
  }

  function _getFuneralCover() {
    const ep = window.MeetingState?.get("existingPolicies") || {};
    return _flattenPolicies(ep).reduce((s, p) => s + (p.label.startsWith("Funeral Cover") ? p.coverAmount : 0), 0);
  }

  // ── Calculation ────────────────────────────────────────────────────────────

  function _calc(w) {
    const p          = _getPortfolioTotals();
    const assetGains = _getAssetGains();
    const deemed     = _getEstatePolicies();
    const accrualStart = _parseMoney(w.querySelector("#epn-accrual-start")?.value);
    const netForAccrual = p.assets + p.investments - p.liabilities;
    const accrual      = Math.max(0, Math.round((netForAccrual - accrualStart) / 2));
    const spousal    = _parseMoney(w.querySelector("#epn-spouse")?.value);
    const isWidow    = w.querySelector("#epn-widow")?.checked || false;

    // Liquid: auto-pull from portfolio + Estate-beneficiary policies (the
    // only policy proceeds the executor actually holds)
    const liquid = _getLiquidAssets().reduce((s, a) => s + (a.value || 0), 0)
                 + _getEstateBeneficiaryPolicies().reduce((s, p) => s + p.value, 0);

    const funeralCover = _getFuneralCover();
    const funeralExtra = _parseMoney(w.querySelector("#epn-funeral-extra")?.value);
    const funeral      = funeralCover + funeralExtra;

    const gross       = p.assets + p.investments + deemed;
    const executorFee = Math.round(gross * EXECUTOR_RATE);
    const masterFee   = _masterFee(gross);

    const totalDed    = p.liabilities + executorFee + masterFee + funeral + accrual + spousal;
    const netEstate   = Math.max(0, gross - totalDed);
    const abatement   = isWidow ? 7_000_000 : 3_500_000;
    const dutiable    = Math.max(0, netEstate - abatement);
    const dutyOn30m   = Math.min(dutiable, 30_000_000) * 0.2;
    const dutyOnBal   = Math.max(0, dutiable - 30_000_000) * 0.25;
    const totalDuty   = Math.round(dutyOn30m + dutyOnBal);

    // ── Capital Gains Tax on deemed disposal ──
    w.querySelectorAll(".epn-cgt-inv-bc").forEach(el => { _bc[el.dataset.idx] = _parseMoney(el.value); });
    // Assets left to a surviving spouse get automatic roll-over relief (Sec
    // 9HA) — no deemed disposal, no CGT at death, deferred until the spouse
    // eventually disposes. Ticked per-asset via each row's "rolls over to
    // spouse" checkbox rather than one all-or-nothing toggle, since a real
    // estate usually splits — house to spouse, investments to children, etc.
    w.querySelectorAll(".epn-cgt-spouse-item").forEach(el => { _spouseFlags[el.dataset.key] = el.checked; });
    const invGains     = _getInvestmentGains();
    const investGains  = invGains.reduce((s, i) => s + (_spouseFlags[i.key] ? 0 : i.gain), 0);
    // No gross captured on Timeline yet → assume the top bracket (45%) rather
    // than the bottom one, so CGT is conservatively over- rather than under-
    // estimated until real income data exists.
    const grossAnnualForCGT = _grossMonthlyFromTimeline() * 12;
    const margRate     = grossAnnualForCGT > 0 ? _calcMarginalRate(grossAnnualForCGT) : 0.45;
    const totalAssetGains = assetGains.reduce((s, a) => s + (_spouseFlags[a.key] ? 0 : a.gain), 0);
    const primResGain     = assetGains.filter(a => a.isPrimary).reduce((s, a) => s + (_spouseFlags[a.key] ? 0 : a.gain), 0);
    // Raw gain regardless of spouse roll-over — used to keep the exclusion
    // line visible (struck through) rather than disappearing once rolled
    // over, since the relief still genuinely existed, it's just moot now.
    const primResGainRaw  = assetGains.filter(a => a.isPrimary).reduce((s, a) => s + a.gain, 0);
    // Primary residence exclusion is automatic statutory relief, not an
    // election an FA can opt out of — always applied whenever there's a gain.
    const primResExcl     = primResGain > 0 ? Math.min(2_000_000, primResGain) : 0;
    const primResExclRaw  = primResGainRaw > 0 ? Math.min(2_000_000, primResGainRaw) : 0;
    const totalGains      = totalAssetGains + investGains;
    const CGT_ANNUAL_EXCL = 300_000;
    const taxableGain     = Math.max(0, totalGains - primResExcl - CGT_ANNUAL_EXCL);
    const totalCGT        = Math.round(taxableGain * 0.40 * margRate);

    const totalCosts  = executorFee + masterFee + totalDuty + funeral + totalCGT;
    const gap         = Math.max(0, totalCosts - liquid);

    return {
      ...p, assetGains, deemed, funeralCover, funeralExtra, funeral, accrualStart, netForAccrual, accrual, spousal, liquid, isWidow,
      gross, executorFee, masterFee, totalDed, netEstate,
      abatement, dutiable, dutyOn30m, dutyOnBal, totalDuty,
      investGains, primResGain, primResExcl, primResExclRaw, totalGains, taxableGain, totalCGT, margRate,
      totalCosts, gap,
    };
  }

  // ── CSS ────────────────────────────────────────────────────────────────────

  function _injectCSS() {
    if (document.getElementById("epn-css")) return;
    const s = document.createElement("style");
    s.id = "epn-css";
    s.textContent = `
      .epn-wrapper {
        flex: 1; min-height: 0; min-width: 0; overflow: hidden;
        display: flex; flex-direction: column;
        background: rgba(255,255,255,0.55);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        border-radius: var(--panel-radius);
        border: 1px solid rgba(255,255,255,0.8);
        box-shadow: 0 15px 35px rgba(0,0,0,0.05);
        color: var(--navy-3);
        padding: 1.25rem 1.25rem 0; gap: 1rem;
      }
      .epn-pane {
        flex: 1; min-height: 0; overflow-y: auto;
        display: flex; flex-direction: column; gap: 1rem;
        padding-bottom: 2rem;
        scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.1) transparent;
      }

      /* ── Section body — a primary section here has no intermediate row grid,
         so it uncollapses straight into a tertiary-styled card (shared visual
         from meeting-shared.css's .mt-tertiary-card) instead of a plain body. ── */
      .epn-sec-body {
        display: flex; flex-direction: column;
        margin: 0.5rem 0.75rem 0.75rem;
        padding: 0.4rem 0;
      }
      /* Gross Estate's body holds two nested Primary sections (Assets, Deemed
         Assets) instead of flat rows — give them breathing room and drop the
         tertiary-card padding those flat-row sections rely on. */
      .epn-sec-body:has(.mt-primary--nested) {
        gap: 0.6rem;
        margin: 0.5rem 0.75rem 0.75rem;
        padding: 0;
      }

      /* ── Sub-header ── */
      .epn-sub-hdr {
        font-family: var(--fb); font-size: 0.62rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.07em; color: var(--navy-5); opacity: 0.55;
        padding: 0.65rem 1rem 0.2rem;
      }
      .epn-div { border: none; border-top: 1px solid rgba(0,0,0,0.05); margin: 0.2rem 0; }

      /* ── Auto (read-only) rows — indented relative to .epn-sub-hdr so line
         items visibly nest under the heading they belong to, instead of
         sitting flush with it. ── */
      .epn-auto {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.32rem 1rem 0.32rem 1.5rem;
      }
      .epn-auto-lbl {
        display: flex; align-items: center; gap: 1rem;
        font-family: var(--fb); font-size: 0.78rem; color: var(--navy-5);
      }
      .epn-auto-val {
        font-family: var(--fb); font-size: 0.78rem; font-weight: 600;
        color: var(--navy-3); font-variant-numeric: tabular-nums;
      }
      .epn-from-badge {
        font-family: var(--fb); font-size: 0.6rem; font-weight: 600;
        color: var(--navy-5); opacity: 0.5;
        background: rgba(0,0,0,0.05); border-radius: 3px;
        padding: 1px 5px; letter-spacing: 0.02em;
      }
      /* Prompts the FA to go fill in something on another tool — same shape as
         .epn-from-badge, just warm-colored and full opacity so it reads as an
         action item rather than passive provenance info. */
      .epn-from-badge--warn {
        color: #b45309; opacity: 1;
        background: rgba(180,83,9,0.1);
      }
      /* Per-asset "rolls over to spouse" CGT toggles only make sense once
         there's a confirmed spouse — hidden as a group via this class rather
         than a single or not-yet-confirmed client seeing a pointless control. */
      .epn-no-spouse .epn-cgt-spouse-toggle { display: none; }
      /* ── Inline Sec 9HA toggle — a clickable badge, same footprint as
         .epn-from-badge, that lights up blue when the asset is flagged as
         rolling over to a spouse (checkbox visually hidden, label carries
         the click target and the checked-state styling). ── */
      .epn-cgt-9ha-tag {
        position: relative;
        display: inline-flex; align-items: center; cursor: pointer;
        font-family: var(--fb); font-size: 0.6rem; font-weight: 600;
        color: var(--navy-5); opacity: 0.5;
        background: rgba(0,0,0,0.05); border-radius: 3px;
        padding: 1px 5px; letter-spacing: 0.02em;
        transition: background 0.15s, color 0.15s, opacity 0.15s;
      }
      .epn-cgt-9ha-tag:hover { opacity: 0.8; }
      .epn-cgt-9ha-tag input {
        position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
        overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
      }
      .epn-cgt-9ha-tag:has(input:checked) {
        opacity: 1; color: #3273f6; background: rgba(50,115,246,0.12);
      }
      /* A row that would normally apply but is currently moot (e.g. the
         primary residence exclusion once that gain has rolled over to a
         spouse) stays visible, struck through, instead of disappearing —
         the figure is still real information, just not currently active. */
      .epn-auto--moot .epn-auto-lbl,
      .epn-auto--moot .epn-auto-val {
        text-decoration: line-through; opacity: 0.4;
      }

      /* ── Manual input rows ── */
      .epn-row {
        display: flex; align-items: center; gap: 0.5rem; padding: 0.32rem 1rem 0.32rem 1.5rem;
      }
      .epn-row-lbl { flex: 1; font-family: var(--fb); font-size: 0.78rem; color: var(--navy-4); }
      .epn-money {
        display: flex; align-items: center; height: 32px; flex-shrink: 0;
        background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1);
        border-radius: 7px; overflow: hidden;
      }
      .epn-money:focus-within {
        background: white; border-color: var(--navy-4); box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .epn-pfx {
        flex-shrink: 0; padding: 0 0.3rem;
        font-family: var(--fb); font-size: 0.78rem; font-weight: 600;
        color: var(--navy-5); user-select: none;
      }
      .epn-num {
        width: 100px; border: none; background: transparent; outline: none;
        font-family: var(--fb); font-size: 0.8rem; color: var(--navy-3);
        text-align: right; padding: 0 0.45rem 0 0;
      }
      .epn-num::placeholder { color: rgba(100,116,139,0.35); }

      /* ── Checkbox ── */
      .epn-chk-row {
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.38rem 1rem 0.38rem 1.5rem; cursor: pointer;
      }
      .epn-chk-row input[type="checkbox"] { width: 14px; height: 14px; accent-color: #3273f6; }
      .epn-chk-row span { font-family: var(--fb); font-size: 0.76rem; color: var(--navy-5); }

      /* ── Summary banners ── */
      .epn-summary {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0.6rem 1rem; border-radius: 0.6rem;
        background: rgba(255,255,255,0.55); border: 1px solid rgba(0,0,0,0.07);
      }
      .epn-summary-lbl {
        font-family: var(--fb); font-size: 0.74rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.06em; color: var(--navy-5);
      }
      .epn-summary-val {
        font-family: var(--fb); font-size: 0.9rem; font-weight: 700;
        color: var(--navy-2); font-variant-numeric: tabular-nums;
      }
      .epn-summary--duty .epn-summary-val  { color: #b45309; }
      .epn-summary--duty .epn-summary-lbl  { color: #b45309; }
      .epn-summary--gap  .epn-summary-val  { color: #3273f6; }
      .epn-summary--gap  .epn-summary-lbl  { color: #3273f6; }

      /* ── Duty breakdown ── */
      .epn-duty-detail {
        background: rgba(180,83,9,0.04); border: 1px solid rgba(180,83,9,0.1);
        border-radius: 0.6rem; padding: 0.5rem 0;
      }
      .epn-duty-detail .epn-auto-lbl { color: var(--navy-5); opacity: 0.75; }
    `;
    document.head.appendChild(s);
  }

  // ── Template ───────────────────────────────────────────────────────────────

  function _template() {
    return `<div class="epn-wrapper calc-glass">
      <div class="tool-hero-zone" id="hero-estate-planning"></div>
      <div class="epn-pane">

        <!-- 01 GROSS ESTATE -->
        <div class="mt-primary collapsed" id="epn-sec-gross">
          <div class="mt-primary-hdr" data-sec="gross">
            <span class="mt-primary-title">1. Gross Estate</span>
            <div class="mt-primary-right"><span class="mt-primary-sum" id="epn-tot-gross">R 0</span><span class="mt-chev"></span></div>
          </div>
          <div class="epn-sec-body">
            <div class="mt-primary mt-primary--nested collapsed" id="epn-sec-assets">
              <div class="mt-primary-hdr">
                <span class="mt-primary-title">Assets</span>
                <div class="mt-primary-right"><span class="mt-primary-sum" id="epn-tot-assets">R 0</span><span class="mt-chev"></span></div>
              </div>
              <div class="mt-primary-body">
                <div class="epn-sub-hdr" style="padding-top:0">Liquid Assets</div>
                <div id="epn-liquid-list"><!-- populated by _update() --></div>
                <div class="epn-sub-hdr">Investments</div>
                <div id="epn-invest-list"><!-- populated by _update() --></div>
                <div class="epn-sub-hdr">Fixed Assets</div>
                <div id="epn-fixed-list"><!-- populated by _update() --></div>
              </div>
            </div>
            <div class="mt-primary mt-primary--nested collapsed" id="epn-sec-deemed">
              <div class="mt-primary-hdr">
                <span class="mt-primary-title">Deemed Assets</span>
                <div class="mt-primary-right"><span class="mt-primary-sum" id="epn-tot-deemed">R 0</span><span class="mt-chev"></span></div>
              </div>
              <div class="mt-primary-body">
                <div id="epn-policies-list"><!-- populated by _update() --></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 02 WHAT IT COSTS -->
        <div class="mt-primary collapsed" id="epn-sec-costs">
          <div class="mt-primary-hdr" data-sec="taxes">
            <span class="mt-primary-title">2. Taxes Payable</span>
            <div class="mt-primary-right"><span class="mt-primary-sum" id="epn-tot-costs">R 0</span><span class="mt-chev"></span></div>
          </div>
          <div class="epn-sec-body">
            <div class="mt-primary mt-primary--nested collapsed" id="epn-sec-duty">
              <div class="mt-primary-hdr">
                <span class="mt-primary-title">Estate Duty</span>
                <div class="mt-primary-right"><span class="mt-primary-sum" id="epn-tot-duty">R 0</span><span class="mt-chev"></span></div>
              </div>
              <div class="mt-primary-body">
                <div class="epn-sub-hdr" style="padding-top:0">Short-Term Liabilities</div>
                <div id="epn-stliab-list"><!-- populated by _update() --></div>
                <div class="epn-sub-hdr">Long-Term Liabilities</div>
                <div id="epn-ltliab-list"><!-- populated by _update() --></div>
                <div class="epn-sub-hdr" style="display:flex;align-items:center;gap:0.4rem">
                  Marital Regime <span class="epn-from-badge" id="epn-regime-badge">—</span>
                </div>
                <div class="epn-auto">
                  <span class="epn-auto-lbl">Executor Fee (3.5% + VAT)</span>
                  <span class="epn-auto-val" id="epn-executor-val">—</span>
                </div>
                <div class="epn-auto">
                  <span class="epn-auto-lbl">Master's Fee</span>
                  <span class="epn-auto-val" id="epn-master-val">—</span>
                </div>
                <div id="epn-funeral-cover-row" style="display:none">
                  <div class="epn-auto">
                    <span class="epn-auto-lbl">Funeral cover</span>
                    <span class="epn-auto-val" id="epn-funeral-cover-val">—</span>
                  </div>
                </div>
                <div class="epn-row">
                  <span class="epn-row-lbl" id="epn-funeral-extra-lbl">Funeral &amp; Admin</span>
                  <div class="epn-money"><span class="epn-pfx">R</span>
                    <input class="epn-num" id="epn-funeral-extra" type="text" inputmode="numeric" placeholder="0">
                  </div>
                </div>
                <div id="epn-accrual-group" style="display:none">
                  <hr class="epn-div">
                  <div class="epn-auto">
                    <span class="epn-auto-lbl">Current net estate</span>
                    <span class="epn-auto-val" id="epn-accrual-net">—</span>
                  </div>
                  <div class="epn-row">
                    <span class="epn-row-lbl">Starting estate (at marriage)</span>
                    <div class="epn-money"><span class="epn-pfx">R</span>
                      <input class="epn-num" id="epn-accrual-start" type="text" inputmode="numeric" placeholder="0">
                    </div>
                  </div>
                  <div class="epn-auto">
                    <span class="epn-auto-lbl" style="font-weight:600">Accrual claim (Sec 4k)</span>
                    <span class="epn-auto-val" id="epn-accrual-val">—</span>
                  </div>
                </div>
                <hr class="epn-div">
                <div class="epn-row">
                  <span class="epn-row-lbl">Spousal Bequest (Sec 4q)</span>
                  <div class="epn-money"><span class="epn-pfx">R</span>
                    <input class="epn-num" id="epn-spouse" type="text" inputmode="numeric" placeholder="0">
                  </div>
                </div>
                <label class="epn-chk-row">
                  <input type="checkbox" id="epn-widow">
                  <span>Widow / Widower — unused S4A abatement rolls over (R7m)</span>
                </label>
                <hr class="epn-div">
                <div class="epn-auto">
                  <span class="epn-auto-lbl" style="font-weight:700;color:var(--navy-4)">= Net Estate</span>
                  <span class="epn-auto-val" id="epn-tot-net">—</span>
                </div>
                <hr class="epn-div">
                <div class="epn-auto">
                  <span class="epn-auto-lbl">Less: S4A Abatement <span class="epn-from-badge">R3.5m / R7m if widow</span></span>
                  <span class="epn-auto-val" id="epn-abatement-val">—</span>
                </div>
                <hr class="epn-div">
                <div class="epn-auto">
                  <span class="epn-auto-lbl" style="font-weight:700;color:var(--navy-4)">= Dutiable Estate</span>
                  <span class="epn-auto-val" id="epn-dutiable-val">—</span>
                </div>
                <hr class="epn-div">
                <div class="epn-auto">
                  <span class="epn-auto-lbl">Duty on first R30m @ 20%</span>
                  <span class="epn-auto-val" id="epn-duty20-val">—</span>
                </div>
                <div class="epn-auto">
                  <span class="epn-auto-lbl">Duty on balance @ 25%</span>
                  <span class="epn-auto-val" id="epn-duty25-val">—</span>
                </div>
              </div>
            </div>
            <div class="mt-primary mt-primary--nested collapsed" id="epn-sec-cgt">
              <div class="mt-primary-hdr">
                <span class="mt-primary-title">Capital Gains Tax</span>
                <div class="mt-primary-right"><span class="mt-primary-sum" id="epn-tot-cgt">—</span><span class="mt-chev"></span></div>
              </div>
              <div class="mt-primary-body">
                <div class="epn-sub-hdr" style="padding-top:0;display:flex;justify-content:space-between;align-items:center">Primary Residence <span class="epn-auto-val" id="epn-tot-cgt-primary">R 0</span></div>
                <div id="epn-cgt-primary-list"><!-- populated by _update() --></div>
                <div class="epn-sub-hdr" style="display:flex;justify-content:space-between;align-items:center">Fixed Assets <span class="epn-auto-val" id="epn-tot-cgt-fixed">R 0</span></div>
                <div id="epn-cgt-fixed-list"><!-- populated by _update() --></div>
                <div class="epn-sub-hdr" style="display:flex;justify-content:space-between;align-items:center">Investments <span class="epn-auto-val" id="epn-tot-cgt-invest">R 0</span></div>
                <div id="epn-cgt-investments"><!-- populated by _update() --></div>
                <hr class="epn-div">
                <div class="epn-auto">
                  <span class="epn-auto-lbl">Total gains on deemed disposal</span>
                  <span class="epn-auto-val" id="epn-cgt-gross">—</span>
                </div>
                <div class="epn-auto" id="epn-cgt-primexcl-row" style="display:none">
                  <span class="epn-auto-lbl">Less: Primary residence exclusion <span class="epn-from-badge" id="epn-cgt-primexcl-note" style="display:none">rolls over to spouse</span></span>
                  <span class="epn-auto-val" style="color:var(--navy-5)" id="epn-cgt-primexcl-val">—</span>
                </div>
                <div class="epn-auto">
                  <span class="epn-auto-lbl">Less: Annual exclusion on death</span>
                  <span class="epn-auto-val" style="color:var(--navy-5)">(R 300 000)</span>
                </div>
                <div class="epn-auto">
                  <span class="epn-auto-lbl" style="font-weight:600">Net taxable gain</span>
                  <span class="epn-auto-val" id="epn-cgt-net">—</span>
                </div>
                <hr class="epn-div">
                <div class="epn-auto">
                  <span class="epn-auto-lbl">Taxable inclusion <span class="epn-from-badge">× 40%</span></span>
                  <span class="epn-auto-val" id="epn-cgt-taxable">—</span>
                </div>
                <div class="epn-auto">
                  <span class="epn-auto-lbl">Marginal tax rate</span>
                  <span class="epn-from-badge" id="epn-rate-badge">—</span>
                </div>
                <hr class="epn-div">
                <div class="epn-auto">
                  <span class="epn-auto-lbl" style="font-weight:600">Capital Gains Tax payable</span>
                  <span class="epn-auto-val" id="epn-cgt-payable">—</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 03 IS THERE ENOUGH -->
        <div class="mt-primary collapsed" id="epn-sec-liq">
          <div class="mt-primary-hdr" data-sec="liq">
            <span class="mt-primary-title">3. Liquidity</span>
            <div class="mt-primary-right"><span class="mt-primary-sum" id="epn-tot-liq">R 0</span><span class="mt-chev"></span></div>
          </div>
          <div class="epn-sec-body mt-tertiary-card">
            <div class="epn-auto">
              <span class="epn-auto-lbl" style="font-weight:600">Total costs due at death</span>
              <span class="epn-auto-val" id="epn-liq-totalcosts">—</span>
            </div>
            <hr class="epn-div">
            <div class="epn-auto">
              <span class="epn-auto-lbl">Liquid assets available <span class="epn-from-badge">from What You Own</span></span>
              <span class="epn-auto-val" id="epn-liq-totalassets">—</span>
            </div>
            <div class="epn-sub-hdr" id="epn-liq-hdr-policies">Life Policies (paid to Estate)</div>
            <div id="epn-liq-auto-policies"></div>
            <div class="epn-auto">
              <span class="epn-auto-lbl" style="font-weight:700">Total available</span>
              <span class="epn-auto-val" id="epn-liquid-total">—</span>
            </div>
            <hr class="epn-div">
            <div class="epn-summary" id="epn-gap-line">
              <span class="epn-summary-lbl" style="color:#3273f6">Cover Gap</span>
              <span class="epn-summary-val" style="color:#dc2626">—</span>
            </div>
          </div>
        </div>

      </div>
    </div>`;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  function _update(w) {
    const r = _calc(w);
    const $ = id => w.querySelector(`#${id}`);
    const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
    const setR = (id, n)  => set(id, n > 0 ? _R(n) : "—");

    // Gross estate
    set("epn-tot-gross", _R(r.gross));
    set("epn-tot-assets", _R(r.assets + r.investments));
    set("epn-tot-deemed", _R(r.deemed));

    const items = _getPortfolioItems();
    const liquidEl = $("epn-liquid-list");
    if (liquidEl) liquidEl.innerHTML = _portfolioRowsHTML(items.liquid, "No liquid assets");
    const investEl = $("epn-invest-list");
    if (investEl) investEl.innerHTML = _portfolioRowsHTML(items.investments, "No investments");
    const fixedEl = $("epn-fixed-list");
    if (fixedEl) fixedEl.innerHTML = _portfolioRowsHTML(items.fixed, "No fixed assets");

    // Policies list
    const allPolicies = _getAllPolicies();
    const policiesEl = $("epn-policies-list");
    if (policiesEl) {
      policiesEl.innerHTML = allPolicies.length > 0
        ? allPolicies.map(p => `
            <div class="epn-auto">
              <span class="epn-auto-lbl">${p.label}
                ${p.provider ? `<span class="epn-from-badge">${p.provider}</span>` : ""}
                ${p.inEstate
                  ? `<span class="epn-from-badge">included in estate</span>`
                  : `<span class="epn-from-badge" style="background:rgba(180,83,9,0.08);color:#b45309">bypasses estate → ${p.beneficiary}</span>`}
              </span>
              <span class="epn-auto-val" style="${p.inEstate ? "" : "opacity:0.35"}">${_R(p.coverAmount)}</span>
            </div>`).join("")
        : `<div class="epn-auto"><span class="epn-auto-lbl" style="color:var(--navy-5);font-style:italic">No policies in Existing Policies yet</span></div>`;
    }

    // Liabilities (top of the Estate Duty pillar, broken down like Existing Portfolio)
    const stLiabEl = $("epn-stliab-list");
    if (stLiabEl) stLiabEl.innerHTML = _portfolioRowsHTML(items.stLiabilities, "No short-term liabilities", "balance");
    const ltLiabEl = $("epn-ltliab-list");
    if (ltLiabEl) ltLiabEl.innerHTML = _portfolioRowsHTML(items.ltLiabilities, "No long-term liabilities", "balance");

    // Deductions (everything else — executor/master's fee, funeral, accrual, spousal)
    setR("epn-executor-val", r.executorFee);
    setR("epn-master-val",   r.masterFee);

    // Funeral cover auto row
    const funeralCoverRow = $("epn-funeral-cover-row");
    const funeralExtraLbl = $("epn-funeral-extra-lbl");
    if (funeralCoverRow) funeralCoverRow.style.display = r.funeralCover > 0 ? "" : "none";
    set("epn-funeral-cover-val", r.funeralCover > 0 ? _R(r.funeralCover) : "—");
    if (funeralExtraLbl) funeralExtraLbl.textContent = r.funeralCover > 0 ? "Additional funeral costs" : "Funeral & Admin";
    setR("epn-accrual-net",  r.netForAccrual);
    setR("epn-accrual-val",  r.accrual);
    set("epn-tot-net", _R(r.netEstate));

    // Duty section — S4A Abatement → Dutiable Estate → Duty, all in one flow
    set("epn-abatement-val", r.netEstate > 0 ? `(${_R(Math.min(r.abatement, r.netEstate))})` : "—");
    set("epn-dutiable-val",  r.netEstate > 0 ? (r.dutiable > 0 ? _R(r.dutiable) : "R 0") : "—");
    set("epn-duty20-val",  r.netEstate > 0 ? (r.dutyOn30m > 0 ? _R(r.dutyOn30m) : "R 0") : "—");
    set("epn-duty25-val",  r.netEstate > 0 ? (r.dutyOnBal > 0 ? _R(r.dutyOnBal) : "R 0") : "—");
    set("epn-tot-duty",      _R(r.totalDuty));

    // CGT section — primary residence (own nested section; toggle lives here)
    const primaryAsset = r.assetGains.find(a => a.isPrimary);
    const fixedAssets   = r.assetGains.filter(a => !a.isPrimary);
    const tagHTML = (key) => `<label class="epn-cgt-9ha-tag epn-cgt-spouse-toggle" title="Rolls over to spouse — no CGT (Sec 9HA)">
              <input type="checkbox" class="epn-cgt-spouse-item" data-key="${key}"${_spouseFlags[key] ? " checked" : ""}>
              <span>Sec 9HA</span>
            </label>`;
    const primaryEl = $("epn-cgt-primary-list");
    if (primaryEl) {
      primaryEl.innerHTML = primaryAsset
        ? `<div class="epn-auto">
              <span class="epn-auto-lbl">${primaryAsset.desc} <span class="epn-from-badge">CV ${_R(primaryAsset.cv)}</span>${primaryAsset.pp > 0 ? ` <span class="epn-from-badge">cost ${_R(primaryAsset.pp)}</span>` : ""}${primaryAsset.gain > 0 ? ` ${tagHTML(primaryAsset.key)}` : ""}</span>
              <span class="epn-auto-val">${primaryAsset.gain > 0 ? _R(primaryAsset.gain) : (primaryAsset.pp > 0 ? "R 0" : "—")}</span>
            </div>`
        : `<div class="epn-auto"><span class="epn-auto-lbl" style="color:var(--navy-5);font-style:italic">No primary residence in Existing Portfolio</span></div>`;
      primaryEl.querySelector(".epn-cgt-spouse-item")?.addEventListener("change", () => _update(w));
    }
    set("epn-tot-cgt-primary", _R(r.primResGain));

    // CGT section — other fixed assets (read-only, purchase price from portfolio)
    const cgtFixedEl = $("epn-cgt-fixed-list");
    if (cgtFixedEl) {
      cgtFixedEl.innerHTML = fixedAssets.length > 0
        ? fixedAssets.map(a => `
            <div class="epn-auto">
              <span class="epn-auto-lbl">${a.desc} <span class="epn-from-badge">CV ${_R(a.cv)}</span>${a.pp > 0 ? ` <span class="epn-from-badge">cost ${_R(a.pp)}</span>` : ""}${a.gain > 0 ? ` ${tagHTML(a.key)}` : ""}</span>
              <span class="epn-auto-val">${a.gain > 0 ? _R(a.gain) : (a.pp > 0 ? "R 0" : "—")}</span>
            </div>`).join("")
        : `<div class="epn-auto"><span class="epn-auto-lbl" style="color:var(--navy-5);font-style:italic">No other fixed assets in Existing Portfolio</span></div>`;
      cgtFixedEl.querySelectorAll(".epn-cgt-spouse-item").forEach(el => el.addEventListener("change", () => _update(w)));
    }
    set("epn-tot-cgt-fixed", _R(r.assetGains.reduce((s, a) => s + a.gain, 0) - r.primResGain));

    // CGT section — investments (base cost input, smart re-render)
    const invGains = _getInvestmentGains();
    const invEl = $("epn-cgt-investments");
    if (invEl) {
      if (invGains.length === 0) {
        invEl.innerHTML = `<div class="epn-auto"><span class="epn-auto-lbl" style="color:var(--navy-5);font-style:italic">No taxable investments in Existing Portfolio</span></div>`;
      } else if (invEl.querySelectorAll(".epn-cgt-inv-row").length !== invGains.length) {
        invEl.innerHTML = invGains.map(i => `
          <div class="epn-cgt-inv-row epn-auto">
            <span class="epn-auto-lbl">${i.desc}${i.provider ? ` <span class="epn-from-badge">${i.provider}</span>` : ""} <span class="epn-from-badge">CV ${_R(i.cv)}</span> ${tagHTML(i.key)}</span>
            <div style="display:flex;align-items:center;gap:0.4rem">
              <span style="font-size:0.68rem;color:var(--navy-5);opacity:0.7;flex-shrink:0">base cost</span>
              <div class="epn-money"><span class="epn-pfx">R</span>
                <input class="epn-num epn-cgt-inv-bc" data-idx="${i.idx}" value="${i.bc > 0 ? _fmt(i.bc) : ''}" placeholder="0">
              </div>
              <span class="epn-auto-val" data-inv-gain="${i.idx}" style="min-width:80px;text-align:right">${i.bc > 0 ? _R(i.gain) : "—"}</span>
            </div>
          </div>`).join("");
        invEl.querySelectorAll(".epn-cgt-spouse-item").forEach(el => el.addEventListener("change", () => _update(w)));
      } else {
        invGains.forEach(i => {
          const g = invEl.querySelector(`[data-inv-gain="${i.idx}"]`);
          if (g) g.textContent = i.bc > 0 ? _R(i.gain) : "—";
        });
      }
    }
    set("epn-tot-cgt-invest", _R(r.investGains));

    const hasGainData = r.assetGains.some(a => a.pp > 0) || invGains.some(i => i.bc > 0);
    const primexclRow = $("epn-cgt-primexcl-row");
    const primexclMoot = r.primResExclRaw > 0 && r.primResExcl === 0;
    if (primexclRow) {
      primexclRow.style.display = r.primResExclRaw > 0 ? "" : "none";
      primexclRow.classList.toggle("epn-auto--moot", primexclMoot);
    }
    const primexclNote = $("epn-cgt-primexcl-note");
    if (primexclNote) primexclNote.style.display = primexclMoot ? "" : "none";
    set("epn-cgt-primexcl-val", r.primResExclRaw > 0 ? `(${_R(r.primResExclRaw)})` : "—");
    set("epn-cgt-gross",    hasGainData ? _R(r.totalGains) : "—");
    set("epn-cgt-net",      hasGainData ? _R(r.taxableGain) : "—");
    const taxableInclusion = Math.round(r.taxableGain * 0.40);
    set("epn-cgt-taxable",  hasGainData ? _R(taxableInclusion) : "—");
    set("epn-cgt-payable",  hasGainData ? (r.totalCGT > 0 ? _R(r.totalCGT) : "R 0") : "—");
    set("epn-tot-cgt",      hasGainData ? (r.totalCGT > 0 ? _R(r.totalCGT) : "R 0") : "—");
    set("epn-tot-costs",    _R(r.totalDuty + r.totalCGT));

    // Is There Enough? — costs rolled up into one line (each already itemized
    // in "What It Costs" above, no need to re-list them here)
    set("epn-liq-totalcosts", r.totalCosts > 0 ? _R(r.totalCosts) : "R 0");

    // Is There Enough? — liquid assets rolled up into one line (already
    // itemized under "Gross Estate"); Estate-beneficiary policies stay
    // itemized since this is the only place that breakdown is shown
    const la = _getLiquidAssets();
    const estPolicies = _getEstateBeneficiaryPolicies();
    const liquidAssetsOnly = la.reduce((s, a) => s + (a.value || 0), 0);
    set("epn-liq-totalassets", liquidAssetsOnly > 0 ? _R(liquidAssetsOnly) : "R 0");
    const liqPolHdrEl = $("epn-liq-hdr-policies");
    const liqPolEl    = $("epn-liq-auto-policies");
    if (liqPolHdrEl) liqPolHdrEl.style.display = estPolicies.length > 0 ? "" : "none";
    if (liqPolEl)    liqPolEl.innerHTML = estPolicies.map(p => `<div class="epn-auto"><span class="epn-auto-lbl">${p.desc}</span><span class="epn-auto-val">${_R(p.value)}</span></div>`).join("");

    set("epn-liquid-total", r.liquid > 0 ? _R(r.liquid) : "—");

    const surplus = r.liquid - r.totalCosts;
    const gapEl = $("epn-gap-line");
    if (gapEl) {
      if (surplus > 0) {
        gapEl.innerHTML = `<span class="epn-summary-lbl" style="color:#059669">Surplus</span><span class="epn-summary-val" style="color:#059669">${_R(surplus)}</span>`;
      } else {
        gapEl.innerHTML = `<span class="epn-summary-lbl" style="color:#3273f6">Cover Gap</span><span class="epn-summary-val" style="color:#dc2626">${_R(r.gap)}</span>`;
      }
    }
    set("epn-tot-liq", r.gap > 0 ? _R(r.gap) : (surplus > 0 ? `+${_R(surplus)}` : "R 0"));

    window.MeetingState?.set("estatePlanner", {
      grossEstate:       r.gross,
      totalDuty:         r.totalDuty,
      executorFee:       r.executorFee,
      masterFee:         r.masterFee,
      totalCGT:          r.totalCGT,
      assetDisposalCost: r.executorFee + r.masterFee + r.totalCGT,
      estateGap:         r.gap,
      surplus:           surplus,
      funeralCost:       r.funeral,
    });

    CalcHero.update({
      primaries:   [{ id: "epn-hero-gap",   value: r.gap              }],
      secondaries: [
        { id: "epn-hero-duty",  value: r.totalDuty                    },
        { id: "epn-hero-exec",  value: r.executorFee + r.masterFee    },
        { id: "epn-hero-cgt",   value: r.totalCGT                     },
      ],
    }, w);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  function _initEvents(w, update) {
    w.addEventListener("focusin", e => {
      const el = e.target.closest(".epn-num");
      if (!el) return;
      el.value = el.value.replace(/[^0-9.]/g, "");
      el.select();
    });
    w.addEventListener("focusout", e => {
      const el = e.target.closest(".epn-num");
      if (!el) return;
      const raw = el.value.trim();
      const n = _parseMoney(raw);
      el.value = raw === "" ? "" : (n > 0 ? _fmt(n) : "0");
      update();
    });
    w.addEventListener("input", e => {
      if (e.target.closest(".epn-num")) update();
    });

    // Gross Estate's nested sections (Assets / Deemed Assets) get their own
    // accordion among themselves, scoped to their shared parent — registered
    // before MtUI.initSections' own top-level accordion below, and stopping
    // the event from also reaching it, so a nested click never collapses
    // Gross Estate itself along with its siblings (Net Estate, Duty, etc.).
    w.addEventListener("click", e => {
      const nestedHdr = e.target.closest(".mt-primary--nested > .mt-primary-hdr");
      if (!nestedHdr) return;
      if (e.target.closest("button, input, select, a")) return;
      const sec    = nestedHdr.closest(".mt-primary--nested");
      // Start the ancestor search from sec's parent, not sec itself — sec also
      // carries the .mt-primary class, so closest() on sec would match sec
      // itself first, leaving "parent" wrongly equal to sec.
      const parent = sec?.parentElement.closest(".mt-primary");
      if (!sec || !parent) return;
      const isCollapsed = sec.classList.contains("collapsed");
      parent.querySelectorAll(".mt-primary--nested").forEach(s => s.classList.add("collapsed"));
      if (isCollapsed) sec.classList.remove("collapsed");
      e.stopImmediatePropagation();
    });

    w.querySelector("#epn-widow")?.addEventListener("change", update);
  }

  // ── Module ─────────────────────────────────────────────────────────────────

  window.App?.register("estate-planning", {
    id: "estate-planning",
    title: "Estate Planning",

    guide: {
      intro: {
        heading: "Estate Planner",
        html: `<p>The gross estate is pulled automatically from the Existing Portfolio — assets, investments, and liabilities are already captured there.</p>
               <p>This tool only needs the deductions and designations: which life policies are paid to the estate, the marital regime, any spousal bequest or accrual claim, and estimated funeral costs.</p>
               <p>The <strong>Estate Gap</strong> is the cash the estate needs on day one — estate duty plus executor fees minus any liquid assets available. This is the number life cover needs to fill.</p>`,
      },
    },

    mount(wrapper) {
      _injectCSS();
      wrapper.insertAdjacentHTML("beforeend", _template());
      const w = wrapper.querySelector(".epn-wrapper");
      CalcHero.render("#hero-estate-planning", {
        primaries:   [{ id: "epn-hero-gap",      label: "Estate Gap"    }],
        secondaries: [
          { id: "epn-hero-duty",  label: "Estate Duty",   dot: "#b45309", negative: true },
          { id: "epn-hero-cgt",   label: "CGT",           dot: "#dc2626", negative: true },
          { id: "epn-hero-exec",  label: "Executor Fees", dot: "#f97316", negative: true },
        ],
      });
      const update = () => _update(w);
      _initEvents(w, update);
      MtUI.initSections(w, { accordion: true });

      _applyProfileDefaults(w);

      const _onState = (e) => {
        if (!wrapper.isConnected) return;
        const id = e.detail.toolId;
        if (id === "timeline" || id === "cashflow") {
          _applyProfileDefaults(w);
        }
        if (id === "currentPortfolio" || id === "existingPolicies" ||
            id === "timeline"          || id === "cashflow") {
          update();
        }
      };
      document.addEventListener("meetingstate", _onState);

      update();
    },

    getState() {
      const w = window.App._wrappers[this.id]?.querySelector(".epn-wrapper");
      if (!w) return null;
      return {
        funeralExtra: w.querySelector("#epn-funeral-extra")?.value  || "",
        accrualStart: w.querySelector("#epn-accrual-start")?.value || "",
        spouse:       w.querySelector("#epn-spouse")?.value        || "",
        isWidow:     w.querySelector("#epn-widow")?.checked     || false,
        cgtBC:       { ..._bc },
        cgtSpouseFlags: { ..._spouseFlags },
      };
    },

    setState(extra) {
      if (!extra) return;
      const w = window.App._wrappers[this.id]?.querySelector(".epn-wrapper");
      if (!w) return;
      const set = (id, val) => { const el = w.querySelector(`#${id}`); if (el) el.value = val || ""; };
      set("epn-funeral-extra", extra.funeralExtra ?? extra.funeral ?? "");
      set("epn-accrual-start", extra.accrualStart);
      set("epn-spouse",        extra.spouse);
      if (extra.cgtBC) Object.assign(_bc, extra.cgtBC);
      if (extra.cgtSpouseFlags) Object.assign(_spouseFlags, extra.cgtSpouseFlags);
      const widowEl = w.querySelector("#epn-widow");
      if (widowEl) widowEl.checked = extra.isWidow || false;
      _update(w);
    },
  });
})();

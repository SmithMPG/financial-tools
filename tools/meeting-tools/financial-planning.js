// tools/meeting-tools/financial-planning.js

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────────

  const _CURRENT_YEAR = new Date().getFullYear();

  // Income replacement default — a blended percentage of expenses/income
  // rather than a category-by-category budget picker, since claiming to know
  // exactly which household costs survive a death is false precision.
  const LIFE_IR_PCT_DEFAULT = 75;

  // Once-off capital costs (home modifications, assistive tech, etc.) can't
  // be sensibly priced without knowing which disability, how severe, or when
  // — so Capital Disability uses the same salary-multiple approach as Dread
  // Disease instead of itemised guesses.
  const DIS_MULT_MIN     = 0.5;
  const DIS_MULT_MAX     = 5;
  const DIS_MULT_DEFAULT = 3;

  const DREAD_MULT_MIN  = 0.5;
  const DREAD_MULT_MAX  = 5;
  const DREAD_MULT_DEFAULT = 3;

  // Income Protection insures a percentage of income, capped — insurers won't
  // underwrite above ~75% of gross monthly income (moral hazard limit), so
  // this is built off income directly rather than total household expenses.
  const IP_PCT_DEFAULT = 75;
  const IP_PCT_MAX     = 75;

  const WRAPPER_TYPES = [
    "Discretionary Investment",
    "Endowment",
    "TFSA",
    "Retirement Annuity",
    "Living Annuity",
    "Life Annuity",
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Delegate to components/input-format.js — the single source of truth for
  // money parsing/formatting — rather than a local regex copy. abs() first
  // since these format money for display only, never a signed value.
  function _fmtNum(n) {
    return window.numberToMoney(Math.abs(n));
  }

  function _fmt(n) {
    return "R " + _fmtNum(n);
  }

  function _parseMoney(v) {
    return window.moneyToNumber(v);
  }

  // Per-pillar "Apply Existing Cover" — pulls just the broken-down cover
  // amount for this pillar's type out of each existing policy (a policy can
  // bundle several types; only the relevant slice shows here, not the whole
  // policy). Nothing counts toward the "have" offset until the FA explicitly
  // ticks a policy in — the gap starts at the full need, not silently netted
  // down by cover the FA hasn't reviewed yet.
  const _EXISTING_TYPE_KEY = { life: "life", dis: "disability", dread: "dreadDisease", ip: "incomeProtection" };

  function _existingPoliciesFor(pillar) {
    const typeKey = _EXISTING_TYPE_KEY[pillar];
    const policies = window.MeetingState?.get("existingPolicies")?.policies || [];
    return policies
      .map((p, i) => ({ key: `${pillar}-${i}`, label: p.insurer || "Policy", cover: p.types?.[typeKey]?.cover || 0 }))
      .filter((p) => p.cover > 0);
  }

  function _haveTotal(pillar) {
    const items     = _existingPoliciesFor(pillar);
    const applyMap  = _existingApply[pillar] || {};
    return items.reduce((s, p) => s + (applyMap[p.key] ? p.cover : 0), 0);
  }

  function _getLiabilityItems() {
    const p = window.MeetingState?.get("currentPortfolio") || {};
    const items = [];
    (p.stLiabilities || []).forEach((l, i) => {
      if ((l.balance || 0) > 0) items.push({ key: `st-${i}`, label: l.description || l.type || "Short-term liability", balance: l.balance });
    });
    (p.ltLiabilities || []).forEach((l, i) => {
      if ((l.balance || 0) > 0) items.push({ key: `lt-${i}`, label: l.description || l.type || "Long-term liability", balance: l.balance });
    });
    return items;
  }

  // Sourced from Timeline instead of About You — the Meeting card's derived age
  // (tl.age) replaces ay.age; retirement age is projected from a "Retirement
  // Funding" life-event card's year (falling back to 65 if there isn't one);
  // household members come from Timeline's household-category cards, each just a
  // free-text description rather than structured name/relationship/age fields.
  function _timelineData() {
    const tl     = window.MeetingState?.get("timeline") || {};
    const events = tl.events || [];
    const clientAge = parseFloat(tl.age) || 0;

    const retirementEvent = events.find(e => e.category === "planning" && /retirement/i.test(e.description || ""));
    const retirementYear  = retirementEvent ? parseFloat(retirementEvent.year) : null;
    const retirementAge   = clientAge > 0 && retirementYear != null
      ? Math.round(clientAge + (retirementYear - _CURRENT_YEAR))
      : 65;

    const childEvents = events.filter(e => e.category === "household" && /child/i.test(e.description || ""));
    const childYears   = childEvents.map(e => parseFloat(e.year)).filter(y => !isNaN(y));
    const youngestChildAge = childYears.length ? _CURRENT_YEAR - Math.max(...childYears) : null;

    const householdMembers = events
      .filter(e => e.category === "household")
      .map(e => ({ name: e.name || e.description || "Dependent", relationship: "" }));

    // Spouse — the name captured on the Marriage card's second field — also
    // gets a Legacy Amounts row, appended after household members so existing
    // dependants' indices (and any amounts already ticked against them) don't
    // shift around.
    events
      .filter(e => e.category === "personal" && e.field2 === "name" && (e.name || "").trim())
      .forEach(e => householdMembers.push({ name: e.name, relationship: "Spouse" }));

    // Gross monthly income lives only on the "Current Job" Timeline card now
    // (Cashflow captures Net only) — shared via MtUI so this can't silently
    // drift apart from estate-planning.js's copy.
    const grossMonthly = MtUI.grossMonthlyFromTimeline();

    return { clientAge, retirementAge, youngestChildAge, householdMembers, grossMonthly };
  }

  function _getData() {
    const ep     = window.MeetingState?.get("estatePlanner")   || {};
    const budget = window.MeetingState?.get("budget")          || {};
    const td     = _timelineData();

    return {
      estateGap:         ep.estateGap           || 0,
      liabilityItems:    _getLiabilityItems(),
      totalExpenses:     budget.totalExpenses   || 0,
      surplus:           budget.surplus         || 0,
      grossMonthly:      td.grossMonthly,
      annualIncome:      td.grossMonthly * 12,
      clientAge:          td.clientAge,
      retirementAge:      td.retirementAge,
      youngestChildAge:   td.youngestChildAge,
      householdMembers:   td.householdMembers,
    };
  }

  // ── State ──────────────────────────────────────────────────────────────────

  let _life, _dis, _funeral, _ip, _dread, _open, _activeTab;

  // Priority order for the two draggable lists — pillar keys for Risk, Timeline
  // goal ids (as strings) for Investments. _investAlloc holds each goal's
  // wrapper + monthly contribution, and _investOpen its collapse state, both
  // keyed by the same goal id string. _riskAlloc is one combined monthly
  // premium figure for all 4 pillars — real premiums are quoted as one
  // package, not broken out per pillar, so there's no per-card equivalent.
  let _riskOrder, _investOrder, _investAlloc, _investOpen, _riskAlloc;

  // "Apply Existing Cover" per pillar — _existingApply[pillar][policyKey] is
  // true when that policy's cover for this pillar has been ticked in (counts
  // toward the have-offset); absent/false means it's excluded, which is the
  // default — nothing counts until the FA reviews and applies it.
  // _existingOpen tracks each pillar's subsection collapse state.
  let _existingApply, _existingOpen;

  // Life cover: category-based income replacement
  const _LIFE_IR_DEFAULTS = () => ({
    open:          false,
    checked:       true,         // whether this need is included at all
    yearsMode:     "retirement", // "dep21" | "retirement" | "whole"
    yearsOverride: null,         // set when FA types manually; nulled when toggle clicked
    pct:           LIFE_IR_PCT_DEFAULT, // % of total expenses to replace
  });

  const _LIFE_DEFAULTS = () => ({
    incomeRep:    _LIFE_IR_DEFAULTS(),
    liabilities:  { open: false, items: {} },   // Liabilities
    estatePlan:   { open: false, items: {} },    // Estate Plan (gap + disposal + funeral)
    householdOpen: false,                                         // Household
    legacy:        { open: false, goalIds: {}, dependants: {} }, // Funded Goals (Timeline)
  });

  // Disability: salary multiple (once-off capital costs), with liabilities as
  // an optional precision add-on — same shape as Dread Disease.
  const _DIS_DEFAULTS = () => ({
    checked:        true,
    multiplier:     DIS_MULT_DEFAULT,
    override:       null, // manual Rand override — takes precedence over multiplier × income
    multiplierOpen: false,
    liabilities:    { open: false, items: {} },
  });

  // Dread disease: salary multiple, with liabilities as an optional precision add-on
  const _DREAD_DEFAULTS = () => ({
    checked:        true,
    multiplier:     DREAD_MULT_DEFAULT,
    override:       null, // manual Rand override — takes precedence over multiplier × income
    multiplierOpen: false,
    liabilities:    { open: false, items: {} },
  });

  function _initState() {
    _activeTab = "life";
    _open      = { life: false, dis: false, ip: false, dread: false, funeral: false };
    _life      = _LIFE_DEFAULTS();
    _dis       = _DIS_DEFAULTS();
    _dread     = _DREAD_DEFAULTS();
    _funeral   = {
      funeral:        { checked: false, amount: 0 },
      repatriation:   { checked: false, amount: 0 },
      familyMembers:  { checked: false, amount: 0 },
      tombstone:      { checked: false, amount: 0 },
    };
    _ip = { checked: true, pct: IP_PCT_DEFAULT, open: false };
    _riskOrder   = _PILLARS.map(p => p.key);
    _investOrder = [];
    _investAlloc = {};
    _investOpen  = {};
    _riskAlloc   = "";
    _existingApply = { life: {}, dis: {}, dread: {}, ip: {} };
    _existingOpen     = { life: false, dis: false, dread: false, ip: false };
  }

  // ── Totals ─────────────────────────────────────────────────────────────────

  function _lifeIRYears(d) {
    const ir = _life.incomeRep;
    if (ir.yearsOverride != null) return ir.yearsOverride;
    if (ir.yearsMode === "dep21")      return d.youngestChildAge != null ? Math.max(0, 21 - d.youngestChildAge) : 20;
    if (ir.yearsMode === "retirement") return d.clientAge > 0 ? Math.max(0, d.retirementAge - d.clientAge) : 20;
    if (ir.yearsMode === "whole")      return d.clientAge > 0 ? Math.max(0, 100 - d.clientAge) : 80;
    return 20;
  }

  // Blended income-replacement monthly figure — a single percentage of total
  // household expenses rather than a category-by-category budget picker,
  // since claiming to know exactly which costs survive a death (75% of
  // groceries but 0% of the gym) is false precision, not a real conversation.
  // "Raw" always computes the figure for display; the checked version feeds
  // totals, zeroed out when the FA has unticked this need entirely.
  function _lifeIRMonthlyRaw(d) {
    return d.totalExpenses * (_life.incomeRep.pct / 100);
  }
  function _lifeIRMonthly(d) {
    return _life.incomeRep.checked ? _lifeIRMonthlyRaw(d) : 0;
  }

  function _lifeIRLump(d) {
    const years   = _lifeIRYears(d);
    const monthly = _lifeIRMonthly(d);
    return monthly > 0 ? monthly * 12 * years : 0;
  }

  // Income Protection insures a percentage of gross income (capped around
  // 75% by insurers as a moral-hazard limit) — built off income directly,
  // not total household expenses, to match how the policy is underwritten.
  function _ipMonthlyRaw(d) {
    return d.grossMonthly * (_ip.pct / 100);
  }
  function _ipMonthly(d) {
    return _ip.checked ? _ipMonthlyRaw(d) : 0;
  }

  // Sourced from Timeline's Planning-event "amount" cards (future goals still
  // to be funded) instead of the (removed) Investment Goals tool — Past events
  // are excluded since they're historical record, not something to fund or
  // protect. Strictly "planning" only — a card left over from before the
  // Past/Planning split (still tagged "life") won't show up here until it's
  // re-added under the correct category.
  function _investmentGoals() {
    const events = window.MeetingState?.get("timeline")?.events || [];
    return events
      .filter(e => e.category === "planning" && e.field === "amount" && _parseMoney(e.lumpSum) > 0)
      .map(e => ({ id: String(e.id), name: e.description, lumpSum: e.lumpSum, year: e.year }));
  }

  // Merges live Timeline goals into the persisted priority order — keeps
  // existing rank, appends newly-captured goals at the end, drops ids for
  // goals that no longer exist (deleted or zeroed on the Timeline).
  function _orderedInvestGoals() {
    const goals = _investmentGoals();
    const byId  = new Map(goals.map(g => [g.id, g]));
    const known = new Set();
    const ordered = [];
    _investOrder.forEach(id => {
      const g = byId.get(id);
      if (g) { ordered.push(g); known.add(id); }
    });
    goals.forEach(g => { if (!known.has(g.id)) ordered.push(g); });
    _investOrder = ordered.map(g => g.id);
    return ordered;
  }

  function _investAllocTotal(goals) {
    return goals.reduce((s, g) => s + _parseMoney((_investAlloc[g.id] || {}).monthly), 0);
  }

  function _lifeDepTotal() {
    return Object.values(_life.legacy.dependants || {}).reduce((s, v) => s + (v?.checked ? (parseFloat(v.amount) || 0) : 0), 0);
  }

  function _legacyTotalFor(goalIds) {
    return _investmentGoals()
      .filter(g => goalIds[g.id])
      .reduce((s, g) => s + _parseMoney(g.lumpSum), 0);
  }

  function _legacyTotal() { return _legacyTotalFor(_life.legacy.goalIds); }

  function _liabilitiesTotal(liabState, d) {
    return d.liabilityItems.reduce((sum, item) => sum + (liabState.items[item.key] ? item.balance : 0), 0);
  }

  // Estate gap is already (executor fee + master's fee + estate duty + funeral
  // + CGT) minus liquid assets — funeral/executor/master/CGT are only ever
  // shown here for context elsewhere, never as separate fundable items, since
  // ticking them alongside Estate gap would double-count costs already netted
  // into it.
  function _estatePlanTotal(epState, d) {
    return epState.items.estateGap ? d.estateGap : 0;
  }

  function _lifeTotal(d) {
    return _lifeIRLump(d)
      + _liabilitiesTotal(_life.liabilities, d)
      + _estatePlanTotal(_life.estatePlan, d)
      + _legacyTotal()
      + _lifeDepTotal();
  }

  // "Raw" is always the pure multiplier × income calc (used as the money
  // cell's placeholder so the FA can see what the multiplier alone implies);
  // the effective amount prefers a manual override when one's been typed
  // directly into the money cell instead.
  function _disMultiplierAmtRaw(d) {
    return (_dis.multiplier || 0) * d.annualIncome;
  }
  function _disMultiplierAmt(d) {
    if (!_dis.checked) return 0;
    return _dis.override ?? _disMultiplierAmtRaw(d);
  }

  function _disTotal(d) {
    return _disMultiplierAmt(d) + _liabilitiesTotal(_dis.liabilities, d);
  }

  function _dreadMultiplierAmtRaw(d) {
    return (_dread.multiplier || 0) * d.annualIncome;
  }
  function _dreadMultiplierAmt(d) {
    if (!_dread.checked) return 0;
    return _dread.override ?? _dreadMultiplierAmtRaw(d);
  }

  function _dreadTotal(d) {
    return _dreadMultiplierAmt(d) + _liabilitiesTotal(_dread.liabilities, d);
  }

  function _funeralTotal() {
    return Object.values(_funeral).reduce((t, v) => t + (v.checked ? v.amount : 0), 0);
  }

  function _pillarTotal(pillar, d) {
    if (pillar === "life")  return _lifeTotal(d);
    if (pillar === "dis")   return _disTotal(d);
    if (pillar === "ip")    return _ipMonthly(d);
    if (pillar === "dread") return _dreadTotal(d);
    return 0;
  }

  // ── CSS ────────────────────────────────────────────────────────────────────

  // Every component here is the shared .mt-primary / .mt-secondary / .mt-tertiary
  // vocabulary from meeting-shared.css — Pillar (Primary) → Budget/Liabilities/
  // Estate Plan/etc (Secondary, .mt-primary--nested) → item row (Tertiary,
  // .mt-secondary). All that's left to define locally is column widths for each
  // row shape, same as every other tool's own *-grid classes.
  function _injectCSS() {
    if (document.getElementById("cn-css")) return;
    const s = document.createElement("style");
    s.id = "cn-css";
    s.textContent = `
      .cn-wrapper {
        flex: 1; min-height: 0; min-width: 0; overflow: hidden;
        display: flex; flex-direction: column;
        background: rgba(255,255,255,0.55);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        border-radius: var(--panel-radius);
        border: 1px solid rgba(255,255,255,0.8);
        box-shadow: 0 15px 35px rgba(0,0,0,0.05);
        color: var(--navy-3); padding: 1.25rem 1.25rem 0;
      }
      .cn-pane {
        flex: 1; min-height: 0; overflow-y: auto;
        display: flex; flex-direction: column; gap: 1rem;
        padding: 1rem 0.1rem 2rem;
        scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.1) transparent;
      }

      /* ── Row grids — column widths only; rows/cells are shared .mt-secondary* ── */
      .cn-row3-grid {
        display: grid; gap: 0.35rem; align-items: center;
        grid-template-columns: 20px 1fr 115px;
      }
      .cn-mult-grid {
        display: grid; gap: 0.35rem; align-items: center;
        grid-template-columns: 20px 1fr 90px 115px;
      }

      /* ── Life cover years toggle row (layout glue, not a component) ── */
      .cn-ir-meta-row {
        display: flex; align-items: center; gap: 0.55rem;
        margin: -0.65rem -0.85rem 0.65rem;
        padding: 0.5rem 0.85rem;
        font-family: var(--fb); font-size: 0.72rem; color: var(--navy-5);
        border-bottom: 1px solid rgba(0,0,0,0.06);
        background: rgba(0,0,0,0.01);
      }

      /* ── Investments | Risk two-column layout (layout glue, not a component) ── */
      .cn-cols {
        display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;
        align-items: start;
      }
      .cn-col-list {
        display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.4rem;
      }
      .cn-col-hdr {
        display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      }

      /* ── Draggable pillar/goal card headers — the shared .mt-primary-hdr's
         justify-content:space-between spreads 3 children (handle/title/sum)
         evenly, floating the title toward the middle instead of sitting left
         next to the handle. Override to a plain left-to-right flow with the
         sum pushed to the end, so it reads handle → label → total → arrow. ── */
      .mt-primary-hdr:has(.mt-drag-handle) {
        justify-content: flex-start;
      }
      .mt-primary-hdr:has(.mt-drag-handle) .mt-primary-right {
        margin-left: auto;
      }

      /* ── Muted subsection — kept visible with an empty-state note rather
         than disappearing (e.g. Apply Existing Cover with nothing to
         apply), just faded to signal there's nothing active here yet. ── */
      .cn-sec-muted > .mt-primary-hdr {
        opacity: 0.5;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Shared-vocabulary row helpers (checkbox, plain row, money cells) ───────

  function _chk(attrs) {
    return `<input type="checkbox" style="width:14px;height:14px;accent-color:var(--navy-3);flex-shrink:0" ${attrs}>`;
  }

  function _row3HTML(checkboxHTML, label, moneyHTML) {
    return `<div class="mt-secondary" style="display:contents">
      <div class="mt-secondary-cell" style="display:flex;align-items:center">${checkboxHTML}</div>
      <div class="mt-secondary-cell" style="font-family:var(--fb);font-size:0.8rem;color:var(--navy-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
      ${moneyHTML}
    </div>`;
  }

  function _moneyCellRO(amount, dim, dataAttrs = "") {
    return `<div class="mt-secondary-cell mt-money-wrap" style="opacity:${dim ? "0.35" : "1"};pointer-events:none">
      <span class="mt-pfx">R</span>
      <input class="mt-input-sm" type="text" readonly tabindex="-1" ${dataAttrs} value="${amount > 0 ? _fmtNum(amount) : "—"}">
    </div>`;
  }

  function _moneyCellEdit(value, placeholder, dataAttrs = "", dim = false) {
    return `<div class="mt-secondary-cell mt-money-wrap" style="opacity:${dim ? "0.35" : "1"}">
      <span class="mt-pfx">R</span>
      <input class="mt-input-sm" type="text" inputmode="numeric" ${dataAttrs}
        value="${value ?? ""}" placeholder="${placeholder}">
    </div>`;
  }

  function _emptyNote(text) {
    return `<div style="padding:0.35rem 0.1rem 0.4rem;font-family:var(--fb);font-size:0.72rem;color:var(--navy-5);opacity:0.45;font-style:italic">${text}</div>`;
  }

  // ── HTML helpers ───────────────────────────────────────────────────────────

  // A subsection within a pillar (Budget, Liabilities, Estate Plan, etc.) —
  // same .mt-primary component as the pillar itself, indented one level via .mt-primary--nested,
  // rather than a second bespoke nesting style.
  function _nestedSecHTML(key, title, amount, open, bodyHTML, extraClass = "") {
    return `<div class="mt-primary mt-primary--nested${open ? "" : " collapsed"}${extraClass ? ` ${extraClass}` : ""}" data-subsec="${key}">
      <div class="mt-primary-hdr" data-subsec-toggle="${key}">
        <span class="mt-primary-title">${title}</span>
        <div class="mt-primary-right">
          <span class="mt-primary-sum" data-subsec-sum="${key}">${amount > 0 ? _fmt(amount) : "—"}</span>
          <span class="mt-chev"></span>
        </div>
      </div>
      <div class="mt-primary-body">${bodyHTML}</div>
    </div>`;
  }

  function _updSubsecSum(w, key, amount) {
    const el = w.querySelector(`[data-subsec-sum="${key}"]`);
    if (el) el.textContent = amount > 0 ? _fmt(amount) : "—";
  }

function _lifeIRHTML(d) {
    const ir      = _life.incomeRep;
    const togDim  = ir.yearsOverride != null;
    const noDep21 = d.youngestChildAge == null;
    const body = `
      <div class="cn-ir-meta-row">
        <div class="mt-toggle" style="${togDim ? "opacity:0.35;pointer-events:none" : ""}">
          <button class="mt-toggle-btn${ir.yearsMode === "dep21" && !togDim ? " active" : ""}"${noDep21 ? " disabled title=\"No household cards on the Timeline\"" : ""} data-life-years-mode="dep21">Until Dep 21</button>
          <button class="mt-toggle-btn${ir.yearsMode === "retirement" && !togDim ? " active" : ""}" data-life-years-mode="retirement">Until Retirement</button>
          <button class="mt-toggle-btn${ir.yearsMode === "whole"      && !togDim ? " active" : ""}" data-life-years-mode="whole">Whole of Life</button>
        </div>
        <span style="flex:1"></span>
        <span style="opacity:0.5;font-size:0.7rem">Coverage:</span>
        <input type="number" class="mt-input-sm" style="width:44px;height:26px;text-align:center;padding:0 4px" id="cn-life-years-override"
               value="${ir.yearsOverride ?? _lifeIRYears(d)}" min="1" max="100">
        <span style="color:var(--navy-5);font-family:var(--fb);font-size:0.74rem">yrs</span>
      </div>
      <div class="cn-mult-grid">
        <div class="mt-secondary-cell" style="display:flex;align-items:center">${_chk(`data-pillar="life" data-need-check${ir.checked ? " checked" : ""}`)}</div>
        <div class="mt-secondary-cell" style="font-family:var(--fb);font-size:0.8rem;color:var(--navy-3)">Income replacement <span style="opacity:0.5;font-weight:400">of R ${_fmtNum(d.totalExpenses)}/mo expenses</span></div>
        <div class="mt-secondary-cell mt-pct-wrap">
          <input class="mt-input-sm" type="text" inputmode="numeric" id="cn-life-ir-pct-inp" value="${ir.pct}">
          <span class="mt-sfx">%</span>
        </div>
        ${_moneyCellRO(_lifeIRMonthlyRaw(d), !ir.checked, "data-life-ir-monthly")}
      </div>`;

    return _nestedSecHTML("life-ir", "1. Income Replacement", _lifeIRLump(d), ir.open, body);
  }

  function _lifeEstatePlanSecHTML(d) {
    const ep = _life.estatePlan;
    const allItems = d.estateGap > 0 ? [{ key: "estateGap", label: "Estate gap", amount: d.estateGap }] : [];

    const rows = allItems.length === 0
      ? _emptyNote("Nothing from Estate Planner yet")
      : `<div class="cn-row3-grid">${allItems.map(item => {
          const checked = !!ep.items[item.key];
          return _row3HTML(
            _chk(`data-pillar="life" data-ep-key="${item.key}"${checked ? " checked" : ""}`),
            item.label,
            _moneyCellRO(item.amount, !checked, `data-ep-amt="${item.key}"`),
          );
        }).join("")}</div>`;

    return _nestedSecHTML("life-ep", "3. Estate Plan", _estatePlanTotal(ep, d), ep.open, rows);
  }

  // Always rendered, even with nothing to apply — a muted empty state
  // beats the section disappearing outright. titlePrefix is only used by
  // the Life pillar's numbered ordering — other pillars call this unprefixed.
  function _existingCoverSecHTML(pillar, titlePrefix = "") {
    const items = _existingPoliciesFor(pillar);
    const applyMap = _existingApply[pillar] || (_existingApply[pillar] = {});
    const kept = items.reduce((s, p) => s + (applyMap[p.key] ? p.cover : 0), 0);
    const rows = items.length === 0
      ? _emptyNote("No policies in Existing Policies yet")
      : `<div class="cn-row3-grid">${items.map(item => {
          const applying = !!applyMap[item.key];
          return _row3HTML(
            _chk(`data-pillar="${pillar}" data-existing-key="${item.key}"${applying ? " checked" : ""}`),
            item.label,
            _moneyCellRO(item.cover, !applying, `data-existing-amt="${item.key}"`),
          );
        }).join("")}</div>`;
    return _nestedSecHTML(`${pillar}-existing`, `${titlePrefix}Apply Existing Cover`, kept, _existingOpen[pillar], rows, items.length === 0 ? "cn-sec-muted" : "");
  }

  // titlePrefix is only used by the Life pillar's numbered ordering — other
  // pillars call this unprefixed.
  function _liabilitySecHTML(liabState, pillar, d, titlePrefix = "") {
    const items = d.liabilityItems;
    const rows = items.length === 0
      ? _emptyNote("Nothing from Existing Portfolio yet")
      : `<div class="cn-row3-grid">${[...items].sort((a, b) => a.label.localeCompare(b.label)).map(item => {
          const checked = !!liabState.items[item.key];
          return _row3HTML(
            _chk(`data-pillar="${pillar}" data-liab-key="${item.key}"${checked ? " checked" : ""}`),
            item.label,
            _moneyCellRO(item.balance, !checked, `data-liab-amt="${pillar}-${item.key}"`),
          );
        }).join("")}</div>`;
    return _nestedSecHTML(`${pillar}-liab`, `${titlePrefix}Liabilities`, _liabilitiesTotal(liabState, d), liabState.open, rows);
  }

  function _lifeHouseholdSecHTML(d) {
    const members = d.householdMembers || [];
    const rows    = members.length === 0
      ? _emptyNote("No household cards on the Timeline yet")
      : `<div class="cn-row3-grid">${members.map((m, i) => {
          const key   = `dep-${i}`;
          const entry = _life.legacy.dependants[key] || { checked: false, amount: 0 };
          return _row3HTML(
            _chk(`data-pillar="life" data-dep-legacy-check="${key}"${entry.checked ? " checked" : ""}`),
            m.name,
            _moneyCellEdit(entry.amount > 0 ? entry.amount : "", "0", `data-dep-legacy="${key}"`),
          );
        }).join("")}</div>`;
    return _nestedSecHTML("life-hh", "5. Legacy Amounts", _lifeDepTotal(), _life.householdOpen, rows);
  }

  function _lifeInvestmentGoalsHTML(d) {
    const goals = _investmentGoals();
    const rows = goals.length === 0
      ? _emptyNote("No funded goals on the Timeline yet")
      : `<div class="cn-row3-grid">${[...goals].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((g, i) => {
          const checked = !!_life.legacy.goalIds[g.id];
          const amt     = _parseMoney(g.lumpSum);
          return _row3HTML(
            _chk(`data-pillar="life" data-legacy-goal="${g.id}"${checked ? " checked" : ""}`),
            g.name || `Goal ${i + 1}`,
            _moneyCellRO(amt, !checked, `data-legacy-amt="${g.id}"`),
          );
        }).join("")}</div>`;
    return _nestedSecHTML("life-goals", "4. Funded Goals", _legacyTotal(), _life.legacy.open, rows);
  }

  function _lifeItemsHTML(d) {
    return `
      ${_lifeIRHTML(d)}
      ${_liabilitySecHTML(_life.liabilities, "life", d, "2. ")}
      ${_lifeEstatePlanSecHTML(d)}
      ${_lifeInvestmentGoalsHTML(d)}
      ${_lifeHouseholdSecHTML(d)}
      ${_existingCoverSecHTML("life", "6. ")}`;
  }

  function _disMultiplierSecHTML(d) {
    const mult = _dis.multiplier;
    const raw  = _disMultiplierAmtRaw(d);
    const body = `<div class="cn-mult-grid">
      <div class="mt-secondary-cell" style="display:flex;align-items:center">${_chk(`data-pillar="dis" data-need-check${_dis.checked ? " checked" : ""}`)}</div>
      <div class="mt-secondary-cell" style="font-family:var(--fb);font-size:0.8rem;color:var(--navy-3)">Annual Cover Multiple</div>
      <div class="mt-secondary-cell mt-pct-wrap">
        <input class="mt-input-sm" type="text" inputmode="decimal" id="cn-dis-mult-inp" value="${mult.toFixed(1)}">
        <span class="mt-sfx">x</span>
      </div>
      ${_moneyCellEdit(_dis.override != null ? Math.round(_dis.override) : (raw > 0 ? Math.round(raw) : ""), Math.round(raw) || 0, "data-dis-mult-amt", !_dis.checked)}
    </div>`;
    return _nestedSecHTML("dis-mult", "1. Cover Multiple", _disMultiplierAmt(d), _dis.multiplierOpen, body);
  }

  function _disItemsHTML(d) {
    return `
      ${_disMultiplierSecHTML(d)}
      ${_liabilitySecHTML(_dis.liabilities, "dis", d, "2. ")}
      ${_existingCoverSecHTML("dis", "3. ")}`;
  }

  function _dreadMultiplierSecHTML(d) {
    const mult = _dread.multiplier;
    const raw  = _dreadMultiplierAmtRaw(d);
    const body = `<div class="cn-mult-grid">
      <div class="mt-secondary-cell" style="display:flex;align-items:center">${_chk(`data-pillar="dread" data-need-check${_dread.checked ? " checked" : ""}`)}</div>
      <div class="mt-secondary-cell" style="font-family:var(--fb);font-size:0.8rem;color:var(--navy-3)">Annual Cover Multiple</div>
      <div class="mt-secondary-cell mt-pct-wrap">
        <input class="mt-input-sm" type="text" inputmode="decimal" id="cn-dread-mult-inp" value="${mult.toFixed(1)}">
        <span class="mt-sfx">x</span>
      </div>
      ${_moneyCellEdit(_dread.override != null ? Math.round(_dread.override) : (raw > 0 ? Math.round(raw) : ""), Math.round(raw) || 0, "data-dread-mult-amt", !_dread.checked)}
    </div>`;
    return _nestedSecHTML("dread-mult", "1. Cover Multiple", _dreadMultiplierAmt(d), _dread.multiplierOpen, body);
  }

  function _dreadItemsHTML(d) {
    return `
      ${_dreadMultiplierSecHTML(d)}
      ${_liabilitySecHTML(_dread.liabilities, "dread", d, "2. ")}
      ${_existingCoverSecHTML("dread", "3. ")}`;
  }

  // ── HTML builders ──────────────────────────────────────────────────────────

  // ── Pillar sections (Life / Disability / Dread / Income Protection) ────────

  const _PILLARS = [
    { key: "life",  label: "Life Cover",        monthly: false },
    { key: "dis",   label: "Capital Disability", monthly: false },
    { key: "dread", label: "Dread Disease",      monthly: false },
    { key: "ip",    label: "Income Protection",  monthly: true  },
  ];

  function _ipContentHTML(d) {
    const body = `<div class="cn-mult-grid">
      <div class="mt-secondary-cell" style="display:flex;align-items:center">${_chk(`data-pillar="ip" data-need-check${_ip.checked ? " checked" : ""}`)}</div>
      <div class="mt-secondary-cell" style="font-family:var(--fb);font-size:0.8rem;color:var(--navy-3)">Income replacement <span style="opacity:0.5;font-weight:400">of R ${_fmtNum(d.grossMonthly)}/mo gross</span></div>
      <div class="mt-secondary-cell mt-pct-wrap">
        <input class="mt-input-sm" type="text" inputmode="numeric" id="cn-ip-pct-inp" value="${_ip.pct}">
        <span class="mt-sfx">%</span>
      </div>
      ${_moneyCellRO(_ipMonthlyRaw(d), !_ip.checked, "data-ip-amt")}
    </div>`;
    return `
      ${_nestedSecHTML("ip-budget", "1. Income Replacement", _ipMonthly(d), _ip.open, body)}
      ${_existingCoverSecHTML("ip", "2. ")}`;
  }

  function _pillarBodyHTML(pillar, d) {
    if (pillar === "life")  return _lifeItemsHTML(d);
    if (pillar === "dis")   return _disItemsHTML(d);
    if (pillar === "ip")    return _ipContentHTML(d);
    if (pillar === "dread") return _dreadItemsHTML(d);
    return "";
  }

  function _pillarSecHTML(p, d) {
    const needs = _pillarTotal(p.key, d);
    const have  = _haveTotal(p.key);
    const net   = Math.max(0, needs - have);
    const sfx   = p.monthly ? "/mo" : "";
    const text  = net > 0 ? _fmt(net) + sfx : "—";
    const open  = !!_open[p.key];
    return `<div class="mt-primary${!open ? " collapsed" : ""}" data-pillar-sec="${p.key}">
      <div class="mt-primary-hdr" data-pillar-toggle="${p.key}">
        <div class="mt-drag-handle" style="flex-shrink:0;height:auto;margin-right:0.35rem" draggable="true">⠿</div>
        <span class="mt-primary-title">${p.label}</span>
        <div class="mt-primary-right">
          <span class="mt-primary-sum" data-tab-total="${p.key}">${text}</span>
          <span class="mt-chev"></span>
        </div>
      </div>
      <div class="mt-primary-body">${_pillarBodyHTML(p.key, d)}</div>
    </div>`;
  }

  // ── Investments list (Timeline goals — wrapper + monthly contribution) ─────

  function _investCardHTML(g) {
    const alloc  = _investAlloc[g.id] || { wrapper: "", lumpSum: "", monthly: "" };
    const wrapperOpts = WRAPPER_TYPES.map(t => `<option value="${t}"${alloc.wrapper === t ? " selected" : ""}>${t}</option>`).join("");
    const open   = !!_investOpen[g.id];
    const needed = _parseMoney(g.lumpSum);
    // Retirement Funding captures a monthly income need on Timeline (see its
    // "Net amount needed pm" placeholder), not a once-off lump sum like every
    // other planning goal — flag it here too so the figure isn't misread.
    const isMonthly = /retirement/i.test(g.name || "");
    return `<div class="mt-primary${open ? "" : " collapsed"}" data-invest-id="${g.id}">
      <div class="mt-primary-hdr" data-invest-toggle="${g.id}">
        <div class="mt-drag-handle" style="flex-shrink:0;height:auto;margin-right:0.35rem" draggable="true">⠿</div>
        <span class="mt-primary-title">${g.name || "Goal"}</span>
        <div class="mt-primary-right">
          <span class="mt-primary-sum">${needed > 0 ? _fmt(needed) + (isMonthly ? "/mo" : "") : "—"}</span>
          <span class="mt-chev"></span>
        </div>
      </div>
      <div class="mt-primary-body" style="flex-direction:row;flex-wrap:wrap">
        <select class="mt-select-sm" data-invest-field="wrapper" style="flex:1;min-width:120px">
          <option value="">Wrapper</option>
          ${wrapperOpts}
        </select>
        <div class="mt-money-wrap" style="flex:0 0 140px">
          <span class="mt-pfx">R</span>
          <input class="mt-input-sm" type="text" inputmode="numeric" data-invest-field="lumpSum"
            value="${alloc.lumpSum || ""}" placeholder="Lump sum">
        </div>
        <div class="mt-money-wrap" style="flex:0 0 140px">
          <span class="mt-pfx">R</span>
          <input class="mt-input-sm" type="text" inputmode="numeric" data-invest-field="monthly"
            value="${alloc.monthly || ""}" placeholder="Monthly">
        </div>
      </div>
    </div>`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function _render(w) {
    const d         = _getData();
    const riskList  = w.querySelector("#cn-risk-list");
    const investList = w.querySelector("#cn-invest-list");
    if (!riskList || !investList) return;

    const pillarsByKey = Object.fromEntries(_PILLARS.map(p => [p.key, p]));
    riskList.innerHTML = _riskOrder.map(key => _pillarSecHTML(pillarsByKey[key], d)).join("");

    const goals = _orderedInvestGoals();
    investList.innerHTML = goals.length
      ? goals.map(_investCardHTML).join("")
      : _emptyNote("No financial goals on the Timeline yet");

    riskList.querySelectorAll("[data-indet='true']").forEach(cb => { cb.indeterminate = true; });

    const investTotal = _investAllocTotal(goals);
    const totalEl = w.querySelector("#cn-invest-total");
    if (totalEl) totalEl.value = _fmtNum(investTotal);
    _updateHero(w, d, investTotal);
  }

  // ── Hero ───────────────────────────────────────────────────────────────────

  function _updateHero(w, d, investTotal) {
    if (!window.CalcHero) return;
    const riskTotal = _parseMoney(_riskAlloc);
    const allocated = riskTotal + investTotal;
    const remaining = d.surplus - allocated;
    CalcHero.update({
      primaries: [{ id: "cn-hero-remaining", value: Math.abs(remaining) }],
      secondaries: [
        { id: "cn-hero-surplus",   value: d.surplus },
        { id: "cn-hero-allocated", value: allocated },
      ],
    }, w);
    const remEl = w.querySelector("#cn-hero-remaining");
    if (remEl) remEl.style.color = remaining < 0 ? "#ef4444" : "#fff";
  }

  // ── Targeted update helpers ────────────────────────────────────────────────

  function _updTabTotal(w, pillar, d) {
    const el = w?.querySelector(`[data-tab-total="${pillar}"]`);
    if (!el) return;
    const monthly  = pillar === "ip";
    const needs    = _pillarTotal(pillar, d);
    const have     = _haveTotal(pillar);
    const net      = Math.max(0, needs - have);
    const sfx      = monthly ? "/mo" : "";
    el.textContent = net > 0 ? _fmt(net) + sfx : "—";
  }

  function _updLifeIR(w, d) {
    const raw   = _lifeIRMonthlyRaw(d);
    const amtEl = w.querySelector("[data-life-ir-monthly]");
    if (amtEl) {
      amtEl.value = raw > 0 ? _fmtNum(raw) : "—";
      amtEl.closest(".mt-money-wrap").style.opacity = _life.incomeRep.checked ? "1" : "0.35";
    }
    _updSubsecSum(w, "life-ir", _lifeIRLump(d));
    _updTabTotal(w, "life", d);
  }

  function _updDreadMultiplier(w, d) {
    const shown = _dread.override ?? _dreadMultiplierAmtRaw(d);
    const amtEl = w.querySelector("[data-dread-mult-amt]");
    if (amtEl) {
      amtEl.value = shown > 0 ? _fmtNum(shown) : "—";
      amtEl.closest(".mt-money-wrap").style.opacity = _dread.checked ? "1" : "0.35";
    }
    _updSubsecSum(w, "dread-mult", _dreadMultiplierAmt(d));
    _updTabTotal(w, "dread", d);
  }

  function _updDisMultiplier(w, d) {
    const shown = _dis.override ?? _disMultiplierAmtRaw(d);
    const amtEl = w.querySelector("[data-dis-mult-amt]");
    if (amtEl) {
      amtEl.value = shown > 0 ? _fmtNum(shown) : "—";
      amtEl.closest(".mt-money-wrap").style.opacity = _dis.checked ? "1" : "0.35";
    }
    _updSubsecSum(w, "dis-mult", _disMultiplierAmt(d));
    _updTabTotal(w, "dis", d);
  }

  function _updIP(w, d) {
    const raw   = _ipMonthlyRaw(d);
    const amtEl = w.querySelector("[data-ip-amt]");
    if (amtEl) {
      amtEl.value = raw > 0 ? _fmtNum(raw) : "—";
      amtEl.closest(".mt-money-wrap").style.opacity = _ip.checked ? "1" : "0.35";
    }
    _updSubsecSum(w, "ip-budget", _ipMonthly(d));
    _updTabTotal(w, "ip", d);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  function _initEvents(w) {
    const pane = w.querySelector(".cn-pane");

    // Sets a subsection's open flag in whichever state object actually owns it —
    // used to force-close siblings when another subsection opens (accordion).
    function _setSubsecOpenState(key, open) {
      if (key === "life-hh")        _life.householdOpen = open;
      else if (key === "dread-mult") _dread.multiplierOpen = open;
      else if (key === "dis-mult")   _dis.multiplierOpen = open;
      else if (key === "ip-budget")  _ip.open = open;
      else if (key.endsWith("-existing")) _existingOpen[key.slice(0, -"-existing".length)] = open;
      else {
        const stateObj = {
          "life-liab":  _life.liabilities,
          "life-ir":    _life.incomeRep,
          "life-ep":    _life.estatePlan,
          "life-goals": _life.legacy,
          "dis-liab":   _dis.liabilities,
          "dread-liab": _dread.liabilities,
        }[key];
        if (stateObj) stateObj.open = open;
      }
    }

    // Pillar / subsection / investment-card expand-collapse — accordion at every
    // level: opening one closes any other open section or subsection.
    pane.addEventListener("click", e => {
      if (e.target.closest("input") || e.target.closest("select") || e.target.closest(".mt-drag-handle")) return;

      const subHdr = e.target.closest("[data-subsec-toggle]");
      if (subHdr) {
        const key = subHdr.dataset.subsecToggle;
        const nestedEl = subHdr.closest(".mt-primary--nested");
        const wasOpen = !nestedEl?.classList.contains("collapsed");
        const pillarEl = subHdr.closest("[data-pillar-sec]");
        pillarEl?.querySelectorAll("[data-subsec-toggle]").forEach(hdr => {
          const k = hdr.dataset.subsecToggle;
          if (k === key) return;
          hdr.closest(".mt-primary--nested")?.classList.add("collapsed");
          _setSubsecOpenState(k, false);
        });
        const nowOpen = !wasOpen;
        _setSubsecOpenState(key, nowOpen);
        nestedEl?.classList.toggle("collapsed", !nowOpen);
        return;
      }

      const investHdr = e.target.closest("[data-invest-toggle]");
      if (investHdr) {
        const id = investHdr.dataset.investToggle;
        const wasOpen = _investOpen[id];
        Object.keys(_investOpen).forEach(k => { _investOpen[k] = false; });
        pane.querySelectorAll("[data-invest-id]").forEach(card => card.classList.add("collapsed"));
        _investOpen[id] = !wasOpen;
        investHdr.closest(".mt-primary")?.classList.toggle("collapsed", !_investOpen[id]);
        return;
      }

      const pillarHdr = e.target.closest("[data-pillar-toggle]");
      if (!pillarHdr) return;
      const key = pillarHdr.dataset.pillarToggle;
      const wasOpen = _open[key];
      Object.keys(_open).forEach(k => { _open[k] = false; });
      pane.querySelectorAll("[data-pillar-sec]").forEach(sec => sec.classList.add("collapsed"));
      _open[key] = !wasOpen;
      pillarHdr.closest(".mt-primary")?.classList.toggle("collapsed", !_open[key]);
    });

    // Checkbox changes
    pane.addEventListener("change", e => {
      const cb = e.target;
      if (cb.type !== "checkbox" || cb.dataset.pillar === undefined) return;
      const pillar = cb.dataset.pillar;
      const d      = _getData();

      // Enable/disable a whole percentage- or multiple-based need (Life
      // Income Replacement, Capital Disability / Dread Disease Cover
      // Multiple, Income Protection) — unticking excludes it from the
      // pillar total without losing the entered %/multiple or hiding the
      // computed figure, which just dims instead.
      if (cb.dataset.needCheck !== undefined) {
        if (pillar === "life")  { _life.incomeRep.checked = cb.checked; _updLifeIR(w, d); }
        if (pillar === "dis")   { _dis.checked            = cb.checked; _updDisMultiplier(w, d); }
        if (pillar === "dread") { _dread.checked          = cb.checked; _updDreadMultiplier(w, d); }
        if (pillar === "ip")    { _ip.checked             = cb.checked; _updIP(w, d); }
        _syncMeeting(d);
        return;
      }

      // Life cover: household legacy checkbox
      if (pillar === "life" && cb.dataset.depLegacyCheck !== undefined) {
        const key   = cb.dataset.depLegacyCheck;
        const entry = _life.legacy.dependants[key] || (_life.legacy.dependants[key] = { checked: false, amount: 0 });
        entry.checked = cb.checked;
        _updSubsecSum(w, "life-hh", _lifeDepTotal());
        _updTabTotal(w, "life", d);
        _syncMeeting(d);
        return;
      }

      // Funeral checkboxes
      if (pillar === "funeral") {
        _funeral[cb.dataset.key].checked = cb.checked;
        _syncMeeting(d);
        return;
      }

      // Apply Existing Cover checkbox — unticked (default) = excluded from the
      // pillar's have-offset; ticking it counts that policy toward the gap calc.
      if (cb.dataset.existingKey !== undefined) {
        const key = cb.dataset.existingKey;
        const applyMap = _existingApply[pillar] || (_existingApply[pillar] = {});
        applyMap[key] = cb.checked;
        w.querySelector(`[data-existing-amt="${key}"]`)?.closest(".mt-money-wrap").style.setProperty("opacity", cb.checked ? "1" : "0.35");
        const items = _existingPoliciesFor(pillar);
        const kept  = items.reduce((s, p) => s + (applyMap[p.key] ? p.cover : 0), 0);
        _updSubsecSum(w, `${pillar}-existing`, kept);
        _updTabTotal(w, pillar, d);
        _syncMeeting(d);
        return;
      }

      // Individual liability checkbox
      if (cb.dataset.liabKey !== undefined) {
        const base = pillar === "life" ? _life : pillar === "dis" ? _dis : _dread;
        base.liabilities.items[cb.dataset.liabKey] = cb.checked;
        w.querySelector(`[data-liab-amt="${pillar}-${cb.dataset.liabKey}"]`)?.closest(".mt-money-wrap").style.setProperty("opacity", cb.checked ? "1" : "0.35");
        _updSubsecSum(w, `${pillar}-liab`, _liabilitiesTotal(base.liabilities, d));
        _updTabTotal(w, pillar, d);
        _syncMeeting(d);
        return;
      }

      // Individual Estate Plan checkbox (life only)
      if (pillar === "life" && cb.dataset.epKey !== undefined) {
        _life.estatePlan.items[cb.dataset.epKey] = cb.checked;
        w.querySelector(`[data-ep-amt="${cb.dataset.epKey}"]`)?.closest(".mt-money-wrap").style.setProperty("opacity", cb.checked ? "1" : "0.35");
        _updSubsecSum(w, "life-ep", _estatePlanTotal(_life.estatePlan, d));
        _updTabTotal(w, "life", d);
        _syncMeeting(d);
        return;
      }

      // Life cover: individual investment goal checkbox
      if (pillar === "life" && cb.dataset.legacyGoal !== undefined) {
        const gid = cb.dataset.legacyGoal;
        _life.legacy.goalIds[gid] = cb.checked;
        w.querySelector(`[data-legacy-amt="${gid}"]`)?.closest(".mt-money-wrap").style.setProperty("opacity", cb.checked ? "1" : "0.35");
        _updSubsecSum(w, "life-goals", _legacyTotal());
        _updTabTotal(w, "life", d);
        _syncMeeting(d);
      }
    });

    // Input changes
    pane.addEventListener("input", e => {
      const inp = e.target;
      const d   = _getData();

      // Funeral flat inputs
      if (inp.dataset.pillar === "funeral") {
        _funeral[inp.dataset.key].amount = _parseMoney(inp.value);
        _syncMeeting(d);
        return;
      }

      // Life cover years — manual edit sets override and greys out toggle
      if (inp.id === "cn-life-years-override") {
        const v = parseInt(inp.value);
        _life.incomeRep.yearsOverride = v > 0 ? v : null;
        const tog = inp.closest(".cn-ir-meta-row")?.querySelector(".mt-toggle");
        if (tog) tog.style.opacity = _life.incomeRep.yearsOverride != null ? "0.35" : "";
        if (tog) tog.style.pointerEvents = _life.incomeRep.yearsOverride != null ? "none" : "";
        _updLifeIR(w, d);
        _syncMeeting(d);
        return;
      }

      // Dread multiplier — editing this clears any manual override, since
      // whichever field the FA is actively using should drive the number.
      if (inp.id === "cn-dread-mult-inp") {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) _dread.multiplier = Math.max(DREAD_MULT_MIN, Math.min(DREAD_MULT_MAX, v));
        _dread.override = null;
        _updDreadMultiplier(w, d);
        _syncMeeting(d);
        return;
      }

      // Disability multiplier — same "last edit wins" rule as Dread above.
      if (inp.id === "cn-dis-mult-inp") {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) _dis.multiplier = Math.max(DIS_MULT_MIN, Math.min(DIS_MULT_MAX, v));
        _dis.override = null;
        _updDisMultiplier(w, d);
        _syncMeeting(d);
        return;
      }

      // Dread / Disability cover amount — manual override, takes precedence
      // over multiplier × income until cleared (typing 0 or blanking it).
      if (inp.dataset.dreadMultAmt !== undefined) {
        const v = _parseMoney(inp.value);
        _dread.override = v > 0 ? v : null;
        _updSubsecSum(w, "dread-mult", _dreadMultiplierAmt(d));
        _updTabTotal(w, "dread", d);
        _syncMeeting(d);
        return;
      }
      if (inp.dataset.disMultAmt !== undefined) {
        const v = _parseMoney(inp.value);
        _dis.override = v > 0 ? v : null;
        _updSubsecSum(w, "dis-mult", _disMultiplierAmt(d));
        _updTabTotal(w, "dis", d);
        _syncMeeting(d);
        return;
      }

      // Life cover income-replacement percentage
      if (inp.id === "cn-life-ir-pct-inp") {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) _life.incomeRep.pct = Math.max(0, Math.min(100, v));
        _updLifeIR(w, d);
        _syncMeeting(d);
        return;
      }

      // Income Protection percentage (capped — insurers won't underwrite above this)
      if (inp.id === "cn-ip-pct-inp") {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) _ip.pct = Math.max(0, Math.min(IP_PCT_MAX, v));
        _updIP(w, d);
        _syncMeeting(d);
        return;
      }

      // Life cover household legacy amounts
      if (inp.dataset.depLegacy !== undefined) {
        const key   = inp.dataset.depLegacy;
        const v     = _parseMoney(inp.value);
        const entry = _life.legacy.dependants[key] || (_life.legacy.dependants[key] = { checked: false, amount: 0 });
        entry.amount = v > 0 ? v : 0;
        _updSubsecSum(w, "life-hh", _lifeDepTotal());
        _updTabTotal(w, "life", d);
        _syncMeeting(d);
        return;
      }
    });

    // Multiplier / percentage inputs — reformat on blur
    pane.addEventListener("focusout", e => {
      if (e.target.id === "cn-dread-mult-inp")   e.target.value = _dread.multiplier.toFixed(1);
      if (e.target.id === "cn-dis-mult-inp")     e.target.value = _dis.multiplier.toFixed(1);
      if (e.target.id === "cn-life-ir-pct-inp")  e.target.value = _life.incomeRep.pct;
      if (e.target.id === "cn-ip-pct-inp")       e.target.value = _ip.pct;
    });

    // Life cover years toggle — clicking a mode clears the manual override and re-activates toggle
    pane.addEventListener("click", e => {
      const btn = e.target.closest("[data-life-years-mode]");
      if (!btn || btn.disabled) return;
      const d = _getData();
      _life.incomeRep.yearsMode     = btn.dataset.lifeYearsMode;
      _life.incomeRep.yearsOverride = null;
      // Reset coverage input to computed value and un-dim toggle
      const overrideInp = pane.querySelector("#cn-life-years-override");
      if (overrideInp) overrideInp.value = _lifeIRYears(d);
      const tog = overrideInp?.closest(".cn-ir-meta-row")?.querySelector(".mt-toggle");
      if (tog) {
        tog.style.opacity = "";
        tog.style.pointerEvents = "";
        tog.querySelectorAll("button[data-life-years-mode]").forEach(b =>
          b.classList.toggle("active", b.dataset.lifeYearsMode === _life.incomeRep.yearsMode)
        );
      }
      _updLifeIR(w, d);
      _syncMeeting(d);
    });

    // Investment card wrapper / lump sum / monthly contribution
    pane.addEventListener("change", e => {
      if (e.target.dataset.investField !== "wrapper") return;
      const id = e.target.closest("[data-invest-id]")?.dataset.investId;
      if (!id) return;
      const alloc = _investAlloc[id] || (_investAlloc[id] = { wrapper: "", lumpSum: "", monthly: "" });
      alloc.wrapper = e.target.value;
      _syncMeeting(_getData());
    });
    pane.addEventListener("input", e => {
      if (e.target.id === "cn-risk-alloc") {
        _riskAlloc = e.target.value;
        const d = _getData();
        const goals = _orderedInvestGoals();
        _updateHero(w, d, _investAllocTotal(goals));
        _syncMeeting(d);
        return;
      }
      if (e.target.dataset.investField === "lumpSum") {
        const id = e.target.closest("[data-invest-id]")?.dataset.investId;
        if (!id) return;
        const alloc = _investAlloc[id] || (_investAlloc[id] = { wrapper: "", lumpSum: "", monthly: "" });
        alloc.lumpSum = e.target.value;
        _syncMeeting(_getData());
        return;
      }
      if (e.target.dataset.investField !== "monthly") return;
      const id = e.target.closest("[data-invest-id]")?.dataset.investId;
      if (!id) return;
      const alloc = _investAlloc[id] || (_investAlloc[id] = { wrapper: "", lumpSum: "", monthly: "" });
      alloc.monthly = e.target.value;
      const d = _getData();
      const goals = _orderedInvestGoals();
      const investTotal = _investAllocTotal(goals);
      const totalEl = pane.querySelector("#cn-invest-total");
      if (totalEl) totalEl.value = _fmtNum(investTotal);
      _updateHero(w, d, investTotal);
      _syncMeeting(d);
    });

    // Drag-to-rank — Risk pillars and Investment goals, each within their own list
    _wireDragReorder(w.querySelector("#cn-risk-list"), "data-pillar-sec", () => _riskOrder, () => _render(w));
    _wireDragReorder(w.querySelector("#cn-invest-list"), "data-invest-id", () => _investOrder, () => _render(w));
  }

  // Generic drag-to-reorder for a flat list of .mt-primary cards, each carrying
  // a .mt-drag-handle and a unique idAttr. Mutates the order array in place via
  // splice so callers can hold a stable reference across re-renders.
  function _wireDragReorder(container, idAttr, getOrder, onChange) {
    if (!container) return;
    let dragId = null, dropId = null, dropPos = null;

    function clearUI() {
      container.querySelectorAll(".mt-drag-handle.mt-drag-dragging").forEach(h => h.classList.remove("mt-drag-dragging"));
      container.querySelectorAll(`[${idAttr}].mt-drop-card-before, [${idAttr}].mt-drop-card-after`).forEach(row =>
        row.classList.remove("mt-drop-card-before", "mt-drop-card-after")
      );
    }

    container.addEventListener("dragstart", e => {
      const handle = e.target.closest(".mt-drag-handle");
      if (!handle) return;
      dragId = handle.closest(`[${idAttr}]`)?.getAttribute(idAttr) ?? null;
      handle.classList.add("mt-drag-dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    container.addEventListener("dragover", e => {
      if (dragId === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const targetRow = e.target.closest(`[${idAttr}]`);
      if (!targetRow) return;
      const targetId = targetRow.getAttribute(idAttr);
      if (targetId === dragId) return;
      const rect = targetRow.getBoundingClientRect();
      const pos  = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
      if (targetId === dropId && pos === dropPos) return;
      clearUI();
      container.querySelector(`[${idAttr}="${dragId}"] .mt-drag-handle`)?.classList.add("mt-drag-dragging");
      dropId = targetId; dropPos = pos;
      targetRow.classList.add(pos === "before" ? "mt-drop-card-before" : "mt-drop-card-after");
    });

    container.addEventListener("dragleave", e => {
      if (!container.contains(e.relatedTarget)) { clearUI(); dropId = dropPos = null; }
    });

    container.addEventListener("drop", e => {
      e.preventDefault();
      clearUI();
      if (dragId !== null && dropId !== null && dragId !== dropId) {
        const order   = getOrder();
        const fromIdx = order.indexOf(dragId);
        if (fromIdx !== -1) {
          const [item] = order.splice(fromIdx, 1);
          const toIdx  = order.indexOf(dropId);
          order.splice(dropPos === "before" ? toIdx : toIdx + 1, 0, item);
          onChange();
        }
      }
      dragId = dropId = dropPos = null;
    });

    container.addEventListener("dragend", () => { clearUI(); dragId = dropId = dropPos = null; });
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  function _syncMeeting(d) {
    const lifeN  = _lifeTotal(d);
    const disN   = _disTotal(d);
    const ipMo   = _ipMonthly(d);
    const dreadN = _dreadTotal(d);
    window.MeetingState?.set("coverNeeds", {
      lifeNeeded:  lifeN,
      disNeeded:   disN,
      ipMonthly:   ipMo,
      dreadNeeded: dreadN,
      lifeGap:     Math.max(0, lifeN  - _haveTotal("life")),
      disGap:      Math.max(0, disN   - _haveTotal("dis")),
      ipGap:       Math.max(0, ipMo   - _haveTotal("ip")),
      dreadGap:    Math.max(0, dreadN - _haveTotal("dread")),
      lifeHave:    _haveTotal("life"),
      disHave:     _haveTotal("dis"),
      ipHave:      _haveTotal("ip"),
      dreadHave:   _haveTotal("dread"),
      lifeIRLump:  _lifeIRLump(d),
      legacyTotal: _legacyTotal(),
      riskMonthly:   _parseMoney(_riskAlloc),
      investMonthly: _investAllocTotal(_orderedInvestGoals()),
      // Target amount + year come from the Timeline goal itself (what the
      // client is aiming for and by when) — not the funding contribution,
      // which mirrors how the risk pillars show the amount needed rather
      // than the premium being paid toward it.
      goals: _orderedInvestGoals().map(g => ({
        name:         g.name || "Goal",
        targetAmount: _parseMoney(g.lumpSum),
        year:         g.year || "",
      })),
    });
  }

  // ── Template ───────────────────────────────────────────────────────────────

  function _template() {
    return `<div class="cn-wrapper calc-glass">
      <div class="tool-hero-zone" id="hero-financial-planning"></div>
      <div class="cn-pane">
        <div class="cn-cols">
          <div class="cn-col">
            <div class="cn-col-hdr">
              <span class="mt-secondary-label">Investments</span>
              <div class="mt-money-wrap" style="flex:0 0 130px">
                <span class="mt-pfx">R</span>
                <input class="mt-input-sm" type="text" readonly tabindex="-1" id="cn-invest-total" value="0" style="pointer-events:none">
              </div>
            </div>
            <div id="cn-invest-list" class="cn-col-list"></div>
          </div>
          <div class="cn-col">
            <div class="cn-col-hdr">
              <span class="mt-secondary-label">Risk</span>
              <div class="mt-money-wrap" style="flex:0 0 130px">
                <span class="mt-pfx">R</span>
                <input class="mt-input-sm" type="text" inputmode="numeric" id="cn-risk-alloc" placeholder="0" value="${_riskAlloc || ""}">
              </div>
            </div>
            <div id="cn-risk-list" class="cn-col-list"></div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Module ─────────────────────────────────────────────────────────────────

  window.App?.register("financial-planning", {
    id: "financial-planning",
    title: "Financial Planning",

    guide: {
      intro: {
        heading: "Cover Needs",
        html: `<p>Select what each pillar of cover should protect. Amounts are pulled from the steps you've already completed.</p>
               <p>For <strong>Life Cover</strong>, each spending category is pre-filled with a presumptive value based on what your dependants would still need — edit any amount that doesn't fit this client's situation. Use the toggle to set the coverage period.</p>
               <p>For <strong>Capital Disability</strong>, the lump sum covers debt settlement and once-off capital costs (home/vehicle adaptations) — ongoing income is handled separately by Income Protection, so it isn't duplicated here.</p>
               <p>For <strong>Dread Disease</strong>, cover defaults to a multiple of annual salary (2–3x is the industry norm) — adjust the multiple, and optionally tick off liabilities if the client wants the payout to also clear debt.</p>
               <p>For <strong>Income Protection</strong>, the full monthly budget total is pre-filled as the benefit needed.</p>`,
      },
    },

    mount(wrapper) {
      _initState();
      _injectCSS();
      wrapper.insertAdjacentHTML("beforeend", _template());
      const w = wrapper.querySelector(".cn-wrapper");
      if (window.CalcHero) {
        CalcHero.render("#hero-financial-planning", {
          primaries: [{ id: "cn-hero-remaining", label: "Remaining Surplus" }],
          secondaries: [
            { id: "cn-hero-surplus",   label: "Surplus" },
            { id: "cn-hero-allocated", label: "Allocated" },
          ],
        });
      }
      _render(w);
      _initEvents(w);
      document.addEventListener("meetingstate", e => {
        if (e.detail?.toolId === "coverNeeds") return;
        if (!w.querySelector(":focus")) _render(w);
        // Needs/goals are derived from Timeline, Existing Portfolio, Existing
        // Policies and the Estate Planner — any of those changing (including
        // being cleared) must re-publish coverNeeds too, not just refresh
        // this tool's own view, or downstream consumers (meeting-summary.js)
        // keep showing whatever was last typed directly into this tool.
        _syncMeeting(_getData());
      });
    },

    getState() {
      return {
        life: {
          incomeRep: {
            open:          _life.incomeRep.open,
            checked:       _life.incomeRep.checked,
            yearsMode:     _life.incomeRep.yearsMode,
            yearsOverride: _life.incomeRep.yearsOverride,
            pct:           _life.incomeRep.pct,
          },
          liabilities:   { open: _life.liabilities.open,  items: { ..._life.liabilities.items } },
          estatePlan:    { open: _life.estatePlan.open,   items: { ..._life.estatePlan.items } },
          householdOpen: _life.householdOpen,
          legacy:        { open: _life.legacy.open, goalIds: { ..._life.legacy.goalIds }, dependants: { ..._life.legacy.dependants } },
        },
        dis: {
          checked:        _dis.checked,
          multiplier:     _dis.multiplier,
          override:       _dis.override,
          multiplierOpen: _dis.multiplierOpen,
          liabilities:    { open: _dis.liabilities.open, items: { ..._dis.liabilities.items } },
        },
        funeral: _funeral,
        ip:      { checked: _ip.checked, pct: _ip.pct, open: _ip.open },
        dread: {
          checked:        _dread.checked,
          multiplier:     _dread.multiplier,
          override:       _dread.override,
          multiplierOpen: _dread.multiplierOpen,
          liabilities:    { open: _dread.liabilities.open, items: { ..._dread.liabilities.items } },
        },
        open:      _open,
        activeTab: _activeTab,
        riskOrder:   [..._riskOrder],
        investOrder: [..._investOrder],
        investAlloc: Object.fromEntries(Object.entries(_investAlloc).map(([k, v]) => [k, { ...v }])),
        investOpen:  { ..._investOpen },
        riskAlloc:   _riskAlloc,
        existingApply: Object.fromEntries(Object.entries(_existingApply).map(([k, v]) => [k, { ...v }])),
        existingOpen:  { ..._existingOpen },
      };
    },

    setState(saved) {
      if (!saved) return;

      // Restore life cover
      if (saved.life) {
        const src = saved.life;
        const ir  = src.incomeRep ?? {};

        // Backward-compat: old liabilities was a boolean
        const savedLiab = src.liabilities;
        const liabItems = typeof savedLiab === "boolean"
          ? { open: false, items: savedLiab ? Object.fromEntries(_getLiabilityItems().map(i => [i.key, true])) : {} }
          : { open: savedLiab?.open ?? false, items: savedLiab?.items ?? {} };

        // Backward-compat: old assetDisposal/estateGap/funeralCost → estatePlan
        let estatePlan;
        if (src.estatePlan?.items) {
          estatePlan = { open: src.estatePlan.open ?? false, items: src.estatePlan.items };
        } else {
          // Migrate from old flat booleans + assetDisposal object
          const epItems = {};
          if (src.estateGap)   epItems.estateGap   = true;
          if (src.funeralCost) epItems.funeralCost  = true;
          if (src.assetDisposal) {
            if (typeof src.assetDisposal === "boolean") {
              ["executorFee","masterFee","cgt"].forEach(k => { epItems[k] = true; });
            } else if (src.assetDisposal?.items) {
              Object.assign(epItems, src.assetDisposal.items);
            }
          }
          estatePlan = { open: false, items: epItems };
        }

        _life = {
          incomeRep:   _LIFE_IR_DEFAULTS(),
          liabilities:   liabItems,
          estatePlan,
          householdOpen: src.householdOpen ?? false,
          legacy:        { open: src.legacy?.open ?? false, goalIds: src.legacy?.goalIds ?? {}, dependants: src.legacy?.dependants ?? {} },
        };
        _life.incomeRep.open          = ir.open          ?? false;
        _life.incomeRep.checked       = ir.checked        ?? true;
        _life.incomeRep.yearsMode     = ir.yearsMode     ?? "retirement";
        _life.incomeRep.yearsOverride = ir.yearsOverride ?? null;
        _life.incomeRep.pct           = ir.pct           ?? LIFE_IR_PCT_DEFAULT;
      }

      // Restore liabilities, tolerating the old boolean-liabilities format
      const _restoreLiab = (savedLiab) => typeof savedLiab === "boolean"
        ? { open: false, items: savedLiab ? Object.fromEntries(_getLiabilityItems().map(i => [i.key, true])) : {} }
        : { open: savedLiab?.open ?? false, items: savedLiab?.items ?? {} };

      if (saved.dis) {
        _dis = {
          checked:        saved.dis.checked ?? true,
          multiplier:     saved.dis.multiplier ?? DIS_MULT_DEFAULT,
          override:       saved.dis.override ?? null,
          multiplierOpen: saved.dis.multiplierOpen ?? false,
          liabilities:    _restoreLiab(saved.dis.liabilities),
        };
      }

      // "dread" is current; "dreadBase" is the pre-multiplier format this replaced
      const savedDread = saved.dread ?? saved.dreadBase;
      if (savedDread) {
        _dread = {
          checked:        savedDread.checked ?? true,
          multiplier:     savedDread.multiplier ?? DREAD_MULT_DEFAULT,
          override:       savedDread.override ?? null,
          multiplierOpen: savedDread.multiplierOpen ?? false,
          liabilities:    _restoreLiab(savedDread.liabilities),
        };
      }

      if (saved.funeral) _funeral = saved.funeral;

      if (saved.ip) {
        const ip = saved.ip;
        _ip = {
          checked: ip.checked ?? true,
          pct:     ip.pct ?? IP_PCT_DEFAULT,
          open:    ip.open ?? false,
        };
      }

      if (saved.open)      _open      = { ...{ life: false, dis: false, ip: false, dread: false, funeral: false }, ...saved.open };
      if (saved.activeTab) _activeTab = saved.activeTab;

      if (saved.riskOrder) {
        const validKeys = _PILLARS.map(p => p.key);
        const known     = saved.riskOrder.filter(k => validKeys.includes(k));
        _riskOrder = [...known, ...validKeys.filter(k => !known.includes(k))];
      }
      if (saved.investOrder) _investOrder = [...saved.investOrder];
      if (saved.investAlloc) _investAlloc = Object.fromEntries(Object.entries(saved.investAlloc).map(([k, v]) => [k, { ...v }]));
      if (saved.investOpen)  _investOpen  = { ...saved.investOpen };
      if (saved.riskAlloc != null) _riskAlloc = saved.riskAlloc;
      if (saved.existingApply) {
        _existingApply = Object.fromEntries(Object.entries(saved.existingApply).map(([k, v]) => [k, { ...v }]));
      } else if (saved.existingReplace) {
        // Backward-compat: the old "Replace Existing Policies" checkbox defaulted
        // every policy to applied, storing true only for the ones marked for
        // replacement (excluded). "Apply Existing Cover" now defaults every
        // policy to unapplied, so migrating means explicitly turning on every
        // policy the old default silently applied, except the ones it excluded.
        _existingApply = Object.fromEntries(["life", "dis", "dread", "ip"].map(pillar => {
          const oldMap = saved.existingReplace[pillar] || {};
          const items  = _existingPoliciesFor(pillar);
          return [pillar, Object.fromEntries(items.map(i => [i.key, !oldMap[i.key]]))];
        }));
      }
      if (saved.existingOpen) _existingOpen = { ...saved.existingOpen };

      const w = window.App._wrappers?.[this.id]?.querySelector(".cn-wrapper");
      if (w) {
        const riskAllocInp = w.querySelector("#cn-risk-alloc");
        if (riskAllocInp) riskAllocInp.value = _riskAlloc || "";
        _render(w);
      }

      // MeetingState.coverNeeds only ever gets (re)written from a live edit —
      // restoring a saved client would otherwise leave it stale (or empty)
      // until the FA happens to touch a field, silently starving downstream
      // consumers (meeting-summary.js, record-of-advice.js) of current data.
      _syncMeeting(_getData());
    },
  });
})();

(function () {
  "use strict";

  // ── STATE ──────────────────────────────────────────────────────────────────
  // Net is stored canonically as monthly; Annual is always just ×12, shown as
  // its own live-linked field rather than a display-mode toggle.
  let _netVal = 40000;    // net / take-home pay, as reported — no tax modelling here
  let _spendingItems = [];   // [{id, desc, cat, val}]
  let _spendingOverride = null; // manual total override (null = use sum)
  let _nextId = 1;

  // Portfolio line items marked "Pre-Net" — already deducted before Net Pay was
  // reported (e.g. employer pension), so excluded from the commitment subtraction
  // to avoid double-counting. Keyed by `${sid}::${item.name}`; default is Post-Net
  // (counted), matching today's behaviour.
  let _preNetItems = new Set();
  function _preNetKey(sid, name) {
    return `${sid}::${name}`;
  }
  function _sumExclPreNet(sid, items) {
    return items.reduce((s, i) => s + (_preNetItems.has(_preNetKey(sid, i.name)) ? 0 : i.val), 0);
  }

  // ── Spending presets ───────────────────────────────────────────────────────
  const SPENDING_PRESETS = [
    { label: "Rent", cat: "Housing" },
    { label: "Rates and Taxes", cat: "Housing" },
    { label: "Water and Lights", cat: "Housing" },
    { label: "Levies", cat: "Housing" },
    { label: "Domestic Worker", cat: "Housing" },
    { label: "Gardener", cat: "Housing" },
    { label: "Fuel", cat: "Transport" },
    { label: "Commuting & Uber", cat: "Transport" },
    { label: "Groceries", cat: "Groceries" },
    { label: "Toiletries and Personal Care", cat: "Groceries" },
    { label: "School Fees", cat: "Family" },
    { label: "Maintenance / Alimony", cat: "Family" },
    { label: "Allowances", cat: "Family" },
    { label: "Tutors / Lessons / Extra murals", cat: "Family" },
    { label: "Clothing", cat: "Personal Spend" },
    { label: "Hair & Beauty", cat: "Personal Spend" },
    { label: "Chronic Medication", cat: "Wellness" },
    { label: "Gym", cat: "Wellness" },
    { label: "Dining Out and Takeaways", cat: "Lifestyle" },
    { label: "Entertainment", cat: "Lifestyle" },
    { label: "Data and Airtime", cat: "Lifestyle" },
    { label: "Internet", cat: "Lifestyle" },
    { label: "Streaming & Subscriptions", cat: "Lifestyle" },
    { label: "Travel and Holidays", cat: "Lifestyle" },
    { label: "Pet Expenses", cat: "Lifestyle" },
  ];
  const ALL_CATS = ["Housing", "Transport", "Groceries", "Family", "Personal Spend", "Wellness", "Lifestyle"];

  // ── Synced sections (from Current Portfolio / Existing Policies) ──
  let _investPortfolio = []; // [{name, val}] investment monthly contributions
  let _liabPortfolio = []; // [{name, val}] debt monthly repayments
  let _riskPortfolio = []; // [{name, val}] risk policy premiums
  let _otherPortfolio = []; // [{name, val}] other insurance premiums

  function _initItems() {
    _nextId = 1;
    _spendingItems = SPENDING_PRESETS.map((p) => ({ id: _nextId++, desc: p.label, cat: p.cat, val: 0 }));
  }

  function _reset() {
    _netVal = 40000;
    _investPortfolio = [];
    _liabPortfolio = [];
    _riskPortfolio = [];
    _otherPortfolio = [];
    _spendingOverride = null;
    _preNetItems = new Set();
    _initItems();
  }

  // ── Portfolio sync helpers ─────────────────────────────────────────────────

  function _syncFromPortfolio() {
    const cp = window.MeetingState?.get("currentPortfolio") || {};
    const ep = window.MeetingState?.get("existingPolicies") || {};

    // Investments — monthly contributions, RA included alongside everything else
    // (no separate tax-deduction handling here anymore, so no reason to split it out).
    _investPortfolio = (cp.investments || [])
      .filter((i) => i.contrib > 0)
      .map((i) => ({
        name: [i.type, i.provider].filter(Boolean).join(" — "),
        val: i.contrib,
      }));

    // Liabilities — short-term + long-term monthly repayments
    _liabPortfolio = [...(cp.stLiabilities || []), ...(cp.ltLiabilities || [])]
      .filter((i) => i.balance > 0 || i.monthly > 0)
      .map((i) => ({
        name: [i.type, i.provider].filter(Boolean).join(" — "),
        val: i.monthly,
      }));

    // Risk policies — one row per policy; p.premium is always the effective policy total,
    // whether typed directly or computed as the sum of its cover-type breakdown.
    _riskPortfolio = (ep.policies || [])
      .filter((p) => p.premium > 0)
      .map((p) => ({ name: p.insurer || "Risk Policy", val: p.premium }));

    // Funeral + Medical & Health + Short-Term/Asset — grouped to mirror Existing
    // Policies' own section split, where Funeral is its own category, not a risk product.
    _otherPortfolio = [...(ep.funeral || []), ...(ep.medical || []), ...(ep.shortTerm || [])]
      .filter((p) => p.premium > 0)
      .map((p) => ({ name: p.insurer || "Other Policy", val: p.premium }));
  }

  // ── CALCULATION ────────────────────────────────────────────────────────────
  // No tax modelling here — Net is captured as reported, so this is pure
  // arithmetic on values the advisor/client already know.
  function _project() {
    const netPayMonthly = _netVal;

    const spendingTotal = _spendingOverride ?? _spendingItems.reduce((s, i) => s + i.val, 0);
    const totalExpenses = spendingTotal;

    // Category totals — consumed by financial-planning
    const categoryTotals = {};
    for (const item of _spendingItems) {
      if (item.cat) categoryTotals[item.cat] = (categoryTotals[item.cat] || 0) + item.val;
    }

    const investTotal = _sumExclPreNet("invest", _investPortfolio);
    const liabTotal = _sumExclPreNet("liab", _liabPortfolio);
    const riskTotal = _sumExclPreNet("protect", _riskPortfolio);
    const otherTotal = _sumExclPreNet("protect", _otherPortfolio);
    const commitTotal = investTotal + liabTotal + riskTotal + otherTotal;
    const surplus = netPayMonthly - totalExpenses - commitTotal;

    return {
      netPayMonthly,
      totalExpenses,
      spendingTotal,
      categoryTotals,
      investTotal,
      liabTotal,
      riskTotal,
      otherTotal,
      commitTotal,
      surplus,
    };
  }

  // ── STYLES ─────────────────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById("bud-styles")) return;
    const s = document.createElement("style");
    s.id = "bud-styles";
    s.textContent = `
      /* ── Outer wrapper ── */
      .bud-wrapper { flex: 1; min-height: 0; min-width: 0; }

      /* ── Summary strip ── */
      .bud-summary {
        display: flex; align-items: stretch; flex-shrink: 0;
        border-bottom: 1px solid rgba(0,0,0,0.07);
      }
      .bud-sum-item {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        padding: 0.85rem 0.5rem;
      }
      .bud-sum-div { width: 1px; background: rgba(0,0,0,0.07); flex-shrink: 0; }
      .bud-sum-lbl {
        font-family: var(--fb); font-size: 0.6rem; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.08em; color: var(--navy-5);
        margin-bottom: 0.22rem; white-space: nowrap;
      }
      .bud-sum-val {
        font-family: var(--fb); font-size: 0.88rem; font-weight: 700;
        color: var(--navy-3); font-variant-numeric: tabular-nums; white-space: nowrap;
      }
      .bud-sum-val.bud-deficit { color: #dc2626; }
      .bud-sum-val.bud-wealth  { color: #059669; }

      /* ── Scrollable pane — scrolling stays functional, the bar itself is just hidden ── */
      .bud-pane {
        flex: 1; min-height: 0; overflow-y: auto;
        display: flex; flex-direction: column; gap: 0.75rem;
        padding-bottom: 2rem; scrollbar-width: none;
      }
      .bud-pane::-webkit-scrollbar { display: none; }

      /* ── Zone divider — separates what's edited here (Cash Flow) from what's
         synced in for reference (Portfolio) ── */
      .bud-zone-label {
        font-family: var(--fb); font-size: 0.6rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.1em; color: var(--navy-5);
        padding: 0.5rem 0.25rem 0.1rem;
        opacity: 0.5;
      }

      /* ── Expense group labels ── */
      .bud-group-label {
        font-family: var(--fb); font-size: 0.62rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.09em; color: var(--navy-5);
        padding: 0.1rem 0.2rem 0.2rem;
        margin-top: 0.15rem;
      }

      /* ── Section extras (container/header/title/body come from meeting-shared.css) ── */
      .bud-computed { opacity: 0.55; pointer-events: none; }
      .bud-input {
        flex: 1; min-width: 0; border: none; background: transparent;
        height: 100%; outline: none; font-family: var(--fb); font-size: 0.78rem;
        color: var(--navy-3); padding: 0 0.5rem 0 0; text-align: right;
      }
      .bud-input--sm { flex: none; width: 80px; }
      .bud-sec-body {
        display: flex; flex-direction: column;
        border-top: 1px solid rgba(0,0,0,0.06);
      }

      /* ── Net Pay — flat, no breakdown: shown as plain quick-edit text (same
         look as the Spending section's total), sitting directly in the
         section bar (no collapse). ── */
      .bud-flat-hdr {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.85rem 1rem;
      }

      /* ── Income header quick-edit input (styled as plain sum text) ── */
      .bud-quick-inp {
        background: none; border: none; outline: none; padding: 0;
        font-family: var(--fb); font-size: 0.8rem; font-weight: 700;
        color: var(--navy-3); font-variant-numeric: tabular-nums;
        text-align: right; width: 80px; cursor: text;
      }
      .bud-quick-inp::placeholder { color: rgba(100,116,139,0.35); }
      /* Section total override indicator */
      .bud-sec-total-inp { color: var(--navy-3); }
      .bud-sec-total-inp.bud-override { color: var(--gold, #d4a843); }

      /* ── Spending flat list (grid, mirrors existing-portfolio style) ── */
      .bud-spend-grid {
        display: grid; gap: 0.25rem 0.45rem; align-items: center;
        grid-template-columns: 1fr minmax(8rem,10rem) 115px;
      }

      /* ── Portfolio-synced sections ──
         Right padding matches the header's reserved chevron gutter (mt-chev's 14px
         plus .mt-primary-right's 0.6rem gap before it) so each row's money value lines
         up under the section header's total instead of sitting under the chevron. */
      .bud-synced-item {
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.12rem calc(1rem + 14px + 0.6rem) 0.12rem 1.6rem;
      }
      .bud-synced-name {
        flex: 1; font-family: var(--fb); font-size: 0.78rem;
        color: var(--navy-4); min-width: 0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .bud-synced-val { flex-shrink: 0; }
      .bud-synced-item.pre-net .bud-synced-name,
      .bud-synced-item.pre-net .bud-synced-val { opacity: 0.4; }
      .bud-prenet-toggle {
        flex-shrink: 0; display: flex; background: rgba(0,0,0,0.04);
        border-radius: 0.35rem; padding: 2px; gap: 2px;
      }
      .bud-prenet-toggle button {
        flex: 1; padding: 0.18rem 0.5rem; font-family: var(--fb);
        font-size: 0.62rem; font-weight: 600; border: none; background: none;
        color: var(--navy-5); border-radius: 0.25rem; cursor: pointer;
        transition: background 0.15s, color 0.15s; white-space: nowrap;
      }
      .bud-prenet-toggle button.active {
        background: rgba(212,168,67,0.15); color: var(--gold, #d4a843);
      }
      .bud-synced-extra {
        border-top: 1px solid rgba(0,0,0,0.05);
        padding-top: 0.15rem; margin-top: 0.1rem;
      }
      .bud-synced-empty {
        padding: 0.75rem 1rem 0.65rem 1.6rem;
        font-family: var(--fb); font-size: 0.75rem; color: var(--navy-5);
        font-style: italic;
      }
    `;
    document.head.appendChild(s);
  }

  // ── HTML TEMPLATE ──────────────────────────────────────────────────────────
  function _template() {
    const netDisplay = numberToMoney(_netVal);

    return `
<div class="bud-wrapper glass-panel glass-panel--light calc-glass">
  <div class="calc-layout">

  <div class="tool-hero-zone" id="hero-budget"></div>

  <div class="bud-pane">

    <div class="bud-zone-label">Cash Flow</div>

    <!-- ── Net Pay — flat, no breakdown, no collapse ── -->
    <div class="mt-primary" id="bud-income-sec">
      <div class="bud-flat-hdr">
        <div class="mt-primary-title">Net Pay</div>
        <div class="mt-primary-right">
          <input class="bud-quick-inp bud-sec-total-inp" id="val-bud-net-m" type="text"
                 inputmode="numeric" value="R ${netDisplay}" autocomplete="off">
          <span class="mt-chev" style="visibility:hidden"></span>
        </div>
      </div>
    </div>

    <!-- ── Spending section ── -->
    <div class="mt-primary collapsed" id="bud-spend-sec">
      <div class="mt-primary-hdr" id="bud-spend-hdr">
        <div class="mt-primary-title">Spending</div>
        <div class="mt-primary-right">
          <input class="bud-quick-inp bud-sec-total-inp" id="bud-spend-sum" type="text" inputmode="numeric" placeholder="R 0" autocomplete="off">
          <span class="mt-chev"></span>
        </div>
      </div>
      <div class="mt-primary-body">
        <div class="bud-spend-grid">
          <div class="mt-secondary-label" style="text-align:left">Description</div>
          <div class="mt-secondary-label">Category</div>
          <div class="mt-secondary-label">Amount</div>
          <div id="bud-spend-list" style="display:contents"></div>
        </div>
      </div>
    </div>

    <div class="bud-zone-label">Portfolio</div>

    <!-- ── Wealth Building (synced from Current Portfolio) ── -->
    <div class="mt-primary collapsed" id="bud-invest-sec">
      <div class="mt-primary-hdr" id="bud-invest-hdr">
        <div class="mt-primary-title">Wealth Building</div>
        <div class="mt-primary-right"><span class="mt-primary-sum" id="bud-invest-sum"></span><span class="mt-chev"></span></div>
      </div>
      <div class="bud-sec-body" id="bud-invest-body"></div>
    </div>

    <!-- ── Liabilities (synced from Current Portfolio) ── -->
    <div class="mt-primary collapsed" id="bud-liab-sec">
      <div class="mt-primary-hdr" id="bud-liab-hdr">
        <div class="mt-primary-title">Liabilities</div>
        <div class="mt-primary-right"><span class="mt-primary-sum" id="bud-liab-sum"></span><span class="mt-chev"></span></div>
      </div>
      <div class="bud-sec-body" id="bud-liab-body"></div>
    </div>

    <!-- ── Protection — Risk Policies + Funeral/Medical/Short-Term combined (synced from Existing Policies) ── -->
    <div class="mt-primary collapsed" id="bud-protect-sec">
      <div class="mt-primary-hdr" id="bud-protect-hdr">
        <div class="mt-primary-title">Protection</div>
        <div class="mt-primary-right"><span class="mt-primary-sum" id="bud-protect-sum"></span><span class="mt-chev"></span></div>
      </div>
      <div class="bud-sec-body" id="bud-protect-body"></div>
    </div>

  </div>
  </div>
</div>`;
  }

  // ── RENDER SPENDING ────────────────────────────────────────────────────────

  function _descOptions(ownDesc) {
    const usedLabels = new Set(_spendingItems.filter((i) => i.desc !== ownDesc).map((i) => i.desc));
    const available = SPENDING_PRESETS.filter((p) => !usedLabels.has(p.label));
    const isPreset = SPENDING_PRESETS.some((p) => p.label === ownDesc);
    const isCustom = ownDesc && !isPreset;
    const opts = available.map((p) => `<option value="${p.label}"${p.label === ownDesc ? " selected" : ""}>${p.label}</option>`).join("");
    return `<option value="">— Description —</option>${opts}<option value="__custom__"${isCustom ? " selected" : ""}>Custom…</option>`;
  }

  function _renderSpending(container, update) {
    const list = container.querySelector("#bud-spend-list");
    if (!list) return;

    list.innerHTML = _spendingItems
      .map((item) => {
        const isPreset = SPENDING_PRESETS.some((p) => p.label === item.desc);
        const isCustom = item.desc && !isPreset;
        const catOpts = ALL_CATS.map((c) => `<option value="${c}"${c === item.cat ? " selected" : ""}>${c}</option>`).join("");

        return `<div class="mt-secondary" data-id="${item.id}">
        <div style="display:flex;align-items:center;gap:0.35rem">
          <button class="mt-secondary-x" type="button" title="Remove">×</button>
          <select class="mt-select-sm bud-desc-sel" style="${isCustom ? "display:none;" : ""}flex:1;min-width:0">
            ${_descOptions(item.desc)}
          </select>
          <input class="mt-input-sm bud-desc-inp" type="text" placeholder="Custom description…"
                 value="${isCustom ? item.desc.replace(/"/g, "&quot;") : ""}" autocomplete="off"
                 style="${!isCustom ? "display:none;" : ""}flex:1;min-width:0">
        </div>
        <div>
          <select class="mt-select-sm bud-cat-sel">
            <option value="">— Category —</option>
            ${catOpts}
          </select>
        </div>
        <div>
          <div class="mt-money-wrap">
            <span class="mt-pfx">R</span>
            <input class="mt-input-sm" type="text" inputmode="numeric" autocomplete="off"
                   value="${item.val > 0 ? numberToMoney(item.val) : ""}" placeholder="0">
          </div>
        </div>
      </div>`;
      })
      .join("");

    _wireSpendingEvents(list, container, update);
  }

  function _wireSpendingEvents(list, container, update) {
    list.querySelectorAll(".bud-desc-sel").forEach((sel) => {
      sel.addEventListener("change", () => {
        const row = sel.closest(".mt-secondary");
        const id = +row.dataset.id;
        const item = _spendingItems.find((i) => i.id === id);
        if (!item) return;
        if (sel.value === "__custom__") {
          sel.style.display = "none";
          const inp = row.querySelector(".bud-desc-inp");
          inp.style.display = "";
          inp.focus();
          item.desc = "";
        } else {
          item.desc = sel.value;
          const preset = SPENDING_PRESETS.find((p) => p.label === sel.value);
          if (preset) {
            item.cat = preset.cat;
            row.querySelector(".bud-cat-sel").value = preset.cat;
          }
          _renderSpending(container, update);
        }
        update();
      });
    });

    list.querySelectorAll(".bud-desc-inp").forEach((inp) => {
      inp.addEventListener("input", () => {
        const item = _spendingItems.find((i) => i.id === +inp.closest(".mt-secondary").dataset.id);
        if (item) {
          item.desc = inp.value;
          update();
        }
      });
    });

    list.querySelectorAll(".bud-cat-sel").forEach((sel) => {
      sel.addEventListener("change", () => {
        const item = _spendingItems.find((i) => i.id === +sel.closest(".mt-secondary").dataset.id);
        if (item) {
          item.cat = sel.value;
          update();
        }
      });
    });

    list.querySelectorAll(".mt-money-wrap input").forEach((inp) => {
      inp.addEventListener("focus", () => {
        inp.value = inp.value.replace(/[^0-9.]/g, "");
        inp.select();
      });
      inp.addEventListener("input", () => {
        const item = _spendingItems.find((i) => i.id === +inp.closest(".mt-secondary").dataset.id);
        if (item) {
          item.val = moneyToNumber(inp.value);
          _spendingOverride = null; // clear override when editing line items
          update();
        }
      });
      inp.addEventListener("blur", () => {
        const item = _spendingItems.find((i) => i.id === +inp.closest(".mt-secondary").dataset.id);
        if (item) inp.value = item.val > 0 ? numberToMoney(item.val) : "";
      });
    });
  }

  // ── SYNCED SECTIONS ───────────────────────────────────────────────────────

  function _renderSyncedSection(container, sid, portfolioItems, update) {
    const body = container.querySelector(`#bud-${sid}-body`);
    if (!body) return;

    const rowsHtml =
      portfolioItems.length > 0
        ? portfolioItems
            .map((item) => {
              const isPre = _preNetItems.has(_preNetKey(sid, item.name));
              const safeName = item.name.replace(/"/g, "&quot;");
              return `
          <div class="bud-synced-item${isPre ? " pre-net" : ""}">
            <span class="bud-synced-name">${item.name}</span>
            <div class="bud-prenet-toggle" data-sid="${sid}" data-name="${safeName}">
              <button type="button" class="${!isPre ? "active" : ""}" data-pre="false">Post-Net</button>
              <button type="button" class="${isPre ? "active" : ""}" data-pre="true">Pre-Net</button>
            </div>
            <div class="mt-money-wrap bud-computed bud-synced-val">
              <span class="mt-pfx">R</span>
              <input class="bud-input bud-input--sm" type="text"
                     value="${numberToMoney(item.val)}" readonly tabindex="-1">
            </div>
          </div>`;
            })
            .join("")
        : `<div class="bud-synced-empty">Nothing captured in your portfolio yet.</div>`;

    body.innerHTML = rowsHtml;

    // "Already deducted before Net" toggle, per line item — Pre-Net items are
    // excluded from the commitment subtraction (see _sumExclPreNet in _project).
    body.querySelectorAll(".bud-prenet-toggle").forEach((toggle) => {
      toggle.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-pre]");
        if (!btn) return;
        const key = _preNetKey(toggle.dataset.sid, toggle.dataset.name);
        const isPre = btn.dataset.pre === "true";
        if (isPre) _preNetItems.add(key);
        else _preNetItems.delete(key);
        toggle.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
        toggle.closest(".bud-synced-item")?.classList.toggle("pre-net", isPre);
        update();
      });
    });
  }

  function _renderSyncedSections(container, update) {
    _renderSyncedSection(container, "invest", _investPortfolio, update);
    _renderSyncedSection(container, "liab", _liabPortfolio, update);
    // Protection is one accordion covering both Risk Policies and Funeral/Medical/
    // Short-Term — _riskPortfolio and _otherPortfolio stay separate module state
    // (their individual totals still feed meeting-summary.js) but render as one list.
    _renderSyncedSection(container, "protect", [..._riskPortfolio, ..._otherPortfolio], update);
  }

  // ── MEETING STATE ──────────────────────────────────────────────────────────
  function _syncMeetingState(res, container) {
    if (!window.MeetingState) return;
    window.MeetingState.set("budget", {
      // ── Income ──
      netPayMonthly: res.netPayMonthly,

      // ── Spending totals ──
      totalExpenses: res.totalExpenses,
      categoryTotals: res.categoryTotals,

      // ── Commitments totals ──
      investTotal: res.investTotal,
      liabTotal: res.liabTotal,
      riskTotal: res.riskTotal,
      otherTotal: res.otherTotal,
      commitTotal: res.commitTotal,

      // ── Bottom line ──
      surplus: res.surplus,

      // ── Itemised spending ──
      spendingItems: _spendingItems.map((i) => ({ desc: i.desc, cat: i.cat, val: i.val })),

      // ── Itemised commitments (synced from portfolio / policies) ──
      investments: _investPortfolio.map((i) => ({ name: i.name, val: i.val })),
      liabilities: _liabPortfolio.map((i) => ({ name: i.name, val: i.val })),
      riskPolicies: _riskPortfolio.map((i) => ({ name: i.name, val: i.val })),
      otherInsurance: _otherPortfolio.map((i) => ({ name: i.name, val: i.val })),
    });
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  function _doUpdate(container) {
    const res = _project();

    // Hero
    if (window.CalcHero) {
      CalcHero.update(
        {
          primaries: [
            { id: "bud-hero-surplus", value: Math.abs(res.surplus) },
          ],
          secondaries: [
            { id: "bud-hero-net-annual", value: res.netPayMonthly * 12 },
            { id: "bud-hero-commit", value: res.commitTotal },
          ],
        },
        container,
      );
      const surplusEl = container.querySelector("#bud-hero-surplus");
      if (surplusEl) surplusEl.style.color = res.surplus < 0 ? "#ef4444" : "#fff";
    }

    // Spending section header sum
    const spendInp = container.querySelector("#bud-spend-sum");
    if (spendInp && document.activeElement !== spendInp) {
      spendInp.value = res.spendingTotal > 0 ? `R ${numberToMoney(Math.round(res.spendingTotal))}` : "";
      spendInp.classList.toggle("bud-override", _spendingOverride != null);
    }

    [
      ["invest",  res.investTotal],
      ["liab",    res.liabTotal],
      ["protect", res.riskTotal + res.otherTotal],
    ].forEach(([key, total]) => {
      const sumEl = container.querySelector(`#bud-${key}-sum`);
      if (sumEl) sumEl.textContent = total > 0 ? `R ${numberToMoney(total)}` : "";
    });

    _syncMeetingState(res, container);
  }

  // ── INCOME EVENTS ──────────────────────────────────────────────────────────
  // Gross and Net each show a Monthly + Annual field, live-linked — editing
  // either recalculates the other (×12 / ÷12), no display-mode toggle needed.
  function _wireIncomeEvents(container, update) {
    const inp = container.querySelector("#val-bud-net-m");
    if (!inp) return;

    inp.addEventListener("click", (e) => e.stopPropagation());
    inp.addEventListener("focus", (e) => {
      e.stopPropagation();
      inp.value = inp.value.replace(/^R\s*/, "").replace(/[^0-9.]/g, "") || "";
      inp.select();
    });
    inp.addEventListener("input", () => {
      _netVal = moneyToNumber(inp.value);
      update();
    });
    inp.addEventListener("blur", () => {
      inp.value = `R ${numberToMoney(Math.round(_netVal))}`;
      update();
    });
  }

  // ── SPENDING SECTION TOTAL QUICK-EDIT ─────────────────────────────────────
  function _wireSpendingHeaderEvents(container, update) {
    const inp = container.querySelector("#bud-spend-sum");
    if (!inp) return;

    inp.addEventListener("click", (e) => e.stopPropagation());
    inp.addEventListener("focus", (e) => {
      e.stopPropagation();
      inp.value = _spendingOverride != null ? numberToMoney(_spendingOverride) : inp.value.replace(/^R\s*/, "").replace(/[^0-9.]/g, "") || "";
      inp.select();
    });
    inp.addEventListener("input", () => {
      const v = moneyToNumber(inp.value);
      _spendingOverride = isNaN(v) || v === 0 ? null : v;
      inp.classList.toggle("bud-override", _spendingOverride != null);
      update();
    });
    inp.addEventListener("blur", () => {
      const cur = _spendingOverride;
      inp.value = cur != null && cur > 0 ? `R ${numberToMoney(Math.round(cur))}` : (cur === 0 ? "" : inp.value);
      update();
    });
  }

  // ── MODULE ─────────────────────────────────────────────────────────────────
  const MODULE = {
    id: "budget",

    mount(container) {
      _reset();
      _injectStyles();
      container.insertAdjacentHTML("beforeend", _template());

      if (window.CalcHero) {
        CalcHero.render("#hero-budget", {
          primaries: [
            { id: "bud-hero-surplus", label: "Surplus" },
          ],
          secondaries: [
            { id: "bud-hero-net-annual", label: "Annual Net Pay" },
            { id: "bud-hero-commit", label: "Portfolio" },
          ],
        });
      }

      const update = () => _doUpdate(container);
      _syncFromPortfolio();
      _renderSpending(container, update);
      _renderSyncedSections(container, update);
      _wireIncomeEvents(container, update);
      _wireSpendingHeaderEvents(container, update);
      MtUI.initSections(container, { accordion: true });

      MtUI.initDeleteMode(container.querySelector("#bud-spend-sec"), {
        addLabel: "+ Add item",
        onAdd: () => {
          _spendingItems.push({ id: _nextId++, desc: "", cat: "", val: 0 });
          _renderSpending(container, update);
          update();
        },
        onDelete: (row) => {
          const id = +row.dataset.id;
          const rem = _spendingItems.filter(i => i.id !== id);
          _spendingItems = rem.length ? rem : [{ id: _nextId++, desc: "", cat: "", val: 0 }];
          _renderSpending(container, update);
          update();
        },
        rowSelector: "[data-id]",
      });

      document.addEventListener("meetingstate", (e) => {
        const tid = e.detail?.toolId;
        if (tid === "currentPortfolio" || tid === "existingPolicies") {
          _syncFromPortfolio();
          _renderSyncedSections(container, update);
          update();
        }
      });

      window.CalcState = {
        get() {
          return {
            income: {
              netMonthly: _netVal,
            },
            spendingItems: _spendingItems.map((i) => ({ ...i })),
          };
        },
        export() {
          return Promise.resolve({});
        },
      };

      update();
    },

    getState() {
      const c = window.App._wrappers?.[this.id];
      const open = id => !c?.querySelector(id)?.classList.contains("collapsed");
      return {
        netVal: _netVal,
        spendingOpen: open("#bud-spend-sec"),
        investOpen: open("#bud-invest-sec"),
        liabOpen: open("#bud-liab-sec"),
        protectOpen: open("#bud-protect-sec"),
        spendingItems: _spendingItems.map((i) => ({ desc: i.desc, cat: i.cat, val: i.val })),
        spendingOverride: _spendingOverride,
        preNetItems: [..._preNetItems],
      };
    },

    setState(extra) {
      if (!extra) return;
      const container = window.App._wrappers[this.id];
      if (!container) return;

      if (extra.netVal != null) _netVal = extra.netVal;
      _preNetItems = new Set(extra.preNetItems || []);

      if (extra.spendingItems) {
        // New format
        _spendingItems = extra.spendingItems.map((i) => ({ id: _nextId++, desc: i.desc || "", cat: i.cat || "", val: i.val || 0 }));
        if (!_spendingItems.length) _spendingItems = SPENDING_PRESETS.map((p) => ({ id: _nextId++, desc: p.label, cat: p.cat, val: 0 }));
      } else if (extra.householdItems || extra.personalItems) {
        // Backward-compat: merge old household + personal arrays into single list
        const hh = (extra.householdItems || []).map((i) => ({ id: _nextId++, desc: i.desc || "", cat: i.cat || "", val: i.val || 0 }));
        const pp = (extra.personalItems  || []).map((i) => ({ id: _nextId++, desc: i.desc || "", cat: i.cat || "", val: i.val || 0 }));
        _spendingItems = [...hh, ...pp];
        if (!_spendingItems.length) _spendingItems = SPENDING_PRESETS.map((p) => ({ id: _nextId++, desc: p.label, cat: p.cat, val: 0 }));
      }

      // Backward-compat: merge old overrides (sum them if both present)
      if (extra.spendingOverride !== undefined) {
        _spendingOverride = extra.spendingOverride;
      } else if (extra.householdOverride != null || extra.personalOverride != null) {
        const hh = extra.householdOverride ?? 0;
        const pp = extra.personalOverride  ?? 0;
        _spendingOverride = hh + pp > 0 ? hh + pp : null;
      } else {
        _spendingOverride = null;
      }

      const update = () => _doUpdate(container);
      _syncFromPortfolio();
      _renderSpending(container, update);
      _renderSyncedSections(container, update);

      // Restore open states
      const sectionIds = ["spend", "invest", "liab", "protect"];
      sectionIds.forEach(sid => {
        // Support old householdOpen/personalOpen keys: open spending if either was open
        let val = extra[`${sid}Open`];
        if (val == null && sid === "spend") val = extra.householdOpen || extra.personalOpen;
        // Support the old separate riskOpen/otherOpen keys, from before Risk Policies
        // and Funeral/Medical/Short-Term were merged into one Protection accordion.
        if (val == null && sid === "protect") val = extra.riskOpen || extra.otherOpen;
        if (val != null) container.querySelector(`#bud-${sid}-sec`)?.classList.toggle("collapsed", !val);
      });

      // Restore Net Pay field
      const netM = container.querySelector("#val-bud-net-m");
      if (netM) netM.value = `R ${numberToMoney(_netVal)}`;

      _doUpdate(container);
    },

    unmount() {
      _reset();
      document.getElementById("bud-styles")?.remove();
      window.CalcState = null;
    },
  };

  window.App.register("budget", MODULE);
})();

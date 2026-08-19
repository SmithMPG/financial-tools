// tools/existing-policies.js
// Existing Policies – Risk Policies (life/disability/dread disease/income protection,
// captured per policy with an optional type breakdown), Funeral Cover (captured per
// policy with an open-ended breakdown of covered people), Medical & Health, and
// Short-Term / Asset Insurance.

(function () {
  function _injectCSS() {
    if (document.getElementById("epol-styles")) return;
    const s = document.createElement("style");
    s.id = "epol-styles";
    s.textContent = `
      .epol-wrapper { flex: 1; min-height: 0; min-width: 0; }

      .epol-hero-row { position: relative; flex-shrink: 0; }

      .epol-pane {
        flex: 1; min-height: 0; overflow-y: auto;
        display: flex; flex-direction: column; gap: 1rem;
        scrollbar-width: none;
      }
      .epol-pane::-webkit-scrollbar { display: none; }

      /* ── Risk Policies grid ──
         5 columns by default (Insurer / Cover Type / Beneficiary / Premium / chevron).
         .lib-active inserts a 6th "Liberty Comparative" column between Premium and the
         chevron rail — driven by the tool-wide "Compare to Liberty" toggle at the
         bottom of the tool, not by anything per-row. Everything after Premium uses
         negative-index grid-column positions so it auto-adjusts to whichever column
         count is currently in play, rather than being auto-placed. */
      .rp-grid {
        display: grid; gap: 0.25rem 0.45rem; align-items: start;
        grid-template-columns: minmax(150px,1.3fr) minmax(140px,1.1fr) minmax(120px,1fr) 115px 34px;
      }
      .rp-grid.lib-active {
        grid-template-columns: minmax(150px,1.3fr) minmax(140px,1.1fr) minmax(120px,1fr) 115px 115px 34px;
      }
      .rp-col-1 { grid-column: 1 / 2; }
      .rp-col-2 { grid-column: 2 / 3; }
      .rp-col-3 { grid-column: 3 / 4; }
      .rp-col-4 { grid-column: 4 / 5; }
      /* Liberty column: always the second-to-last defined column, whatever the count. */
      .rp-lib-computed { grid-column: -3 / -2; }
      /* Chevron rail: always the true last column, so it stays put on the
         right whether the Liberty column exists yet or not. */
      .rp-expand-cell { grid-column: -2 / -1; display: flex; align-items: center; justify-content: center; height: 100%; }

      /* Match the section header's chevron/summary spacing to the grid's own rail-column
         width and column gap, so the header's chevron sits directly above the row's
         expand arrow, and its premium total sits directly above the Premium column.
         Same fix applied to Funeral Cover, whose grid uses the same rail width/gap. */
      #epol-sec-risk .mt-primary-right,
      #epol-sec-funeral .mt-primary-right { gap: 0.45rem; }
      #epol-sec-risk .mt-chev,
      #epol-sec-funeral .mt-chev { width: 34px; }

      /* The computed Liberty cell on a policy row only shows while the tool-wide toggle is on. */
      .rp-lib-computed { display: none; }
      .rp-grid.lib-active .rp-lib-computed { display: flex; }
      /* Hide bottom fallback button when rows exist */
      .rp-grid:has(.rp-row) .mt-total-row { display: none; }

      /* Expand button + breakdown wrapper/card now come from the shared three-tier
         classes in meeting-shared.css (.mt-tertiary-expand-btn / .mt-tertiary /
         .mt-tertiary-rows) — only the subgrid + column-span specifics stay local. */

      /* ── Cover Type checklist dropdown (inline row column) ── */
      .rp-type-cell { position: relative; }
      .rp-type-dd { position: relative; width: 100%; }
      .rp-type-dd-btn {
        width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;
        background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1);
        border-radius: 8px; padding: 0 0.6rem; height: 34px; cursor: pointer;
        font-family: var(--fb); font-size: 0.78rem; font-weight: 500; color: var(--navy-3);
      }
      .rp-type-dd-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
      .rp-type-dd-label.placeholder { color: rgba(100, 116, 139, 0.5); }
      .rp-dd-chev { transition: transform 0.2s; flex-shrink: 0; opacity: 0.5; }
      .rp-type-dd.open .rp-dd-chev { transform: rotate(180deg); }
      /* position:fixed, JS-positioned on open, and reparented to document.body (see
         _positionTypeDD / openTypeDD in _initEvents) — .mt-primary and .glass-panel both
         have overflow:hidden for their rounded corners, which would otherwise clip
         this popover, and a fixed-position descendant of .glass-panel--light doesn't
         actually position off the viewport anyway since backdrop-filter gives that
         ancestor its own containing block. Moving the node out to <body> sidesteps
         both problems at once. Toggled via .open on the menu itself, not a .rp-type-dd
         descendant selector, since it's no longer nested inside .rp-type-dd once open. */
      .rp-type-dd-menu {
        display: none; position: fixed; z-index: 50;
        min-width: 190px; background: #fff; border: 1px solid rgba(0,0,0,0.1);
        border-radius: 0.6rem; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        padding: 0.35rem; flex-direction: column; gap: 0.1rem;
      }
      .rp-type-dd-menu.open { display: flex; }
      .rp-type-opt {
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.4rem 0.5rem; border-radius: 0.4rem; cursor: pointer;
        font-family: var(--fb); font-size: 0.8rem; color: var(--navy-3);
      }
      .rp-type-opt:hover { background: rgba(0,0,0,0.04); }
      .rp-type-opt input { flex-shrink: 0; }

      /* ── Breakdown line items: description | cover amount | premium | Liberty ──
         Subgridded onto rp-grid's own columns so each value column lines up with
         the matching column above it (the shared .mt-tertiary-row/.mt-tertiary-lbl deliberately
         don't set this, since it's specific to how Risk Policies' fields map onto
         its own row). No repeated header row — the money fields carry their own
         placeholder text instead. */
      .rp-bd-row { grid-template-columns: subgrid; }
      .rp-bd-lbl { grid-column: 1 / 3; }
      .rp-bd-cover  { grid-column: 3 / 4; }
      .rp-bd-premium { grid-column: 4 / 5; }

      .rp-premium-computed input { opacity: 0.5; }

      /* ── Liberty Comparative — one tool-wide toggle (bottom of the tool) reveals/hides
         every Liberty value cell across Risk Policies and Funeral Cover at once: the
         computed per-policy cell above, and every breakdown line item's own field.
         Fixed column 5 (not -3/-2) — the breakdown card's own subgrid excludes the
         trailing chevron-rail column (see .mt-tertiary-rows), so negative indexing here
         would resolve one column short; Liberty is always column 5 in that reduced
         frame regardless, since only the last (rail) track was ever trimmed. ── */
      .rp-bd-liberty { grid-column: 5 / 6; display: none; align-items: center; }
      .rp-grid.lib-active .rp-bd-liberty { display: flex; }
      .rp-bd-liberty input,
      .rp-lib-computed input {
        background: #3273f6; border-color: #3273f6; color: #fff;
      }
      .rp-bd-liberty input::placeholder,
      .rp-lib-computed input::placeholder { color: rgba(255,255,255,0.65); }
      .rp-bd-liberty .mt-pfx,
      .rp-lib-computed .mt-pfx { color: #fff; opacity: 0.85; }
      .rp-lib-computed input { pointer-events: none; }

      /* ── Funeral grid — Insurer / Covered / Monthly Premium / [Liberty] / chevron,
         breakdown by covered person. The Liberty column only appears while the
         tool-wide "Compare to Liberty" toggle (bottom of the tool) is on — same
         toggle that reveals it on Risk Policies. ── */
      .fn-grid {
        display: grid; gap: 0.25rem 0.45rem; align-items: start;
        grid-template-columns: minmax(200px,1.6fr) 80px 115px 34px;
      }
      .fn-grid.lib-active {
        grid-template-columns: minmax(200px,1.6fr) 80px 115px 115px 34px;
      }
      .fn-grid:has(.fn-row) .mt-total-row { display: none; }
      .fn-lib-cell { display: none; }
      .fn-grid.lib-active .fn-lib-cell { display: flex; }
      .fn-lib-cell input { background: #3273f6; border-color: #3273f6; color: #fff; }
      .fn-lib-cell input::placeholder { color: rgba(255,255,255,0.65); }
      .fn-lib-cell .mt-pfx { color: #fff; opacity: 0.85; }
      .fn-count-cell input {
        width: 100%; height: 34px; text-align: center;
        font-family: var(--fb); font-size: 0.8rem; font-weight: 500; color: var(--navy-3);
        background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1);
        border-radius: 7px; outline: none; padding: 0 0.4rem; box-sizing: border-box;
      }
      .fn-count-cell input::placeholder { color: rgba(100,116,139,0.5); }
      .fn-count-cell input:focus { background: white; border-color: var(--navy-4); }
      .fn-expand-cell {
        display: flex; align-items: center; justify-content: center; height: 100%;
      }
      /* Expand button + breakdown wrapper/card come from the shared three-tier
         classes (.mt-tertiary-expand-btn / .mt-tertiary / .mt-tertiary-rows). Independent
         grid (not subgridded) on .fn-bd-row — a person's Name/Relationship/Cover/
         Premium don't map 1:1 onto the policy row's own Insurer/Covered/Premium
         columns the way Risk Policies' breakdown does, so each row just lays out
         its own 3 tracks at the same money-field width (115px) used throughout
         the tool. Name + Relationship share the combined Insurer+Covered span
         since neither needs to align with anything above it. */
      .fn-bd-row { grid-template-columns: 1fr 115px 115px; gap: 0.25rem 0.45rem; }
      .fn-bd-namewrap {
        grid-column: 1 / 2; display: flex; gap: 0.45rem; align-items: center;
        min-width: 0;
      }
      .fn-bd-namewrap > input { flex: 1; min-width: 0; }
      .fn-bd-namewrap > select { flex: 0 0 170px; }
      .fn-bd-cover { grid-column: 2 / 3; }
      .fn-bd-premium { grid-column: 3 / 4; }

      /* ── Medical & Health / Short-Term / Asset Insurance grids — both are Insurer /
         Type / Premium, so they share the exact same column template. ── */
      .epol-med-grid,
      .epol-st-grid {
        display: grid; gap: 0.25rem 0.45rem; align-items: center;
        grid-template-columns: minmax(160px,1.6fr) minmax(160px,1.6fr) 115px;
      }
      .epol-med-grid:has(.mt-secondary) .mt-total-row,
      .epol-st-grid:has(.mt-secondary) .mt-total-row { display: none; }

      /* ── Tool-wide Liberty Comparative toggle — pinned to the bottom-right corner of
         the tool (margin-top:auto pushes it down the flex column, past any leftover
         space below the last section) rather than trailing directly under it.
         Styled like the section Delete/Done toggles, not a primary action. ── */
      .epol-lib-toggle-row { display: flex; justify-content: flex-end; padding: 0.2rem 0.6rem 0; margin-top: auto; }
      .epol-lib-toggle-btn {
        padding: 0.22rem 0.5rem; background: transparent; border: none;
        font-family: var(--fb); font-size: 0.72rem; color: var(--navy-5);
        cursor: pointer; border-radius: 5px; opacity: 0.5;
        transition: opacity 0.14s, color 0.14s;
      }
      .epol-lib-toggle-btn:hover,
      .epol-lib-toggle-btn.active { opacity: 1; color: #3273f6; }
    `;
    document.head.appendChild(s);
  }

  // ── Constants ──────────────────────────────────────────────────────────────

  const RISK_TYPES = [
    { key: "life", label: "Life Cover", short: "Life" },
    { key: "disability", label: "Disability Cover", short: "Disability" },
    { key: "dreadDisease", label: "Dread Disease Cover", short: "Dread Disease" },
    { key: "incomeProtection", label: "Income Protection", short: "Income Protection" },
  ];

  const RISK_INSURERS = [
    "1Life",
    "Allan Gray",
    "Auto & General",
    "BrightRock",
    "Clientèle",
    "Discovery",
    "Guardrisk",
    "Liberty",
    "MiWay",
    "Momentum",
    "Old Mutual",
    "Outsurance",
    "PPS",
    "Sanlam",
    "Santam",
    "Zurich",
  ];

  const BENEFICIARIES = ["Business", "Child / Children", "Estate", "Family & Extended Family", "Other", "Spouse / Partner", "Trust"];

  const FUNERAL_RELATIONSHIPS = ["Main Member", "Spouse / Partner", "Child", "Parent", "Extended Family", "Other"];

  const MEDICAL_TYPES = ["Medical Aid", "Medical Insurance", "Gap Cover"];

  const SHORT_TERM_TYPES = [
    "Building Insurance",
    "Business Insurance",
    "Car Insurance",
    "Domestic Worker Insurance",
    "Home Contents Insurance",
    "Legal Insurance",
    "Pet Insurance",
    "Travel Insurance",
    "Other",
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Delegates to components/input-format.js — the single source of truth for
  // money parsing/formatting — rather than a local regex copy. Callers only
  // ever invoke this once a positive value is already confirmed, so the old
  // NaN/empty pass-through never actually triggered.
  function _moneyFmt(v) {
    return window.numberToMoney(v);
  }

  // Accepts either an input element (reads .value) or a raw string directly, so
  // callers working from an already-extracted raw-field object don't need to
  // re-wrap it as a fake element just to parse it.
  function _parseMoney(v) {
    const raw = typeof v === "string" ? v : v?.value || "";
    return window.moneyToNumber(raw);
  }

  function _moneyCell(field, extraClass = "", placeholder = "0") {
    return `<div class="mt-secondary-cell mt-money-wrap${extraClass ? " " + extraClass : ""}">
      <span class="mt-pfx">R</span>
      <input class="mt-input-sm" type="text" data-field="${field}" data-money="true" autocomplete="off" placeholder="${placeholder}">
    </div>`;
  }

  function _getInsurer(row) {
    const sel = row.querySelector('[data-field="insurer-sel"]');
    return sel?.value === "__custom__" ? row.querySelector('[data-field="insurer-custom"]')?.value || "" : sel?.value || "";
  }

  // ── Row readers ────────────────────────────────────────────────────────────
  // Single source of truth for "what fields does this row have and where do I find
  // them" — both _sync() (which needs numbers, for totals) and getState() (which
  // needs raw .value strings, for exact restore) read through these instead of each
  // keeping their own independent list of selectors. That duplication is exactly
  // what let the Cover Type checkbox lookup go stale in one place and not another.

  function _readInsurerRaw(row) {
    const sel = row.querySelector('[data-field="insurer-sel"]');
    const isCustom = sel?.value === "__custom__";
    return {
      insurerSel: isCustom ? "__custom__" : sel?.value || "",
      insurerCustom: isCustom ? row.querySelector('[data-field="insurer-custom"]')?.value || "" : "",
    };
  }

  function _readRiskRowRaw(row) {
    const types = {};
    RISK_TYPES.forEach((t) => {
      if (_typeChk(row, t.key)?.checked) {
        types[t.key] = {
          cover: row.querySelector(`[data-cover-type="${t.key}"]`)?.value || "",
          premium: row.querySelector(`[data-premium-type="${t.key}"]`)?.value || "",
          liberty: row.querySelector(`[data-lib-type="${t.key}"]`)?.value || "",
        };
      }
    });
    return {
      ..._readInsurerRaw(row),
      beneficiary: row.querySelector('[data-field="beneficiary"]')?.value || "",
      premium: row.querySelector('[data-field="premium"]')?.value || "",
      types,
    };
  }

  function _readFnPeople(row) {
    return [...row.querySelectorAll(".fn-bd-row")].map((pRow) => ({
      name: pRow.querySelector("[data-fn-name]")?.value || "",
      relationship: pRow.querySelector("[data-fn-relationship]")?.value || "",
      coverAmount: pRow.querySelector("[data-fn-cover]")?.value || "",
      premium: pRow.querySelector("[data-fn-premium]")?.value || "",
    }));
  }

  function _readFuneralRowRaw(row) {
    return {
      ..._readInsurerRaw(row),
      premium: row.querySelector('[data-field="premium"]')?.value || "",
      liberty: row.querySelector('[data-field="liberty"]')?.value || "",
      covered: row.querySelector('[data-field="covered"]')?.value || "",
      people: _readFnPeople(row),
    };
  }

  function _readSimpleRowRaw(row, extraFields = []) {
    const out = {
      ..._readInsurerRaw(row),
      insuranceType: row.querySelector('[data-field="insuranceType"]')?.value || "",
      premium: row.querySelector('[data-field="premium"]')?.value || "",
    };
    extraFields.forEach((f) => {
      out[f] = row.querySelector(`[data-field="${f}"]`)?.value || "";
    });
    return out;
  }

  function _chevronSVG(cls) {
    return `<svg class="${cls}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
  }

  function _insurerCell() {
    const insurerOpts = RISK_INSURERS.map((o) => `<option value="${o}">${o}</option>`).join("");
    return `<div class="mt-secondary-cell" style="display:flex;align-items:center;gap:0.35rem">
      <button class="mt-secondary-x" type="button" title="Remove">×</button>
      <select class="mt-select-sm" data-field="insurer-sel" style="flex:1;min-width:0">
        <option value="">Insurer</option>
        ${insurerOpts}
        <option value="__custom__">Custom…</option>
      </select>
      <input class="mt-input-sm" type="text" data-field="insurer-custom" placeholder="Type insurer…" autocomplete="off" style="display:none">
    </div>`;
  }

  // ── Risk policy row ────────────────────────────────────────────────────────

  // The Cover Type checkboxes are reparented to document.body while their menu is
  // open (see openTypeDD in _initEvents), which pulls them out of the row's DOM
  // subtree — a plain row.querySelector('[data-type-chk]') stops finding them for
  // as long as the menu is open. Tagging each checkbox with its row's id lets
  // _typeChk look it up document-wide regardless of where the menu currently lives.
  let _rpRowSeq = 0;

  function _typeChk(row, key) {
    const rid = row.dataset.rpRowId;
    return rid ? document.querySelector(`[data-type-chk="${key}"][data-row-id="${rid}"]`) : row.querySelector(`[data-type-chk="${key}"]`);
  }

  function _riskRow() {
    const rid = ++_rpRowSeq;
    const benOpts = BENEFICIARIES.map((o) => `<option value="${o}">${o}</option>`).join("");
    const typeOpts = RISK_TYPES.map(
      (t) => `
      <label class="rp-type-opt">
        <input type="checkbox" data-type-chk="${t.key}" data-row-id="${rid}">
        <span>${t.label}</span>
      </label>`,
    ).join("");

    return `<div class="mt-secondary rp-row" style="display:contents" data-rp-row-id="${rid}">
      <div class="rp-col-1">${_insurerCell()}</div>
      <div class="mt-secondary-cell rp-col-2 rp-type-cell">
        <div class="rp-type-dd">
          <button type="button" class="rp-type-dd-btn">
            <span class="rp-type-dd-label placeholder">Cover Type</span>
            ${_chevronSVG("rp-dd-chev")}
          </button>
          <div class="rp-type-dd-menu">${typeOpts}</div>
        </div>
      </div>
      <div class="mt-secondary-cell rp-col-3">
        <select class="mt-select-sm" data-field="beneficiary">
          <option value="">Beneficiary</option>
          ${benOpts}
        </select>
      </div>
      ${_moneyCell("premium", "rp-col-4", "Premium")}
      <div class="mt-secondary-cell mt-money-wrap rp-lib-computed">
        <span class="mt-pfx">R</span>
        <input class="mt-input-sm" type="text" data-field="liberty" data-money="true" placeholder="—" disabled>
      </div>
      <div class="mt-secondary-cell rp-expand-cell">
        <button class="mt-tertiary-expand-btn" type="button" title="Break down cover">${_chevronSVG("rp-chev")}</button>
      </div>
      <div class="mt-tertiary">
        <div class="mt-tertiary-rows mt-tertiary-card" data-bd-rows></div>
      </div>
    </div>`;
  }

  function _updateTypeDDLabel(row) {
    const lbl = row.querySelector(".rp-type-dd-label");
    if (!lbl) return;
    const checked = RISK_TYPES.filter((t) => _typeChk(row, t.key)?.checked);
    lbl.textContent = checked.length ? checked.map((t) => t.short).join(", ") : "Cover Type";
    lbl.classList.toggle("placeholder", !checked.length);
  }

  function _bdRowHTML(t) {
    return `<div class="mt-tertiary-row rp-bd-row" data-type="${t.key}">
      <span class="mt-tertiary-lbl rp-bd-lbl">${t.label}</span>
      <div class="mt-money-wrap rp-bd-cover">
        <span class="mt-pfx">R</span>
        <input class="mt-input-sm" type="text" data-cover-type="${t.key}" data-money="true" autocomplete="off" placeholder="Cover Amount">
      </div>
      <div class="mt-money-wrap rp-bd-premium">
        <span class="mt-pfx">R</span>
        <input class="mt-input-sm" type="text" data-premium-type="${t.key}" data-money="true" autocomplete="off" placeholder="Premium">
      </div>
      <div class="mt-money-wrap rp-bd-liberty">
        <span class="mt-pfx">R</span>
        <input class="mt-input-sm" type="text" data-lib-type="${t.key}" data-money="true" autocomplete="off" placeholder="Liberty">
      </div>
    </div>`;
  }

  function _updateBreakdownRows(row) {
    const bdRows = row.querySelector("[data-bd-rows]");
    if (!bdRows) return;
    RISK_TYPES.forEach((t) => {
      const chk = _typeChk(row, t.key);
      const existing = bdRows.querySelector(`.rp-bd-row[data-type="${t.key}"]`);
      if (chk?.checked && !existing) {
        bdRows.insertAdjacentHTML("beforeend", _bdRowHTML(t));
      } else if (!chk?.checked && existing) {
        existing.remove();
      }
    });
    // keep breakdown rows in a stable, fixed order
    RISK_TYPES.forEach((t) => {
      const el = bdRows.querySelector(`.rp-bd-row[data-type="${t.key}"]`);
      if (el) bdRows.appendChild(el);
    });
    _updateTypeDDLabel(row);
  }

  // Premium is captured once per policy, or once per cover type — never both.
  // Editing a breakdown premium makes the top-level field the (computed) sum of the
  // breakdown; editing the top-level field directly zeroes the breakdown premiums
  // back out and hands manual control back to it. See the input listener in
  // _initEvents for the top-level-edit-clears-breakdown half of that.
  function _updateRiskPremiumLock(row) {
    const topInput = row.querySelector('[data-field="premium"]');
    if (!topInput) return;
    let breakdownSum = 0;
    let hasBreakdownPremium = false;
    row.querySelectorAll("[data-premium-type]").forEach((el) => {
      const v = _parseMoney(el);
      if (v > 0) hasBreakdownPremium = true;
      breakdownSum += v;
    });
    const wrap = topInput.closest(".mt-money-wrap");
    if (hasBreakdownPremium) {
      topInput.value = _moneyFmt(String(breakdownSum));
      wrap?.classList.add("rp-premium-computed");
    } else {
      wrap?.classList.remove("rp-premium-computed");
    }
  }

  // Liberty Comparative values live per cover type, but visibility is per policy
  // (toggled by any of that policy's arrow buttons) — the policy-level field is
  // always the computed sum of the (visible) line items, never independently editable.
  function _updateRiskLibertyDisplay(row) {
    const topInput = row.querySelector('[data-field="liberty"]');
    if (!topInput) return;
    let total = 0;
    row.querySelectorAll("[data-lib-type]").forEach((el) => (total += _parseMoney(el)));
    topInput.value = total > 0 ? _moneyFmt(String(total)) : "";
    return total;
  }

  // ── Funeral policy row ─────────────────────────────────────────────────────
  // A funeral plan usually quotes one combined premium for the whole family, so
  // premium is never split — only cover amount breaks down, one line per covered
  // person, and the list is open-ended (however many kids/relatives the plan covers).

  function _funeralRow() {
    return `<div class="mt-secondary fn-row" style="display:contents">
      ${_insurerCell()}
      <div class="mt-secondary-cell fn-count-cell">
        <input type="text" inputmode="numeric" data-field="covered" placeholder="Covered" autocomplete="off">
      </div>
      ${_moneyCell("premium", "", "Premium")}
      ${_moneyCell("liberty", "fn-lib-cell", "Liberty")}
      <div class="mt-secondary-cell fn-expand-cell">
        <button class="mt-tertiary-expand-btn" type="button" title="Covered people">${_chevronSVG("fn-chev")}</button>
      </div>
      <div class="mt-tertiary">
        <div class="mt-tertiary-rows mt-tertiary-card" data-fn-rows></div>
      </div>
    </div>`;
  }

  // Keeps the breakdown's person rows in lockstep with the "Covered" count — grows by
  // appending blank rows, shrinks by dropping from the end. Also called (in reverse)
  // when a row is removed via its × so the count field stays truthful.
  function _syncFnPeopleCount(row, target) {
    const container = row.querySelector("[data-fn-rows]");
    if (!container) return;
    let current = container.querySelectorAll(".fn-bd-row").length;
    while (current < target) {
      container.insertAdjacentHTML("beforeend", _fnPersonRow());
      current++;
    }
    while (current > target) {
      container.lastElementChild?.remove();
      current--;
    }
  }

  function _fnPersonRow() {
    const opts = FUNERAL_RELATIONSHIPS.map((o) => `<option value="${o}">${o}</option>`).join("");
    return `<div class="mt-tertiary-row fn-bd-row">
      <div class="fn-bd-namewrap">
        <input class="mt-input-sm" type="text" data-fn-name placeholder="Name" autocomplete="off">
        <select class="mt-select-sm" data-fn-relationship>
          <option value="">Relationship</option>
          ${opts}
        </select>
      </div>
      <div class="mt-money-wrap fn-bd-cover">
        <span class="mt-pfx">R</span>
        <input class="mt-input-sm" type="text" data-fn-cover data-money="true" autocomplete="off" placeholder="Cover Amount">
      </div>
      <div class="mt-money-wrap fn-bd-premium">
        <span class="mt-pfx">R</span>
        <input class="mt-input-sm" type="text" data-fn-premium data-money="true" autocomplete="off" placeholder="Premium">
      </div>
    </div>`;
  }

  // ── Medical & Health row ───────────────────────────────────────────────────
  // Subscription-style, not a lump-sum product — no cover amount field.

  function _medicalRow() {
    const typeOpts = MEDICAL_TYPES.map((o) => `<option value="${o}">${o}</option>`).join("");
    return `<div class="mt-secondary" style="display:contents">
      ${_insurerCell()}
      <div class="mt-secondary-cell">
        <select class="mt-select-sm" data-field="insuranceType">
          <option value="">Type</option>
          ${typeOpts}
        </select>
      </div>
      ${_moneyCell("premium", "", "Premium")}
    </div>`;
  }

  // ── Short-Term / Asset Insurance row ───────────────────────────────────────

  function _shortTermRow() {
    const typeOpts = SHORT_TERM_TYPES.map((o) => `<option value="${o}">${o}</option>`).join("");
    return `<div class="mt-secondary" style="display:contents">
      ${_insurerCell()}
      <div class="mt-secondary-cell">
        <select class="mt-select-sm" data-field="insuranceType">
          <option value="">Type</option>
          ${typeOpts}
        </select>
      </div>
      ${_moneyCell("premium", "", "Premium")}
    </div>`;
  }

  // ── Template ───────────────────────────────────────────────────────────────

  function _template() {
    return `<div class="epol-wrapper glass-panel glass-panel--light calc-glass">
  <div class="calc-layout" style="position:relative">
    <div class="epol-hero-row">
      <div class="tool-hero-zone" id="hero-existing-policies"></div>
    </div>
    <div class="epol-pane">
      <div class="mt-primary collapsed" id="epol-sec-risk">
        <div class="mt-primary-hdr">
          <span class="mt-primary-title">Risk Policies</span>
          <div class="mt-primary-right">
            <span class="mt-primary-sum" id="epol-hdr-risk">—</span>
            <span class="mt-chev"></span>
          </div>
        </div>
        <div class="mt-primary-body">
          <div class="rp-grid">
            <div id="rp-rows" style="display:contents">
              ${_riskRow()}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-primary collapsed" id="epol-sec-funeral">
        <div class="mt-primary-hdr">
          <span class="mt-primary-title">Funeral Cover</span>
          <div class="mt-primary-right">
            <span class="mt-primary-sum" id="epol-hdr-funeral">—</span>
            <span class="mt-chev"></span>
          </div>
        </div>
        <div class="mt-primary-body">
          <div class="fn-grid">
            <div id="fn-rows" style="display:contents">
              ${_funeralRow()}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-primary collapsed" id="epol-sec-medical">
        <div class="mt-primary-hdr">
          <span class="mt-primary-title">Medical &amp; Health</span>
          <div class="mt-primary-right">
            <span class="mt-primary-sum" id="epol-hdr-medical">—</span>
            <span class="mt-chev"></span>
          </div>
        </div>
        <div class="mt-primary-body">
          <div class="epol-med-grid">
            <div id="mt-rows-medical" style="display:contents">
              ${_medicalRow()}
            </div>
          </div>
        </div>
      </div>

      <div class="mt-primary collapsed" id="epol-sec-shortterm">
        <div class="mt-primary-hdr">
          <span class="mt-primary-title">Short-Term / Asset Insurance</span>
          <div class="mt-primary-right">
            <span class="mt-primary-sum" id="epol-hdr-shortterm">—</span>
            <span class="mt-chev"></span>
          </div>
        </div>
        <div class="mt-primary-body">
          <div class="epol-st-grid">
            <div id="mt-rows-shortterm" style="display:contents">
              ${_shortTermRow()}
            </div>
          </div>
        </div>
      </div>

      <div class="epol-lib-toggle-row">
        <button type="button" class="epol-lib-toggle-btn" id="epol-lib-toggle">Liberty</button>
      </div>
    </div>
  </div>
</div>`;
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  function _initEvents(w, onSync) {
    // Cover Type menu is reparented to document.body while open (see openTypeDD) so it
    // can escape .mt-primary/.glass-panel's overflow:hidden and the containing-block that
    // .glass-panel--light's backdrop-filter creates for position:fixed descendants.
    // Once it's outside `w`, delegated listeners on `w` no longer see its events, so
    // open/close state and its checkbox handling live here instead, keyed off `openDD`.
    let openDD = null; // { dd, menu, homeParent, nextSibling, row }

    function closeDD() {
      if (!openDD) return;
      const { dd, menu, homeParent, nextSibling } = openDD;
      dd.classList.remove("open");
      menu.classList.remove("open");
      if (nextSibling) homeParent.insertBefore(menu, nextSibling);
      else homeParent.appendChild(menu);
      menu.style.left = "";
      menu.style.top = "";
      menu.style.minWidth = "";
      openDD = null;
    }

    function openTypeDD(ddBtn) {
      const dd = ddBtn.closest(".rp-type-dd");
      const menu = dd?.querySelector(".rp-type-dd-menu");
      const row = ddBtn.closest(".rp-row");
      if (!dd || !menu || !row) return;
      const homeParent = menu.parentElement;
      const nextSibling = menu.nextSibling;
      document.body.appendChild(menu);
      const r = ddBtn.getBoundingClientRect();
      menu.style.left = r.left + "px";
      menu.style.top = r.bottom + 4 + "px";
      menu.style.minWidth = r.width + "px";
      dd.classList.add("open");
      menu.classList.add("open");
      openDD = { dd, menu, homeParent, nextSibling, row };
    }

    // Scroll doesn't bubble, so closing on scroll needs a capture-phase listener.
    w.addEventListener("scroll", closeDD, true);

    document.addEventListener("click", (e) => {
      if (!openDD) return;
      if (e.target.closest(".rp-type-dd") === openDD.dd) return; // the toggle button's own click handler below owns this
      if (openDD.menu.contains(e.target)) return; // clicking a checkbox shouldn't close the menu
      closeDD();
    });

    document.addEventListener("change", (e) => {
      if (!openDD) return;
      const chk = e.target.closest("[data-type-chk]");
      if (!chk || !openDD.menu.contains(chk)) return;
      const { row } = openDD;
      _updateBreakdownRows(row);
      _updateRiskPremiumLock(row);
      if (chk.checked) row.classList.add("expanded");
      onSync?.();
    });

    // Typing directly into a policy's top-level premium hands manual control back to
    // it by zeroing out that policy's breakdown premiums (mirrors the other direction,
    // where editing a breakdown premium turns the top-level field into a computed sum).
    // Registered before the generic input->sync listener so the clear takes effect
    // before that sync pass reads the row's state.
    w.addEventListener("input", (e) => {
      if (!e.target.matches('[data-field="premium"]')) return;
      const row = e.target.closest(".rp-row");
      if (!row) return;
      row.querySelectorAll("[data-premium-type]").forEach((el) => (el.value = ""));
    });

    w.addEventListener("change", (e) => {
      const sel = e.target.closest('[data-field="insurer-sel"]');
      if (sel) {
        const cell = sel.closest(".mt-secondary-cell");
        const custom = cell?.querySelector('[data-field="insurer-custom"]');
        if (custom) {
          const isCustom = sel.value === "__custom__";
          sel.style.display = isCustom ? "none" : "";
          custom.style.display = isCustom ? "" : "none";
          if (isCustom) {
            custom.value = "";
            custom.focus();
          }
        }
      }
      // [data-type-chk] changes are handled by the document-level listener above —
      // the checkbox lives inside the portal'd menu while it's open, outside `w`.
    });

    w.addEventListener("click", (e) => {
      // Shared across Risk Policies and Funeral Cover rows — both carry .mt-secondary
      // alongside their own rp-row/fn-row class.
      const expandBtn = e.target.closest(".mt-tertiary-expand-btn");
      if (expandBtn) {
        expandBtn.closest(".mt-secondary")?.classList.toggle("expanded");
        return;
      }
      const ddBtn = e.target.closest(".rp-type-dd-btn");
      if (ddBtn) {
        const dd = ddBtn.closest(".rp-type-dd");
        const willOpen = !dd.classList.contains("open");
        closeDD();
        if (willOpen) openTypeDD(ddBtn);
        return;
      }
    });

    // "Covered" count drives the breakdown row list directly — no separate add button.
    // Resized on change (blur/Enter), not input, so rows aren't torn down mid-keystroke
    // while the FA is still typing a multi-digit number. No explicit onSync() call here:
    // this is a native "change" event bubbling through `w`, so the blanket change
    // listener registered in mount() already re-syncs once this returns.
    w.addEventListener("change", (e) => {
      const coveredEl = e.target.closest('.fn-row [data-field="covered"]');
      if (!coveredEl) return;
      const row = coveredEl.closest(".fn-row");
      const target = parseInt(coveredEl.value, 10) || 0;
      _syncFnPeopleCount(row, target);
    });
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  // Total across all four sections — Risk Policies, Funeral, Medical & Health, and
  // Short-Term/Asset — not just Risk Policies, so the hero figure matches its "Total
  // Premiums" label rather than silently only covering one section.
  function _syncHero(w) {
    if (!window.CalcHero) return;
    let totalPremium = 0;
    w.querySelectorAll("#rp-rows > .rp-row").forEach((row) => {
      totalPremium += _parseMoney(row.querySelector('[data-field="premium"]'));
      _updateRiskLibertyDisplay(row);
    });
    w.querySelectorAll("#fn-rows > .fn-row, #mt-rows-medical > .mt-secondary, #mt-rows-shortterm > .mt-secondary").forEach((row) => {
      totalPremium += _parseMoney(row.querySelector('[data-field="premium"]'));
    });
    CalcHero.update({
      primaries: [{ id: "epol-hero-current", value: totalPremium }],
    });
  }

  // The Liberty Comparative columns (Risk Policies + Funeral Cover) are driven by one
  // tool-wide toggle rather than anything per-row — see the "Liberty" button at the
  // bottom of the tool. Its active/inactive state is shown by color alone (matching
  // the section Delete/Done toggles), so the label itself never changes.
  function _syncLibMode(w, on) {
    w.classList.toggle("lib-mode", on);
    w.querySelector(".rp-grid")?.classList.toggle("lib-active", on);
    w.querySelector(".fn-grid")?.classList.toggle("lib-active", on);
    w.querySelector("#epol-lib-toggle")?.classList.toggle("active", on);
  }

  function _sync(w) {
    const categoryTotals = {};
    RISK_TYPES.forEach((t) => (categoryTotals[t.key] = { cover: 0, premium: 0 }));
    categoryTotals.funeralCover = { cover: 0, premium: 0 };
    categoryTotals.medical = { cover: 0, premium: 0 };
    categoryTotals.shortTerm = { cover: 0, premium: 0 };

    let totalRiskPremium = 0,
      unclassifiedPremium = 0,
      totalLibertyComparative = 0;

    const policies = [...w.querySelectorAll("#rp-rows > .rp-row")].map((row) => {
      _updateRiskPremiumLock(row);
      const raw = _readRiskRowRaw(row);
      const premium = _parseMoney(raw.premium);
      totalRiskPremium += premium;
      const types = {};
      let anyType = false;
      Object.entries(raw.types).forEach(([key, val]) => {
        anyType = true;
        const cover = _parseMoney(val.cover);
        const typePremium = _parseMoney(val.premium);
        const libertyComparative = _parseMoney(val.liberty);
        types[key] = { cover, premium: typePremium, libertyComparative };
        categoryTotals[key].cover += cover;
        categoryTotals[key].premium += typePremium;
      });
      if (!anyType) unclassifiedPremium += premium;
      const libertyTotal = _updateRiskLibertyDisplay(row) || 0;
      totalLibertyComparative += libertyTotal;
      return {
        insurer: _getInsurer(row),
        beneficiary: raw.beneficiary,
        premium,
        types,
        libertyTotal,
      };
    });

    let totalFuneralPremium = 0,
      totalFuneralLiberty = 0;
    const funeral = [...w.querySelectorAll("#fn-rows > .fn-row")].map((row) => {
      const raw = _readFuneralRowRaw(row);
      const premium = _parseMoney(raw.premium);
      const liberty = _parseMoney(raw.liberty);
      totalFuneralPremium += premium;
      totalFuneralLiberty += liberty;
      categoryTotals.funeralCover.premium += premium;
      const covered = parseInt(raw.covered, 10) || 0;
      const people = raw.people.map((p) => {
        const coverAmount = _parseMoney(p.coverAmount);
        const personPremium = _parseMoney(p.premium);
        categoryTotals.funeralCover.cover += coverAmount;
        return { name: p.name, relationship: p.relationship, coverAmount, premium: personPremium };
      });
      return { insurer: _getInsurer(row), premium, liberty, covered, people };
    });

    let totalMedicalPremium = 0;
    const medical = [...w.querySelectorAll("#mt-rows-medical > .mt-secondary")].map((row) => {
      const raw = _readSimpleRowRaw(row);
      const premium = _parseMoney(raw.premium);
      totalMedicalPremium += premium;
      categoryTotals.medical.premium += premium;
      return { insurer: _getInsurer(row), insuranceType: raw.insuranceType, premium };
    });

    let totalShortTermPremium = 0;
    const shortTerm = [...w.querySelectorAll("#mt-rows-shortterm > .mt-secondary")].map((row) => {
      const raw = _readSimpleRowRaw(row);
      const premium = _parseMoney(raw.premium);
      totalShortTermPremium += premium;
      categoryTotals.shortTerm.premium += premium;
      return { insurer: _getInsurer(row), insuranceType: raw.insuranceType, premium };
    });

    const totalPremium = totalRiskPremium + totalFuneralPremium + totalMedicalPremium + totalShortTermPremium;
    const totalCover = Object.values(categoryTotals).reduce((s, c) => s + c.cover, 0);
    const comparablePremium = totalRiskPremium + totalFuneralPremium;
    totalLibertyComparative += totalFuneralLiberty;

    const _hdr = (id, val) => {
      const el = w.querySelector(id);
      if (el) el.textContent = val > 0 ? "R " + _moneyFmt(String(val)) + " pm" : "—";
    };
    _hdr("#epol-hdr-risk", totalRiskPremium);
    _hdr("#epol-hdr-funeral", totalFuneralPremium);
    _hdr("#epol-hdr-medical", totalMedicalPremium);
    _hdr("#epol-hdr-shortterm", totalShortTermPremium);

    _syncHero(w);

    if (window.MeetingState)
      window.MeetingState.set("existingPolicies", {
        policies,
        funeral,
        medical,
        shortTerm,
        categoryTotals,
        totalRiskPremium,
        totalFuneralPremium,
        totalMedicalPremium,
        totalShortTermPremium,
        totalPremium,
        totalCover,
        comparablePremium,
        unclassifiedPremium,
        totalLibertyComparative,
      });
  }

  // ── Module ─────────────────────────────────────────────────────────────────

  window.App?.register("existing-policies", {
    id: "existing-policies",
    title: "Existing Policies",
    guide: {
      intro: {
        heading: "Existing Policies",
        html: `<p>Four sections, grouped by how the product actually works:</p>
               <ul>
                 <li><strong>Risk Policies</strong> — life, disability, dread disease, income protection. Capture one premium per policy, then uncollapse to break it down by cover type once you know the split.</li>
                 <li><strong>Funeral Cover</strong> — one premium per policy, but cover amount breaks down by covered person (main member, spouse, each child, extended family) since payout varies per person.</li>
                 <li><strong>Medical &amp; Health</strong> — medical aid, gap cover. Subscription-style, no cover amount.</li>
                 <li><strong>Short-Term / Asset Insurance</strong> — car, home, business, etc. Captures sum insured alongside premium, useful for spotting under-insurance.</li>
               </ul>`,
      },
    },

    mount(wrapper) {
      _injectCSS();
      wrapper.insertAdjacentHTML("beforeend", _template());
      const w = wrapper.querySelector(".epol-wrapper");

      if (window.CalcHero) {
        CalcHero.render("#hero-existing-policies", {
          primaries: [{ id: "epol-hero-current", label: "Total Premiums", negative: true }],
        });
      }

      _initEvents(w, () => _sync(w));
      MtUI.initSections(w, { accordion: true });
      MtUI.initMoney(w, () => _sync(w));

      MtUI.initDeleteMode(w.querySelector("#epol-sec-risk"), {
        addLabel: "+ Add policy",
        onAdd: () => {
          w.querySelectorAll("#rp-rows > .rp-row.expanded").forEach((row) => row.classList.remove("expanded"));
          w.querySelector("#rp-rows")?.insertAdjacentHTML("beforeend", _riskRow());
          _sync(w);
        },
        onDelete: (row) => {
          row.remove();
          _sync(w);
        },
        rowSelector: ".rp-row",
      });

      MtUI.initDeleteMode(w.querySelector("#epol-sec-funeral"), {
        addLabel: "+ Add policy",
        onAdd: () => {
          w.querySelector("#fn-rows")?.insertAdjacentHTML("beforeend", _funeralRow());
          _sync(w);
        },
        onDelete: (row) => {
          row.remove();
          _sync(w);
        },
        rowSelector: ".fn-row",
      });

      MtUI.initDeleteMode(w.querySelector("#epol-sec-medical"), {
        addLabel: "+ Add policy",
        onAdd: () => {
          w.querySelector("#mt-rows-medical")?.insertAdjacentHTML("beforeend", _medicalRow());
          _sync(w);
        },
        onDelete: (row) => {
          row.remove();
          _sync(w);
        },
      });

      MtUI.initDeleteMode(w.querySelector("#epol-sec-shortterm"), {
        addLabel: "+ Add policy",
        onAdd: () => {
          w.querySelector("#mt-rows-shortterm")?.insertAdjacentHTML("beforeend", _shortTermRow());
          _sync(w);
        },
        onDelete: (row) => {
          row.remove();
          _sync(w);
        },
      });

      w.querySelector("#epol-lib-toggle")?.addEventListener("click", () => {
        _syncLibMode(w, !w.classList.contains("lib-mode"));
        _sync(w);
      });

      w.addEventListener("input", () => _sync(w));
      w.addEventListener("change", () => _sync(w));
      _sync(w);
    },

    getState() {
      const w = window.App._wrappers[this.id]?.querySelector(".epol-wrapper");
      if (!w) return null;

      const riskRows = [...w.querySelectorAll("#rp-rows > .rp-row")].map((row) => ({
        ..._readRiskRowRaw(row),
        expanded: row.classList.contains("expanded"),
      }));

      const funeralRows = [...w.querySelectorAll("#fn-rows > .fn-row")].map((row) => ({
        ..._readFuneralRowRaw(row),
        expanded: row.classList.contains("expanded"),
      }));

      const medicalRows = [...w.querySelectorAll("#mt-rows-medical > .mt-secondary")].map((row) => _readSimpleRowRaw(row));
      const shortTermRows = [...w.querySelectorAll("#mt-rows-shortterm > .mt-secondary")].map((row) => _readSimpleRowRaw(row));

      return {
        riskRows,
        funeralRows,
        medicalRows,
        shortTermRows,
        riskCollapsed: w.querySelector("#epol-sec-risk")?.classList.contains("collapsed") ?? true,
        funeralCollapsed: w.querySelector("#epol-sec-funeral")?.classList.contains("collapsed") ?? true,
        medicalCollapsed: w.querySelector("#epol-sec-medical")?.classList.contains("collapsed") ?? true,
        shortTermCollapsed: w.querySelector("#epol-sec-shortterm")?.classList.contains("collapsed") ?? true,
        libertyMode: w.classList.contains("lib-mode"),
      };
    },

    setState(extra) {
      if (!extra) return;
      const w = window.App._wrappers[this.id]?.querySelector(".epol-wrapper");
      if (!w) return;

      const _restoreInsurer = (row, d) => {
        const sel = row.querySelector('[data-field="insurer-sel"]');
        const selCustom = row.querySelector('[data-field="insurer-custom"]');
        if (d.insurerSel === "__custom__" && sel && selCustom) {
          sel.value = "__custom__";
          sel.style.display = "none";
          selCustom.value = d.insurerCustom || "";
          selCustom.style.display = "";
        } else if (sel) {
          sel.value = d.insurerSel || "";
        }
      };

      const riskContainer = w.querySelector("#rp-rows");
      if (riskContainer) {
        riskContainer.innerHTML = "";
        const rows = extra.riskRows?.length ? extra.riskRows : [{}];
        rows.forEach((d) => {
          riskContainer.insertAdjacentHTML("beforeend", _riskRow());
          const row = riskContainer.lastElementChild;
          _restoreInsurer(row, d);
          const benEl = row.querySelector('[data-field="beneficiary"]');
          if (benEl) benEl.value = d.beneficiary || "";
          const premEl = row.querySelector('[data-field="premium"]');
          if (premEl) premEl.value = d.premium || "";
          Object.keys(d.types || {}).forEach((key) => {
            const chk = row.querySelector(`[data-type-chk="${key}"]`);
            if (chk) chk.checked = true;
          });
          _updateBreakdownRows(row);
          Object.entries(d.types || {}).forEach(([key, val]) => {
            const coverEl = row.querySelector(`[data-cover-type="${key}"]`);
            if (coverEl) coverEl.value = val?.cover || "";
            const premEl2 = row.querySelector(`[data-premium-type="${key}"]`);
            if (premEl2) premEl2.value = val?.premium || "";
            const libEl = row.querySelector(`[data-lib-type="${key}"]`);
            if (libEl) libEl.value = val?.liberty || "";
          });
          _updateRiskPremiumLock(row);
          _updateRiskLibertyDisplay(row);
          if (d.expanded) row.classList.add("expanded");
        });
      }

      const funeralContainer = w.querySelector("#fn-rows");
      if (funeralContainer) {
        funeralContainer.innerHTML = "";
        const rows = extra.funeralRows?.length ? extra.funeralRows : [{}];
        rows.forEach((d) => {
          funeralContainer.insertAdjacentHTML("beforeend", _funeralRow());
          const row = funeralContainer.lastElementChild;
          _restoreInsurer(row, d);
          const premEl = row.querySelector('[data-field="premium"]');
          if (premEl) premEl.value = d.premium || "";
          const libEl = row.querySelector('[data-field="liberty"]');
          if (libEl) libEl.value = d.liberty || "";
          const coveredEl = row.querySelector('[data-field="covered"]');
          if (coveredEl) coveredEl.value = d.covered || "";
          const peopleContainer = row.querySelector("[data-fn-rows]");
          (d.people || []).forEach((p) => {
            peopleContainer.insertAdjacentHTML("beforeend", _fnPersonRow());
            const pRow = peopleContainer.lastElementChild;
            const nameEl = pRow.querySelector("[data-fn-name]");
            if (nameEl) nameEl.value = p.name || "";
            const relEl = pRow.querySelector("[data-fn-relationship]");
            if (relEl) relEl.value = p.relationship || "";
            const coverEl = pRow.querySelector("[data-fn-cover]");
            if (coverEl) coverEl.value = p.coverAmount || "";
            const premEl = pRow.querySelector("[data-fn-premium]");
            if (premEl) premEl.value = p.premium || "";
          });
          if (d.expanded) row.classList.add("expanded");
        });
      }

      const _restoreSimple = (containerSel, rowFn, rows, extraFields) => {
        const container = w.querySelector(containerSel);
        if (!container) return;
        container.innerHTML = "";
        (rows?.length ? rows : [{}]).forEach((d) => {
          container.insertAdjacentHTML("beforeend", rowFn());
          const row = container.lastElementChild;
          _restoreInsurer(row, d);
          const typeEl = row.querySelector('[data-field="insuranceType"]');
          if (typeEl) typeEl.value = d.insuranceType || "";
          const premEl = row.querySelector('[data-field="premium"]');
          if (premEl) premEl.value = d.premium || "";
          (extraFields || []).forEach((f) => {
            const el = row.querySelector(`[data-field="${f}"]`);
            if (el) el.value = d[f] || "";
          });
        });
      };

      _restoreSimple("#mt-rows-medical", _medicalRow, extra.medicalRows);
      _restoreSimple("#mt-rows-shortterm", _shortTermRow, extra.shortTermRows);

      w.querySelector("#epol-sec-risk")?.classList.toggle("collapsed", extra.riskCollapsed ?? true);
      w.querySelector("#epol-sec-funeral")?.classList.toggle("collapsed", extra.funeralCollapsed ?? true);
      w.querySelector("#epol-sec-medical")?.classList.toggle("collapsed", extra.medicalCollapsed ?? true);
      w.querySelector("#epol-sec-shortterm")?.classList.toggle("collapsed", extra.shortTermCollapsed ?? true);
      _syncLibMode(w, !!extra.libertyMode);

      _sync(w);
    },
  });
})();

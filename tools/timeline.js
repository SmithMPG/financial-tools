// tools/timeline.js
// Life & planning timeline — one chronological list of cards (date + description,
// optional amount), covering personal, employment, and household milestones,
// plus Past events (what already happened) and Planning events (what's still
// to be funded — green-tinted, and the source of Financial Planning's goals).

(function () {
  "use strict";

  const _CURRENT_YEAR = new Date().getFullYear();

  const CATEGORIES = [
    { key: "personal",   label: "Marital Events" },
    { key: "employment", label: "Employment" },
    { key: "household",  label: "Household" },
    { key: "past",        label: "Past Event" },
    { key: "planning",    label: "Planning Event" },
  ];

  // Every card has exactly one trailing field, always visible (no more open/
  // closed toggle) — its type is fixed by the preset: "regime" (Marriage),
  // "name" (dependants), "gross" (a job), "amount" (a financial goal),
  // "location" (Born), or null (Divorce/Separation — nothing to capture).
  // Whichever type is in play, the field occupies the same fixed-width slot
  // (.tl-row-value) so cards read as one consistent shape regardless of type.
  const REGIME_OPTIONS = ["Community of Property", "ANC with Accrual", "ANC without Accrual"];
  const RELATIONSHIP_OPTIONS = ["Child", "Stepchild", "Grandchild", "Parent", "Sibling", "Other Dependent"];

  const PRESETS = [
    { category: "personal",   label: "Marriage",             description: "Marriage",             field: "regime", field2: "name" },
    { category: "personal",   label: "Divorce / Separation",  description: "Divorce / Separation", field: null },

    { category: "employment", label: "Current Employment",   description: "Current employment",   field: "gross",    field2: "occupation" },
    { category: "employment", label: "Business",             description: "Business",             field: "turnover", field2: "industry" },

    { category: "household",  label: "Child",                description: "Child born",           field: "name" },
    { category: "household",  label: "Other Dependent",      description: "Started supporting",   field: "name", field2: "relationship" },

    // Past events — things that already happened, captured to build the client
    // picture. No money is allocated toward these going forward.
    { category: "past",       label: "Graduation",           description: "Graduation",           field: "amount", field2: "qualification" },
    { category: "past",       label: "Business Started",     description: "Started a business",   field: "amount", field2: "industry" },
    { category: "past",       label: "Bought a House",       description: "Bought a house",       field: "amount", field2: "location" },
    { category: "past",       label: "Bought a Car",         description: "Bought a car",          field: "amount", field2: "makeModel" },
    { category: "past",       label: "Wedding",               description: "Wedding",              field: "amount" },

    // Planning events — things still to fund. These are the goals that show up
    // on the Investments side of Financial Planning.
    { category: "planning",   label: "Buy a Car",            description: "Buy a car",            field: "amount" },
    { category: "planning",   label: "Education Funding",    description: "Education Funding",    field: "amount", field2: "beneficiary" },
    { category: "planning",   label: "Emergency Fund",       description: "Emergency Fund",       field: "amount" },
    { category: "planning",   label: "Holiday",               description: "Holiday",              field: "amount", field2: "location" },
    { category: "planning",   label: "House Deposit",        description: "House deposit",        field: "amount", field2: "location" },
    { category: "planning",   label: "Retirement Funding",   description: "Retirement Funding",   field: "amount" },

    // One custom fallback per category, always last in its dropdown — description
    // starts blank so the FA can type whatever isn't covered by a preset above,
    // still with that category's usual field type attached.
    { category: "personal",   label: "Custom", description: "", field: null },
    { category: "employment", label: "Custom", description: "", field: "gross", field2: "occupation" },
    { category: "household",  label: "Custom", description: "", field: "name", field2: "relationship" },
    { category: "past",       label: "Custom", description: "", field: "amount" },
    { category: "planning",   label: "Custom", description: "", field: "amount" },
  ];

  // State
  let _events = [];
  let _nextId = 1;
  let _currentAge = null;

  function _uid() {
    return _nextId++;
  }
  function _reset() {
    _nextId = 1;
    _events = [];
    _currentAge = null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Delegates to components/input-format.js — the single source of truth for
  // money parsing/formatting — rather than a local regex copy. Empty/non-
  // numeric input must stay "" (not "0") since this also reformats a field
  // live while the FA is still typing (see the "input" handler below).
  function _fmtR(v) {
    if (String(v ?? "").replace(/[^0-9.]/g, "") === "") return "";
    return window.numberToMoney(window.moneyToNumber(v));
  }
  function _esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  // Age at any event is just its year minus birth year — no projection needed.
  function _ageAt(year, bornYear) {
    const y = parseFloat(year);
    if (bornYear == null || isNaN(y)) return null;
    return Math.round(y - bornYear);
  }
  function _sortedEvents() {
    return [..._events].sort((a, b) => (parseFloat(a.year) || 0) - (parseFloat(b.year) || 0));
  }
  // Birth year comes from the Born card. If more than one somehow exists, the
  // most recently added wins.
  function _deriveBornYear() {
    const born = _events.filter((e) => e.type === "born");
    if (!born.length) return null;
    const y = parseFloat(born[born.length - 1].year);
    return isNaN(y) ? null : y;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  function _injectCSS() {
    if (document.getElementById("tl-css")) return;
    const s = document.createElement("style");
    s.id = "tl-css";
    s.textContent = `
      .tl-list { display: flex; flex-direction: column; gap: 0.5rem; }

      /* Boxed card, matching the collapsible-section look used elsewhere (Existing
         Portfolio, etc.) — a plain flat list read as too little visual weight per
         entry once cards stopped being split across two columns. */
      .tl-row {
        display: flex; align-items: center; gap: 0.6rem;
        padding: 0.6rem 0.85rem;
        background: rgba(0,0,0,0.02);
        border: 1px solid rgba(0,0,0,0.07);
        border-radius: 0.75rem;
        transition: background 0.15s, border-color 0.15s;
      }
      .tl-row-x {
        display: none; flex-shrink: 0; width: 20px; height: 20px;
        align-items: center; justify-content: center;
        padding: 0; background: none; border: none; cursor: pointer;
        font-size: 0.9rem; color: #dc2626; opacity: 0.6; border-radius: 3px;
      }
      .tl-row-x:hover { opacity: 1; }
      .mt-panel.tl-delete-mode .tl-row-x { display: flex; }

      .tl-row-date { flex-shrink: 0; width: 108px; display: flex; align-items: center; gap: 0.3rem; }
      .tl-year-input {
        flex: 1; min-width: 0; height: 34px; text-align: center; box-sizing: border-box;
        font-family: var(--fb); font-size: 0.75rem; font-weight: 500; color: var(--navy-3);
        background: transparent; border: 1px solid transparent;
        border-radius: 7px; padding: 0 0.2rem; outline: none;
        transition: background 0.15s, border-color 0.15s;
      }
      .tl-year-input:hover { background: rgba(0,0,0,0.03); }
      .tl-year-input:focus { background: white; border-color: var(--navy-4); }
      .tl-row-age {
        flex-shrink: 0; width: 22px; text-align: center;
        font-family: var(--fb); font-size: 0.75rem; font-weight: 700; color: var(--navy-3);
      }

      /* Pre-populated from the preset but still freely editable (except Born,
         which is fixed — see .tl-row-desc--fixed) — floats as plain text on the
         card, Trello-style, no visible box until hover/focus. */
      .tl-row-desc {
        flex: 1; min-width: 0; height: 34px; box-sizing: border-box;
        font-family: var(--fb); font-size: 0.82rem; color: var(--navy-3);
        background: transparent; border: 1px solid transparent;
        border-radius: 7px; padding: 0 0.65rem; outline: none;
        transition: background 0.15s, border-color 0.15s;
      }
      .tl-row-desc:hover { background: rgba(0,0,0,0.03); }
      .tl-row-desc:focus { background: rgba(255,255,255,0.6); border-color: rgba(0,0,0,0.1); }
      .tl-row-desc::placeholder { color: rgba(100,116,139,0.5); }
      /* Static text, not an input — same box/padding as the editable version so
         the Born card's description still lines up with every other card's. */
      span.tl-row-desc {
        display: flex; align-items: center;
        border-color: transparent; background: transparent;
      }

      /* Trailing field — always visible, one fixed-size slot regardless of type
         (money for gross/amount, text for name/location, select for regime), so
         cards read as one consistent shape and the field is freely swappable
         between types without anything reflowing. */
      .tl-row-value {
        flex-shrink: 0; width: 180px; height: 34px; box-sizing: border-box;
      }
      .tl-row-value.mt-money-wrap input { flex: 1; min-width: 0; }
      input.tl-row-value {
        font-family: var(--fb); font-size: 0.8rem; color: var(--navy-3);
        background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1);
        border-radius: 7px; padding: 0 0.5rem; outline: none;
        transition: background 0.15s, border-color 0.15s;
      }
      input.tl-row-value:focus { background: white; border-color: var(--navy-4); }
      input.tl-row-value::placeholder { color: rgba(100,116,139,0.5); }
      select.tl-row-value {
        font-family: var(--fb); font-size: 0.78rem; color: var(--navy-3);
        background-color: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1);
        border-radius: 7px; padding: 0 0.4rem; outline: none; cursor: pointer;
        appearance: none; -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23334155' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 0.5rem center; padding-right: 1.5rem;
      }
      select.tl-row-value:focus { background-color: white; border-color: var(--navy-4); }
      select.tl-row-value:has(option:checked[value=""]) { color: rgba(100,116,139,0.5); }

      /* ── Born card — the age anchor for every other card. Same card shape as
         everything else (computed age, a trailing Location field), just fixed
         description and no delete button, blue-tinted so it's easy to spot. */
      .tl-row--born {
        background: rgba(50,115,246,0.07);
        border-color: rgba(50,115,246,0.25);
      }
      /* ── Planning event card — a future goal still to be funded, green-tinted
         to set it apart from Past events (which are just history, not something
         to allocate money toward). */
      .tl-row--planning {
        background: rgba(22,163,74,0.07);
        border-color: rgba(22,163,74,0.25);
      }

      /* ── Footer / add ── */
      .tl-controls { margin: auto 0 -2rem; padding-top: 0.8rem; flex-shrink: 0; }
      .tl-footer { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
      .tl-footer-add { display: flex; gap: 0.5rem; flex-wrap: wrap; }

      .tl-add-dd { position: relative; }
      .tl-dd-menu {
        display: none;
        position: absolute; bottom: 100%; left: 0; margin-bottom: 0.35rem;
        min-width: 220px; max-height: 340px; overflow-y: auto;
        background: #fff;
        border: 1px solid rgba(0,0,0,0.1);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        padding: 0.35rem;
        z-index: 20;
        flex-direction: column;
      }
      .tl-add-dd.open .tl-dd-menu { display: flex; }
      .tl-dd-item {
        text-align: left;
        padding: 0.35rem 0.55rem;
        background: none; border: none; border-radius: 5px;
        font-family: var(--fb); font-size: 0.75rem; color: var(--navy-4);
        cursor: pointer;
      }
      .tl-dd-item:hover { background: rgba(0,0,0,0.05); }
    `;
    document.head.appendChild(s);
  }

  // ── Row HTML ──────────────────────────────────────────────────────────────

  // One trailing field per card, always visible — shape fixed by ev.field.
  function _moneyFieldHTML(ev, field, placeholder) {
    return `<div class="mt-money-wrap tl-amt-wrap tl-row-value">
      <span class="mt-pfx">R</span>
      <input class="mt-input-sm" type="text" data-field="${field}" data-id="${ev.id}"
        value="${_fmtR(ev[field])}" placeholder="${placeholder}" inputmode="numeric" autocomplete="off">
    </div>`;
  }

  // Renders one field slot — same signature regardless of type, so a card can
  // carry a second slot (ev.field2) built from the exact same vocabulary as the
  // first (ev.field) whenever one is needed. Only Marriage uses a second slot
  // today (marital regime + spouse name), but any preset can add a field2.
  function _fieldHTML(ev, fieldType, placeholderOverride) {
    switch (fieldType) {
      case "amount": {
        const placeholder = placeholderOverride ?? (/retirement/i.test(ev.description || "")
          ? "Net amount needed pm"
          : ev.category === "planning" ? "Amount needed" : "Amount");
        return _moneyFieldHTML(ev, "lumpSum", placeholder);
      }
      case "gross":
        return _moneyFieldHTML(ev, "gross", placeholderOverride ?? "Monthly gross");
      case "turnover":
        return _moneyFieldHTML(ev, "turnover", placeholderOverride ?? "Annual turnover");
      case "name":
        return `<input class="tl-row-value" type="text" data-field="name" data-id="${ev.id}"
          value="${_esc(ev.name)}" placeholder="${placeholderOverride ?? "Name"}" autocomplete="off">`;
      case "location":
        return `<input class="tl-row-value" type="text" data-field="location" data-id="${ev.id}"
          value="${_esc(ev.location)}" placeholder="${placeholderOverride ?? "Where?"}" autocomplete="off">`;
      case "occupation":
        return `<input class="tl-row-value" type="text" data-field="occupation" data-id="${ev.id}"
          value="${_esc(ev.occupation)}" placeholder="${placeholderOverride ?? "Occupation"}" autocomplete="off">`;
      case "industry":
        return `<input class="tl-row-value" type="text" data-field="industry" data-id="${ev.id}"
          value="${_esc(ev.industry)}" placeholder="${placeholderOverride ?? "Industry"}" autocomplete="off">`;
      case "qualification":
        return `<input class="tl-row-value" type="text" data-field="qualification" data-id="${ev.id}"
          value="${_esc(ev.qualification)}" placeholder="${placeholderOverride ?? "Qualification"}" autocomplete="off">`;
      case "beneficiary":
        return `<input class="tl-row-value" type="text" data-field="beneficiary" data-id="${ev.id}"
          value="${_esc(ev.beneficiary)}" placeholder="${placeholderOverride ?? "Beneficiary"}" autocomplete="off">`;
      case "makeModel":
        return `<input class="tl-row-value" type="text" data-field="makeModel" data-id="${ev.id}"
          value="${_esc(ev.makeModel)}" placeholder="${placeholderOverride ?? "Make & Model"}" autocomplete="off">`;
      case "regime": {
        const opts = REGIME_OPTIONS.map((o) => `<option value="${o}"${o === ev.regime ? " selected" : ""}>${o}</option>`).join("");
        return `<select class="tl-row-value" data-field="regime" data-id="${ev.id}">
          <option value="">${placeholderOverride ?? "Marital Regime"}</option>
          ${opts}
        </select>`;
      }
      case "relationship": {
        const opts = RELATIONSHIP_OPTIONS.map((o) => `<option value="${o}"${o === ev.relationship ? " selected" : ""}>${o}</option>`).join("");
        return `<select class="tl-row-value" data-field="relationship" data-id="${ev.id}">
          <option value="">${placeholderOverride ?? "Relationship"}</option>
          ${opts}
        </select>`;
      }
      default:
        return "";
    }
  }

  // Field-2 placeholder overrides, keyed by field2's type — "location" defaults
  // to "Where?" (Born's field1 placeholder) but reads better as "Location" when
  // it's a second slot on a purchase/goal card.
  const FIELD2_PLACEHOLDER = { name: "Spouse name", location: "Location" };

  // Money fields (amount/gross/turnover) always render rightmost, regardless
  // of which slot — ev.field vs ev.field2 — actually stores them. Storage
  // stays as-is (several lookups elsewhere key off ev.field === "amount",
  // e.g. Financial Planning's Timeline goal detection); this only reorders
  // the two rendered inputs so a card reads label-first, number-last.
  const MONEY_FIELD_TYPES = ["amount", "gross", "turnover"];

  function _trailingHTML(ev) {
    const field1 = _fieldHTML(ev, ev.field);
    const field2 = ev.field2 ? _fieldHTML(ev, ev.field2, FIELD2_PLACEHOLDER[ev.field2]) : "";
    const field1IsMoney = MONEY_FIELD_TYPES.includes(ev.field);
    return field1IsMoney && field2 ? field2 + field1 : field1 + field2;
  }

  function _rowHTML(ev, bornYear) {
    const isBorn = ev.type === "born";
    const age = _ageAt(ev.year, bornYear);
    const classes = ["tl-row", isBorn ? "tl-row--born" : ev.category === "planning" ? "tl-row--planning" : ""].filter(Boolean).join(" ");
    const desc = isBorn
      ? `<span class="tl-row-desc">${_esc(ev.description)}</span>`
      : `<input class="tl-row-desc" type="text" data-field="description" data-id="${ev.id}"
          value="${_esc(ev.description)}" placeholder="Description" autocomplete="off">`;
    return `<div class="${classes}" data-id="${ev.id}">
      ${isBorn
        ? `<span class="tl-row-x" aria-hidden="true"></span>`
        // tabindex="-1" keeps this out of the tab sequence — it sits before the
        // year field in DOM order, so left in flow it steals focus between one
        // row's last field and the next row's year instead of a clean Tab-through.
        : `<button type="button" class="tl-row-x" data-id="${ev.id}" title="Remove" tabindex="-1">×</button>`}
      <div class="tl-row-date">
        <input class="tl-year-input" type="text" data-id="${ev.id}" value="${ev.year ?? ""}" inputmode="numeric">
        ${age != null ? `<span class="tl-row-age">${age}</span>` : ""}
      </div>
      ${desc}
      ${_trailingHTML(ev)}
    </div>`;
  }

  // ── Template ──────────────────────────────────────────────────────────────

  // One button + menu per category — guides the meeting through Marital Events,
  // Employment, Household, and Life Event in turn, rather than one combined menu.
  function _ddHTML(cat) {
    const presets = PRESETS.filter((p) => p.category === cat.key && p.label !== "Custom");
    if (cat.key === "past" || cat.key === "planning") presets.sort((a, b) => a.label.localeCompare(b.label));
    const custom = PRESETS.find((p) => p.category === cat.key && p.label === "Custom");
    if (custom) presets.push(custom);
    const items = presets
      .map((p) => `<button class="tl-dd-item" data-preset="${PRESETS.indexOf(p)}" type="button">${p.label}</button>`)
      .join("");
    return `<div class="tl-add-dd" data-cat="${cat.key}">
      <button class="mt-primary-add-btn tl-add-btn" type="button">+ ${cat.label} ▾</button>
      <div class="tl-dd-menu">
        ${items}
      </div>
    </div>`;
  }

  function _template() {
    return `<div class="mt-panel calc-glass">
      <div class="mt-pane">

        <div class="tl-list" id="tl-rows"></div>

        <div class="tl-controls">
          <div class="tl-footer">
            <div class="tl-footer-add">
              ${CATEGORIES.map((cat) => _ddHTML(cat)).join("")}
            </div>
            <button class="mt-primary-del-btn" id="tl-del-toggle" type="button">Delete</button>
          </div>
        </div>

      </div>
    </div>`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function _render(w) {
    const container = w.querySelector("#tl-rows");
    if (!container) return;
    const bornYear = _deriveBornYear();
    _currentAge = bornYear != null ? _CURRENT_YEAR - bornYear : null;
    container.innerHTML = _sortedEvents().map((ev) => _rowHTML(ev, bornYear)).join("");
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  function _sync() {
    window.MeetingState?.set("timeline", {
      age: _currentAge ?? "",
      events: _events.map((e) => ({ ...e })),
    });
  }

  // ── Events ────────────────────────────────────────────────────────────────

  function _commitYear(w, id, rawValue) {
    const ev = _events.find((e) => e.id === id);
    if (!ev) return;
    const n = parseFloat(rawValue);
    // Fires on every blur, including a plain Tab-out with nothing edited — only
    // rebuild (and reposition) the list when the year actually changed. _render
    // replaces the whole row list's DOM, which would otherwise destroy the very
    // input the browser is mid-Tab toward, silently dropping focus.
    if (isNaN(n) || n === ev.year) return;
    ev.year = n;
    _render(w);
    _sync(w);
    // The year genuinely changed, so the reposition-render above is real and
    // necessary (row order depends on year) — but it still tears out the
    // field the browser was mid-Tab toward. Put focus back on the same row's
    // next field manually: the description input where one exists (every
    // preset but Born), otherwise the row's own first value field.
    const row  = w.querySelector(`.tl-row[data-id="${id}"]`);
    const next = row?.querySelector("input.tl-row-desc") || row?.querySelector(".tl-row-value");
    next?.focus();
  }

  // Initialises the storage property a field type writes to (lumpSum for
  // "amount", gross for "gross", etc.) — shared by field and field2 so a
  // second slot starts out just as populated as the first.
  function _initFieldValue(ev, fieldType) {
    if (fieldType === "amount") ev.lumpSum = "";
    else if (fieldType === "gross") ev.gross = "";
    else if (fieldType === "name") ev.name = "";
    else if (fieldType === "regime") ev.regime = "";
    else if (fieldType === "location") ev.location = "";
    else if (fieldType === "relationship") ev.relationship = "";
    else if (fieldType === "turnover") ev.turnover = "";
    else if (fieldType === "occupation") ev.occupation = "";
    else if (fieldType === "industry") ev.industry = "";
    else if (fieldType === "qualification") ev.qualification = "";
    else if (fieldType === "beneficiary") ev.beneficiary = "";
    else if (fieldType === "makeModel") ev.makeModel = "";
  }

  function _addEvent(w, category, preset) {
    const id = _uid();
    const ev = { id, category, description: preset?.description ?? "", year: _CURRENT_YEAR, field: preset?.field ?? null, field2: preset?.field2 ?? null };
    _initFieldValue(ev, ev.field);
    if (ev.field2) _initFieldValue(ev, ev.field2);
    // Pre-select the relationship when the preset label is already one of the
    // options (Child, Other Dependent) — one less click for the common case.
    if (ev.field2 === "relationship" && RELATIONSHIP_OPTIONS.includes(preset?.label)) ev.relationship = preset.label;
    _events.push(ev);
    _render(w);
    _sync(w);
    const row = w.querySelector(`.tl-row[data-id="${id}"]`);
    // Blank description (Custom) needs typing first; a preset description means
    // the value field is the empty thing left to fill in.
    const focusSel = ev.description ? '[data-field]:not([data-field="description"])' : ".tl-row-desc";
    row?.querySelector(focusSel)?.focus();
  }

  function _closeAllDropdowns(w) {
    w.querySelectorAll(".tl-add-dd.open").forEach((dd) => dd.classList.remove("open"));
  }

  function _initEvents(w) {
    w.querySelectorAll(".tl-add-dd").forEach((dd) => {
      dd.querySelector(".tl-add-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = dd.classList.contains("open");
        _closeAllDropdowns(w);
        if (!wasOpen) dd.classList.add("open");
      });

      dd.querySelector(".tl-dd-menu")?.addEventListener("click", (e) => {
        const item = e.target.closest(".tl-dd-item");
        if (!item) return;
        const preset = PRESETS[+item.dataset.preset];
        _closeAllDropdowns(w);
        _addEvent(w, dd.dataset.cat, preset);
      });
    });

    document.addEventListener("click", () => _closeAllDropdowns(w));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") _closeAllDropdowns(w); });

    const delBtn = w.querySelector("#tl-del-toggle");
    delBtn?.addEventListener("click", () => {
      const entering = !w.classList.contains("tl-delete-mode");
      w.classList.toggle("tl-delete-mode");
      delBtn.textContent = entering ? "Done" : "Delete";
    });

    const list = w.querySelector("#tl-rows");

    list.addEventListener("focusin", (e) => {
      if (e.target.matches(".tl-year-input")) {
        e.target.select();
      }
      // Tabbing into a select (Regime, Relationship) should pop it straight
      // open — arrow keys pick an option, Tab/Enter confirms and moves on —
      // rather than landing focused-but-closed and needing an extra keypress.
      // showPicker() isn't universally supported yet; unsupported browsers
      // just get a normally-focused (closed) select, no worse than before.
      if (e.target.matches("select.tl-row-value") && typeof e.target.showPicker === "function") {
        try { e.target.showPicker(); } catch (err) {}
      }
    });

    list.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (e.target.matches(".tl-year-input")) {
        e.preventDefault();
        _commitYear(w, +e.target.dataset.id, e.target.value);
        e.target.blur();
      }
    });
    list.addEventListener("focusout", (e) => {
      if (e.target.matches(".tl-year-input")) {
        _commitYear(w, +e.target.dataset.id, e.target.value);
      } else if (e.target.matches('input[data-field="lumpSum"], input[data-field="gross"]')) {
        e.target.value = _fmtR(e.target.value);
      }
    });

    list.addEventListener("click", (e) => {
      const x = e.target.closest(".tl-row-x");
      if (x) {
        _events = _events.filter((ev) => ev.id !== +x.dataset.id);
        _render(w);
        _sync(w);
        w.classList.remove("tl-delete-mode");
        if (delBtn) delBtn.textContent = "Delete";
      }
    });

    list.addEventListener("input", (e) => {
      const { field } = e.target.dataset;
      if (!["description", "lumpSum", "gross", "name", "regime", "location", "relationship", "turnover", "occupation", "industry", "qualification", "beneficiary", "makeModel"].includes(field)) return;
      const ev = _events.find((e2) => e2.id === +e.target.dataset.id);
      if (!ev) return;
      ev[field] = e.target.value;
      _sync(w);
    });
  }

  // ── Module ────────────────────────────────────────────────────────────────

  window.App?.register("timeline", {
    id: "timeline",
    title: "Timeline",

    guide: {
      intro: {
        heading: "Timeline",
        html: `<p>One chronological list — personal, employment, household, and life-event milestones, all in one place, so nothing captured in About You gets missed here.</p>
               <p>Fill in the birth year and birthplace on the Born card — every other card's age is calculated straight from it. Edit a year and press Enter to reposition that card. Each card's trailing field is fixed by its type — marital regime for Marriage, name for a dependant, gross income for a job, or an amount for a financial goal.</p>
               <p><strong>Past events</strong> are things that already happened (bought a house, graduated) — they just build the client picture. <strong>Planning events</strong> (green-tinted) are goals still to be funded, like retirement or a deposit — these are what show up on the Investments side of Financial Planning.</p>`,
      },
    },

    mount(wrapper) {
      _reset();
      _events.push({ id: _uid(), type: "born", description: "Born", year: "", field: "location", location: "" });
      _events.push({ id: _uid(), category: "personal",   description: "Marriage",           year: _CURRENT_YEAR, field: "regime", regime: "", field2: "name", name: "" });
      _events.push({ id: _uid(), category: "employment", description: "Current employment", year: _CURRENT_YEAR, field: "gross",  gross: "", field2: "occupation", occupation: "" });
      _events.push({ id: _uid(), category: "planning",   description: "Retirement Funding", year: 2050,          field: "amount", lumpSum: "" });
      _injectCSS();
      wrapper.insertAdjacentHTML("beforeend", _template());
      const w = wrapper.querySelector(".mt-panel");
      _initEvents(w);
      _render(w);
    },

    getState() {
      return {
        nextId: _nextId,
        age: _currentAge ?? "",
        events: JSON.parse(JSON.stringify(_events)),
      };
    },

    setState(saved) {
      if (!saved) return;
      _nextId = saved.nextId ?? 1;
      _events = saved.events ?? [];
      // Migrate Born cards saved before the Location field existed.
      _events.forEach((ev) => {
        if (ev.type === "born" && ev.field !== "location") {
          ev.field = "location";
          if (ev.location == null) ev.location = "";
        }
      });
      const w = window.App._wrappers?.[this.id]?.querySelector(".mt-panel");
      if (!w) return;
      _render(w); // re-derives _currentAge from the restored Born card

      // MeetingState.timeline only ever gets (re)written from a live edit —
      // restoring a saved client would otherwise leave it as whatever cross-tool
      // snapshot was last saved, which can drift from what actually got restored
      // here, silently feeding stale/wrong events to every downstream consumer
      // (Financial Planning's investment goals, estate/cover calcs, etc.).
      _sync();
    },
  });
})();

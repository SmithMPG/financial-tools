// tools/meeting-shared.js
// Shared utilities for all meeting-tool panels.
// Must load before any meeting tool script.

(function () {
  "use strict";

  // ── Public API ─────────────────────────────────────────────────────────────

  window.MtUI = {

    // ── HTML builders ────────────────────────────────────────────────────────

    field(label, html) {
      return `<div class="mt-field"><label class="mt-label">${label}</label>${html}</div>`;
    },

    // opts: { type, inputmode, id, value, disabled }
    input(field, placeholder, opts = {}) {
      const { type = "text", inputmode = "", id = field, value = "", disabled = false } = opts;
      return [
        `<input class="mt-input"`,
        id        ? ` id="${id}"`               : "",
        ` type="${type}" placeholder="${placeholder}" autocomplete="off"`,
        value     ? ` value="${value}"`          : "",
        inputmode ? ` inputmode="${inputmode}"`  : "",
        disabled  ? ` disabled`                  : "",
        `>`,
      ].join("");
    },

    // options: array of strings OR {v, l} / {value, label} objects
    // opts: { placeholder, id, value }
    select(field, options, opts = {}) {
      const { placeholder = "Select…", id = field, value = "" } = opts;
      const optHtml = options.map(o => {
        const v = typeof o === "string" ? o : (o.v ?? o.value ?? "");
        const l = typeof o === "string" ? o : (o.l ?? o.label ?? v);
        return `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`;
      }).join("");
      return `<select class="mt-select"${id ? ` id="${id}"` : ""}>`
        + `<option value="" disabled${!value ? " selected" : ""}>${placeholder}</option>`
        + optHtml
        + `</select>`;
    },

    // options: array of {v, l} or {value, label}  activeVal: pre-select a value (null = first)
    toggle(name, options, activeVal = null) {
      const btns = options.map((o, i) => {
        const v = o.v ?? o.value ?? o;
        const l = o.l ?? o.label ?? o;
        const on = activeVal !== null ? v === activeVal : i === 0;
        return `<button class="mt-toggle-btn${on ? " active" : ""}" type="button" data-val="${v}">${l}</button>`;
      }).join("");
      return `<div class="mt-toggle" data-tog="${name}">${btns}</div>`;
    },

    // value: "yes" | "no" | null
    yn(id, value = null) {
      return `<div class="mt-yn" data-yn="${id}">`
        + `<button class="mt-yn-btn${value === "yes" ? " active-yes" : ""}" type="button" data-ans="yes">Yes</button>`
        + `<button class="mt-yn-btn${value === "no"  ? " active-no"  : ""}" type="button" data-ans="no">No</button>`
        + `</div>`;
    },

    ynRow(id, label, value = null) {
      return `<div class="mt-q-row"><span class="mt-q-text">${label}</span>${this.yn(id, value)}</div>`;
    },

    // ── Money helpers ────────────────────────────────────────────────────────
    // Delegate to components/input-format.js — the single source of truth for
    // money parsing/formatting, loaded globally before every meeting tool
    // script — rather than each tool carrying its own regex copy.

    fmtMoney(n) {
      return window.numberToMoney(n);
    },

    parseMoney(str) {
      return window.moneyToNumber(str);
    },

    // ── Timeline helpers ─────────────────────────────────────────────────────

    // Gross monthly income lives only on Timeline's "Current Job" card
    // (Cashflow captures Net only) — shared here so estate-planning.js and
    // financial-planning.js can't silently drift apart if Timeline's job-event
    // shape ever changes again.
    grossMonthlyFromTimeline() {
      const events = window.MeetingState?.get("timeline")?.events || [];
      const job = events.find(e => e.category === "employment" && e.field === "gross");
      return job ? this.parseMoney(job.gross) : 0;
    },

    // ── Behaviour initialisers ────────────────────────────────────────────────

    // Wires collapse/expand on all .mt-primary headers inside root.
    // accordion: true → opening one closes all siblings.
    // exclude: CSS selector of .mt-primary elements to skip when closing siblings.
    initSections(root, { accordion = false, exclude = null } = {}) {
      root.addEventListener("click", e => {
        const hdr = e.target.closest(".mt-primary-hdr");
        if (!hdr) return;
        if (e.target.closest("button, input, select, a")) return;
        const sec = hdr.closest(".mt-primary");
        if (!sec) return;
        if (accordion) {
          const isCollapsed = sec.classList.contains("collapsed");
          const sel = exclude ? `.mt-primary:not(${exclude})` : ".mt-primary";
          root.querySelectorAll(sel).forEach(s => s.classList.add("collapsed"));
          if (isCollapsed) sec.classList.remove("collapsed");
        } else {
          sec.classList.toggle("collapsed");
        }
      });
    },

    // Wires [data-tog] segmented controls.
    // Skips toggles inside [data-ben] (beneficiary rows use data-ben-field).
    initToggles(root, onSync) {
      root.addEventListener("click", e => {
        const btn = e.target.closest(".mt-toggle-btn");
        if (!btn) return;
        if (btn.closest("[data-ben]")) return;
        const grp = btn.closest("[data-tog]");
        if (!grp) return;
        grp.querySelectorAll(".mt-toggle-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        onSync?.();
      });
    },

    // Wires .mt-yn yes/no controls.
    initYn(root, onSync) {
      root.addEventListener("click", e => {
        const btn = e.target.closest(".mt-yn-btn");
        if (!btn) return;
        const grp = btn.closest(".mt-yn");
        if (!grp) return;
        grp.querySelectorAll(".mt-yn-btn").forEach(b => b.classList.remove("active-yes", "active-no"));
        btn.classList.add(btn.dataset.ans === "yes" ? "active-yes" : "active-no");
        onSync?.();
      });
    },

    // Wires [data-money="true"] inputs: strip on focus, format on blur, digits-only on input.
    initMoney(root, onSync) {
      root.addEventListener("focusin", e => {
        if (!e.target.matches('[data-money="true"]')) return;
        e.target.value = e.target.value.replace(/[^0-9.]/g, "");
        e.target.select();
      });
      root.addEventListener("focusout", e => {
        if (!e.target.matches('[data-money="true"]')) return;
        window.formatMoneyInput(e.target);
        onSync?.();
      });
      root.addEventListener("input", e => {
        if (!e.target.matches('[data-money="true"]')) return;
        const v = e.target.value, c = v.replace(/[^0-9.]/g, "");
        if (v !== c) e.target.value = c;
      });
    },

    // ── Delete mode ───────────────────────────────────────────────────────────
    //
    // Appends a footer to secEl's .mt-primary-body (or a custom bodyEl).
    // Footer has a Delete/Done toggle on the left and an optional + Add on the right.
    // When in delete mode, clicking any .mt-secondary-x inside secEl triggers onDelete(rowEl)
    // and automatically exits delete mode.
    //
    // opts: {
    //   addLabel   string | null  – label for + button; omit to hide the button
    //   onAdd      () => void     – called when + is clicked
    //   onDelete   (rowEl) => void – called when × is clicked in delete mode
    //   rowSelector string        – selector to find the parent row from × (default ".mt-secondary")
    //   bodyEl     Element | null – override the footer container (default: .mt-primary-body)
    // }
    //
    // Returns the footer element so callers can append extra buttons.
    initDeleteMode(secEl, opts = {}) {
      const { addLabel, onAdd, onDelete, rowSelector = ".mt-secondary", bodyEl } = opts;
      const body = bodyEl || secEl.querySelector(".mt-primary-body");
      if (!body) return null;

      const footer = document.createElement("div");
      footer.className = "mt-primary-footer";
      footer.innerHTML = (addLabel ? `<button class="mt-primary-add-btn" type="button">${addLabel}</button>` : "")
        + `<button class="mt-primary-del-btn" type="button">Delete</button>`;
      body.appendChild(footer);

      const delBtn = footer.querySelector(".mt-primary-del-btn");

      delBtn?.addEventListener("click", () => {
        const entering = !secEl.classList.contains("delete-mode");
        secEl.classList.toggle("delete-mode");
        if (delBtn) delBtn.textContent = entering ? "Done" : "Delete";
      });

      footer.querySelector(".mt-primary-add-btn")?.addEventListener("click", () => {
        onAdd?.();
      });

      secEl.addEventListener("click", e => {
        if (!secEl.classList.contains("delete-mode")) return;
        const xBtn = e.target.closest(".mt-secondary-x");
        if (!xBtn) return;
        const row = xBtn.closest(rowSelector);
        onDelete?.(row);
        secEl.classList.remove("delete-mode");
        if (delBtn) delBtn.textContent = "Delete";
      });

      return footer;
    },
  };
})();

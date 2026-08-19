// components/tool-hero.js
(function injectStyles() {
  if (document.getElementById("tool-hero-css")) return;
  const s = document.createElement("style");
  s.id = "tool-hero-css";
  s.textContent = `
    /* ── Hero card ── */
    .ch-hero {
      position: relative;
      background-color: #0f172a;
      background-image:
        radial-gradient(at 0% 0%,   hsla(263,85%,60%,0.5)  0px, transparent 85%),
        radial-gradient(at 100% 100%, hsla(180,85%,50%,0.35) 0px, transparent 85%);
      border-radius: 1rem;
      border: 1px solid rgba(255,255,255,0.06);
      color: #fff;
      padding: 1.25rem 1rem 1rem;
      box-shadow: 0 15px 35px -12px rgba(0,0,0,0.5);
      user-select: none;
      cursor: pointer;
      transition: border-color 0.2s, transform 0.2s ease, box-shadow 0.2s ease;
    }
    .ch-hero:hover {
      border-color: rgba(255,255,255,0.14);
      transform: scale(1.01);
      box-shadow: 0 20px 45px -10px rgba(0,0,0,0.65);
    }

    /* ── Kicker / labels ── */
    .ch-kicker {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.65rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.2rem;
    }

    /* ── Value display ── */
    .ch-total,
    .ch-stat-val {
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ch-primary--lg .ch-total { font-size: 2.25rem; margin-top: 0.15rem; }
    .ch-primary--md .ch-total { font-size: 1.75rem; margin-top: 0.15rem; }
    .ch-primary--sm .ch-total { font-size: 1.1rem;  margin-top: 0.1rem; }
    @media (min-width: 480px) {
    .ch-primary--lg .ch-total { font-size: 2.25rem; margin-top: 0.15rem; }
    .ch-primary--md .ch-total { font-size: 1.75rem; margin-top: 0.15rem; }
    .ch-primary--sm .ch-total { font-size: 1.1rem;  margin-top: 0.1rem; }
}

    /* ── Primary layouts ── */
    .ch-p1 { text-align: center; margin-bottom: 1rem; }
    .ch-p1 .ch-kicker { justify-content: center; }

    .ch-p2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
    .ch-p2 .ch-primary { text-align: center; }
    .ch-p2 .ch-kicker  { justify-content: center; }

    .ch-p3 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem; align-items: center; }
    .ch-p3-main { text-align: center; }
    .ch-p3-main .ch-kicker { justify-content: center; }
    .ch-p3-stack {
      display: flex; flex-direction: column; gap: 0.5rem;
      padding-left: 0.875rem;
      border-left: 1px solid rgba(255,255,255,0.1);
      text-align: center;
    }
    .ch-p3-stack .ch-kicker { justify-content: center; }

    /* ── Secondary stats ── */
    .ch-stats {
      display: grid;
      gap: 0.5rem;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 1rem;
      margin-top: 0.25rem;
    }
    .ch-s1 { grid-template-columns: 1fr; }
    .ch-s1 .ch-stat { align-items: center; text-align: center; }
    .ch-s2 { grid-template-columns: 1fr 1fr; }
    .ch-s3 { grid-template-columns: repeat(3,1fr); }
    .ch-s4 { grid-template-columns: repeat(4,1fr); }

    .ch-stat { display: flex; flex-direction: column; align-items: center; }
    .ch-stat-label {
      display: flex; align-items: center; gap: 5px;
      font-size: 0.63rem; color: #94a3b8;
      line-height: 1.3; text-align: center;
    }
    .ch-stat-val { font-size: 0.9rem; font-weight: 700; color: #fff; margin-top: 0.2rem; }

    .ch-dot {
      width: 7px; height: 7px; border-radius: 50%;
      flex-shrink: 0; display: inline-block;
    }
    .ch-disclaimer {
      font-size: 0.6rem; color: #475569;
      margin-top: 0.75rem; padding-top: 0.65rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      text-align: center; line-height: 1.5;
    }

    /* ── Fallback full-value modal (standalone pages without App) ── */
    #ch-val-modal {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: flex-end; justify-content: center;
      padding: 1rem;
    }
    @media (min-width: 480px) { #ch-val-modal { align-items: center; } }
    .ch-val-backdrop {
      position: absolute; inset: 0;
      background: rgba(15,23,42,0.65);
      backdrop-filter: blur(6px);
    }
    .ch-val-panel {
      position: relative;
      background: #1e293b;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 1.25rem;
      padding: 1.75rem 1.5rem 1.25rem;
      width: 100%; max-width: 320px;
      text-align: center;
      animation: chValUp 0.25s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes chValUp {
      from { opacity: 0; transform: translateY(1rem); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ch-val-close {
      width: 100%; padding: 0.75rem;
      background: #334155; color: #fff;
      border: none; border-radius: 0.75rem;
      font-size: 0.9rem; font-weight: 600;
      cursor: pointer; transition: background 0.2s;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }

    /* ── Guide value display ── */
    .ch-guide-val {
      font-size: 1.75rem; font-weight: 800;
      color: #fff; margin: 0 0 0.875rem;
      line-height: 1.1; word-break: break-all;
    }

    /* ── Corner nav buttons (mobile only) ── */
    .ch-corner-btn {
      display: none;
      position: absolute;
      top: 0.75rem;
      width: 30px;
      height: 30px;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 50%;
      color: #94a3b8;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
      z-index: 10;
    }
    .ch-corner-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
    .ch-corner-btn--left  { left: 0.75rem; }
    .ch-corner-btn--right { right: 0.75rem; }

    /* ── Mobile tweaks ── */
    @media (max-width: 1000px) {
      .ch-hero {
        padding: 1rem 1rem 0.875rem;
        border-radius: 0;
        border-top: none;
        border-left: none;
        border-right: none;
        box-shadow: 0 10px 30px -10px rgba(0,0,0,0.6);
      }
      .ch-hero:hover {
        transform: none;
        box-shadow: 0 10px 30px -10px rgba(0,0,0,0.6);
      }
      .ch-p1   { margin-bottom: 0.5rem; }
      .ch-stats { padding-top: 0.5rem; margin-top: 0; }
      .ch-corner-btn { display: flex; }
    }
  `;
  document.head.appendChild(s);
})();

window.CalcHero = {
  // ── Public: update ────────────────────────────────────────────────────────
  // scope: optional Element to query within - prevents cross-calc ID collisions
  // in FA mode where multiple calc DOMs coexist. Defaults to document.
  update(solutions, scope) {
    if (solutions.primaries) {
      solutions.primaries.forEach((item) => this._applyValue(item.id, item.value, scope));
    }
    if (solutions.secondaries) {
      solutions.secondaries.forEach((item) => this._applyValue(item.id, item.value, scope));
    }
  },

  _applyValue(id, val, scope) {
    const el = scope ? scope.querySelector("#" + id) : document.getElementById(id);
    if (!el) return;

    const full = this._formatFull(val);
    const short = this._formatShort(val);

    el.innerText = short;
    el.dataset.full = full;
    el.dataset.raw  = typeof val === "number" ? val : "";
  },

  // ── Public: render ────────────────────────────────────────────────────────
  render(containerSelector, config) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    this._config = config; // store for breakdown on click

    const hero = document.createElement("div");
    hero.className = config.extraClass ? `ch-hero ${config.extraClass}` : "ch-hero";
    hero.innerHTML = this._buildHTML(config);

    // Corner nav buttons (mobile only) — menu top-left, guide top-right
    hero.insertAdjacentHTML("beforeend", `
      <button class="ch-corner-btn ch-corner-btn--left" aria-label="Open menu" onclick="event.stopPropagation();App.openMenu()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <button class="ch-corner-btn ch-corner-btn--right" aria-label="Open guide" onclick="event.stopPropagation();App.openGuide()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </button>
    `);

    container.prepend(hero);

    // Single click on whole hero → show full breakdown
    hero.addEventListener("click", () => {
      const html = this._buildBreakdown();
      if (!html) return;
      if (window.App) {
        App.setGuide("Breakdown", html);
      } else {
        this._showBreakdownModal(html);
      }
    });
  },

  // ── Public: applyParams ───────────────────────────────────────────────────
  applyParams() {
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) return;

    params.forEach((value, key) => {
      const inputEl = document.getElementById(`val-${key}`);
      const rangeEl = document.getElementById(`slider-${key}`);
      if (inputEl) {
        inputEl.value = value;
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (rangeEl) {
        rangeEl.value = value;
        rangeEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    if (typeof window.updateSimulation === "function") window.updateSimulation();
  },

  // ── Formatting Logic ──────────────────────────────────────────────────────
  _formatFull(n) {
    if (typeof n !== "number") return n;
    return "R " + Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
  },

  _formatShort(n) {
    if (typeof n !== "number") return n;

    // 1. Billions: R 1.25b
    if (n >= 1e9) {
      return "R " + (n / 1e9).toFixed(2).replace(/\.00$/, "") + "b";
    }
    // 2. Millions (Only if R10m or higher): R 10.5m
    if (n >= 10000000) {
      return "R " + (n / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
    }
    // 3. Everything else (Full format): R 9 500 000
    return this._formatFull(n);
  },

  // ── Breakdown builder ─────────────────────────────────────────────────────
  _buildBreakdown() {
    const cfg = this._config;
    if (!cfg) return null;

    const primary = cfg.primaries?.[0];
    const primaryEl = primary ? document.getElementById(primary.id) : null;
    const primaryFull = primaryEl?.dataset.full || "-";

    const rows = (cfg.secondaries || [])
      .map(({ id, label, breakdownLabel, dot, negative, note }) => {
        const el = document.getElementById(id);
        const val = el?.dataset.full || "-";
        const raw = el?.dataset.raw ? parseFloat(el.dataset.raw) : null;
        const dotHtml = dot ? `<span class="guide-dot" style="background:${dot}"></span>` : "";
        const sign = negative ? "−" : "";
        const cls = negative ? ' class="guide-row-fee"' : "";
        const noteHtml = note && raw !== null ? `<tr><td colspan="2" style="font-size:0.72rem;color:var(--muted);padding-top:0.1rem;padding-left:1.2rem">${note(raw)}</td></tr>` : "";
        return `<tr${cls}><td>${dotHtml}${breakdownLabel || label}</td><td>${sign}${val}</td></tr>${noteHtml}`;
      })
      .join("");

    const divider = rows
      ? `
      <table class="guide-breakdown" style="margin-top:0.75rem">
        ${rows}
      </table>`
      : "";

    return `<p class="ch-guide-val">${primaryFull}</p>${divider}`;
  },

  // Fallback modal for standalone pages (no App object)
  _showBreakdownModal(html) {
    document.getElementById("ch-val-modal")?.remove();
    const modal = document.createElement("div");
    modal.id = "ch-val-modal";
    modal.innerHTML = `
      <div class="ch-val-backdrop"></div>
      <div class="ch-val-panel">
        ${html}
        <button class="ch-val-close" onclick="document.getElementById('ch-val-modal').remove()">Dismiss</button>
      </div>`;
    modal.querySelector(".ch-val-backdrop").addEventListener("click", () => modal.remove());
    document.body.appendChild(modal);
  },

  // ── HTML builder ──────────────────────────────────────────────────────────

  _buildHTML({ primaries = [], secondaries = [], disclaimer } = {}) {
    const pc = Math.min(primaries.length, 3);
    const sc = Math.min(secondaries.length, 3);
    return [this._buildPrimaries(primaries, pc), sc > 0 ? this._buildSecondaries(secondaries, sc) : "", disclaimer ? `<p class="ch-disclaimer">${disclaimer}</p>` : ""].join("");
  },

  _buildPrimaries(items, count) {
    if (count === 1) return `<div class="ch-primaries ch-p1">${this._primaryBlock(items[0], "lg")}</div>`;
    if (count === 2) return `<div class="ch-primaries ch-p2">${this._primaryBlock(items[0], "md")}${this._primaryBlock(items[1], "md")}</div>`;
    return `<div class="ch-primaries ch-p3">
      <div class="ch-p3-main">${this._primaryBlock(items[0], "lg")}</div>
      <div class="ch-p3-stack">
        ${this._primaryBlock(items[1], "sm")}
        ${this._primaryBlock(items[2], "sm")}
      </div>
    </div>`;
  },

  _primaryBlock({ id, label } = {}, size) {
    return `<div class="ch-primary ch-primary--${size}">
        <span class="ch-kicker">${label}</span>
        <div class="ch-total" id="${id}" data-label="${label}">R -</div>
      </div>`;
  },

  _buildSecondaries(items, count) {
    const mod = { 1: "ch-s1", 2: "ch-s2", 3: "ch-s3", 4: "ch-s4" }[count] || "ch-s4";
    const cells = items
      .slice(0, count)
      .map(({ id, label, dot }) => {
        const dotEl = dot ? `<span class="ch-dot" style="background:${dot}"></span>` : "";
        return `<div class="ch-stat">
          <div class="ch-stat-label">${dotEl}${label}</div>
          <div class="ch-stat-val" id="${id}" data-label="${label}">-</div>
        </div>`;
      })
      .join("");
    return `<div class="ch-stats ${mod}">${cells}</div>`;
  },
};

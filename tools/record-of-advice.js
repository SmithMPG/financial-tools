// tools/record-of-advice.js
// Record of Advice - 8-section narrative form for the compliance file.
// Reads client name/date from MeetingState or falls back to DOM IDs in other tools.
// Section styles are scoped under .roa-pane to avoid conflicts with other tools
// that share the same .cm-sec class name with different padding.

(function () {
  // ── ROA sections ───────────────────────────────────────────────────────────

  const ROA_SECTIONS = [
    {
      id: "s1",
      title: "1. Who is the Client",
      fields: [
        { id: "s1_met",        label: "When and how did you come to know the client?" },
        { id: "s1_who",        label: "Who is the client? (personal details, occupation, marital status)" },
        { id: "s1_dependents", label: "Who are the client's dependents?" },
        { id: "s5_risk",       label: "What is the client's interest in risk and investments?" },
      ],
    },
    {
      id: "s3",
      title: "2. Client's Current Financial Position",
      fields: [
        { id: "s3_assets",   label: "What are the client's assets and liabilities?" },
        { id: "s3_cashflow", label: "What is the client's income and expenses? (cash flow, not just budget)" },
        { id: "s3_budget",   label: "What is the client's current budget available for financial planning?" },
        { id: "s3_existing", label: "Does the client have any existing cover or policies?" },
        { id: "s3_tax",      label: "What is the client's tax situation?" },
        { id: "s3_debt",     label: "Does the client have a debt repayment strategy?" },
        { id: "s3_emergency",label: "Does the client have an emergency fund? (3–6 months expenses)" },
        { id: "s3_offshore", label: "Does the client have any offshore assets or interests?" },
      ],
    },
    {
      id: "s4",
      title: "3. Goals",
      fields: [
        { id: "s4_goals",      label: "What are the client's goals?" },
        { id: "s4_retirement", label: "What are the client's retirement lifestyle expectations?" },
        { id: "s4_fna", label: "What did the financial needs analysis recommend?", get html() { return _recsHTML(); } },
      ],
    },
    {
      id: "s7",
      title: "4. Plan",
      fields: [
        { id: "s6_will", label: "Will — status, location and last updated date" },
        { id: "s7_projections", label: "Was it explained that investment projections are estimates, not guarantees?" },
        { id: "s8_feeling",     label: "How does the client feel about the solutions presented?" },
        { id: "s9_implement",   label: "When will the solutions be implemented?" },
      ],
    },
  ];

  // ── CSS ────────────────────────────────────────────────────────────────────
  // Section styles are scoped under .roa-pane so they don't conflict with
  // other tools (.cm-sec padding differs: ROA needs 0, others use 1rem 1.1rem).

  function _injectCSS() {
    if (document.getElementById("roa-styles")) return;
    const s = document.createElement("style");
    s.id = "roa-styles";
    s.textContent = `
      .cm-wrapper {
        flex: 1; min-height: 0; min-width: 0; overflow: hidden;
        display: flex; flex-direction: column;
        background: rgba(255,255,255,0.55);
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        border-radius: var(--panel-radius);
        border: 1px solid rgba(255,255,255,0.8);
        box-shadow: 0 15px 35px rgba(0,0,0,0.05);
        color: var(--navy-3);
        padding: 1.25rem; gap: 1rem;
      }
      .cm-pane {
        flex: 1; min-height: 0; overflow-y: auto;
        display: flex; flex-direction: column; gap: 0.85rem;
        padding: 0.15rem 0.1rem 2rem; scrollbar-width: thin;
        scrollbar-color: rgba(0,0,0,0.15) transparent;
      }
      /* Scoped section styles - .roa-pane prevents conflicts with other tools */
      .roa-pane .cm-sec {
        background: rgba(0,0,0,0.02);
        border: 1px solid rgba(0,0,0,0.07);
        border-radius: 0.75rem;
        padding: 0;
        display: flex; flex-direction: column; overflow: hidden;
        flex-shrink: 0;
      }
      .roa-pane .cm-sec-hdr {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.75rem 1.1rem; cursor: pointer; user-select: none; gap: 0.75rem;
      }
      .roa-pane .cm-sec-hdr:hover { background: rgba(0,0,0,0.02); }
      .roa-pane .cm-sec-title {
        font-family: var(--fb); font-size: 0.65rem; font-weight: 700;
        letter-spacing: 0.09em; text-transform: uppercase; color: var(--navy-5);
      }
      .roa-pane .cm-sec-chevron {
        color: var(--navy-5); opacity: 0.4; font-size: 1rem; line-height: 1;
        flex-shrink: 0; transition: transform 0.25s;
      }
      .roa-pane .cm-sec.collapsed .cm-sec-chevron { transform: rotate(-90deg); }
      .roa-pane .cm-sec-body {
        display: flex; flex-direction: column; gap: 0.75rem;
        padding: 0 1.1rem 1rem;
        max-height: 2000px; overflow: hidden;
        transition: max-height 0.35s ease, opacity 0.25s ease, padding 0.25s ease;
        opacity: 1;
      }
      .roa-pane .cm-sec.collapsed .cm-sec-body { max-height: 0; opacity: 0; padding-bottom: 0; }
      /* Recommendations 3-column table */
      .roa-recs-table {
        display: grid;
        grid-template-columns: 160px 1fr 1fr 1fr;
        border: 1px solid rgba(0,0,0,0.08); border-radius: 0.55rem; overflow: hidden;
      }
      .roa-recs-th {
        font-family: var(--fb); font-size: 0.6rem; font-weight: 700;
        letter-spacing: 0.08em; text-transform: uppercase; color: var(--navy-5);
        padding: 0.55rem 0.65rem; background: rgba(0,0,0,0.03);
        border-bottom: 1px solid rgba(0,0,0,0.08);
        border-right: 1px solid rgba(0,0,0,0.06);
        line-height: 1.4; text-align: center;
      }
      .roa-recs-th:first-child { text-align: left; }
      .roa-recs-th:last-child { border-right: none; }
      .roa-recs-lbl {
        font-family: var(--fb); font-size: 0.8rem; color: var(--navy-3);
        padding: 0.5rem 0.65rem; display: flex; align-items: center;
        border-bottom: 1px solid rgba(0,0,0,0.05);
        border-right: 1px solid rgba(0,0,0,0.05);
      }
      .roa-recs-cell {
        font-family: var(--fb); font-size: 0.82rem; color: var(--navy-4);
        padding: 0.5rem 0.65rem; display: flex; align-items: center; justify-content: center;
        border-bottom: 1px solid rgba(0,0,0,0.05);
        border-right: 1px solid rgba(0,0,0,0.05);
      }
      .roa-recs-final {
        padding: 0.35rem 0.5rem; display: flex; flex-direction: column;
        justify-content: center; align-items: center; gap: 0.35rem;
        border-bottom: 1px solid rgba(0,0,0,0.05);
      }
      .roa-recs-lbl:nth-last-child(-n+4),
      .roa-recs-cell:nth-last-child(-n+3),
      .roa-recs-final:last-child { border-bottom: none; }
      .roa-recs-dual { display: flex; align-items: center; gap: 0.5rem; justify-content: center; }
      .roa-recs-inp-col { display: flex; flex-direction: row; align-items: center; gap: 0.35rem; }
      .roa-recs-inp-lbl { font-family: var(--fb); font-size: 0.58rem; color: var(--navy-5); text-align: right; line-height: 1.3; white-space: nowrap; }
      .roa-recs-wrap { width: 130px; }
      /* Intro card (no collapse) */
      .roa-intro-card {
        background: rgba(0,0,0,0.02);
        border: 1px solid rgba(0,0,0,0.07);
        border-radius: 0.75rem;
        padding: 0.85rem 1.1rem;
        display: flex; flex-direction: column; gap: 0.5rem;
        flex-shrink: 0;
      }
      .roa-intro-title {
        font-family: var(--fb); font-size: 0.65rem; font-weight: 700;
        letter-spacing: 0.09em; text-transform: uppercase; color: var(--navy-5);
      }
      .roa-intro-text {
        font-family: var(--fb); font-size: 0.8rem; color: var(--navy-5);
        line-height: 1.6; margin: 0;
      }
      /* Shared field / input styles */
      .cm-field { display: flex; flex-direction: column; gap: 0.3rem; }
      .cm-label { font-family: var(--fb); font-size: 0.66rem; font-weight: 500; color: var(--navy-5); letter-spacing: 0.01em; }
      .cm-textarea {
        width: 100%; min-height: 70px; padding: 0.55rem 0.75rem;
        font-family: var(--fb); font-size: 0.88rem; color: var(--navy-3);
        background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1);
        border-radius: 8px; outline: none; resize: vertical; line-height: 1.5;
        box-sizing: border-box; transition: all 0.2s;
      }
      .cm-textarea::placeholder { color: rgba(100,116,139,0.45); }
      .cm-textarea:focus { background: white; border-color: var(--navy-4); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      .cm-action-bar { flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem; margin-top: 0.5rem; }
      .cm-btn-primary {
        display: flex; align-items: center; gap: 0.4rem;
        padding: 0.6rem 1.2rem; background: var(--navy-3); color: white;
        font-family: var(--fb); font-size: 0.85rem; font-weight: 700;
        border: none; border-radius: 0.55rem; cursor: pointer; transition: opacity 0.15s, transform 0.1s;
      }
      .cm-btn-primary:hover { opacity: 0.85; }
      .cm-btn-primary:active { transform: scale(0.97); }
      .cm-btn-secondary {
        display: flex; align-items: center; gap: 0.4rem;
        padding: 0.6rem 1rem; background: transparent; color: var(--navy-4);
        font-family: var(--fb); font-size: 0.82rem; font-weight: 600;
        border: 1.5px solid rgba(0,0,0,0.15); border-radius: 0.55rem; cursor: pointer; transition: all 0.15s;
      }
      .cm-btn-secondary:hover { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.25); }
      .cm-btn-secondary:active { transform: scale(0.97); }
      .cm-toast { font-family: var(--fb); font-size: 0.78rem; color: #059669; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
      .cm-toast.show { opacity: 1; }
    `;
    document.head.appendChild(s);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const _f = (label, html) => `<div class="cm-field"><label class="cm-label">${label}</label>${html}</div>`;
  const _ta = (id, rows = 3) => `<textarea class="cm-textarea" id="${id}" rows="${rows}" placeholder="Your notes…"></textarea>`;
  const _v = (id) => (document.getElementById(id)?.value || "").trim();

  function _recsHTML() {
    const inp = (id, lbl = "") => `
      <div class="roa-recs-inp-col">
        ${lbl ? `<span class="roa-recs-inp-lbl">${lbl}</span>` : ""}
        <div class="mt-money-wrap roa-recs-wrap">
          <span class="mt-pfx">R</span>
          <input class="mt-input-sm" id="${id}" type="text" data-format="money" inputmode="numeric" placeholder="0" autocomplete="off">
        </div>
      </div>`;
    const dual = (id1, lbl1, id2, lbl2) => `
      <div class="roa-recs-dual">
        ${inp(id1, lbl1)}
        ${inp(id2, lbl2)}
      </div>`;
    const cell = (id) => `<div class="roa-recs-cell"><span id="${id}">—</span></div>`;
    const row  = (lbl, fnaHtml, recId, finalHtml) => `
      <div class="roa-recs-lbl">${lbl}</div>
      <div class="roa-recs-final">${fnaHtml}</div>
      ${cell(recId)}
      <div class="roa-recs-final">${finalHtml}</div>`;
    return `<div class="roa-recs-table">
      <div class="roa-recs-th"></div>
      <div class="roa-recs-th">FNA Recommendations</div>
      <div class="roa-recs-th">My Recommendations</div>
      <div class="roa-recs-th">Final Recommendations<br>based on client's affordability</div>
      ${row("Life Cover",         inp("s7_fna_life"),                                                                                          "fna_life_rec",   inp("s7_life"))}
      ${row("Capital Disability", inp("s7_fna_dis"),                                                                                           "fna_dis_rec",    inp("s7_dis"))}
      ${row("Income Protection",  dual("s7_fna_ip_24", "Within<br>24m (pm)", "s7_fna_ip_after", "After<br>24m (pm)"),                       "fna_ip_rec",     dual("s7_ip_24", "Within<br>24m (pm)", "s7_ip_after", "After<br>24m (pm)"))}
      ${row("Dread Disease",      inp("s7_fna_dread"),                                                                                         "fna_dread_rec",  inp("s7_dread"))}
      ${row("Retirement",         dual("s7_fna_ret_monthly", "Monthly<br>(pm)", "s7_fna_ret_lump", "Lump<br>sum"),                            "fna_ret_rec",    dual("s7_ret_monthly", "Monthly<br>(pm)", "s7_ret_lump", "Lump<br>sum"))}
      ${row("Investment",         dual("s7_fna_invest_mo", "Monthly<br>(pm)", "s7_fna_invest_lump", "Lump<br>sum"),                           "fna_invest_rec", dual("s7_invest_mo", "Monthly<br>(pm)", "s7_invest_lump", "Lump<br>sum"))}
    </div>`;
  }

  function _buildRecs() {
    const fmtV = (id) => {
      const raw = _v(id).replace(/[^0-9.]/g, "");
      const n = parseFloat(raw);
      return isNaN(n) || !raw ? null : `R ${Math.round(n).toLocaleString("en-ZA")}`;
    };
    const lines = [];

    const fnaIp24    = fmtV("s7_fna_ip_24"),      fnaIpAfter   = fmtV("s7_fna_ip_after");
    const fnaRetM    = fmtV("s7_fna_ret_monthly"), fnaRetL      = fmtV("s7_fna_ret_lump");
    const ip24       = fmtV("s7_ip_24"),           ipAfter      = fmtV("s7_ip_after");
    const retM       = fmtV("s7_ret_monthly"),     retL         = fmtV("s7_ret_lump");
    const fnaInvMo   = fmtV("s7_fna_invest_mo"),  fnaInvLump   = fmtV("s7_fna_invest_lump");
    const invMo      = fmtV("s7_invest_mo"),       invLump      = fmtV("s7_invest_lump");

    const fnaIpStr  = [fnaIp24  ? `${fnaIp24}pm (within 24m)`  : "", fnaIpAfter  ? `${fnaIpAfter}pm (after 24m)`  : ""].filter(Boolean).join(", ");
    const fnaRetStr = [fnaRetM  ? `${fnaRetM}pm`                : "", fnaRetL     ? `lump sum ${fnaRetL}`           : ""].filter(Boolean).join(", ");
    const fnaInvStr = [fnaInvMo ? `${fnaInvMo}pm`              : "", fnaInvLump  ? `lump sum ${fnaInvLump}`        : ""].filter(Boolean).join(", ");
    const ipStr     = [ip24     ? `${ip24}pm (within 24m)`      : "", ipAfter     ? `${ipAfter}pm (after 24m)`      : ""].filter(Boolean).join(", ");
    const retStr    = [retM     ? `${retM}pm`                   : "", retL        ? `lump sum ${retL}`              : ""].filter(Boolean).join(", ");
    const invStr    = [invMo    ? `${invMo}pm`                  : "", invLump     ? `lump sum ${invLump}`           : ""].filter(Boolean).join(", ");

    const row = (label, fna, final) => {
      if (!fna && !final) return null;
      const parts = [fna ? `FNA recommended: ${fna}` : "", final ? `Based on affordability: ${final}` : ""].filter(Boolean);
      return `${label} — ${parts.join("; ")}`;
    };

    const lifeLine  = row("Life Cover",         fmtV("s7_fna_life"),  fmtV("s7_life"));
    const disLine   = row("Capital Disability", fmtV("s7_fna_dis"),   fmtV("s7_dis"));
    const ipLine    = row("Income Protection",  fnaIpStr || null,      ipStr || null);
    const dreadLine = row("Dread Disease",      fmtV("s7_fna_dread"), fmtV("s7_dread"));
    const retLine   = row("Retirement",         fnaRetStr || null,     retStr || null);
    const invLine   = row("Investment",         fnaInvStr || null,     invStr || null);

    if (lifeLine)  lines.push(lifeLine);
    if (disLine)   lines.push(disLine);
    if (ipLine)    lines.push(ipLine);
    if (dreadLine) lines.push(dreadLine);
    if (retLine)   lines.push(retLine);
    if (invLine)   lines.push(invLine);

    return lines.length ? lines.join("\n") : null;
  }

  // ── Template ───────────────────────────────────────────────────────────────

  function _renderSection(sec, collapsed = true) {
    return `<div class="cm-sec${collapsed ? " collapsed" : ""}">
      <div class="cm-sec-hdr">
        <div class="cm-sec-title">${sec.title}</div>
        <span class="cm-sec-chevron">▾</span>
      </div>
      <div class="cm-sec-body">
        ${sec.fields.map((f) => _f(f.label, f.html ?? _ta(f.id))).join("")}
      </div>
    </div>`;
  }

  function _template() {
    return `<div class="cm-wrapper calc-glass">
      <div class="cm-pane roa-pane">
        <div class="roa-intro-card">
          <div class="roa-intro-title">Record of Advice</div>
          <p class="roa-intro-text">Work through each of the 8 sections in full sentences - the output reads as a narrative. Fields are drafted automatically from the tools you've already filled in. When done, click <strong>Copy</strong> to generate a formatted RoA for your compliance file.</p>
        </div>
        ${ROA_SECTIONS.map((sec, i) => _renderSection(sec, i !== 0)).join("")}
        <div class="cm-action-bar">
          <button class="cm-btn-primary" id="roa_copy_btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy Record of Advice
          </button>
          <button class="cm-btn-secondary" id="roa_preview_btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Preview ROA
          </button>
          <span class="cm-toast" id="roa_toast">Copied to clipboard</span>
        </div>
      </div>
    </div>`;
  }

  // ── Pre-fill from MeetingState ─────────────────────────────────────────────

  function _fmt(v) {
    const n = parseFloat(String(v).replace(/[^\d.\-]/g, ""));
    return isNaN(n) ? null : `R ${Math.round(n).toLocaleString("en-ZA")}`;
  }
  function _parseMoneyRoA(v) {
    return parseFloat(String(v || "").replace(/[^0-9.]/g, "")) || 0;
  }
  // About You and Investment Goals were removed — client age, marital status,
  // employment, household, and funded goals now all come from Timeline cards
  // instead. Marital status is inferred from the most recent Marriage/Divorce
  // personal-event card (no Widowed/Separated signal, since Timeline logs what
  // happened rather than current status). A Marriage card also carries the
  // spouse's name (field2), which only means anything when that's the card
  // that's currently in effect — a later Divorce should drop the name again.
  function _maritalStatusFromTimeline(events) {
    const relevant = events
      .filter(e => e.category === "personal" && /^(Marriage|Divorce)/i.test(e.description || ""))
      .map(e => ({ description: e.description, year: parseFloat(e.year) || 0, name: e.name || "", regime: e.regime || "" }))
      .sort((a, b) => b.year - a.year);
    if (!relevant.length) return { status: "", spouseName: "", regime: "" };
    const latest = relevant[0];
    const isDivorce = /divorce/i.test(latest.description);
    return {
      status: isDivorce ? "Divorced" : "Married",
      spouseName: isDivorce ? "" : latest.name,
      regime: isDivorce ? "" : latest.regime,
    };
  }

  function _prefill(w, force) {
    const ms = window.MeetingState;
    if (!ms) return 0;

    const tl  = ms.get("timeline");
    const cp  = ms.get("currentPortfolio");
    const ep  = ms.get("existingPolicies");
    const bud = ms.get("cashflow");
    const cn  = ms.get("coverNeeds");
    const wu  = ms.get("wrapUp");
    const cd  = ms.get("clientDetails");

    const tlEvents         = tl?.events || [];
    const clientAge        = parseFloat(tl?.age) || null;
    const { status: maritalStatus, spouseName, regime } = _maritalStatusFromTimeline(tlEvents);
    const bornEvent  = tlEvents.find(e => e.type === "born");
    const birthplace = bornEvent?.location || "";
    const employmentEvents = tlEvents.filter(e => e.category === "employment");
    const householdEvents  = tlEvents.filter(e => e.category === "household");
    // Gross monthly income lives only on the "Current Job" Timeline card now
    // (Cashflow captures Net only).
    const jobEvent          = employmentEvents.find(e => e.field === "gross");
    const grossMonthly      = jobEvent ? _parseMoneyRoA(jobEvent.gross) : 0;
    // Timeline's "planning" category is exactly the goal cards (Retirement
    // Funding, Buy a Car, etc.) — matches financial-planning.js's own filter.
    const fundedGoals      = tlEvents.filter(e => e.category === "planning" && e.description && _parseMoneyRoA(e.lumpSum) > 0);
    // Retirement narrative used to come from the standalone retirement calculator's
    // MeetingState write — that calculator is a public-site tool now decoupled from
    // MeetingState entirely, so this reads the same "Retirement Funding" planning
    // goal Timeline already captures instead (years to retirement + funding goal,
    // not the calculator's monthly-income/contribution figures).
    const retGoal          = fundedGoals.find(g => /retirement/i.test(g.description));

    let filled = 0;
    const set = (id, txt) => {
      const el = w.querySelector(`#${id}`);
      if (!el || !txt?.trim()) return;
      if (!force && el.value.trim()) return;
      el.value = txt.trim();
      filled++;
    };

    // Populate FNA / My Rec display columns
    const R   = (v) => v  ? `R ${Math.round(v).toLocaleString("en-ZA")}`      : "—";
    const Rmo = (v) => v  ? `R ${Math.round(v).toLocaleString("en-ZA")}/mo`   : "—";
    const setCell = (id, txt) => { const el = w.querySelector(`#${id}`); if (el) el.textContent = txt; };

    if (cn && Object.keys(cn).length) {
      setCell("fna_life_rec",  R(cn.lifeNeeded));
      setCell("fna_dis_rec",   R(cn.disNeeded));
      setCell("fna_ip_rec",    Rmo(cn.ipMonthly));
      setCell("fna_dread_rec", R(cn.dreadNeeded));
    }
    if (retGoal) {
      setCell("fna_ret_rec", R(_parseMoneyRoA(retGoal.lumpSum)));
    }
    if (fundedGoals.length) {
      const total = fundedGoals.reduce((s, g) => s + _parseMoneyRoA(g.lumpSum), 0);
      if (total) setCell("fna_invest_rec", R(total));
    }

    // A household card's identity is its name + relationship (e.g. "Jane
    // (Child, 2024)"), falling back to the card's description for older
    // saves or custom entries captured before the relationship dropdown existed.
    const _householdLabel = (e) => {
      const who = e.name || e.description || "Dependent";
      const detail = [e.relationship, e.year].filter(Boolean).join(", ");
      return detail ? `${who} (${detail})` : who;
    };
    const validHousehold = householdEvents.filter(e => e.name || e.relationship || e.description);

    // s1_who — from client DB entry + Timeline
    {
      const intro = ms.get("meetingIntro");
      const pending = window._pendingToolStates?.["client-details"]?.extra || {};
      const firstName = pending.first_name || cd?.cm_firstname || "";
      const lastName  = pending.last_name  || cd?.cm_surname   || "";
      const fullName  = [firstName, lastName].filter(Boolean).join(" ") || intro?.intro_name || "";

      const parts = [];
      if (fullName) parts.push(fullName);
      if (clientAge) parts.push(`age ${clientAge}`);
      if (birthplace) parts.push(`born in ${birthplace}`);
      if (maritalStatus) {
        let bit = maritalStatus === "Married" && spouseName ? `Married to ${spouseName}` : maritalStatus;
        if (regime) bit += ` (${regime})`;
        parts.push(bit);
      }

      const empLines = employmentEvents
        .filter(e => e.description)
        .map(e => {
          const detail = [
            e.occupation || e.industry || "",
            e.turnover ? `turnover ${_fmt(e.turnover)}` : "",
            e.year || "",
          ].filter(Boolean).join(", ");
          return detail ? `${e.description} (${detail})` : e.description;
        });

      // Background — every "Past Event" card (Graduation, Bought a House,
      // Business Started, etc.), oldest first, with whatever detail field
      // that card type carries (qualification, location, industry, make &
      // model) alongside the amount.
      const pastLines = tlEvents
        .filter(e => e.category === "past" && e.description)
        .sort((a, b) => (parseFloat(a.year) || 0) - (parseFloat(b.year) || 0))
        .map(e => {
          const detail = [
            e.qualification || e.industry || e.location || e.makeModel || "",
            e.lumpSum ? _fmt(e.lumpSum) : "",
            e.year || "",
          ].filter(Boolean).join(", ");
          return detail ? `${e.description} (${detail})` : e.description;
        });

      const lines = [];
      if (parts.length) lines.push(parts.join(", ") + ".");
      if (empLines.length) lines.push(`Employment: ${empLines.join("; ")}.`);
      if (pastLines.length) lines.push(`Background: ${pastLines.join("; ")}.`);

      if (lines.length) set("s1_who", lines.join(" "));
    }

    // s1_dependents — from Timeline household cards (name + relationship)
    if (tlEvents.length) {
      if (validHousehold.length) {
        set("s1_dependents", `Dependents: ${validHousehold.map(_householdLabel).join("; ")}.`);
      } else {
        set("s1_dependents", "The client does not have any dependents at this time.");
      }
    }

    // s3_assets — from Existing Portfolio
    if (cp?.totalAssets != null) {
      const lines = [
        `Total assets: ${_fmt(cp.totalAssets)}`,
        cp.totalLiquid    ? `Liquid assets: ${_fmt(cp.totalLiquid)}`       : "",
        cp.totalInvestments ? `Investments: ${_fmt(cp.totalInvestments)}`  : "",
        cp.totalFixed     ? `Fixed assets: ${_fmt(cp.totalFixed)}`         : "",
        `Total liabilities: ${_fmt(cp.totalLiabilities)}`,
        cp.totalStLiabilities ? `Short-term liabilities: ${_fmt(cp.totalStLiabilities)}` : "",
        cp.totalLtLiabilities ? `Long-term liabilities: ${_fmt(cp.totalLtLiabilities)}`  : "",
        `Net worth: ${_fmt(cp.netWorth)}`,
      ].filter(Boolean);
      set("s3_assets", lines.join(". ") + ".");
    }

    // s3_cashflow — from Timeline (gross) + Cashflow (everything else)
    if (bud || grossMonthly) {
      const lines = [
        grossMonthly             ? `Gross monthly income: ${_fmt(grossMonthly)}`                : "",
        _fmt(bud?.netPayMonthly) ? `Net monthly income (after tax): ${_fmt(bud.netPayMonthly)}`  : "",
        _fmt(bud?.totalExpenses) ? `Total monthly expenses: ${_fmt(bud.totalExpenses)}`          : "",
        _fmt(bud?.commitTotal)   ? `Total monthly commitments: ${_fmt(bud.commitTotal)}`         : "",
        bud?.surplus != null     ? `Monthly ${bud.surplus >= 0 ? "surplus" : "deficit"}: ${_fmt(Math.abs(bud.surplus))}` : "",
      ].filter(Boolean);
      if (lines.length) set("s3_cashflow", lines.join(". ") + ".");
    }

    // s3_budget — from Budget surplus
    if (bud?.surplus != null) {
      const sign = bud.surplus >= 0 ? "surplus" : "deficit";
      set("s3_budget", `Monthly ${sign} available for financial planning: ${_fmt(Math.abs(bud.surplus))}/month after all expenses and current contributions.`);
    }

    // s3_existing — from Existing Policies (categoryTotals: 4 risk pillars +
    // funeral/medical/short-term, matching the tool's own current shape)
    if (ep?.categoryTotals || ep?.totalPremium) {
      const cat = ep.categoryTotals || {};
      const RISK_LABELS = { life: "Life Cover", disability: "Disability Cover", dreadDisease: "Dread Disease Cover", incomeProtection: "Income Protection" };
      const catLine = (label, c) => {
        if (!c || (!(c.cover > 0) && !(c.premium > 0))) return "";
        const parts = [c.cover > 0 ? `cover ${_fmt(c.cover)}` : "", c.premium > 0 ? `premium ${_fmt(c.premium)}/mo` : ""].filter(Boolean);
        return `${label}: ${parts.join(", ")}`;
      };
      const lines = [
        ...Object.entries(RISK_LABELS).map(([key, label]) => catLine(label, cat[key])),
        catLine("Funeral Cover", cat.funeralCover),
        cat.medical?.premium > 0    ? `Medical & Health: ${_fmt(cat.medical.premium)}/month`    : "",
        cat.shortTerm?.premium > 0  ? `Short-Term / Asset Insurance: ${_fmt(cat.shortTerm.premium)}/month` : "",
      ].filter(Boolean);
      if (ep.totalPremium) lines.push(`Total premium across all policies: ${_fmt(ep.totalPremium)}/month`);
      if (lines.length) set("s3_existing", lines.join(". ") + ".");
    }

    // s3_tax — no live source since "About You" was removed; the FA fills
    // this in manually, same as s8_feeling / s9_implement.

    // s3_emergency — liquid assets vs monthly expenses
    if (cp?.totalLiquid != null) {
      const months = bud?.totalExpenses > 0 ? (cp.totalLiquid / bud.totalExpenses).toFixed(1) : null;
      const line = [
        `Liquid assets: ${_fmt(cp.totalLiquid)}`,
        months ? `equivalent to ${months} months of living expenses` : "",
        bud?.totalExpenses ? `(monthly expenses: ${_fmt(bud.totalExpenses)})` : "",
      ].filter(Boolean).join(" – ");
      set("s3_emergency", line + ".");
    }

    // s3_debt — from Existing Portfolio liabilities
    if (cp?.totalLiabilities != null) {
      if (cp.totalLiabilities === 0) {
        set("s3_debt", "The client does not have any debt at this time.");
      } else {
        const rowLabel = r => [r.type, r.balance ? `balance ${_fmt(r.balance)}` : "", r.monthly ? `${_fmt(r.monthly)}/mo` : ""].filter(Boolean).join(" – ");
        const ltRows = (cp.ltLiabilities || []).filter(r => r.type);
        const stRows = (cp.stLiabilities || []).filter(r => r.type);
        const parts = [];
        if (ltRows.length) parts.push(`Long-term: ${ltRows.map(rowLabel).join("; ")}`);
        if (stRows.length) parts.push(`Short-term: ${stRows.map(rowLabel).join("; ")}`);
        if (parts.length) set("s3_debt", parts.join(". ") + ".");
      }
    }

    // s3_offshore — offshore investments from Existing Portfolio
    if (cp?.investments?.length) {
      const offshore = cp.investments.filter((i) => i.type === "Offshore Investment");
      if (offshore.length) {
        const list = offshore.map((i) => [i.provider, i.value ? _fmt(i.value) : ""].filter(Boolean).join(" – ")).join("; ");
        set("s3_offshore", `Offshore investments on record: ${list}.`);
      } else {
        set("s3_offshore", "No offshore assets or interests disclosed.");
      }
    }

    // s5_risk — Planning-event cards are themselves evidence of investment
    // interest (the client set money aside toward something), distinct from
    // s4_goals' own detailed breakdown of each goal.
    if (fundedGoals.length) {
      const names = fundedGoals.map(g => g.description).filter((v, i, a) => a.indexOf(v) === i);
      set("s5_risk", `The client has identified the following goals to fund, indicating an interest in risk and investment planning: ${names.join(", ")}.`);
    }

    // s4_goals — from Timeline funded cards
    if (fundedGoals.length) {
      const currentYear = new Date().getFullYear();
      const intro = clientAge ? `The client is currently ${clientAge} years old, and their goals are:` : "The client's goals are:";
      const items = fundedGoals.map((g) => {
        const targetYear = parseFloat(g.year) || null;
        const yrs = targetYear != null ? Math.round(targetYear - currentYear) : null;
        const targetAge = clientAge && yrs != null ? Math.round(clientAge + yrs) : null;
        const timing = yrs != null && yrs > 0
          ? `In ${yrs} ${yrs === 1 ? "year" : "years"} time${targetAge ? ` (age ${targetAge}, ${targetYear})` : ` (${targetYear})`}`
          : null;
        const parts = [
          timing,
          g.beneficiary ? `${g.description} (${g.beneficiary})` : g.description,
          g.lumpSum ? `needed: ${_fmt(g.lumpSum)}` : "",
        ].filter(Boolean);
        return `- ${parts.join(" – ")}`;
      });
      set("s4_goals", `${intro}\n${items.join("\n")}`);
    }

    // s4_retirement — from Timeline's "Retirement Funding" planning goal. Used to
    // come from the standalone Retirement Calculator's monthly-income/contribution
    // figures via MeetingState; that calculator no longer writes MeetingState at
    // all (decoupled from Financial Tools), so this is narrower by design — years
    // to retirement + funding goal, not a monthly income/contribution breakdown.
    if (retGoal) {
      const yearsToRetire = retGoal.year - new Date().getFullYear();
      const lines = [
        yearsToRetire > 0  ? `${yearsToRetire} years to retirement`             : "",
        _fmt(retGoal.lumpSum) ? `Retirement funding goal: ${_fmt(retGoal.lumpSum)}` : "",
      ].filter(Boolean);
      if (lines.length) set("s4_retirement", lines.join(". ") + ".");
    }

    // s4_fna — from Cover Needs
    if (cn?.lifeNeeded || cn?.disNeeded || cn?.dreadNeeded) {
      const lines = [
        cn.lifeNeeded   ? `Life cover needed: ${_fmt(cn.lifeNeeded)}${cn.lifeGap   ? ` (shortfall: ${_fmt(cn.lifeGap)})`   : ""}` : "",
        cn.disNeeded    ? `Disability cover needed: ${_fmt(cn.disNeeded)}${cn.disGap    ? ` (shortfall: ${_fmt(cn.disGap)})`    : ""}` : "",
        cn.ipMonthly    ? `Income protection needed: ${_fmt(cn.ipMonthly)}/month${cn.ipGap    ? ` (shortfall: ${_fmt(cn.ipGap)}/month)` : ""}` : "",
        cn.dreadNeeded  ? `Dread disease cover needed: ${_fmt(cn.dreadNeeded)}${cn.dreadGap  ? ` (shortfall: ${_fmt(cn.dreadGap)})`  : ""}` : "",
        cn.funeralNeeded ? `Funeral cover needed: ${_fmt(cn.funeralNeeded)}`                                                              : "",
      ].filter(Boolean);
      if (lines.length) set("s4_fna", lines.join(". ") + ".");
    }

    // s6_will — from Wrap Up
    if (wu?.hasWill) {
      let txt;
      if (wu.hasWill === "yes") {
        const parts = ["Client has a valid will in place."];
        if (wu.willLocation) parts.push(`Kept at: ${wu.willLocation}${wu.willAttorney ? ` (${wu.willAttorney})` : ""}.`);
        if (wu.willUpdated)  parts.push(`Last updated: ${wu.willUpdated}.`);
        txt = parts.join(" ");
      } else {
        const contact = wu.willContact === "yes"
          ? "The client opted in to be contacted to update or draft their will."
          : wu.willContact === "no"
            ? "The client did not opt in to be contacted to update or draft their will."
            : "";
        txt = ["Client does not currently have a will in place.", contact].filter(Boolean).join(" ");
      }
      set("s6_will", txt);
    }

    // s7_projections — static disclaimer
    set("s7_projections", "It was made clear to the client that the return goals discussed are merely speculative, based on the past performance of the funds discussed, and are not guaranteed.");

    // s9_referrals — from Wrap Up
    if (wu?.referrals?.length) {
      const valid = wu.referrals.filter((r) => r.name);
      if (valid.length) {
        const list = valid.map((r) => [r.name, r.contact, r.relation, r.occupation].filter(Boolean).join(", ")).join("; ");
        set("s9_referrals", `Client provided the following referrals: ${list}.`);
      }
    }

    return filled;
  }

  // ── Preview in new window ─────────────────────────────────────────────────

  function _preview(text) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8">
      <title>Record of Advice — Preview</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Georgia, serif; background: #f8f8f7; color: #1e293b; padding: 3rem 2rem; }
        .page { max-width: 760px; margin: 0 auto; background: white; padding: 3rem 3.5rem; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        pre { white-space: pre-wrap; word-break: break-word; font-family: Georgia, serif; font-size: 0.95rem; line-height: 1.8; color: #1e293b; }
        @media print { body { background: white; padding: 0; } .page { box-shadow: none; border-radius: 0; padding: 2rem; } }
      </style>
    </head><body><div class="page"><pre>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></div></body></html>`);
    win.document.close();
  }

  // ── Build output text ──────────────────────────────────────────────────────

  function _build() {
    const ln = (label, val) => (val ? `${label}\n${val}\n\n` : "");

    const lines = [
      ln("How the client came to be known:", _v("s1_met")),
      ln("Client profile:", _v("s1_who")),
      ln("Dependents:", _v("s1_dependents")),
      ln("Attitude toward risk and investments:", _v("s5_risk")),
      ln("Assets and liabilities:", _v("s3_assets")),
      ln("Income and expenses (cash flow):", _v("s3_cashflow")),
      ln("Budget available for financial planning:", _v("s3_budget")),
      ln("Existing cover and policies:", _v("s3_existing")),
      ln("Tax situation:", _v("s3_tax")),
      ln("Debt repayment strategy:", _v("s3_debt")),
      ln("Emergency fund:", _v("s3_emergency")),
      ln("Offshore assets or interests:", _v("s3_offshore")),
      ln("Client goals:", _v("s4_goals")),
      ln("Retirement lifestyle expectations:", _v("s4_retirement")),
      ln("Financial needs analysis recommendations:", _buildRecs()),
      ln("Will in place:", _v("s6_will")),
      ln("Projection disclaimer discussed:", _v("s7_projections")),
      ln("Client's response to recommendations:", _v("s8_feeling")),
      ln("Implementation timeline:", _v("s9_implement")),
    ];
    return lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // ── Copy helper ────────────────────────────────────────────────────────────

  function _copy(text, toastId, msg) {
    const toast = document.getElementById(toastId);
    const show = (m) => {
      if (toast) {
        toast.textContent = m || "Copied to clipboard";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2500);
      }
    };
    navigator.clipboard
      .writeText(text)
      .then(() => show(msg))
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        show(msg);
      });
  }

  // ── Toast helper (no clipboard) ────────────────────────────────────────────

  function _toast(toastId, msg) {
    const toast = document.getElementById(toastId);
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }

  // ── Module ─────────────────────────────────────────────────────────────────

  window.App?.register("record-of-advice", {
    id: "record-of-advice",
    title: "Record of Advice",
    guide: {
      intro: {
        heading: "Record of Advice",
        html: `<p>Work through each of the 8 sections in full sentences. The output is a formatted narrative ready to paste into your compliance file.</p>
               <p>Click <strong>Pull from meeting data</strong> to auto-draft fields from the tools you've already completed in this session.</p>
               <p>Client name, date, and advisor are pulled automatically from the meeting details you've already captured.</p>`,
      },
    },

    mount(wrapper) {
      _injectCSS();
      wrapper.insertAdjacentHTML("beforeend", _template());
      const w = wrapper.querySelector(".cm-wrapper");

      w.addEventListener("click", (e) => {
        if (e.target.closest("button, input, select, textarea, a")) return;
        const hdr = e.target.closest(".cm-sec-hdr");
        if (!hdr) return;
        const sec = hdr.closest(".cm-sec");
        if (!sec) return;
        const isCollapsed = sec.classList.contains("collapsed");
        w.querySelectorAll(".cm-sec").forEach(s => s.classList.add("collapsed"));
        if (isCollapsed) sec.classList.remove("collapsed");
      });

      w.querySelector("#roa_copy_btn")?.addEventListener("click", () => {
        _copy(_build(), "roa_toast", "Copied to clipboard");
      });

      w.querySelector("#roa_preview_btn")?.addEventListener("click", () => {
        _preview(_build());
      });

      // Auto-prefill empty fields on first mount
      const pane = w.querySelector(".roa-pane");
      _prefill(pane, false);
    },

    onActivate(wrapper) {
      const pane = wrapper.querySelector(".roa-pane");
      if (pane) _prefill(pane, false);
    },
  });
})();

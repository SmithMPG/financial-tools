// tools/meeting-summary.js
// Meeting Summary - post-meeting notes and formatted email/summary output.
// Reads fact-find data from the DOM (other mounted tools) and MeetingState.

(function () {
  // ── Constants ──────────────────────────────────────────────────────────────

  const PRIORITIES = [
    "Death",
    "Disability",
    "Dread Disease",
    "Retirement Planning",
    "Estate Planning",
    "Investment / Wealth Creation",
    "Children's Education",
    "Short Term Savings / Emergency Fund",
    "Medical Aid / Gap Cover",
    "Will",
    "Short Term Insurance",
  ];

  const DOCS = [
    { id: "doc_id", label: "ID document" },
    { id: "doc_income", label: "Proof of income" },
    { id: "doc_address", label: "Proof of address" },
    { id: "doc_bank", label: "Bank confirmation" },
    { id: "doc_fsp", label: "Other FSP benefits" },
    { id: "doc_corporate", label: "Corporate benefit statements" },
    { id: "doc_birth", label: "Birth certificates (minor beneficiaries)" },
  ];

  // ── CSS ────────────────────────────────────────────────────────────────────

  function _injectCSS() {
    if (document.getElementById("ms-styles")) return;
    const s = document.createElement("style");
    s.id = "ms-styles";
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
        scrollbar-color: rgba(0,0,0,0.1) transparent;
      }
      .cm-sec {
        background: rgba(0,0,0,0.02);
        border: 1px solid rgba(0,0,0,0.07);
        border-radius: 0.75rem;
        padding: 1rem 1.1rem;
        display: flex; flex-direction: column; gap: 0.75rem;
      }
      .cm-sec-title {
        font-family: var(--fb); font-size: 0.65rem; font-weight: 700;
        letter-spacing: 0.09em; text-transform: uppercase; color: var(--navy-5);
      }
      .cm-field { display: flex; flex-direction: column; gap: 0.3rem; }
      .cm-label { font-family: var(--fb); font-size: 0.66rem; font-weight: 500; color: var(--navy-5); letter-spacing: 0.01em; }
      .cm-output-label { font-family: var(--fb); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--navy-4); }
      .cm-output-hint { font-family: var(--fb); font-size: 0.78rem; color: var(--navy-5); line-height: 1.5; }
      .cm-textarea {
        width: 100%; min-height: 70px; padding: 0.55rem 0.75rem;
        font-family: var(--fb); font-size: 0.88rem; color: var(--navy-3);
        background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1);
        border-radius: 8px; outline: none; resize: vertical; line-height: 1.5;
        box-sizing: border-box; transition: all 0.2s;
      }
      .cm-textarea::placeholder { color: rgba(100,116,139,0.45); }
      .cm-textarea:focus { background: white; border-color: var(--navy-4); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      .cm-checks { display: flex; flex-wrap: wrap; gap: 0.45rem 1.5rem; }
      .cm-chk-lbl { display: flex; align-items: center; gap: 0.4rem; font-family: var(--fb); font-size: 0.84rem; color: var(--navy-3); cursor: pointer; }
      .cm-action-bar { flex-shrink: 0; display: flex; align-items: center; gap: 0.65rem; margin-top: 0.5rem; }
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
        padding: 0.6rem 1.2rem; background: transparent; color: var(--navy-3);
        font-family: var(--fb); font-size: 0.85rem; font-weight: 700;
        border: 1.5px solid var(--navy-3); border-radius: 0.55rem; cursor: pointer; transition: all 0.15s;
      }
      .cm-btn-secondary:hover { background: var(--navy-3); color: white; }
      .cm-btn-secondary:active { transform: scale(0.97); }
      .cm-toast { font-family: var(--fb); font-size: 0.78rem; color: #059669; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
      .cm-toast.show { opacity: 1; }
      .cm-grp-label {
        font-family: var(--fb); font-size: 0.6rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.1em;
        color: var(--navy-5); opacity: 0.45;
        padding: 0.6rem 0 0.1rem;
      }
      .cm-date-input {
        padding: 0.5rem 0.7rem; font-family: var(--fb); font-size: 0.84rem; color: var(--navy-3);
        background: rgba(255,255,255,0.6); border: 1px solid rgba(0,0,0,0.1);
        border-radius: 8px; outline: none; width: 190px;
      }
      .cm-date-input:focus { background: white; border-color: var(--navy-4); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

      /* ── Send-block cards — reuse the shared .mt-primary accordion, just
         with a checkbox slotted into the header before the title. The shared
         header's justify-content:space-between spreads 3 children apart
         instead of packing them handle→label→...→arrow, so override it the
         same way financial-planning.js does for its drag-handle rows. ── */
      .ms-send-list { display: flex; flex-direction: column; gap: 0.55rem; }
      .mt-primary-hdr:has(.ms-send-chk) { justify-content: flex-start; }
      .mt-primary-hdr:has(.ms-send-chk) .mt-chev { margin-left: auto; }
      .ms-send-chk { width: 15px; height: 15px; accent-color: var(--navy-3); flex-shrink: 0; margin-right: 0.6rem; }
      .ms-send-empty { font-family: var(--fb); font-size: 0.76rem; color: var(--navy-5); opacity: 0.55; font-style: italic; padding: 0.3rem 0; }
      .ms-row { display: flex; justify-content: space-between; align-items: center; padding: 0.32rem 0; border-bottom: 1px solid rgba(0,0,0,0.06); font-family: var(--fb); font-size: 0.8rem; }
      .ms-row:last-child { border-bottom: none; }
      .ms-row-lbl { color: var(--navy-5); }
      .ms-row-val { color: var(--navy-3); font-weight: 600; font-variant-numeric: tabular-nums; }
      .ms-row-sub { font-size: 0.68rem; color: var(--navy-5); opacity: 0.7; margin-top: 0.35rem; }
    `;
    document.head.appendChild(s);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const _ta = (id, ph, rows = 3) => `<textarea class="cm-textarea" id="${id}" rows="${rows}" placeholder="${ph}"></textarea>`;
  const _v = (id) => (document.getElementById(id)?.value || "").trim();
  const _chk = (id) => document.getElementById(id)?.checked || false;
  const _line = (label, val) => (val ? `${label}: ${val}\n` : "");

  // Delegates to components/input-format.js — the single source of truth for
  // money formatting — rather than a local regex copy.
  function _R(n) { return window.numToRand(n || 0); }

  // The FA-editable Meeting Date field takes priority (it's the one place
  // this can be corrected, e.g. writing the summary up a day later) — falls
  // back to meetingIntro's auto-stamped date, then today.
  function _meetingDateStr() {
    const raw = _v("ms_meeting_date");
    if (raw) {
      const d = new Date(raw + "T00:00:00");
      if (!isNaN(d)) return d.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
    }
    const intro = window.MeetingState?.get("meetingIntro") || {};
    return intro.meetingDate || new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  }

  function _row(label, val, sub = "") {
    return `<div class="ms-row"><span class="ms-row-lbl">${label}</span><span class="ms-row-val">${val}</span></div>${sub ? `<div class="ms-row-sub">${sub}</div>` : ""}`;
  }

  function _empty(text) { return `<div class="ms-send-empty">${text}</div>`; }

  // ── Send-block previews ────────────────────────────────────────────────────
  // Each reads live MeetingState and renders a rough preview — the exact
  // email HTML formatting (donut chart, table styling, Outlook-safety) is a
  // separate pass; this is about surfacing correct, current data first.

  function _previewPortfolio() {
    const cp = window.MeetingState?.get("currentPortfolio") || {};
    if (!cp.totalAssets && !cp.totalLiabilities) return _empty("No portfolio captured yet");
    return [
      _row("Net Worth", _R(cp.netWorth || 0)),
      _row("Total Assets", _R(cp.totalAssets || 0)),
      _row("Total Liabilities", _R(cp.totalLiabilities || 0)),
    ].join("");
  }

  const RISK_PILLARS = [
    { key: "life",             label: "Life Cover" },
    { key: "disability",       label: "Disability" },
    { key: "dreadDisease",     label: "Dread Disease" },
    { key: "incomeProtection", label: "Income Protection" },
  ];

  function _previewPolicies() {
    const ep  = window.MeetingState?.get("existingPolicies") || {};
    const cat = ep.categoryTotals || {};
    const pillars = RISK_PILLARS.filter(p => (cat[p.key]?.cover || 0) > 0);
    if (!pillars.length) return _empty("No policies captured yet");
    return pillars.map(p => _row(p.label, _R(cat[p.key].cover))).join("");
  }

  function _previewCashflow() {
    const bud = window.MeetingState?.get("cashflow") || {};
    const netPay = bud.netPayMonthly || 0;
    if (!netPay && !bud.totalExpenses) return _empty("No cashflow captured yet");
    const seg = (label, val) => _row(label, _R(val), netPay > 0 ? _pct(val, netPay) : "");
    return [
      _row("Net Pay", _R(netPay)),
      seg("Wealth Building", bud.investTotal),
      seg("Protection", bud.riskTotal),
      seg("Liabilities", bud.liabTotal),
      seg("Other Spend", bud.otherTotal),
      seg("Surplus", bud.surplus),
    ].join("");
  }

  function _previewEstate() {
    const est = window.MeetingState?.get("estatePlanner") || {};
    if (!est.grossEstate) return _empty("No estate plan captured yet");
    const taxesPayable = (est.totalDuty || 0) + (est.totalCGT || 0);
    const gapVal = est.estateGap > 0 ? _R(est.estateGap) : (est.surplus > 0 ? `+${_R(est.surplus)}` : _R(0));
    return [
      _row("Gross Estate", _R(est.grossEstate)),
      _row("Taxes Payable", _R(taxesPayable), "Estate Duty + Capital Gains Tax"),
      _row(est.estateGap > 0 ? "Estate Gap" : "Surplus", gapVal),
    ].join("");
  }

  const RISK_NEED_ROWS = (cn) => [
    { label: "Life Cover",         val: cn.lifeNeeded },
    { label: "Capital Disability", val: cn.disNeeded },
    { label: "Dread Disease",      val: cn.dreadNeeded },
    { label: "Income Protection",  val: cn.ipMonthly, mo: true },
  ];
  const FIN_ESTIMATE_NOTE = "These are all estimated amounts — final amounts will be discussed in the final meeting.";

  function _previewFinRisk() {
    const cn = window.MeetingState?.get("coverNeeds") || {};
    const riskRows = RISK_NEED_ROWS(cn).filter(r => r.val > 0);
    if (!riskRows.length) return _empty("No risk needs captured yet");
    const items = riskRows.map(r => _row(r.label, `${_R(r.val)}${r.mo ? "/mo" : ""}`)).join("");
    const note = `<div class="ms-row-sub" style="margin-top:0.6rem;font-style:italic;">${FIN_ESTIMATE_NOTE}</div>`;
    return items + note;
  }

  function _previewFinInvest() {
    const cn = window.MeetingState?.get("coverNeeds") || {};
    const goals = (cn.goals || []).filter(g => g.targetAmount > 0);
    if (!goals.length) return _empty("No investment goals captured yet");
    return goals.map(g => _row(g.name, _R(g.targetAmount) + (/retirement/i.test(g.name || "") ? "/mo" : ""), g.year ? `By ${g.year}` : "")).join("");
  }

  function _previewNextMeeting() {
    const wu = window.MeetingState?.get("wrapUp") || {};
    if (!wu.nextMeetingDate) return _empty("No next meeting date captured yet");
    const dateStr = new Date(wu.nextMeetingDate + (wu.nextMeetingTime ? `T${wu.nextMeetingTime}` : "")).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return _row("Next Meeting", dateStr + (wu.nextMeetingTime ? ` at ${wu.nextMeetingTime}` : ""));
  }

  const SEND_BLOCKS = [
    { key: "portfolio", title: "Existing Portfolio",              render: _previewPortfolio },
    { key: "policies",  title: "Existing Policies",                render: _previewPolicies },
    { key: "cashflow",  title: "Cashflow",                         render: _previewCashflow },
    { key: "estate",    title: "Estate Planning",                  render: _previewEstate },
    { key: "finrisk",   title: "Financial Planning — Risk",        render: _previewFinRisk },
    { key: "fininvest", title: "Financial Planning — Investments", render: _previewFinInvest },
  ];

  // ── Template ───────────────────────────────────────────────────────────────

  function _template() {
    return `<div class="cm-wrapper calc-glass">
      <div class="cm-pane">
        <div class="cm-sec">
          <div class="cm-output-label">Introduction</div>
          <div class="cm-field" style="margin-bottom:0.6rem;">
            <label class="cm-label" for="ms_meeting_date">Meeting Date</label>
            <input type="date" class="cm-date-input" id="ms_meeting_date">
          </div>
          <div class="cm-output-hint">Opening paragraph for the client email. Edit as needed before previewing.</div>
          ${_ta("ms_intro", "", 3)}
        </div>

        <div class="cm-sec">
          <div class="cm-output-label">Select What to Send</div>
          <div class="cm-output-hint">Tick each section to include in the email. Click a card to preview how it will look.</div>
          <div class="ms-send-list">
            ${SEND_BLOCKS.map(b => `
              <div class="mt-primary collapsed" data-send-sec="${b.key}">
                <div class="mt-primary-hdr">
                  <input type="checkbox" class="ms-send-chk" id="ms_inc_${b.key}" checked>
                  <span class="mt-primary-title">${b.title}</span>
                  <span class="mt-chev"></span>
                </div>
                <div class="mt-primary-body" id="ms_preview_${b.key}"></div>
              </div>`).join("")}
          </div>
        </div>

        <div class="cm-grp-label">Email Close</div>

        <div class="cm-sec">
          <div class="cm-output-label">Next Steps</div>
          <div class="cm-output-hint">List the action items agreed upon and who is responsible for each.</div>
          ${_ta("ms_nextsteps", "e.g. 1. Matthew to prepare quotes by 20 May.\n2. Client to send latest pension statement.\n3. Review meeting on 1 June.", 4)}
        </div>

        <div class="cm-sec">
          <div class="cm-sec-title">Documents Required</div>
          <div class="cm-checks">
            ${DOCS.map((d) => `<label class="cm-chk-lbl"><input type="checkbox" id="${d.id}"> ${d.label}</label>`).join("")}
          </div>
        </div>

        <div class="cm-sec">
          <div class="cm-sec-title">Next Meeting</div>
          <div id="ms_next_meeting_preview"></div>
        </div>

        <div class="cm-sec">
          <div class="cm-output-label">Outro</div>
          <div class="cm-output-hint">Closing paragraph before the sign-off. "Kind regards, [Advisor]" is added automatically.</div>
          ${_ta("ms_outro", "", 3)}
        </div>

        <div class="cm-action-bar">
          <button class="cm-btn-primary" id="ms_preview_btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Preview Summary
          </button>
          <button class="cm-btn-secondary" id="ms_copy_btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2v1"/></svg>
            Copy Text
          </button>
          <span class="cm-toast" id="ms_toast">Email copied — paste into Gmail or Outlook</span>
        </div>
      </div>
    </div>`;
  }

  // ── Build summary text ─────────────────────────────────────────────────────

  function _build() {
    const intro = window.MeetingState?.get("meetingIntro") || {};
    const wu = window.MeetingState?.get("wrapUp") || {};
    const nextMeetingLine = wu.nextMeetingDate
      ? new Date(wu.nextMeetingDate + (wu.nextMeetingTime ? `T${wu.nextMeetingTime}` : "")).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + (wu.nextMeetingTime ? ` at ${wu.nextMeetingTime}` : "")
      : "";
    const client = intro.clientName || _v("cm_client_name") || "Valued Client";
    const first = intro.clientName || client;
    const advisor = intro.advisor || _v("cm_advisor") || window.ACTIVE_ADVISER?.name || "Your Advisor";
    const date = _meetingDateStr();

    const priLines = PRIORITIES.map((name, i) => {
      const dashEl = document.querySelector(`.cm-wrapper .cm-pri-rating[data-pri="${i}"] .cm-pri-btn.active`);
      const rating = dashEl?.dataset.r || "-";
      const whyInputs = document.querySelectorAll(".cm-wrapper .cm-pri-why .cm-input");
      const why = whyInputs[i]?.value?.trim() || "";
      return `  ${name}: ${rating}${why ? " - " + why : ""}`;
    }).join("\n");


    const rpqScore = document.getElementById("cm_rpq_score")?.textContent?.trim();
    const rpqProfile = document.getElementById("cm_rpq_profile")?.textContent?.trim();

    const incEl = document.getElementById("cm_tot_income");
    const expEl = document.getElementById("cm_tot_expenses");
    const affEl = document.getElementById("cm_affordability");

    return [
      `MEETING SUMMARY`,
      `${"─".repeat(60)}`,
      `Client:  ${client}`,
      `Date:    ${date}`,
      `Advisor: ${advisor}`,
      `${"─".repeat(60)}`,
      ``,
      `Dear ${first},`,
      ``,
      _v("ms_intro") || `Hi ${first},\n\nThank you for meeting with me on ${date}.\nBelow you will find a brief summary of your current financial position and the solutions I am proposing.`,
      ``,
      `${"─".repeat(60)}`,
      `PERSONAL SNAPSHOT`,
      `${"─".repeat(60)}`,
      ``,
      _line("Full Name", [_v("cm_title"), _v("cm_firstname"), _v("cm_surname")].filter(Boolean).join(" ")),
      _line("ID Number", _v("cm_idnumber")),
      _line("Occupation", _v("cm_occupation")),
      _line("Employer", _v("cm_employer")),
      _line("Gross Income", _v("cm_gross_income")),
      _line("Marital Status", _v("cm_marital_status")),
      ``,
      `${"─".repeat(60)}`,
      `FINANCIAL SNAPSHOT`,
      `${"─".repeat(60)}`,
      ``,
      `Monthly net income:    ${incEl?.textContent || "-"}`,
      `Monthly expenses:      ${expEl?.textContent || "-"}`,
      `Monthly affordability: ${affEl?.textContent || "-"}`,
      ``,
      _v("cm_retirement_age") ? `Projected retirement age: ${_v("cm_retirement_age")}\n` : "",
      rpqScore && rpqScore !== "-" ? `Risk Profile: ${rpqProfile} (score: ${rpqScore}/20)\n` : "",
      `${"─".repeat(60)}`,
      `YOUR PRIORITIES`,
      `${"─".repeat(60)}`,
      `(1 = most important, 3 = least important)`,
      ``,
      priLines,
      ``,
      _v("ms_nextsteps") ? `${"─".repeat(60)}\nNEXT STEPS\n${"─".repeat(60)}\n\n${_v("ms_nextsteps")}\n` : "",
      nextMeetingLine ? `${"─".repeat(60)}\nNEXT MEETING\n${"─".repeat(60)}\n\n${nextMeetingLine}\n` : "",
      `${"─".repeat(60)}`,
      ``,
      _v("ms_outro") || "Please do not hesitate to contact me should you have any questions.",
      ``,
      `Kind regards,`,
      advisor,
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // ── HTML email builder ─────────────────────────────────────────────────────

  function _pct(num, denom) {
    if (!denom) return "0%";
    return Math.round((num / denom) * 100) + "%";
  }

  function _buildHTML(opts) {
    const intro = window.MeetingState?.get("meetingIntro") || {};
    const bud  = window.MeetingState?.get("cashflow") || {};
    const ep      = window.MeetingState?.get("existingPolicies") || {};
    const curPort = window.MeetingState?.get("currentPortfolio") || {};
    const est     = window.MeetingState?.get("estatePlanner") || {};
    const cn      = window.MeetingState?.get("coverNeeds") || {};
    const wu      = window.MeetingState?.get("wrapUp") || {};

    const clientFirst = intro.clientName || window._activeClientFirstName || "Client Name";
    const clientFull  = intro.clientName || clientFirst;
    const advisor     = intro.advisor || window.ACTIVE_ADVISER?.name || "Your Advisor";
    const date        = _meetingDateStr();

    const introText = _v("ms_intro") || `Hi ${clientFirst},\n\nThank you for meeting with me on ${date}.\nBelow you will find a brief summary of your current financial position and the solutions I am proposing.`;
    const nextsteps = _v("ms_nextsteps");
    const outroText = _v("ms_outro") || "Please do not hesitate to contact me should you have any questions.";

    const _cell = (content, style = "") =>
      `<td style="padding:6px 8px;font-size:13px;${style}">${content}</td>`;
    const _hdr = (label, style = "") =>
      `<td style="padding:5px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;background:#f8fafc;${style}">${label}</td>`;
    const _sec = (title) =>
      `<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0a0f1e;border-left:3px solid #d4a843;padding:2px 0 4px 10px;margin:22px 0 12px;">${title}</div>`;
    // Chapter breaks are a harder stop than section breaks — a thick navy
    // rule and a serif heading (matching the header banner's wordmark font)
    // so the email reads as three parts, not seven identical sections.
    const _chapter = (title) => `
      <div style="margin:8px 0 4px;padding-top:22px;border-top:3px solid #0a0f1e;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:700;color:#0a0f1e;">${title}</div>
      </div>`;
    // A leading headline number — same treatment as Estate Plan's chips —
    // for sections whose detail below is really just "how we got this number".
    const _chip = (label, val) => `
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="text-align:center;padding:12px 8px;">
          <div style="font-size:17px;font-weight:700;color:#0a0f1e;">${val}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${label}</div>
        </td>
      </tr></table>`;
    // Several headline numbers side by side — same treatment Estate Plan
    // pioneered (Gross Estate | Taxes Payable | Gap) — for a section that's
    // really just 2-3 numbers, not a breakdown.
    const _statRow = (stats) => `
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        ${stats.map((s, i) => `<td style="text-align:center;padding:12px 8px;border-right:${i < stats.length - 1 ? "1px solid #e2e8f0" : "none"};">
            <div style="font-size:17px;font-weight:700;color:${s.color || "#0a0f1e"};">${s.val}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${s.label}</div>
          </td>`).join("")}
      </tr></table>`;

    // ── Cashflow donut chart — Net Pay in the centre, spend broken into the
    // real categories cashflow.js tracks (all five, not just the three we
    // talk to most, so the percentages always add up to 100% of net pay) ──
    const netPay = bud.netPayMonthly || 0;
    const budSegments = [
      { label: "Wealth Building", val: bud.investTotal || 0, color: "#3b82f6" },
      { label: "Protection",      val: bud.riskTotal   || 0, color: "#f59e0b" },
      { label: "Liabilities",     val: bud.liabTotal    || 0, color: "#ef4444" },
      { label: "Other Spend",     val: bud.otherTotal   || 0, color: "#a855f7" },
      { label: "Surplus",         val: bud.surplus       || 0, color: "#22c55e" },
    ].filter(s => s.val > 0);

    const budSection = opts.budget && netPay > 0 ? (() => {
      // Render donut to canvas → base64 PNG so it survives Outlook (no SVG support)
      const size = 240; // 2× for retina
      const cnv  = document.createElement("canvas");
      cnv.width  = cnv.height = size;
      const ctx  = cnv.getContext("2d");
      const cx = size / 2, cy = size / 2;
      const rad = Math.round(size * 46 / 120);
      const lw  = Math.round(size * 13 / 120);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, 2 * Math.PI);
      ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = lw; ctx.stroke();
      let angle = -Math.PI / 2;
      for (const seg of budSegments) {
        const sweep = (seg.val / netPay) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, angle, angle + sweep);
        ctx.strokeStyle = seg.color; ctx.lineWidth = lw; ctx.stroke();
        angle += sweep;
      }
      const sc = size / 120;
      ctx.textAlign = "center";
      ctx.font = `bold ${Math.round(8 * sc)}px Arial`; ctx.fillStyle = "#94a3b8";
      ctx.fillText("NET PAY", cx, cy - 8 * sc);
      ctx.font = `bold ${Math.round(13 * sc)}px Arial`; ctx.fillStyle = "#334155";
      ctx.fillText(_R(netPay), cx, cy + 8 * sc);
      ctx.font = `${Math.round(8 * sc)}px Arial`; ctx.fillStyle = "#94a3b8";
      ctx.fillText("/month", cx, cy + 20 * sc);
      const donutSrc = cnv.toDataURL("image/png");

      const legendRows = budSegments.map(s => `
        <tr>
          <td style="padding:4px 6px 4px 0;vertical-align:middle;">
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${s.color};"></span>
          </td>
          <td style="padding:4px 12px 4px 0;font-size:12px;color:#334155;">${s.label}</td>
          <td style="padding:4px 8px 4px 0;font-size:12px;color:#64748b;text-align:right;">${_R(s.val)}</td>
          <td style="padding:4px 0;font-size:12px;color:#94a3b8;text-align:right;">${_pct(s.val, netPay)}</td>
        </tr>`).join("");
      return `
        ${_sec("Cashflow")}
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="130" style="vertical-align:middle;padding-right:20px;text-align:center;">
            <img src="${donutSrc}" width="120" height="120" alt="Cashflow breakdown" style="display:block;margin:0 auto;">
          </td>
          <td style="vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" border="0">${legendRows}</table>
          </td>
        </tr></table>`;
    })() : "";

    // ── Risk cover — cover amount per pillar (premium already shown in Cashflow) ──
    const riskCat = ep.categoryTotals || {};
    const riskPillars = RISK_PILLARS.filter(p => (riskCat[p.key]?.cover || 0) > 0);
    const riskSection = opts.risk && riskPillars.length ? `
      ${_sec("Existing Risk Cover")}
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${riskPillars.map(p => `<tr style="border-top:1px solid #f1f5f9;">
          ${_cell(`<strong>${p.label}</strong>`, "color:#334155;")}
          ${_cell(_R(riskCat[p.key].cover), "text-align:right;color:#64748b;")}
        </tr>`).join("")}
      </table>` : "";

    const portfolioSection = opts.portfolio && (curPort.totalAssets || curPort.totalLiabilities) ? `
      ${_sec("Existing Portfolio")}
      ${_statRow([
        { label: "Net Worth",         val: _R(curPort.netWorth || 0) },
        { label: "Total Assets",      val: _R(curPort.totalAssets || 0) },
        { label: "Total Liabilities", val: _R(curPort.totalLiabilities || 0) },
      ])}` : "";

    // ── Estate Planning — Gross Estate → Taxes Payable → Gap/Surplus,
    // mirroring the live tool's 3-milestone structure ──
    const estTaxesPayable = (est.totalDuty || 0) + (est.totalCGT || 0);
    const estGapVal = est.estateGap > 0 ? _R(est.estateGap) : (est.surplus > 0 ? `+${_R(est.surplus)}` : _R(0));
    const estGapLabel = est.estateGap > 0 ? "Estate Gap" : "Surplus";
    const estGapColor = est.estateGap > 0 ? "#dc2626" : "#16a34a";
    const estateSection = opts.estate && est.grossEstate ? `
      ${_sec("Estate Planning")}
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          ${[
            { label: "Gross Estate",  val: _R(est.grossEstate), color: "#0a0f1e" },
            { label: "Taxes Payable", val: _R(estTaxesPayable), color: "#0a0f1e" },
            { label: estGapLabel,     val: estGapVal,           color: estGapColor },
          ].map((s, i) => `<td style="text-align:center;padding:12px 8px;border-right:${i < 2 ? "1px solid #e2e8f0" : "none"};">
              <div style="font-size:17px;font-weight:700;color:${s.color};">${s.val}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:3px;">${s.label}</div>
            </td>`).join("")}
        </tr>
      </table>` : "";


    // ── Financial Planning — Risk and Investments are independently
    // toggleable (separate send checkboxes) but share one "Financial
    // Planning" heading. Both halves show the amount needed, not the
    // effort being put in toward it (premium / contribution) — Risk shows
    // cover needed, Investments shows the goal's target amount and year.
    const finRiskRows = opts.finrisk ? RISK_NEED_ROWS(cn).filter(r => r.val > 0) : [];
    const finInvestGoals = opts.invest ? (cn.goals || []).filter(g => g.targetAmount > 0) : [];
    const finPlanSection = (finRiskRows.length || finInvestGoals.length) ? `
      ${_sec("Financial Planning")}
      ${finRiskRows.length ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${finRiskRows.map(r => `<tr style="border-top:1px solid #f1f5f9;">
          ${_cell(`<strong>${r.label}</strong>`, "color:#334155;")}
          ${_cell(`${_R(r.val)}${r.mo ? "/mo" : ""}`, "text-align:right;color:#64748b;")}
        </tr>`).join("")}
      </table>
      <div style="font-size:11px;color:#94a3b8;font-style:italic;padding:8px 8px 0;">${FIN_ESTIMATE_NOTE}</div>` : ""}
      ${finInvestGoals.length ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
        <tr>
          ${_hdr("Year", "width:15%;")}
          ${_hdr("Goal", "width:45%;")}
          ${_hdr("Amount", "text-align:right;width:40%;")}
        </tr>
        ${finInvestGoals.map(g => `<tr style="border-top:1px solid #f1f5f9;">
            ${_cell(g.year || "—", "color:#64748b;")}
            ${_cell(`<strong>${g.name}</strong>`, "color:#334155;")}
            ${_cell(_R(g.targetAmount) + (/retirement/i.test(g.name || "") ? "/mo" : ""), "text-align:right;color:#64748b;")}
          </tr>`).join("")}
      </table>` : ""}` : "";

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meeting Summary – ${clientFull}</title></head>
<body style="margin:0;padding:20px;background:#e2e3e4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:20px 10px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1);">

  <tr><td style="background:#0a0f1e;padding:24px 32px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:white;font-weight:700;">The Steward</div>
    <div style="font-size:13px;color:#94a3b8;margin-top:4px;">${advisor} &nbsp;&middot;&nbsp; ${date}</div>
  </td></tr>

  <tr><td style="padding:28px 32px 8px;">
    <p style="font-size:15px;color:#334155;line-height:1.7;margin:0;white-space:pre-wrap;">${introText}</p>
  </td></tr>

  <tr><td style="padding:0 32px;">
    ${(() => {
      const nextStepsBlock = nextsteps ? `
        ${_sec("Next Steps")}
        <div style="margin-bottom:24px;">
          <div style="font-size:13px;color:#334155;line-height:1.7;white-space:pre-wrap;">${nextsteps}</div>
        </div>` : "";
      const nextMeetingBlock = wu.nextMeetingDate ? `
        ${_sec("Next Meeting")}
        <div style="margin-bottom:24px;">
          <div style="font-size:13px;color:#334155;">${new Date(wu.nextMeetingDate + (wu.nextMeetingTime ? `T${wu.nextMeetingTime}` : "")).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${wu.nextMeetingTime ? ` at ${wu.nextMeetingTime}` : ""}</div>
        </div>` : "";

      // Three hard-broken chapters instead of seven identically-weighted
      // sections — a chapter header only appears if it actually has content.
      const chapters = [
        { title: "Your Current Position", body: [portfolioSection, riskSection, budSection].join("") },
        { title: "Your Goals & Needs",    body: [estateSection, finPlanSection].join("") },
        { title: "Your Plan",             body: [nextStepsBlock, nextMeetingBlock].join("") },
      ];
      return chapters.map(c => c.body.trim() ? _chapter(c.title) + c.body : "").join("");
    })()}
  </td></tr>

  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
    <p style="font-size:13px;color:#334155;margin:0;white-space:pre-wrap;">${outroText}</p>
    <p style="font-size:13px;color:#334155;margin:10px 0 0;">Kind regards,<br><strong>${advisor}</strong></p>
  </td></tr>

</table></td></tr></table>
</body></html>`;
  }

  function _getOpts() {
    return {
      portfolio: document.getElementById("ms_inc_portfolio")?.checked ?? true,
      risk:      document.getElementById("ms_inc_policies")?.checked  ?? true,
      budget:    document.getElementById("ms_inc_cashflow")?.checked  ?? true,
      estate:    document.getElementById("ms_inc_estate")?.checked    ?? true,
      finrisk:   document.getElementById("ms_inc_finrisk")?.checked   ?? true,
      invest:    document.getElementById("ms_inc_fininvest")?.checked ?? true,
    };
  }

  function _preview() {
    try {
      const html = _buildHTML(_getOpts());
      const blob = new Blob([html], { type: "text/html" });
      const url  = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      console.error("[meeting-summary] preview error:", e);
      alert("Preview failed: " + e.message);
    }
  }

  // When doc checkboxes change, inject/update a document request block in Next Steps
  const DOCS_MARKER = "Please send me the following documents:";

  function _updateDocNextSteps(w) {
    const nextEl = w.querySelector("#ms_nextsteps");
    if (!nextEl) return;
    const checked = DOCS.filter(d => w.querySelector(`#${d.id}`)?.checked);
    let text = nextEl.value;
    // Strip any previously injected docs block (and the blank line before it)
    const idx = text.indexOf(DOCS_MARKER);
    if (idx !== -1) text = text.substring(0, idx).replace(/\n+$/, "");
    if (checked.length > 0) {
      const list = checked.map(d => `• ${d.label}`).join("\n");
      text = (text ? text + "\n\n" : "") + DOCS_MARKER + "\n" + list;
    }
    nextEl.value = text;
  }

  function _showToast(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) { toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2500); }
  }

  function _copyEmail(toastId) {
    try {
      const html = _buildHTML(_getOpts());
      const htmlBlob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([_build()], { type: "text/plain" });
      navigator.clipboard.write([
        new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob }),
      ]).then(() => _showToast(toastId))
        .catch(() => _copyPlain(toastId));
    } catch (e) {
      _copyPlain(toastId);
    }
  }

  function _copyPlain(toastId) {
    navigator.clipboard.writeText(_build())
      .then(() => _showToast(toastId))
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = _build();
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        _showToast(toastId);
      });
  }

  // ── Module ─────────────────────────────────────────────────────────────────

  window.App?.register("meeting-summary", {
    id: "meeting-summary",
    title: "Meeting Summary",
    guide: {
      intro: {
        heading: "Meeting Summary",
        html: `<p>Edit the opening introduction, fill in the agreed next steps, and tick any documents you need from the client.</p>
               <p>Click <strong>Preview Summary</strong> to open the formatted client email in a new tab — select all and paste into Gmail or Outlook.</p>`,
      },
    },

    mount(wrapper) {
      _injectCSS();
      wrapper.insertAdjacentHTML("beforeend", _template());
      const w = wrapper.querySelector(".cm-wrapper");

      const introState = window.MeetingState?.get("meetingIntro") || {};

      const dateEl = w.querySelector("#ms_meeting_date");
      if (dateEl && !dateEl.value) {
        dateEl.value = introState.meetingDate
          ? introState.meetingDate.replace(/\//g, "-")
          : new Date().toISOString().slice(0, 10);
      }

      const introEl = w.querySelector("#ms_intro");
      if (introEl && !introEl.value) {
        const firstName = introState.clientName || window._activeClientFirstName || "Valued Client";
        introEl.value   = `Hi ${firstName},\n\nThank you for meeting with me on ${_meetingDateStr()}.\nBelow you will find a brief summary of your current financial position and the solutions I am proposing.`;
      }

      const outroEl = w.querySelector("#ms_outro");
      if (outroEl && !outroEl.value) {
        outroEl.value = "Please do not hesitate to contact me should you have any questions.";
      }

      DOCS.forEach(d => {
        w.querySelector(`#${d.id}`)?.addEventListener("change", () => _updateDocNextSteps(w));
      });

      const _renderPreviews = () => {
        SEND_BLOCKS.forEach(b => {
          const el = w.querySelector(`#ms_preview_${b.key}`);
          if (el) el.innerHTML = b.render();
        });
        const nmEl = w.querySelector("#ms_next_meeting_preview");
        if (nmEl) nmEl.innerHTML = _previewNextMeeting();
      };
      _renderPreviews();
      MtUI.initSections(w, { accordion: true });

      // Previews are read-only reflections of other tools' state, not local
      // form fields — re-render whenever any tool's MeetingState changes so
      // e.g. filling in Wrapping Up's Next Meeting date after this tool is
      // already open still shows up here without needing a remount.
      this._onState = (e) => {
        if (!wrapper.isConnected) return;
        if (document.activeElement?.closest(".ms-send-list")) return;
        _renderPreviews();
      };
      document.addEventListener("meetingstate", this._onState);

      w.querySelector("#ms_preview_btn")?.addEventListener("click", () => _preview());
      w.querySelector("#ms_copy_btn")?.addEventListener("click", () => _copyEmail("ms_toast"));
    },
  });
})();

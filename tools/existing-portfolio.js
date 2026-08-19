// tools/existing-portfolio.js
// Balance sheet: Liquid Assets · Investments · Fixed Assets · Liabilities

(function () {
  // ── CSS ────────────────────────────────────────────────────────────────────

  function _injectCSS() {
    if (document.getElementById("ec-styles")) return;
    const s = document.createElement("style");
    s.id = "ec-styles";
    s.textContent = `
      .ec-wrapper { flex: 1; min-height: 0; min-width: 0; }
      .ec-pane {
        flex: 1; min-height: 0; overflow-y: auto;
        display: flex; flex-direction: column; gap: 1rem;
        padding-bottom: 2rem; scrollbar-width: thin;
        scrollbar-color: rgba(0,0,0,0.1) transparent;
      }
      .ec-liquid-grid {
        display: grid; gap: 0.25rem 0.45rem; align-items: center;
        grid-template-columns: minmax(140px,1.5fr) minmax(110px,1fr) 115px 115px;
      }
      .ec-invest-grid {
        display: grid; gap: 0.25rem 0.45rem; align-items: center;
        grid-template-columns: minmax(140px,1.5fr) minmax(120px,1fr) 75px 115px 115px;
      }
      .ec-fixed-grid {
        display: grid; gap: 0.25rem 0.45rem; align-items: center;
        grid-template-columns: minmax(160px,2fr) 115px 115px;
      }
      .ec-liab-grid {
        display: grid; gap: 0.25rem 0.45rem; align-items: center;
        grid-template-columns: minmax(140px,1.5fr) minmax(110px,1fr) 75px 115px 115px;
      }
      .ec-grp-label {
        font-family: var(--fb); font-size: 0.6rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.1em;
        color: var(--navy-5); opacity: 0.45;
        padding: 0.6rem 0 0.1rem;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Constants ──────────────────────────────────────────────────────────────

  const LIQUID_TYPES = ["Cash", "Cheque Account", "Fixed Deposit", "Money Market", "Savings Account"];

  const INVEST_TYPES = [
    "Discretionary Investment",
    "Employer Pension / Provident Fund",
    "Endowment",
    "Living Annuity",
    "Offshore Investment",
    "Preservation Fund (Pension)",
    "Preservation Fund (Provident)",
    "Retirement Annuity (RA)",
    "Tax-Free Savings Account (TFSA)",
    "Unit Trust",
  ];

  const FIXED_TYPES = ["Business Interest", "Collectables", "Other Property", "Personal Effects", "Primary Residence", "Vehicle"];

  const ST_LIAB_TYPES = ["Credit Card", "Overdraft", "Store Account"];

  const LT_LIAB_TYPES = ["Home Loan / Bond", "Personal Loan", "Student Loan", "Vehicle Finance"];

  const BANK_PROVIDERS = ["ABSA", "Capitec", "Discovery Bank", "FNB", "Investec", "Nedbank", "Standard Bank", "Tyme Bank"];

  const INVEST_PROVIDERS = [
    "10X Investments",
    "Alex Forbes",
    "Allan Gray",
    "Ashburton Investments",
    "Coronation Fund Managers",
    "Discovery",
    "Fairtree Capital",
    "Investec Wealth & Investment",
    "Liberty",
    "Momentum",
    "Ninety One",
    "Old Mutual Invest",
    "PPS Investments",
    "Prescient Investment Management",
    "PSG Wealth",
    "Sanlam Investments",
    "STANLIB",
  ];

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _options(list, selected = "") {
    return list.map((o) => `<option value="${o}"${o === selected ? " selected" : ""}>${o}</option>`).join("");
  }

  // Delegates to components/input-format.js — the single source of truth for
  // money parsing/formatting — rather than a local regex copy. Callers only
  // ever invoke this once a positive value is already confirmed, so the old
  // NaN/empty pass-through never actually triggered.
  function _moneyFmt(v) {
    return window.numberToMoney(v);
  }

  function _parseMoney(el) {
    return window.moneyToNumber(el?.value);
  }

  function _moneyCell(field, placeholder = "0") {
    return `<div class="mt-secondary-cell mt-money-wrap">
      <span class="mt-pfx">R</span>
      <input class="mt-input-sm" type="text" data-field="${field}" data-money="true" autocomplete="off" placeholder="${placeholder}">
    </div>`;
  }

  function _typeCell(types, defaultType = "", placeholder = "Type") {
    return `<div class="mt-secondary-cell" style="display:flex;align-items:center;gap:0.35rem">
      <button class="mt-secondary-x" type="button" title="Remove">×</button>
      <select class="mt-select-sm" data-field="type" style="flex:1;min-width:0">
        <option value="">${placeholder}</option>
        ${_options(types, defaultType)}
        <option value="__custom__">Custom…</option>
      </select>
      <input class="mt-input-sm" type="text" data-field="type-custom" placeholder="Type…" autocomplete="off" style="display:none;flex:1;min-width:0">
    </div>`;
  }

  function _providerCell(providers, placeholder = "Institution") {
    const opts = providers.map((o) => `<option value="${o}">${o}</option>`).join("");
    return `<div class="mt-secondary-cell">
      <select class="mt-select-sm" data-field="provider-sel">
        <option value="">${placeholder}</option>
        ${opts}
        <option value="__custom__">Custom…</option>
      </select>
      <input class="mt-input-sm" type="text" data-field="provider-custom" placeholder="Type…" autocomplete="off" style="display:none">
    </div>`;
  }

  function _moneyCellLast(field, placeholder = "0") {
    return _moneyCell(field, placeholder);
  }

  function _getType(row) {
    const sel = row.querySelector('[data-field="type"]');
    return sel?.value === "__custom__" ? row.querySelector('[data-field="type-custom"]')?.value || "" : sel?.value || "";
  }

  function _getProvider(row) {
    const sel = row.querySelector('[data-field="provider-sel"]');
    return sel?.value === "__custom__" ? row.querySelector('[data-field="provider-custom"]')?.value || "" : sel?.value || "";
  }

  // ── Row templates ──────────────────────────────────────────────────────────

  function _liquidRow(defaultType = "") {
    return `<div class="mt-secondary" style="display:contents">
      ${_typeCell(LIQUID_TYPES, defaultType)}
      ${_providerCell(BANK_PROVIDERS)}
      ${_moneyCell("value", "Balance")}
      ${_moneyCellLast("contrib", "Monthly")}
    </div>`;
  }

  function _investRow(defaultType = "") {
    return `<div class="mt-secondary" style="display:contents">
      ${_typeCell(INVEST_TYPES, defaultType)}
      ${_providerCell(INVEST_PROVIDERS, "Provider")}
      <div class="mt-secondary-cell mt-money-wrap">
        <input class="mt-input-sm" type="text" data-field="rate" autocomplete="off" placeholder="Rate">
        <span class="mt-pfx" style="left:auto;right:6px">%</span>
      </div>
      ${_moneyCell("value", "Current value")}
      ${_moneyCellLast("contrib", "Monthly")}
    </div>`;
  }

  function _fixedRow(defaultType = "") {
    return `<div class="mt-secondary" style="display:contents">
      ${_typeCell(FIXED_TYPES, defaultType)}
      ${_moneyCell("purchasePrice", "Purchase price")}
      ${_moneyCellLast("value", "Current value")}
    </div>`;
  }

  function _liabRow(types, defaultType = "") {
    return `<div class="mt-secondary" style="display:contents">
      ${_typeCell(types, defaultType)}
      ${_providerCell(BANK_PROVIDERS, "Provider")}
      <div class="mt-secondary-cell mt-money-wrap">
        <input class="mt-input-sm" type="text" data-field="rate" autocomplete="off" placeholder="Rate">
        <span class="mt-pfx" style="left:auto;right:6px">%</span>
      </div>
      ${_moneyCell("balance", "Balance")}
      ${_moneyCellLast("monthly", "Monthly")}
    </div>`;
  }

  // ── Template ───────────────────────────────────────────────────────────────

  function _template() {
    return `<div class="ec-wrapper glass-panel glass-panel--light calc-glass">
  <div class="calc-layout">
    <div class="tool-hero-zone" id="hero-existing-portfolio"></div>
    <div class="ec-pane">

      <div class="ec-grp-label">Assets</div>

      <!-- ════ LIQUID ASSETS ════ -->
      <div class="mt-primary collapsed" id="ec-sec-liquid">
        <div class="mt-primary-hdr">
          <span class="mt-primary-title">Liquid Assets</span>
          <div class="mt-primary-right">
            <span class="mt-primary-sum" id="ec-hdr-liquid">—</span>
            <span class="mt-chev"></span>
          </div>
        </div>
        <div class="mt-primary-body">
          <div class="ec-liquid-grid">
            <div id="ec-liquid-rows" style="display:contents">
              ${_liquidRow("Savings Account")}
            </div>
          </div>
        </div>
      </div>

      <!-- ════ INVESTMENTS ════ -->
      <div class="mt-primary collapsed" id="ec-sec-invest">
        <div class="mt-primary-hdr">
          <span class="mt-primary-title">Investments</span>
          <div class="mt-primary-right">
            <span class="mt-primary-sum" id="ec-hdr-invest">—</span>
            <span class="mt-chev"></span>
          </div>
        </div>
        <div class="mt-primary-body">
          <div class="ec-invest-grid">
            <div id="ec-invest-rows" style="display:contents">
              ${_investRow("Retirement Annuity (RA)")}
              ${_investRow("Tax-Free Savings Account (TFSA)")}
            </div>

          </div>
        </div>
      </div>

      <!-- ════ FIXED ASSETS ════ -->
      <div class="mt-primary collapsed" id="ec-sec-fixed">
        <div class="mt-primary-hdr">
          <span class="mt-primary-title">Fixed Assets</span>
          <div class="mt-primary-right">
            <span class="mt-primary-sum" id="ec-hdr-fixed">—</span>
            <span class="mt-chev"></span>
          </div>
        </div>
        <div class="mt-primary-body">
          <div class="ec-fixed-grid">
            <div id="ec-fixed-rows" style="display:contents">
              ${_fixedRow("Primary Residence")}
              ${_fixedRow("Vehicle")}
            </div>
          </div>
        </div>
      </div>

      <div class="ec-grp-label">Liabilities</div>

      <!-- ════ LIABILITIES ════ -->
      <div class="mt-primary collapsed" id="ec-sec-liab">
        <div class="mt-primary-hdr">
          <span class="mt-primary-title">Liabilities</span>
          <div class="mt-primary-right">
            <span class="mt-primary-sum" id="ec-hdr-liab">—</span>
            <span class="mt-chev"></span>
          </div>
        </div>
        <div class="mt-primary-body">

          <div class="ec-grp-label">Short-term (&lt; 1 year)</div>
          <div class="ec-liab-grid">
            <div id="ec-st-liab-rows" style="display:contents">
              ${_liabRow(ST_LIAB_TYPES, "Credit Card")}
            </div>
          </div>

          <div class="ec-grp-label">Long-term (&gt; 1 year)</div>
          <div class="ec-liab-grid">
            <div id="ec-lt-liab-rows" style="display:contents">
              ${_liabRow(LT_LIAB_TYPES, "Home Loan / Bond")}
            </div>
          </div>

        </div>
      </div>

    </div>
  </div>
</div>`;
  }

  // ── Section guide content ──────────────────────────────────────────────────

  const SECTION_GUIDE = {
    "ec-sec-liquid": {
      heading: "Liquid Assets",
      html: `<p>Liquid assets are cash or near-cash holdings you can access quickly without selling anything.</p>
             <p>Include cheque accounts, savings accounts, money market funds, and fixed deposits. These form your emergency buffer and short-term spending reserve.</p>
             <p><strong>Tip:</strong> A healthy emergency fund is 3–6 months of living expenses held in liquid assets.</p>`,
    },
    "ec-sec-invest": {
      heading: "Investments",
      html: `<p>Investments are assets held specifically to build wealth over time — generating returns through growth, income, or both.</p>
             <p>Include retirement annuities (RA), tax-free savings accounts (TFSA), unit trusts, pension and provident funds, endowments, living annuities, and offshore investments.</p>
             <p><strong>Tip:</strong> Capture the current value and monthly contribution — this feeds directly into the retirement and savings gap analysis.</p>`,
    },
    "ec-sec-fixed": {
      heading: "Fixed Assets",
      html: `<p>Fixed assets are things you own and use — they hold value but aren't primarily held for investment returns.</p>
             <p>Include the primary residence, other property, vehicles, business interests, collectables, and personal effects. Record the current market value, not the original purchase price.</p>
             <p><strong>Tip:</strong> Any debt against these assets (e.g. a home loan or vehicle finance) goes under Long-term Liabilities.</p>`,
    },
    "ec-sec-liab": {
      heading: "Liabilities",
      html: `<p>Liabilities are amounts owed to creditors, split into two groups:</p>
             <ul>
               <li><strong>Short-term (&lt; 1 year)</strong> — credit cards, overdrafts, store accounts. Typically the highest interest rates — prioritise these for repayment.</li>
               <li><strong>Long-term (&gt; 1 year)</strong> — home loans, vehicle finance, personal loans. Capture the outstanding balance, interest rate, and monthly repayment.</li>
             </ul>
             <p><strong>Tip:</strong> Net Worth = Total Assets − Total Liabilities. Reducing liabilities has the same effect on net worth as growing assets.</p>`,
    },
  };

  // ── Row factory map ────────────────────────────────────────────────────────

  const ROW_FACTORY = {
    "ec-liquid-rows": () => _liquidRow(),
    "ec-invest-rows": () => _investRow(),
    "ec-fixed-rows": () => _fixedRow(),
    "ec-st-liab-rows": () => _liabRow(ST_LIAB_TYPES),
    "ec-lt-liab-rows": () => _liabRow(LT_LIAB_TYPES),
  };

  // ── Events ─────────────────────────────────────────────────────────────────

  function _initEvents(w) {
    w.addEventListener("click", (e) => {
      // Guide-panel side-effect when a collapsed section is opened (toggle handled by MtUI.initSections)
      const secHdr = e.target.closest(".mt-primary-hdr");
      if (secHdr && !e.target.closest("button, input, select")) {
        const sec = secHdr.closest(".mt-primary");
        if (sec?.classList.contains("collapsed") && window.App) {
          const guide = SECTION_GUIDE[sec.id];
          if (guide) App.setGuide(guide.heading, guide.html, false);
        }
        return;
      }

      // Liability sub-grid add buttons (two targets — handled here, not in initDeleteMode)
      const addBtn = e.target.closest("[data-add]");
      if (addBtn) {
        const key = addBtn.dataset.add;
        const containerId = key === "st-liab" ? "ec-st-liab-rows" : key === "lt-liab" ? "ec-lt-liab-rows" : null;
        if (!containerId) return;
        const fn = ROW_FACTORY[containerId];
        const container = w.querySelector(`#${containerId}`);
        if (fn && container) {
          container.insertAdjacentHTML("beforeend", fn());
          _sync(w);
        }
      }
    });

    // Custom toggle for type and provider selects
    w.addEventListener("change", (e) => {
      const typeSel = e.target.closest('[data-field="type"]');
      if (typeSel) {
        const cell = typeSel.closest(".mt-secondary-cell");
        const custom = cell?.querySelector('[data-field="type-custom"]');
        if (custom) {
          const isCustom = typeSel.value === "__custom__";
          typeSel.style.display = isCustom ? "none" : "";
          custom.style.display = isCustom ? "" : "none";
          if (isCustom) {
            custom.value = "";
            custom.focus();
          }
        }
      }

      const provSel = e.target.closest('[data-field="provider-sel"]');
      if (provSel) {
        const cell = provSel.closest(".mt-secondary-cell");
        const custom = cell?.querySelector('[data-field="provider-custom"]');
        if (custom) {
          const isCustom = provSel.value === "__custom__";
          provSel.style.display = isCustom ? "none" : "";
          custom.style.display = isCustom ? "" : "none";
          if (isCustom) {
            custom.value = "";
            custom.focus();
          }
        }
      }
    });
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  function _sync(w) {
    let totalLiquid = 0,
      totalInvest = 0,
      totalFixed = 0,
      totalST = 0,
      totalLT = 0;

    const liquid = [...w.querySelectorAll("#ec-liquid-rows > .mt-secondary")].map((row) => {
      const value = _parseMoney(row.querySelector('[data-field="value"]'));
      const contrib = _parseMoney(row.querySelector('[data-field="contrib"]'));
      totalLiquid += value;
      return { type: _getType(row), provider: _getProvider(row), value, contrib };
    });

    const investments = [...w.querySelectorAll("#ec-invest-rows > .mt-secondary")].map((row) => {
      const value = _parseMoney(row.querySelector('[data-field="value"]'));
      const contrib = _parseMoney(row.querySelector('[data-field="contrib"]'));
      totalInvest += value;
      return {
        type: _getType(row),
        provider: _getProvider(row),
        rate: parseFloat(row.querySelector('[data-field="rate"]')?.value || "0") || 0,
        contrib,
        value,
      };
    });

    const fixed = [...w.querySelectorAll("#ec-fixed-rows > .mt-secondary")].map((row) => {
      const value = _parseMoney(row.querySelector('[data-field="value"]'));
      const purchasePrice = _parseMoney(row.querySelector('[data-field="purchasePrice"]'));
      totalFixed += value;
      return { type: _getType(row), value, purchasePrice };
    });

    const stLiabilities = [...w.querySelectorAll("#ec-st-liab-rows > .mt-secondary")].map((row) => {
      const balance = _parseMoney(row.querySelector('[data-field="balance"]'));
      const monthly = _parseMoney(row.querySelector('[data-field="monthly"]'));
      totalST += balance;
      return {
        type: _getType(row),
        provider: _getProvider(row),
        rate: parseFloat(row.querySelector('[data-field="rate"]')?.value || "0") || 0,
        monthly,
        balance,
      };
    });

    const ltLiabilities = [...w.querySelectorAll("#ec-lt-liab-rows > .mt-secondary")].map((row) => {
      const balance = _parseMoney(row.querySelector('[data-field="balance"]'));
      const monthly = _parseMoney(row.querySelector('[data-field="monthly"]'));
      totalLT += balance;
      return {
        type: _getType(row),
        provider: _getProvider(row),
        rate: parseFloat(row.querySelector('[data-field="rate"]')?.value || "0") || 0,
        monthly,
        balance,
      };
    });

    const totalLiquidContrib = liquid.reduce((s, l) => s + l.contrib, 0);
    const totalContrib = investments.reduce((s, i) => s + i.contrib, 0);
    const totalMonthly = [...stLiabilities, ...ltLiabilities].reduce((s, l) => s + l.monthly, 0);
    const totalAssets = totalLiquid + totalInvest + totalFixed;
    const totalLiabilities = totalST + totalLT;
    const netWorth = totalAssets - totalLiabilities;

    const _hdr = (id, val) => {
      const el = w.querySelector(id);
      if (el) el.textContent = val > 0 ? "R " + _moneyFmt(String(val)) : "—";
    };
    const _hdrDual = (id, val, monthly) => {
      const el = w.querySelector(id);
      if (!el) return;
      if (val <= 0 && monthly <= 0) {
        el.textContent = "—";
        return;
      }
      const valPart = val > 0 ? "R " + _moneyFmt(String(val)) : "—";
      const monthlyPart = monthly > 0 ? "R " + _moneyFmt(String(monthly)) + " pm" : "—";
      el.textContent = valPart + " / " + monthlyPart;
    };
    _hdrDual("#ec-hdr-liquid", totalLiquid, totalLiquidContrib);
    _hdrDual("#ec-hdr-invest", totalInvest, totalContrib);
    _hdr("#ec-hdr-fixed", totalFixed);
    _hdrDual("#ec-hdr-liab", totalLiabilities, totalMonthly);

    if (window.CalcHero) {
      CalcHero.update({
        primaries: [{ id: "ec-hero-networth", value: netWorth }],
        secondaries: [
          { id: "ec-hero-assets", value: totalAssets },
          { id: "ec-hero-liab", value: totalLiabilities },
        ],
      });
    }

    if (window.MeetingState)
      window.MeetingState.set("currentPortfolio", {
        // ── Asset categories ──
        liquid,
        investments,
        fixed,

        // ── Liability categories ──
        stLiabilities,
        ltLiabilities,

        // ── Totals ──
        totalLiquid,
        totalLiquidContrib,
        totalInvestments: totalInvest,
        totalFixed,
        totalAssets,
        totalStLiabilities: totalST,
        totalLtLiabilities: totalLT,
        totalLiabilities,
        netWorth,
      });
  }

  // ── State helpers ──────────────────────────────────────────────────────────

  function _saveRow(row, fields) {
    const typeSel = row.querySelector('[data-field="type"]');
    const isCustomT = typeSel?.value === "__custom__";
    const provSel = row.querySelector('[data-field="provider-sel"]');
    const isCustomP = provSel?.value === "__custom__";
    const out = {
      type: isCustomT ? "__custom__" : typeSel?.value || "",
      typeCustom: isCustomT ? row.querySelector('[data-field="type-custom"]')?.value || "" : "",
      providerSel: isCustomP ? "__custom__" : provSel?.value || "",
      providerCustom: isCustomP ? row.querySelector('[data-field="provider-custom"]')?.value || "" : "",
    };
    (fields || []).forEach((f) => {
      out[f] = row.querySelector(`[data-field="${f}"]`)?.value || "";
    });
    return out;
  }

  function _restoreRow(row, d) {
    const typeSel = row.querySelector('[data-field="type"]');
    const typeCustom = row.querySelector('[data-field="type-custom"]');
    if (d.type === "__custom__" && typeSel && typeCustom) {
      typeSel.value = "__custom__";
      typeSel.style.display = "none";
      typeCustom.value = d.typeCustom || "";
      typeCustom.style.display = "";
    } else if (typeSel) {
      typeSel.value = d.type || "";
    }

    const provSel = row.querySelector('[data-field="provider-sel"]');
    const provCustom = row.querySelector('[data-field="provider-custom"]');
    if (d.providerSel === "__custom__" && provSel && provCustom) {
      provSel.value = "__custom__";
      provSel.style.display = "none";
      provCustom.value = d.providerCustom || "";
      provCustom.style.display = "";
    } else if (provSel) {
      provSel.value = d.providerSel || "";
    }
  }

  // ── Module ─────────────────────────────────────────────────────────────────

  window.App?.register("existing-portfolio", {
    id: "existing-portfolio",
    title: "Existing Portfolio",
    guide: {
      intro: {
        heading: "Existing Portfolio",
        html: `<p>Build the client's balance sheet across three asset categories and two liability groups.</p>
               <ul>
                 <li><strong>Liquid Assets</strong> — cash, savings, money market, fixed deposits</li>
                 <li><strong>Investments</strong> — RA, TFSA, unit trusts, pensions, endowments</li>
                 <li><strong>Fixed Assets</strong> — property, vehicles, business interests, collectables</li>
                 <li><strong>Liabilities</strong> — short-term (credit cards, overdrafts) and long-term (home loans, vehicle finance)</li>
               </ul>
               <p>Open a section to see guidance on what belongs there.</p>`,
      },
    },

    mount(wrapper) {
      _injectCSS();
      wrapper.insertAdjacentHTML("beforeend", _template());
      const w = wrapper.querySelector(".ec-wrapper");

      if (window.CalcHero) {
        CalcHero.render("#hero-existing-portfolio", {
          primaries: [{ id: "ec-hero-networth", label: "Net Worth" }],
          secondaries: [
            { id: "ec-hero-assets", label: "Total Assets", dot: "#059669" },
            { id: "ec-hero-liab", label: "Total Liabilities", dot: "#dc2626", negative: true },
          ],
        });
      }

      _initEvents(w);
      MtUI.initSections(w, { accordion: true });
      MtUI.initMoney(w, () => _sync(w));

      const _del = (row) => {
        row.remove();
        _sync(w);
      };
      MtUI.initDeleteMode(w.querySelector("#ec-sec-liquid"), {
        addLabel: "+ Add liquid asset",
        onAdd: () => {
          w.querySelector("#ec-liquid-rows")?.insertAdjacentHTML("beforeend", _liquidRow());
          _sync(w);
        },
        onDelete: _del,
      });
      MtUI.initDeleteMode(w.querySelector("#ec-sec-invest"), {
        addLabel: "+ Add investment",
        onAdd: () => {
          w.querySelector("#ec-invest-rows")?.insertAdjacentHTML("beforeend", _investRow());
          _sync(w);
        },
        onDelete: _del,
      });
      MtUI.initDeleteMode(w.querySelector("#ec-sec-fixed"), {
        addLabel: "+ Add fixed asset",
        onAdd: () => {
          w.querySelector("#ec-fixed-rows")?.insertAdjacentHTML("beforeend", _fixedRow());
          _sync(w);
        },
        onDelete: _del,
      });

      // Liabilities has two sub-grids — add buttons are appended to the footer manually
      const liabFooter = MtUI.initDeleteMode(w.querySelector("#ec-sec-liab"), { onDelete: _del });
      if (liabFooter) {
        liabFooter.insertAdjacentHTML(
          "afterbegin",
          `<div style="display:flex;gap:0.45rem">` +
            `<button class="mt-primary-add-btn" data-add="st-liab">+ Short-term</button>` +
            `<button class="mt-primary-add-btn" data-add="lt-liab">+ Long-term</button>` +
            `</div>`,
        );
      }

      w.addEventListener("input", () => _sync(w));
      w.addEventListener("change", () => _sync(w));
      _sync(w);
    },

    getState() {
      const w = window.App._wrappers[this.id]?.querySelector(".ec-wrapper");
      if (!w) return null;
      return {
        liquidRows: [...w.querySelectorAll("#ec-liquid-rows  > .mt-secondary")].map((r) => _saveRow(r, ["value", "contrib"])),
        investRows: [...w.querySelectorAll("#ec-invest-rows  > .mt-secondary")].map((r) => _saveRow(r, ["rate", "contrib", "value"])),
        fixedRows: [...w.querySelectorAll("#ec-fixed-rows   > .mt-secondary")].map((r) => _saveRow(r, ["value", "purchasePrice"])),
        stLiabRows: [...w.querySelectorAll("#ec-st-liab-rows > .mt-secondary")].map((r) => _saveRow(r, ["rate", "monthly", "balance"])),
        ltLiabRows: [...w.querySelectorAll("#ec-lt-liab-rows > .mt-secondary")].map((r) => _saveRow(r, ["rate", "monthly", "balance"])),
        liquidCollapsed: w.querySelector("#ec-sec-liquid")?.classList.contains("collapsed") ?? true,
        investCollapsed: w.querySelector("#ec-sec-invest")?.classList.contains("collapsed") ?? true,
        fixedCollapsed: w.querySelector("#ec-sec-fixed")?.classList.contains("collapsed") ?? true,
        liabCollapsed: w.querySelector("#ec-sec-liab")?.classList.contains("collapsed") ?? true,
      };
    },

    setState(extra) {
      if (!extra) return;
      const w = window.App._wrappers[this.id]?.querySelector(".ec-wrapper");
      if (!w) return;

      const _restore = (containerId, rows, rowFn, fields) => {
        const container = w.querySelector(containerId);
        if (!container) return;
        container.innerHTML = "";
        (rows || []).forEach((d) => {
          container.insertAdjacentHTML("beforeend", rowFn());
          const row = container.lastElementChild;
          _restoreRow(row, d);
          (fields || []).forEach((f) => {
            const el = row.querySelector(`[data-field="${f}"]`);
            if (el) el.value = d[f] || "";
          });
        });
      };

      _restore("#ec-liquid-rows", extra.liquidRows, _liquidRow, ["value", "contrib"]);
      _restore("#ec-invest-rows", extra.investRows, _investRow, ["rate", "contrib", "value"]);
      _restore("#ec-fixed-rows", extra.fixedRows, _fixedRow, ["value", "purchasePrice"]);
      _restore("#ec-st-liab-rows", extra.stLiabRows, () => _liabRow(ST_LIAB_TYPES), ["rate", "monthly", "balance"]);
      _restore("#ec-lt-liab-rows", extra.ltLiabRows, () => _liabRow(LT_LIAB_TYPES), ["rate", "monthly", "balance"]);

      w.querySelector("#ec-sec-liquid")?.classList.toggle("collapsed", extra.liquidCollapsed ?? true);
      w.querySelector("#ec-sec-invest")?.classList.toggle("collapsed", extra.investCollapsed ?? true);
      w.querySelector("#ec-sec-fixed")?.classList.toggle("collapsed", extra.fixedCollapsed ?? true);
      w.querySelector("#ec-sec-liab")?.classList.toggle("collapsed", extra.liabCollapsed ?? true);
      _sync(w);
    },
  });
})();

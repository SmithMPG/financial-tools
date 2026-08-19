// resources/constants.js
// ─────────────────────────────────────────────────────────────────────────────
// Global constants shared across all calculators.
// ─────────────────────────────────────────────────────────────────────────────

window.LINKS = {
  BOOK_A_MEETING: "https://outlook.office.com/bookwithme/user/c02b2d2125604a98beef742f4dcdf944@liblink.co.za?anonymous&ismsaljsauthenabled&ep=plink",
};

// ── Shared SVG icons ──────────────────────────────────────────────────────────
// Single source of truth for icons reused across components (bottom-drawer,
// user-report, cta-buttons, etc.). Reference as: ICONS.download
window.ICONS = {
  download: `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
    viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>`,
};

// Current SA CPI assumption - update here to reflect across all calcs
window.CPI = 0.06;

window.PALETTE = {
  principal: "#06b6d4", // Cyan     - lump sum / annual contribution
  contributions: "#a855f7", // Purple   - monthly contribution
  returns: "#10b981", // Emerald  - growth / profit
  lumpSum: "#059669", // Darker emerald - once-off lump sum payment
  neutral: "#1d4ed8", // Navy blue    - neutral inputs (years, etc.)
  fees: "#f59e0b", // Amber    - cost / friction
  target: "#ef4444", // Red      - goals / shortfalls
  gold: "#d4a843", // Gold     - arcade sliders / brand accent
};

// ── Shared Slider Configurations ──────────────────────────────────────────────
window.SLIDER_CONFIG = {
  default: {
    principal: { min: 0, max: 10000000, step: 10000, value: 0 },
    monthly: { min: 0, max: 50000, step: 500, value: 5000 },
    years: { min: 1, max: 50, step: 1, value: 20 },
    rate: { min: 4, max: 20, step: 0.5, value: 10 },
    fee: { min: 0, max: 3, step: 0.1, value: 1 },
    escalation: { min: 0, max: 15, step: 1, value: 6 },
  },
  tfsa: {
    lifetimeCap: 500000,
    current: { min: 0, max: 500000, step: 1000, value: 0 },
    monthly: { min: 500, max: 3833, step: 100, value: 3833 },
    annual: { min: 6000, max: 46000, step: 1000, value: 46000 },
  },
};

// ── Transfer Duty (2024/2025 SARS Rates) ─────────────────────────────────────
// Applies when transfer duty is triggered (massed estates, donations).
// Standard inheritance by will or intestate succession is EXEMPT (Sec 9(1)(e)).
window.TRANSFER_DUTY = {
  BRACKETS: [
    { min: 0, max: 1100000, base: 0, rate: 0 },
    { min: 1100001, max: 1512500, base: 0, rate: 0.03 },
    { min: 1512501, max: 2117500, base: 12375, rate: 0.06 },
    { min: 2117501, max: 2722500, base: 48675, rate: 0.08 },
    { min: 2722501, max: 12100000, base: 97075, rate: 0.11 },
    { min: 12100001, max: Infinity, base: 1128600, rate: 0.13 },
  ],
  // Conservative flat rate used when exact property value is unknown
  PLANNING_RATE: 0.08,
};

// ── CGT Configuration ─────────────────────────────────────────────────────────
// Death triggers deemed disposal on all assets. CGT is a deductible liability
// of the estate (Section 4(a)) and reduces the net estate before duty.
// Surviving spouse receives rollover relief - no CGT on death transfer.
window.CGT_CONFIG = {
  INCLUSION_RATE: 0.4, // 40% of gain included in taxable income
  YEAR_OF_DEATH_EXCLUSION: 440000, // R440,000 exclusion in year of death (2026/27)
  PLANNING_MARGINAL_RATE: 0.45, // Conservative: top marginal rate
};

// ── Endowment Tax Configuration ───────────────────────────────────────────────
// All taxes settled inside the policy by the life company. No further personal
// tax liability on withdrawal. Rates set by SARS for policyholder funds.
window.ENDOWMENT_CONFIG = {
  DIVIDEND_RATE: 0.15,  // 15% DWT inside endowment (vs 20% personal DWT)
  INTEREST_RATE: 0.30,  // 30% flat on interest income (vs personal marginal rate)
  CGT_INCLUSION: 0.25,  // 25% inclusion rate (vs 40% for individuals)
  CGT_CORP_RATE: 0.40,  // 40% policyholder fund tax rate (fixed)
  CGT_EFFECTIVE: 0.10,  // 25% × 40% = 10% effective CGT (no R40k exclusion)
};

// ── Estate Administration Costs ───────────────────────────────────────────────
window.ESTATE_COSTS = {
  EXECUTOR_RATE: 0.035, // 3.5% on gross estate value
  EXECUTOR_VAT: 0.15, // VAT on executor fee
  MASTER_FEE_CAP: 7000, // Maximum Master's fee
  BOND_CANCELLATION_EST: 5000, // Typical bond cancellation fee (per bond)
  STT_RATE: 0.0025, // 0.25% Securities Transfer Tax on share transfers
};

// ── Helper: Calculate Transfer Duty ──────────────────────────────────────────
window.calcTransferDuty = function (value) {
  const brackets = window.TRANSFER_DUTY.BRACKETS;
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (value > brackets[i].min) {
      return Math.round(brackets[i].base + (value - brackets[i].min) * brackets[i].rate);
    }
  }
  return 0;
};

// ── Helper: Estimate Conveyancing Fee ────────────────────────────────────────
// Based on LPC indicative tariff (incl. 15% VAT). Sliding scale - larger
// properties attract a lower percentage. Used as a planning estimate only.
window.calcConveyancing = function (propertyValue) {
  if (propertyValue <= 0) return 0;
  let rate;
  if (propertyValue <= 500000) rate = 0.015;
  else if (propertyValue <= 1000000) rate = 0.012;
  else if (propertyValue <= 2000000) rate = 0.01;
  else if (propertyValue <= 5000000) rate = 0.009;
  else rate = 0.008;
  return Math.round(propertyValue * rate);
};

// ── Helper: Estimate CGT Liability ───────────────────────────────────────────
// Conservative estimate (top marginal rate). Returns 0 for surviving spouse
// (rollover relief) or when no gain exists.
window.calcCGT = function (marketValue, baseCost, isSpouse = false) {
  if (isSpouse) return 0;
  const gain = Math.max(0, marketValue - baseCost);
  const taxableGain = Math.max(0, gain - CGT_CONFIG.YEAR_OF_DEATH_EXCLUSION);
  return Math.round(taxableGain * CGT_CONFIG.INCLUSION_RATE * CGT_CONFIG.PLANNING_MARGINAL_RATE);
};

// ── 2026/2027 Tax Configuration (Single Source of Truth) ──────────────────────
window.TAX_CONFIG = {
  MAX_RA_DEDUCT: 430000, // Updated 2026 Annual Cap

  // Interest exemption: first R23 800/year (R34 500 if 65+) is tax-free
  INTEREST_EXEMPTION: 23800,
  INTEREST_EXEMPTION_65: 34500,

  // 2026/2027 Income Tax Brackets
  BRACKETS: [
    { min: 0, max: 245100, base: 0, rate: 0.18, label: "0 – 245 100", calc: "18% of taxable income" },
    { min: 245101, max: 383100, base: 44118, rate: 0.26, label: "245 101 – 383 100", calc: "44 118 + 26% of taxable income above 245 100" },
    { min: 383101, max: 530200, base: 79998, rate: 0.31, label: "383 101 – 530 200", calc: "79 998 + 31% of taxable income above 383 100" },
    { min: 530201, max: 695800, base: 125599, rate: 0.36, label: "530 201 – 695 800", calc: "125 599 + 36% of taxable income above 530 200" },
    { min: 695801, max: 887000, base: 185215, rate: 0.39, label: "695 801 – 887 000", calc: "185 215 + 39% of taxable income above 695 800" },
    { min: 887001, max: 1878600, base: 259783, rate: 0.41, label: "887 001 – 1 878 600", calc: "259 783 + 41% of taxable income above 887 000" },
    { min: 1878601, max: Infinity, base: 666339, rate: 0.45, label: "1 878 601 and above", calc: "666 339 + 45% of taxable income above 1 878 600" },
  ],

  // Primary, Secondary (65-74), Tertiary (75+)
  REBATES: { primary: 17224, secondary: 9444, tertiary: 3145 },

  // Medical Scheme Fees Tax Credits (Monthly) - 2026/27
  // Source: SARS 2026/2027 year of assessment (1 March 2026 – 28 February 2027)
  //
  // Scenario A — Taxpayer IS the member:
  //   Yourself only:          R376/mo
  //   Yourself + 1 dep:       R752/mo  (376 + 376)
  //   Each additional dep:    +R254/mo
  //
  // Scenario B — Taxpayer is NOT the member (deps are the members):
  //   1 dependant:            R376/mo
  //   2 dependants:           R728/mo  (SARS special rate — not 2×376)
  //   Each additional dep:    +R254/mo
  MED_CREDITS: { main: 376, first: 376, extra: 254, nonMemberTwo: 728 },
};

// ── Investment Fund Type Presets ──────────────────────────────────────────────
// dividendYield and interestYield are actual % of portfolio value per year.
// capitalGrowth is always derived: returnRate − dividendYield − interestYield.
window.FUND_TYPES = {
  equity:   { dividendYield: 2.5, interestYield: 1.0 },
  balanced: { dividendYield: 1.5, interestYield: 2.5 },
  income:   { dividendYield: 0.5, interestYield: 6.0 },
};

// ── Inject palette as CSS custom properties ───────────────────────────────────
(function () {
  const root = document.documentElement;
  Object.entries(window.PALETTE).forEach(([key, value]) => {
    root.style.setProperty(`--palette-${key}`, value);
  });
})();

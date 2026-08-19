// components/input-format.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all input parsing, formatting, and UX behaviour
// across every calculator. Load this before any calc JS.
// ─────────────────────────────────────────────────────────────────────────────

// Strip everything except digits and dots → number
// e.g. "R 1 500" → 1500, "1,500.00" → 1500
window.moneyToNumber = function (s) {
  return Number(String(s || "").replace(/[^0-9.]/g, "")) || 0;
};

// Round and format as space-separated SA locale string (no R prefix)
// e.g. 1500 → "1 500", 1234567 → "1 234 567"
window.numberToMoney = function (n) {
  return Math.round(n).toLocaleString("en-ZA").replace(/,/g, " ");
};

// Format as display string with R prefix
// e.g. 1500 → "R 1 500"
window.numToRand = function (n) {
  return "R " + window.numberToMoney(n);
};

// Format a money input field: strips non-digits and adds space separators
window.formatMoneyInput = function (el) {
  const raw = el.value.replace(/[^\d]/g, "");
  el.value = raw.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// ── Input sanitisation ────────────────────────────────────────────────────────
// Single listener handles both field types:
//   money  → strip non-digits, reformat with space separators
//   decimal → strip invalid chars, treat comma as decimal point (SA locale)
document.addEventListener("input", (e) => {
  const el = e.target;

  if (el.dataset.format === "money") {
    window.formatMoneyInput(el);
    return;
  }

  if (!el.classList.contains("slider-input")) return;

  const cursor = el.selectionStart;
  const parts = el.value
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "")
    .split(".");
  const cleaned = parts.length > 1 ? parts[0] + "." + parts.slice(1).join("") : parts[0];

  if (el.value !== cleaned) {
    el.value = cleaned;
    const pos = Math.min(cursor, cleaned.length);
    el.setSelectionRange(pos, pos);
  }
});

// ── Mobile keyboard hints ─────────────────────────────────────────────────────
// Stamp inputmode so mobile devices open the numeric keyboard for every
// money field (data-format="money") and every plain slider-input that
// isn't already decorated (e.g. percentage / year fields).
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-format='money']").forEach((el) => {
    if (!el.getAttribute("inputmode")) el.setAttribute("inputmode", "numeric");
  });
});

// ── Focus / blur UX ──────────────────────────────────────────────────────────
// Select-all on focus - user almost always wants to replace the full value
document.addEventListener("focusin", (e) => {
  if (e.target.classList.contains("slider-input")) {
    setTimeout(() => e.target.select(), 0);
  }
});

// Normalise decimal inputs on blur: ".5" → "0.5", "5." → "5"
document.addEventListener("focusout", (e) => {
  const el = e.target;
  if (!el.classList.contains("slider-input") || el.hasAttribute("data-format")) return;
  let v = el.value.trim();
  if (!v || v === ".") {
    el.value = "0";
    return;
  }
  if (v.startsWith(".")) v = "0" + v;
  if (v.endsWith(".")) v = v.slice(0, -1);
  el.value = v;
});

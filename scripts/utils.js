// scripts/utils.js
// Very small helpers (kept simple on purpose)

// Trim text safely
function cleanText(x) {
  return String(x ?? "").trim();
}

// Convert to number safely
function toNum(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

// Many filters use "All" / "all". Treat both as ALL.
function isAll(x) {
  return cleanText(x).toLowerCase() === "all" || cleanText(x) === "";
}

// Put helpers on window so other files can use them
window.DashboardUtils = { cleanText, toNum, isAll };

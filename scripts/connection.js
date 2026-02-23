// scripts/connection.js
// Syncs region dropdowns across different charts.
// This is intentionally simple: we sync the UI and let each chart's existing
// "change" listeners do the real work.

document.addEventListener("DOMContentLoaded", () => {
  const { safeDispatchChange, normalizeKey } = window.DashboardUtils;
  const { set, get, subscribe } = window.DashboardState;

  // All region dropdowns we want to keep aligned
  const REGION_SELECT_IDS = [
    "line-region",
    "bar-region-filter",
    "map-region-filter",
    "bubble-regionSelect"
  ];

  const regionSelects = REGION_SELECT_IDS
    .map(id => document.getElementById(id))
    .filter(Boolean);

  // Helper: check if a select contains a value
  function hasOption(selectEl, value) {
    const target = normalizeKey(value);
    return Array.from(selectEl.options).some(opt => normalizeKey(opt.value) === target);
  }

  // Helper: set a select safely (with fallback)
  function setSelectValue(selectEl, value) {
    const wanted = normalizeKey(value);

    if (hasOption(selectEl, wanted)) {
      if (selectEl.value !== wanted) {
        selectEl.value = wanted;
        safeDispatchChange(selectEl);
      }
      return;
    }

    // fallback: try "all", then "All", then leave it
    if (hasOption(selectEl, "all")) {
      selectEl.value = "all";
      safeDispatchChange(selectEl);
    } else if (hasOption(selectEl, "All")) {
      selectEl.value = "All";
      safeDispatchChange(selectEl);
    }
  }

  // When a dropdown changes, update shared state + sync others
  regionSelects.forEach(selectEl => {
    selectEl.addEventListener("change", () => {
      const newRegion = selectEl.value;
      set("region", newRegion);
    });
  });

  // When state changes, push value to all dropdowns
  subscribe((evt) => {
    const { key, value } = evt.detail;
    if (key !== "region") return;

    regionSelects.forEach(sel => setSelectValue(sel, value));
  });

  // Initialize state from first existing dropdown value
  if (regionSelects.length > 0) {
    set("region", regionSelects[0].value || get("region"));
  }
});

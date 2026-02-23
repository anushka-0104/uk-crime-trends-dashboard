// scripts/state.js
// A tiny shared state store so charts + filters can stay in sync.
// Uses EventTarget so it's easy to subscribe without extra libraries.

(function () {
  const bus = new EventTarget();

  const state = {
    region: "all"
  };

  function get(key) {
    return state[key];
  }

  function set(key, value) {
    const prev = state[key];
    if (prev === value) return;

    state[key] = value;
    bus.dispatchEvent(
      new CustomEvent("statechange", {
        detail: { key, value, prev }
      })
    );
  }

  function subscribe(handler) {
    bus.addEventListener("statechange", handler);
    return () => bus.removeEventListener("statechange", handler);
  }

  window.DashboardState = {
    get,
    set,
    subscribe
  };
})();

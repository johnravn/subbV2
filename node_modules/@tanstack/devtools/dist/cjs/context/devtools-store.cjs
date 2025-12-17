"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const initialState = {
  settings: {
    defaultOpen: false,
    hideUntilHover: false,
    position: "bottom-right",
    panelLocation: "bottom",
    openHotkey: ["Shift", "A"],
    requireUrlFlag: false,
    urlFlag: "tanstack-devtools"
  },
  state: {
    activeTab: "plugins",
    height: 400,
    activePlugin: void 0,
    persistOpen: false
  }
};
exports.initialState = initialState;
//# sourceMappingURL=devtools-store.cjs.map

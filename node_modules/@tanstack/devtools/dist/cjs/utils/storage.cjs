"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const getStorageItem = (key) => localStorage.getItem(key);
const setStorageItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (_e) {
    return;
  }
};
const TANSTACK_DEVTOOLS = "tanstack_devtools";
const TANSTACK_DEVTOOLS_STATE = "tanstack_devtools_state";
const TANSTACK_DEVTOOLS_SETTINGS = "tanstack_devtools_settings";
exports.TANSTACK_DEVTOOLS = TANSTACK_DEVTOOLS;
exports.TANSTACK_DEVTOOLS_SETTINGS = TANSTACK_DEVTOOLS_SETTINGS;
exports.TANSTACK_DEVTOOLS_STATE = TANSTACK_DEVTOOLS_STATE;
exports.getStorageItem = getStorageItem;
exports.setStorageItem = setStorageItem;
//# sourceMappingURL=storage.cjs.map

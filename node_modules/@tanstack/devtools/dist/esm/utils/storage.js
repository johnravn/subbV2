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
export {
  TANSTACK_DEVTOOLS,
  TANSTACK_DEVTOOLS_SETTINGS,
  TANSTACK_DEVTOOLS_STATE,
  getStorageItem,
  setStorageItem
};
//# sourceMappingURL=storage.js.map

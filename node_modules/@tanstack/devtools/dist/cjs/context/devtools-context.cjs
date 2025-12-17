"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const solidJs = require("solid-js");
const store = require("solid-js/store");
const sanitize = require("../utils/sanitize.cjs");
const storage = require("../utils/storage.cjs");
const devtoolsStore = require("./devtools-store.cjs");
const DevtoolsContext = solidJs.createContext();
const getSettings = () => {
  const settingsString = storage.getStorageItem(storage.TANSTACK_DEVTOOLS_SETTINGS);
  const settings = sanitize.tryParseJson(settingsString);
  return {
    ...settings
  };
};
const generatePluginId = (plugin, index) => {
  if (plugin.id) {
    return plugin.id;
  }
  if (typeof plugin.name === "string") {
    return plugin.name.toLowerCase().replace(" ", "-");
  }
  return index.toString();
};
const getExistingStateFromStorage = (config, plugins) => {
  const existingState = storage.getStorageItem(storage.TANSTACK_DEVTOOLS_STATE);
  const settings = getSettings();
  const state = {
    ...devtoolsStore.initialState,
    plugins: plugins?.map((plugin, i) => {
      const id = generatePluginId(plugin, i);
      return {
        ...plugin,
        id
      };
    }) || [],
    state: {
      ...devtoolsStore.initialState.state,
      ...existingState ? JSON.parse(existingState) : {}
    },
    settings: {
      ...devtoolsStore.initialState.settings,
      ...config,
      ...settings
    }
  };
  return state;
};
const DevtoolsProvider = (props) => {
  const [store$1, setStore] = store.createStore(getExistingStateFromStorage(props.config, props.plugins));
  const value = {
    store: store$1,
    setStore: (updater) => {
      const newState = updater(store$1);
      const {
        settings,
        state: internalState
      } = newState;
      storage.setStorageItem(storage.TANSTACK_DEVTOOLS_SETTINGS, JSON.stringify(settings));
      storage.setStorageItem(storage.TANSTACK_DEVTOOLS_STATE, JSON.stringify(internalState));
      setStore((prev) => ({
        ...prev,
        ...newState
      }));
    }
  };
  return web.createComponent(DevtoolsContext.Provider, {
    value,
    get children() {
      return props.children;
    }
  });
};
exports.DevtoolsContext = DevtoolsContext;
exports.DevtoolsProvider = DevtoolsProvider;
//# sourceMappingURL=devtools-context.cjs.map

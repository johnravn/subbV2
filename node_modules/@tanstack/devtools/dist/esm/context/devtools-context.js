import { createComponent } from "solid-js/web";
import { createContext } from "solid-js";
import { createStore } from "solid-js/store";
import { tryParseJson } from "../utils/sanitize.js";
import { getStorageItem, setStorageItem, TANSTACK_DEVTOOLS_SETTINGS, TANSTACK_DEVTOOLS_STATE } from "../utils/storage.js";
import { initialState } from "./devtools-store.js";
const DevtoolsContext = createContext();
const getSettings = () => {
  const settingsString = getStorageItem(TANSTACK_DEVTOOLS_SETTINGS);
  const settings = tryParseJson(settingsString);
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
  const existingState = getStorageItem(TANSTACK_DEVTOOLS_STATE);
  const settings = getSettings();
  const state = {
    ...initialState,
    plugins: plugins?.map((plugin, i) => {
      const id = generatePluginId(plugin, i);
      return {
        ...plugin,
        id
      };
    }) || [],
    state: {
      ...initialState.state,
      ...existingState ? JSON.parse(existingState) : {}
    },
    settings: {
      ...initialState.settings,
      ...config,
      ...settings
    }
  };
  return state;
};
const DevtoolsProvider = (props) => {
  const [store, setStore] = createStore(getExistingStateFromStorage(props.config, props.plugins));
  const value = {
    store,
    setStore: (updater) => {
      const newState = updater(store);
      const {
        settings,
        state: internalState
      } = newState;
      setStorageItem(TANSTACK_DEVTOOLS_SETTINGS, JSON.stringify(settings));
      setStorageItem(TANSTACK_DEVTOOLS_STATE, JSON.stringify(internalState));
      setStore((prev) => ({
        ...prev,
        ...newState
      }));
    }
  };
  return createComponent(DevtoolsContext.Provider, {
    value,
    get children() {
      return props.children;
    }
  });
};
export {
  DevtoolsContext,
  DevtoolsProvider
};
//# sourceMappingURL=devtools-context.js.map

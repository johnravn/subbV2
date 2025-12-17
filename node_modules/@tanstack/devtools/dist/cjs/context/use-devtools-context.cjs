"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const solidJs = require("solid-js");
const devtoolsContext = require("./devtools-context.cjs");
const useDevtoolsContext = () => {
  const context = solidJs.useContext(devtoolsContext.DevtoolsContext);
  if (context === void 0) {
    throw new Error(
      "useDevtoolsShellContext must be used within a ShellContextProvider"
    );
  }
  return context;
};
const usePlugins = () => {
  const { store, setStore } = useDevtoolsContext();
  const plugins = solidJs.createMemo(() => store.plugins);
  const activePlugin = solidJs.createMemo(() => store.state.activePlugin);
  const setActivePlugin = (pluginId) => {
    setStore((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        activePlugin: pluginId
      }
    }));
  };
  return { plugins, setActivePlugin, activePlugin };
};
const useDevtoolsState = () => {
  const { store, setStore } = useDevtoolsContext();
  const state = solidJs.createMemo(() => store.state);
  const setState = (newState) => {
    setStore((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        ...newState
      }
    }));
  };
  return { state, setState };
};
const useDevtoolsSettings = () => {
  const { store, setStore } = useDevtoolsContext();
  const settings = solidJs.createMemo(() => store.settings);
  const setSettings = (newSettings) => {
    setStore((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...newSettings
      }
    }));
  };
  return { setSettings, settings };
};
const usePersistOpen = () => {
  const { state, setState } = useDevtoolsState();
  const persistOpen = solidJs.createMemo(() => state().persistOpen);
  const setPersistOpen = (value) => {
    setState({ persistOpen: value });
  };
  return { persistOpen, setPersistOpen };
};
const useHeight = () => {
  const { state, setState } = useDevtoolsState();
  const height = solidJs.createMemo(() => state().height);
  const setHeight = (newHeight) => {
    setState({ height: newHeight });
  };
  return { height, setHeight };
};
exports.useDevtoolsSettings = useDevtoolsSettings;
exports.useDevtoolsState = useDevtoolsState;
exports.useHeight = useHeight;
exports.usePersistOpen = usePersistOpen;
exports.usePlugins = usePlugins;
//# sourceMappingURL=use-devtools-context.cjs.map

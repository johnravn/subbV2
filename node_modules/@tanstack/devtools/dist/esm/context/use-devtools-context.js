import { createMemo, useContext } from "solid-js";
import { DevtoolsContext } from "./devtools-context.js";
const useDevtoolsContext = () => {
  const context = useContext(DevtoolsContext);
  if (context === void 0) {
    throw new Error(
      "useDevtoolsShellContext must be used within a ShellContextProvider"
    );
  }
  return context;
};
const usePlugins = () => {
  const { store, setStore } = useDevtoolsContext();
  const plugins = createMemo(() => store.plugins);
  const activePlugin = createMemo(() => store.state.activePlugin);
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
  const state = createMemo(() => store.state);
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
  const settings = createMemo(() => store.settings);
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
  const persistOpen = createMemo(() => state().persistOpen);
  const setPersistOpen = (value) => {
    setState({ persistOpen: value });
  };
  return { persistOpen, setPersistOpen };
};
const useHeight = () => {
  const { state, setState } = useDevtoolsState();
  const height = createMemo(() => state().height);
  const setHeight = (newHeight) => {
    setState({ height: newHeight });
  };
  return { height, setHeight };
};
export {
  useDevtoolsSettings,
  useDevtoolsState,
  useHeight,
  usePersistOpen,
  usePlugins
};
//# sourceMappingURL=use-devtools-context.js.map

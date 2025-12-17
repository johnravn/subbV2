"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const jsxRuntime = require("react/jsx-runtime");
const react = require("react");
const devtools = require("@tanstack/devtools");
const reactDom = require("react-dom");
const convertRender = (Component, setComponent) => {
  setComponent(typeof Component === "function" ? Component() : Component);
};
const TanstackDevtools = ({
  plugins,
  config,
  eventBusConfig
}) => {
  const devToolRef = react.useRef(null);
  const [pluginContainer, setPluginContainer] = react.useState(
    null
  );
  const [titleContainer, setTitleContainer] = react.useState(null);
  const [PluginComponent, setPluginComponent] = react.useState(
    null
  );
  const [TitleComponent, setTitleComponent] = react.useState(null);
  const [devtools$1] = react.useState(
    () => new devtools.TanStackDevtoolsCore({
      config,
      eventBusConfig,
      plugins: plugins?.map((plugin) => {
        return {
          ...plugin,
          name: typeof plugin.name === "string" ? plugin.name : (
            // The check above confirms that `plugin.name` is of Render type
            () => {
              setTitleContainer(
                document.getElementById(devtools.PLUGIN_TITLE_CONTAINER_ID) || null
              );
              convertRender(
                plugin.name,
                setTitleComponent
              );
            }
          ),
          render: () => {
            setPluginContainer(
              document.getElementById(devtools.PLUGIN_CONTAINER_ID) || null
            );
            convertRender(plugin.render, setPluginComponent);
          }
        };
      })
    })
  );
  react.useEffect(() => {
    if (devToolRef.current) {
      devtools$1.mount(devToolRef.current);
    }
    return () => devtools$1.unmount();
  }, [devtools$1]);
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx("div", { ref: devToolRef }),
    pluginContainer && PluginComponent ? reactDom.createPortal(/* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: PluginComponent }), pluginContainer) : null,
    titleContainer && TitleComponent ? reactDom.createPortal(/* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: TitleComponent }), titleContainer) : null
  ] });
};
exports.TanstackDevtools = TanstackDevtools;
//# sourceMappingURL=devtools.cjs.map

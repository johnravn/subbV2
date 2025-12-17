import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useRef, useState, useEffect } from "react";
import { TanStackDevtoolsCore, PLUGIN_CONTAINER_ID, PLUGIN_TITLE_CONTAINER_ID } from "@tanstack/devtools";
import { createPortal } from "react-dom";
const convertRender = (Component, setComponent) => {
  setComponent(typeof Component === "function" ? Component() : Component);
};
const TanstackDevtools = ({
  plugins,
  config,
  eventBusConfig
}) => {
  const devToolRef = useRef(null);
  const [pluginContainer, setPluginContainer] = useState(
    null
  );
  const [titleContainer, setTitleContainer] = useState(null);
  const [PluginComponent, setPluginComponent] = useState(
    null
  );
  const [TitleComponent, setTitleComponent] = useState(null);
  const [devtools] = useState(
    () => new TanStackDevtoolsCore({
      config,
      eventBusConfig,
      plugins: plugins?.map((plugin) => {
        return {
          ...plugin,
          name: typeof plugin.name === "string" ? plugin.name : (
            // The check above confirms that `plugin.name` is of Render type
            () => {
              setTitleContainer(
                document.getElementById(PLUGIN_TITLE_CONTAINER_ID) || null
              );
              convertRender(
                plugin.name,
                setTitleComponent
              );
            }
          ),
          render: () => {
            setPluginContainer(
              document.getElementById(PLUGIN_CONTAINER_ID) || null
            );
            convertRender(plugin.render, setPluginComponent);
          }
        };
      })
    })
  );
  useEffect(() => {
    if (devToolRef.current) {
      devtools.mount(devToolRef.current);
    }
    return () => devtools.unmount();
  }, [devtools]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { ref: devToolRef }),
    pluginContainer && PluginComponent ? createPortal(/* @__PURE__ */ jsx(Fragment, { children: PluginComponent }), pluginContainer) : null,
    titleContainer && TitleComponent ? createPortal(/* @__PURE__ */ jsx(Fragment, { children: TitleComponent }), titleContainer) : null
  ] });
};
export {
  TanstackDevtools
};
//# sourceMappingURL=devtools.js.map

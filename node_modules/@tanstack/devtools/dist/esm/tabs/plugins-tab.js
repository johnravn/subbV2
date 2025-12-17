import { template, insert, createComponent, setAttribute, effect, className, use, delegateEvents } from "solid-js/web";
import { createEffect, For } from "solid-js";
import clsx from "clsx";
import { usePlugins } from "../context/use-devtools-context.js";
import { useStyles } from "../styles/use-styles.js";
import { PLUGIN_TITLE_CONTAINER_ID, PLUGIN_CONTAINER_ID } from "../constants.js";
var _tmpl$ = /* @__PURE__ */ template(`<div><div></div><div>`), _tmpl$2 = /* @__PURE__ */ template(`<div><h3>`);
const PluginsTab = () => {
  const {
    plugins,
    activePlugin,
    setActivePlugin
  } = usePlugins();
  let activePluginRef;
  createEffect(() => {
    const currentActivePlugin = plugins()?.find((plugin) => plugin.id === activePlugin());
    if (activePluginRef && currentActivePlugin) {
      currentActivePlugin.render(activePluginRef);
    }
  });
  const styles = useStyles();
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
    insert(_el$2, createComponent(For, {
      get each() {
        return plugins();
      },
      children: (plugin) => {
        let pluginHeading;
        createEffect(() => {
          if (pluginHeading) {
            typeof plugin.name === "string" ? pluginHeading.textContent = plugin.name : plugin.name(pluginHeading);
          }
        });
        return (() => {
          var _el$4 = _tmpl$2(), _el$5 = _el$4.firstChild;
          _el$4.$$click = () => setActivePlugin(plugin.id);
          var _ref$2 = pluginHeading;
          typeof _ref$2 === "function" ? use(_ref$2, _el$5) : pluginHeading = _el$5;
          setAttribute(_el$5, "id", PLUGIN_TITLE_CONTAINER_ID);
          effect(() => className(_el$4, clsx(styles().pluginName, {
            active: activePlugin() === plugin.id
          })));
          return _el$4;
        })();
      }
    }));
    var _ref$ = activePluginRef;
    typeof _ref$ === "function" ? use(_ref$, _el$3) : activePluginRef = _el$3;
    setAttribute(_el$3, "id", PLUGIN_CONTAINER_ID);
    effect((_p$) => {
      var _v$ = styles().pluginsTabPanel, _v$2 = styles().pluginsTabSidebar, _v$3 = styles().pluginsTabContent;
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && className(_el$2, _p$.t = _v$2);
      _v$3 !== _p$.a && className(_el$3, _p$.a = _v$3);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
};
delegateEvents(["click"]);
export {
  PluginsTab
};
//# sourceMappingURL=plugins-tab.js.map

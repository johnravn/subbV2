"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const solidJs = require("solid-js");
const clsx = require("clsx");
const useDevtoolsContext = require("../context/use-devtools-context.cjs");
const useStyles = require("../styles/use-styles.cjs");
const constants = require("../constants.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<div><div></div><div>`), _tmpl$2 = /* @__PURE__ */ web.template(`<div><h3>`);
const PluginsTab = () => {
  const {
    plugins,
    activePlugin,
    setActivePlugin
  } = useDevtoolsContext.usePlugins();
  let activePluginRef;
  solidJs.createEffect(() => {
    const currentActivePlugin = plugins()?.find((plugin) => plugin.id === activePlugin());
    if (activePluginRef && currentActivePlugin) {
      currentActivePlugin.render(activePluginRef);
    }
  });
  const styles = useStyles.useStyles();
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
    web.insert(_el$2, web.createComponent(solidJs.For, {
      get each() {
        return plugins();
      },
      children: (plugin) => {
        let pluginHeading;
        solidJs.createEffect(() => {
          if (pluginHeading) {
            typeof plugin.name === "string" ? pluginHeading.textContent = plugin.name : plugin.name(pluginHeading);
          }
        });
        return (() => {
          var _el$4 = _tmpl$2(), _el$5 = _el$4.firstChild;
          _el$4.$$click = () => setActivePlugin(plugin.id);
          var _ref$2 = pluginHeading;
          typeof _ref$2 === "function" ? web.use(_ref$2, _el$5) : pluginHeading = _el$5;
          web.setAttribute(_el$5, "id", constants.PLUGIN_TITLE_CONTAINER_ID);
          web.effect(() => web.className(_el$4, clsx(styles().pluginName, {
            active: activePlugin() === plugin.id
          })));
          return _el$4;
        })();
      }
    }));
    var _ref$ = activePluginRef;
    typeof _ref$ === "function" ? web.use(_ref$, _el$3) : activePluginRef = _el$3;
    web.setAttribute(_el$3, "id", constants.PLUGIN_CONTAINER_ID);
    web.effect((_p$) => {
      var _v$ = styles().pluginsTabPanel, _v$2 = styles().pluginsTabSidebar, _v$3 = styles().pluginsTabContent;
      _v$ !== _p$.e && web.className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && web.className(_el$2, _p$.t = _v$2);
      _v$3 !== _p$.a && web.className(_el$3, _p$.a = _v$3);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
};
web.delegateEvents(["click"]);
exports.PluginsTab = PluginsTab;
//# sourceMappingURL=plugins-tab.cjs.map

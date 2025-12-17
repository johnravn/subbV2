"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const solidJs = require("solid-js");
const useDevtoolsContext = require("../context/use-devtools-context.cjs");
const index = require("../tabs/index.cjs");
const useStyles = require("../styles/use-styles.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<div>`);
const TabContent = () => {
  const {
    state
  } = useDevtoolsContext.useDevtoolsState();
  const styles = useStyles.useStyles();
  const [component, setComponent] = solidJs.createSignal(index.tabs.find((t) => t.id === state().activeTab)?.component() || null);
  solidJs.createEffect(() => {
    setComponent(index.tabs.find((t) => t.id === state().activeTab)?.component() || null);
  });
  return (() => {
    var _el$ = _tmpl$();
    web.insert(_el$, component);
    web.effect(() => web.className(_el$, styles().tabContent));
    return _el$;
  })();
};
exports.TabContent = TabContent;
//# sourceMappingURL=tab-content.cjs.map

import { template, insert, effect, className } from "solid-js/web";
import { createSignal, createEffect } from "solid-js";
import { useDevtoolsState } from "../context/use-devtools-context.js";
import { tabs } from "../tabs/index.js";
import { useStyles } from "../styles/use-styles.js";
var _tmpl$ = /* @__PURE__ */ template(`<div>`);
const TabContent = () => {
  const {
    state
  } = useDevtoolsState();
  const styles = useStyles();
  const [component, setComponent] = createSignal(tabs.find((t) => t.id === state().activeTab)?.component() || null);
  createEffect(() => {
    setComponent(tabs.find((t) => t.id === state().activeTab)?.component() || null);
  });
  return (() => {
    var _el$ = _tmpl$();
    insert(_el$, component);
    effect(() => className(_el$, styles().tabContent));
    return _el$;
  })();
};
export {
  TabContent
};
//# sourceMappingURL=tab-content.js.map

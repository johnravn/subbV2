import { template, setAttribute, insert, effect, className } from "solid-js/web";
import clsx from "clsx";
import { useHeight, useDevtoolsSettings } from "../context/use-devtools-context.js";
import { useStyles } from "../styles/use-styles.js";
import { TANSTACK_DEVTOOLS } from "../utils/storage.js";
var _tmpl$ = /* @__PURE__ */ template(`<div>`);
const MainPanel = (props) => {
  const styles = useStyles();
  const {
    height
  } = useHeight();
  const {
    settings
  } = useDevtoolsSettings();
  return (() => {
    var _el$ = _tmpl$();
    setAttribute(_el$, "id", TANSTACK_DEVTOOLS);
    insert(_el$, () => props.children);
    effect((_p$) => {
      var _v$ = height() + "px", _v$2 = clsx(styles().devtoolsPanelContainer(settings().panelLocation), styles().devtoolsPanelContainerAnimation(props.isOpen(), height()), styles().devtoolsPanelContainerVisibility(props.isOpen()), styles().devtoolsPanelContainerResizing(props.isResizing));
      _v$ !== _p$.e && ((_p$.e = _v$) != null ? _el$.style.setProperty("height", _v$) : _el$.style.removeProperty("height"));
      _v$2 !== _p$.t && className(_el$, _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
};
export {
  MainPanel
};
//# sourceMappingURL=main-panel.js.map

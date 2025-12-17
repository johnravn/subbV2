"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const clsx = require("clsx");
const useDevtoolsContext = require("../context/use-devtools-context.cjs");
const useStyles = require("../styles/use-styles.cjs");
const storage = require("../utils/storage.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<div>`);
const MainPanel = (props) => {
  const styles = useStyles.useStyles();
  const {
    height
  } = useDevtoolsContext.useHeight();
  const {
    settings
  } = useDevtoolsContext.useDevtoolsSettings();
  return (() => {
    var _el$ = _tmpl$();
    web.setAttribute(_el$, "id", storage.TANSTACK_DEVTOOLS);
    web.insert(_el$, () => props.children);
    web.effect((_p$) => {
      var _v$ = height() + "px", _v$2 = clsx(styles().devtoolsPanelContainer(settings().panelLocation), styles().devtoolsPanelContainerAnimation(props.isOpen(), height()), styles().devtoolsPanelContainerVisibility(props.isOpen()), styles().devtoolsPanelContainerResizing(props.isResizing));
      _v$ !== _p$.e && ((_p$.e = _v$) != null ? _el$.style.setProperty("height", _v$) : _el$.style.removeProperty("height"));
      _v$2 !== _p$.t && web.className(_el$, _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
};
exports.MainPanel = MainPanel;
//# sourceMappingURL=main-panel.cjs.map

"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const useDevtoolsContext = require("../context/use-devtools-context.cjs");
const useStyles = require("../styles/use-styles.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<div>`);
const ContentPanel = (props) => {
  const styles = useStyles.useStyles();
  const {
    settings
  } = useDevtoolsContext.useDevtoolsSettings();
  return (() => {
    var _el$ = _tmpl$();
    var _ref$ = props.ref;
    typeof _ref$ === "function" ? web.use(_ref$, _el$) : props.ref = _el$;
    web.insert(_el$, (() => {
      var _c$ = web.memo(() => !!props.handleDragStart);
      return () => _c$() ? (() => {
        var _el$2 = _tmpl$();
        web.addEventListener(_el$2, "mousedown", props.handleDragStart, true);
        web.effect(() => web.className(_el$2, styles().dragHandle(settings().panelLocation)));
        return _el$2;
      })() : null;
    })(), null);
    web.insert(_el$, () => props.children, null);
    web.effect(() => web.className(_el$, styles().devtoolsPanel));
    return _el$;
  })();
};
web.delegateEvents(["mousedown"]);
exports.ContentPanel = ContentPanel;
//# sourceMappingURL=content-panel.cjs.map

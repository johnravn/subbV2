import { template, use, insert, memo, addEventListener, effect, className, delegateEvents } from "solid-js/web";
import { useDevtoolsSettings } from "../context/use-devtools-context.js";
import { useStyles } from "../styles/use-styles.js";
var _tmpl$ = /* @__PURE__ */ template(`<div>`);
const ContentPanel = (props) => {
  const styles = useStyles();
  const {
    settings
  } = useDevtoolsSettings();
  return (() => {
    var _el$ = _tmpl$();
    var _ref$ = props.ref;
    typeof _ref$ === "function" ? use(_ref$, _el$) : props.ref = _el$;
    insert(_el$, (() => {
      var _c$ = memo(() => !!props.handleDragStart);
      return () => _c$() ? (() => {
        var _el$2 = _tmpl$();
        addEventListener(_el$2, "mousedown", props.handleDragStart, true);
        effect(() => className(_el$2, styles().dragHandle(settings().panelLocation)));
        return _el$2;
      })() : null;
    })(), null);
    insert(_el$, () => props.children, null);
    effect(() => className(_el$, styles().devtoolsPanel));
    return _el$;
  })();
};
delegateEvents(["mousedown"]);
export {
  ContentPanel
};
//# sourceMappingURL=content-panel.js.map

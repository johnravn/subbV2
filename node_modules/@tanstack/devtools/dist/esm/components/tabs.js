import { template, insert, createComponent, effect, className, delegateEvents } from "solid-js/web";
import clsx from "clsx";
import { For } from "solid-js";
import { useStyles } from "../styles/use-styles.js";
import { useDevtoolsState } from "../context/use-devtools-context.js";
import { tabs } from "../tabs/index.js";
var _tmpl$ = /* @__PURE__ */ template(`<div><button type=button><svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M18 6 6 18"></path><path d="m6 6 12 12">`), _tmpl$2 = /* @__PURE__ */ template(`<button type=button>`);
const Tabs = (props) => {
  const styles = useStyles();
  const {
    state,
    setState
  } = useDevtoolsState();
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild;
    insert(_el$, createComponent(For, {
      each: tabs,
      children: (tab) => (() => {
        var _el$3 = _tmpl$2();
        _el$3.$$click = () => setState({
          activeTab: tab.id
        });
        insert(_el$3, () => tab.icon);
        effect(() => className(_el$3, clsx(styles().tab, {
          active: state().activeTab === tab.id
        })));
        return _el$3;
      })()
    }), _el$2);
    _el$2.$$click = () => props.toggleOpen();
    effect((_p$) => {
      var _v$ = styles().tabContainer, _v$2 = clsx(styles().tab, "close");
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && className(_el$2, _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
};
delegateEvents(["click"]);
export {
  Tabs
};
//# sourceMappingURL=tabs.js.map

"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const clsx = require("clsx");
const solidJs = require("solid-js");
const useStyles = require("../styles/use-styles.cjs");
const useDevtoolsContext = require("../context/use-devtools-context.cjs");
const index = require("../tabs/index.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<div><button type=button><svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M18 6 6 18"></path><path d="m6 6 12 12">`), _tmpl$2 = /* @__PURE__ */ web.template(`<button type=button>`);
const Tabs = (props) => {
  const styles = useStyles.useStyles();
  const {
    state,
    setState
  } = useDevtoolsContext.useDevtoolsState();
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild;
    web.insert(_el$, web.createComponent(solidJs.For, {
      each: index.tabs,
      children: (tab) => (() => {
        var _el$3 = _tmpl$2();
        _el$3.$$click = () => setState({
          activeTab: tab.id
        });
        web.insert(_el$3, () => tab.icon);
        web.effect(() => web.className(_el$3, clsx(styles().tab, {
          active: state().activeTab === tab.id
        })));
        return _el$3;
      })()
    }), _el$2);
    _el$2.$$click = () => props.toggleOpen();
    web.effect((_p$) => {
      var _v$ = styles().tabContainer, _v$2 = clsx(styles().tab, "close");
      _v$ !== _p$.e && web.className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && web.className(_el$2, _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
};
web.delegateEvents(["click"]);
exports.Tabs = Tabs;
//# sourceMappingURL=tabs.cjs.map

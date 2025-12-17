"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const solidJs = require("solid-js");
const useStyles = require("../styles/use-styles.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<div><label><input type=checkbox><div>`), _tmpl$2 = /* @__PURE__ */ web.template(`<span>`);
function Checkbox(props) {
  const styles = useStyles.useStyles();
  const [isChecked, setIsChecked] = solidJs.createSignal(props.checked || false);
  const handleChange = (e) => {
    const checked = e.target.checked;
    setIsChecked(checked);
    props.onChange?.(checked);
  };
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling;
    _el$3.$$input = handleChange;
    web.insert(_el$4, (() => {
      var _c$ = web.memo(() => !!props.label);
      return () => _c$() && (() => {
        var _el$5 = _tmpl$2();
        web.insert(_el$5, () => props.label);
        web.effect(() => web.className(_el$5, styles().checkboxLabel));
        return _el$5;
      })();
    })(), null);
    web.insert(_el$4, (() => {
      var _c$2 = web.memo(() => !!props.description);
      return () => _c$2() && (() => {
        var _el$6 = _tmpl$2();
        web.insert(_el$6, () => props.description);
        web.effect(() => web.className(_el$6, styles().checkboxDescription));
        return _el$6;
      })();
    })(), null);
    web.effect((_p$) => {
      var _v$ = styles().checkboxContainer, _v$2 = styles().checkboxWrapper, _v$3 = styles().checkbox, _v$4 = styles().checkboxLabelContainer;
      _v$ !== _p$.e && web.className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && web.className(_el$2, _p$.t = _v$2);
      _v$3 !== _p$.a && web.className(_el$3, _p$.a = _v$3);
      _v$4 !== _p$.o && web.className(_el$4, _p$.o = _v$4);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0
    });
    web.effect(() => _el$3.checked = isChecked());
    return _el$;
  })();
}
web.delegateEvents(["input"]);
exports.Checkbox = Checkbox;
//# sourceMappingURL=checkbox.cjs.map

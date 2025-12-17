"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const solidJs = require("solid-js");
const useStyles = require("../styles/use-styles.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<div><div><select>`), _tmpl$2 = /* @__PURE__ */ web.template(`<label>`), _tmpl$3 = /* @__PURE__ */ web.template(`<p>`), _tmpl$4 = /* @__PURE__ */ web.template(`<option>`);
function Select(props) {
  const styles = useStyles.useStyles();
  const [selected, setSelected] = solidJs.createSignal(props.value || props.options[0]?.value);
  const handleChange = (e) => {
    const value = e.target.value;
    setSelected((prev) => prev !== value ? value : prev);
    props.onChange?.(value);
  };
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild;
    web.insert(_el$2, (() => {
      var _c$ = web.memo(() => !!props.label);
      return () => _c$() && (() => {
        var _el$4 = _tmpl$2();
        web.insert(_el$4, () => props.label);
        web.effect(() => web.className(_el$4, styles().selectLabel));
        return _el$4;
      })();
    })(), _el$3);
    web.insert(_el$2, (() => {
      var _c$2 = web.memo(() => !!props.description);
      return () => _c$2() && (() => {
        var _el$5 = _tmpl$3();
        web.insert(_el$5, () => props.description);
        web.effect(() => web.className(_el$5, styles().selectDescription));
        return _el$5;
      })();
    })(), _el$3);
    _el$3.$$input = handleChange;
    web.insert(_el$3, () => props.options.map((opt) => (() => {
      var _el$6 = _tmpl$4();
      web.insert(_el$6, () => opt.label);
      web.effect(() => _el$6.value = opt.value);
      return _el$6;
    })()));
    web.effect((_p$) => {
      var _v$ = styles().selectContainer, _v$2 = styles().selectWrapper, _v$3 = styles().select;
      _v$ !== _p$.e && web.className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && web.className(_el$2, _p$.t = _v$2);
      _v$3 !== _p$.a && web.className(_el$3, _p$.a = _v$3);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    web.effect(() => _el$3.value = selected());
    return _el$;
  })();
}
web.delegateEvents(["input"]);
exports.Select = Select;
//# sourceMappingURL=select.cjs.map

"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const solidJs = require("solid-js");
const useStyles = require("../styles/use-styles.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<div><div><input>`), _tmpl$2 = /* @__PURE__ */ web.template(`<label>`), _tmpl$3 = /* @__PURE__ */ web.template(`<p>`);
function Input(props) {
  const styles = useStyles.useStyles();
  const [val, setVal] = solidJs.createSignal(props.value || "");
  const handleChange = (e) => {
    const value = e.target.value;
    setVal((prev) => prev !== value ? value : prev);
    props.onChange?.(value);
  };
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild;
    web.insert(_el$2, (() => {
      var _c$ = web.memo(() => !!props.label);
      return () => _c$() && (() => {
        var _el$4 = _tmpl$2();
        web.insert(_el$4, () => props.label);
        web.effect(() => web.className(_el$4, styles().inputLabel));
        return _el$4;
      })();
    })(), _el$3);
    web.insert(_el$2, (() => {
      var _c$2 = web.memo(() => !!props.description);
      return () => _c$2() && (() => {
        var _el$5 = _tmpl$3();
        web.insert(_el$5, () => props.description);
        web.effect(() => web.className(_el$5, styles().inputDescription));
        return _el$5;
      })();
    })(), _el$3);
    _el$3.$$input = handleChange;
    web.effect((_p$) => {
      var _v$ = styles().inputContainer, _v$2 = styles().inputWrapper, _v$3 = props.type || "text", _v$4 = styles().input, _v$5 = props.placeholder;
      _v$ !== _p$.e && web.className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && web.className(_el$2, _p$.t = _v$2);
      _v$3 !== _p$.a && web.setAttribute(_el$3, "type", _p$.a = _v$3);
      _v$4 !== _p$.o && web.className(_el$3, _p$.o = _v$4);
      _v$5 !== _p$.i && web.setAttribute(_el$3, "placeholder", _p$.i = _v$5);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0
    });
    web.effect(() => _el$3.value = val());
    return _el$;
  })();
}
web.delegateEvents(["input"]);
exports.Input = Input;
//# sourceMappingURL=input.cjs.map

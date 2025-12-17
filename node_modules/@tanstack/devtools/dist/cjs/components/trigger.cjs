"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const solidJs = require("solid-js");
const clsx = require("clsx");
const devtoolsUi = require("@tanstack/devtools-ui");
const useDevtoolsContext = require("../context/use-devtools-context.cjs");
const useStyles = require("../styles/use-styles.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<button type=button aria-label="Open TanStack Devtools">`);
const Trigger = ({
  isOpen,
  setIsOpen
}) => {
  const {
    settings
  } = useDevtoolsContext.useDevtoolsSettings();
  const styles = useStyles.useStyles();
  const buttonStyle = solidJs.createMemo(() => {
    return clsx(styles().mainCloseBtn, styles().mainCloseBtnPosition(settings().position), styles().mainCloseBtnAnimation(isOpen(), settings().hideUntilHover));
  });
  return (() => {
    var _el$ = _tmpl$();
    _el$.$$click = () => setIsOpen(!isOpen());
    web.insert(_el$, web.createComponent(devtoolsUi.TanStackLogo, {}));
    web.effect(() => web.className(_el$, buttonStyle()));
    return _el$;
  })();
};
web.delegateEvents(["click"]);
exports.Trigger = Trigger;
//# sourceMappingURL=trigger.cjs.map

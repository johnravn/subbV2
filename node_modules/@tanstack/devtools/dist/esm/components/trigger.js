import { template, insert, createComponent, effect, className, delegateEvents } from "solid-js/web";
import { createMemo } from "solid-js";
import clsx from "clsx";
import { TanStackLogo } from "@tanstack/devtools-ui";
import { useDevtoolsSettings } from "../context/use-devtools-context.js";
import { useStyles } from "../styles/use-styles.js";
var _tmpl$ = /* @__PURE__ */ template(`<button type=button aria-label="Open TanStack Devtools">`);
const Trigger = ({
  isOpen,
  setIsOpen
}) => {
  const {
    settings
  } = useDevtoolsSettings();
  const styles = useStyles();
  const buttonStyle = createMemo(() => {
    return clsx(styles().mainCloseBtn, styles().mainCloseBtnPosition(settings().position), styles().mainCloseBtnAnimation(isOpen(), settings().hideUntilHover));
  });
  return (() => {
    var _el$ = _tmpl$();
    _el$.$$click = () => setIsOpen(!isOpen());
    insert(_el$, createComponent(TanStackLogo, {}));
    effect(() => className(_el$, buttonStyle()));
    return _el$;
  })();
};
delegateEvents(["click"]);
export {
  Trigger
};
//# sourceMappingURL=trigger.js.map

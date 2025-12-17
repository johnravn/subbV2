import { createEffect } from "solid-js";
import { TANSTACK_DEVTOOLS } from "../utils/storage.js";
const recursivelyChangeTabIndex = (node, remove = true) => {
  if (remove) {
    node.setAttribute("tabIndex", "-1");
  } else {
    node.removeAttribute("tabIndex");
  }
  for (const child of node.children) {
    recursivelyChangeTabIndex(child, remove);
  }
};
const useDisableTabbing = (isOpen) => {
  createEffect(() => {
    const el = document.getElementById(TANSTACK_DEVTOOLS);
    if (!el) return;
    recursivelyChangeTabIndex(el, !isOpen());
  });
};
export {
  useDisableTabbing
};
//# sourceMappingURL=use-disable-tabbing.js.map

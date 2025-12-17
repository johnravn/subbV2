"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const solidJs = require("solid-js");
const storage = require("../utils/storage.cjs");
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
  solidJs.createEffect(() => {
    const el = document.getElementById(storage.TANSTACK_DEVTOOLS);
    if (!el) return;
    recursivelyChangeTabIndex(el, !isOpen());
  });
};
exports.useDisableTabbing = useDisableTabbing;
//# sourceMappingURL=use-disable-tabbing.cjs.map

"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const devtools$1 = require("@tanstack/devtools");
const devtools = require("./devtools.cjs");
exports.TanstackDevtools = devtools.TanstackDevtools;
Object.keys(devtools$1).forEach((k) => {
  if (k !== "default" && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: () => devtools$1[k]
  });
});
//# sourceMappingURL=index.cjs.map

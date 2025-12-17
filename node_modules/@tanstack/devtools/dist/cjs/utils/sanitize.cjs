"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const tryParseJson = (json) => {
  if (!json) return void 0;
  try {
    return JSON.parse(json);
  } catch (_e) {
    return void 0;
  }
};
const uppercaseFirstLetter = (value) => value.charAt(0).toUpperCase() + value.slice(1);
exports.tryParseJson = tryParseJson;
exports.uppercaseFirstLetter = uppercaseFirstLetter;
//# sourceMappingURL=sanitize.cjs.map

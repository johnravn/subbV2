"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const settingsTab = require("./settings-tab.cjs");
const pluginsTab = require("./plugins-tab.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M8 6h10"></path><path d="M6 12h9"></path><path d="M11 18h7">`), _tmpl$2 = /* @__PURE__ */ web.template(`<svg xmlns=http://www.w3.org/2000/svg width=24 height=24 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"></path><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path><path d="M12 2v2"></path><path d="M12 22v-2"></path><path d="m17 20.66-1-1.73"></path><path d="M11 10.27 7 3.34"></path><path d="m20.66 17-1.73-1"></path><path d="m3.34 7 1.73 1"></path><path d="M14 12h8"></path><path d="M2 12h2"></path><path d="m20.66 7-1.73 1"></path><path d="m3.34 17 1.73-1"></path><path d="m17 3.34-1 1.73"></path><path d="m11 13.73-4 6.93">`);
const tabs = [{
  name: "Plugins",
  id: "plugins",
  component: () => web.createComponent(pluginsTab.PluginsTab, {}),
  icon: _tmpl$()
}, {
  name: "Settings",
  id: "settings",
  component: () => web.createComponent(settingsTab.SettingsTab, {}),
  icon: _tmpl$2()
}];
exports.tabs = tabs;
//# sourceMappingURL=index.cjs.map

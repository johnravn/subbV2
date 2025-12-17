import { template, insert, createComponent, effect, className, setAttribute } from "solid-js/web";
import { Show } from "solid-js";
import { Checkbox, Input, Select } from "@tanstack/devtools-ui";
import { useDevtoolsSettings } from "../context/use-devtools-context.js";
import { uppercaseFirstLetter } from "../utils/sanitize.js";
import { useStyles } from "../styles/use-styles.js";
var _tmpl$ = /* @__PURE__ */ template(`<div>`), _tmpl$2 = /* @__PURE__ */ template(`<div><div><h3><svg xmlns=http://www.w3.org/2000/svg width=20 height=20 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx=12 cy=12 r=3></circle></svg>General</h3><p>Configure general behavior of the devtools panel.</p><div></div></div><div><h3><svg xmlns=http://www.w3.org/2000/svg width=20 height=20 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M9 17H7A5 5 0 0 1 7 7h2"></path><path d="M15 7h2a5 5 0 1 1 0 10h-2"></path><line x1=8 x2=16 y1=12 y2=12></line></svg>URL Configuration</h3><p>Control when devtools are available based on URL parameters.</p><div></div></div><div><h3><svg xmlns=http://www.w3.org/2000/svg width=20 height=20 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M10 8h.01"></path><path d="M12 12h.01"></path><path d="M14 8h.01"></path><path d="M16 12h.01"></path><path d="M18 8h.01"></path><path d="M6 8h.01"></path><path d="M7 16h10"></path><path d="M8 12h.01"></path><rect width=20 height=16 x=2 y=4 rx=2></rect></svg>Keyboard</h3><p>Customize keyboard shortcuts for quick access.</p><div></div></div><div><h3><svg xmlns=http://www.w3.org/2000/svg width=20 height=20 viewBox="0 0 24 24"fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx=12 cy=10 r=3></circle></svg>Position</h3><p>Adjust the position of the trigger button and devtools panel.</p><div><div>`);
const SettingsTab = () => {
  const {
    setSettings,
    settings
  } = useDevtoolsSettings();
  const styles = useStyles();
  return (() => {
    var _el$ = _tmpl$2(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$3.nextSibling, _el$6 = _el$5.nextSibling, _el$7 = _el$2.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$8.firstChild, _el$10 = _el$8.nextSibling, _el$11 = _el$10.nextSibling, _el$13 = _el$7.nextSibling, _el$14 = _el$13.firstChild, _el$15 = _el$14.firstChild, _el$16 = _el$14.nextSibling, _el$17 = _el$16.nextSibling, _el$18 = _el$13.nextSibling, _el$19 = _el$18.firstChild, _el$20 = _el$19.firstChild, _el$21 = _el$19.nextSibling, _el$22 = _el$21.nextSibling, _el$23 = _el$22.firstChild;
    insert(_el$6, createComponent(Checkbox, {
      label: "Default open",
      description: "Automatically open the devtools panel when the page loads",
      onChange: () => setSettings({
        defaultOpen: !settings().defaultOpen
      }),
      get checked() {
        return settings().defaultOpen;
      }
    }), null);
    insert(_el$6, createComponent(Checkbox, {
      label: "Hide trigger until hovered",
      description: "Keep the devtools trigger button hidden until you hover over its area",
      onChange: () => setSettings({
        hideUntilHover: !settings().hideUntilHover
      }),
      get checked() {
        return settings().hideUntilHover;
      }
    }), null);
    insert(_el$11, createComponent(Checkbox, {
      label: "Require URL Flag",
      description: "Only show devtools when a specific URL parameter is present",
      get checked() {
        return settings().requireUrlFlag;
      },
      onChange: (checked) => setSettings({
        requireUrlFlag: checked
      })
    }), null);
    insert(_el$11, createComponent(Show, {
      get when() {
        return settings().requireUrlFlag;
      },
      get children() {
        var _el$12 = _tmpl$();
        insert(_el$12, createComponent(Input, {
          label: "URL flag",
          description: "Enter the URL parameter name (e.g., 'debug' for ?debug=true)",
          placeholder: "debug",
          get value() {
            return settings().urlFlag;
          },
          onChange: (e) => setSettings({
            urlFlag: e
          })
        }));
        effect(() => className(_el$12, styles().conditionalSetting));
        return _el$12;
      }
    }), null);
    insert(_el$17, createComponent(Input, {
      label: "Hotkey to open/close devtools",
      description: "Use '+' to combine keys (e.g., 'Ctrl+Shift+D' or 'Alt+D')",
      placeholder: "Ctrl+Shift+D",
      get value() {
        return settings().openHotkey.join("+");
      },
      onChange: (e) => setSettings({
        openHotkey: e.split("+").map((key) => uppercaseFirstLetter(key)).filter(Boolean)
      })
    }));
    insert(_el$23, createComponent(Select, {
      label: "Trigger Position",
      options: [{
        label: "Bottom Right",
        value: "bottom-right"
      }, {
        label: "Bottom Left",
        value: "bottom-left"
      }, {
        label: "Top Right",
        value: "top-right"
      }, {
        label: "Top Left",
        value: "top-left"
      }, {
        label: "Middle Right",
        value: "middle-right"
      }, {
        label: "Middle Left",
        value: "middle-left"
      }],
      get value() {
        return settings().position;
      },
      onChange: (value) => setSettings({
        position: value
      })
    }), null);
    insert(_el$23, createComponent(Select, {
      label: "Panel Position",
      get value() {
        return settings().panelLocation;
      },
      options: [{
        label: "Top",
        value: "top"
      }, {
        label: "Bottom",
        value: "bottom"
      }],
      onChange: (value) => setSettings({
        panelLocation: value
      })
    }), null);
    effect((_p$) => {
      var _v$ = styles().settingsContainer, _v$2 = styles().settingsSection, _v$3 = styles().sectionTitle, _v$4 = styles().sectionIcon, _v$5 = styles().sectionDescription, _v$6 = styles().settingsGroup, _v$7 = styles().settingsSection, _v$8 = styles().sectionTitle, _v$9 = styles().sectionIcon, _v$10 = styles().sectionDescription, _v$11 = styles().settingsGroup, _v$12 = styles().settingsSection, _v$13 = styles().sectionTitle, _v$14 = styles().sectionIcon, _v$15 = styles().sectionDescription, _v$16 = styles().settingsGroup, _v$17 = styles().settingsSection, _v$18 = styles().sectionTitle, _v$19 = styles().sectionIcon, _v$20 = styles().sectionDescription, _v$21 = styles().settingsGroup, _v$22 = styles().settingRow;
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && className(_el$2, _p$.t = _v$2);
      _v$3 !== _p$.a && className(_el$3, _p$.a = _v$3);
      _v$4 !== _p$.o && setAttribute(_el$4, "class", _p$.o = _v$4);
      _v$5 !== _p$.i && className(_el$5, _p$.i = _v$5);
      _v$6 !== _p$.n && className(_el$6, _p$.n = _v$6);
      _v$7 !== _p$.s && className(_el$7, _p$.s = _v$7);
      _v$8 !== _p$.h && className(_el$8, _p$.h = _v$8);
      _v$9 !== _p$.r && setAttribute(_el$9, "class", _p$.r = _v$9);
      _v$10 !== _p$.d && className(_el$10, _p$.d = _v$10);
      _v$11 !== _p$.l && className(_el$11, _p$.l = _v$11);
      _v$12 !== _p$.u && className(_el$13, _p$.u = _v$12);
      _v$13 !== _p$.c && className(_el$14, _p$.c = _v$13);
      _v$14 !== _p$.w && setAttribute(_el$15, "class", _p$.w = _v$14);
      _v$15 !== _p$.m && className(_el$16, _p$.m = _v$15);
      _v$16 !== _p$.f && className(_el$17, _p$.f = _v$16);
      _v$17 !== _p$.y && className(_el$18, _p$.y = _v$17);
      _v$18 !== _p$.g && className(_el$19, _p$.g = _v$18);
      _v$19 !== _p$.p && setAttribute(_el$20, "class", _p$.p = _v$19);
      _v$20 !== _p$.b && className(_el$21, _p$.b = _v$20);
      _v$21 !== _p$.T && className(_el$22, _p$.T = _v$21);
      _v$22 !== _p$.A && className(_el$23, _p$.A = _v$22);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0,
      n: void 0,
      s: void 0,
      h: void 0,
      r: void 0,
      d: void 0,
      l: void 0,
      u: void 0,
      c: void 0,
      w: void 0,
      m: void 0,
      f: void 0,
      y: void 0,
      g: void 0,
      p: void 0,
      b: void 0,
      T: void 0,
      A: void 0
    });
    return _el$;
  })();
};
export {
  SettingsTab
};
//# sourceMappingURL=settings-tab.js.map

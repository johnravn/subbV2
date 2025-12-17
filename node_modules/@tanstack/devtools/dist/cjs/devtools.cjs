"use strict";
const web = require("solid-js/web");
const solidJs = require("solid-js");
const keyboard = require("@solid-primitives/keyboard");
const useDevtoolsContext = require("./context/use-devtools-context.cjs");
const useDisableTabbing = require("./hooks/use-disable-tabbing.cjs");
const storage = require("./utils/storage.cjs");
const trigger = require("./components/trigger.cjs");
const mainPanel = require("./components/main-panel.cjs");
const contentPanel = require("./components/content-panel.cjs");
const tabs = require("./components/tabs.cjs");
const tabContent = require("./components/tab-content.cjs");
var _tmpl$ = /* @__PURE__ */ web.template(`<div>`);
function DevTools() {
  const {
    settings
  } = useDevtoolsContext.useDevtoolsSettings();
  const {
    setHeight
  } = useDevtoolsContext.useHeight();
  const {
    persistOpen,
    setPersistOpen
  } = useDevtoolsContext.usePersistOpen();
  const [rootEl, setRootEl] = solidJs.createSignal();
  const [isOpen, setIsOpen] = solidJs.createSignal(settings().defaultOpen || persistOpen());
  let panelRef = void 0;
  const [isResizing, setIsResizing] = solidJs.createSignal(false);
  const toggleOpen = () => {
    const open = isOpen();
    setIsOpen(!open);
    setPersistOpen(!open);
  };
  solidJs.createEffect(() => {
  });
  const handleDragStart = (panelElement, startEvent) => {
    if (startEvent.button !== 0) return;
    if (!panelElement) return;
    setIsResizing(true);
    const dragInfo = {
      originalHeight: panelElement.getBoundingClientRect().height,
      pageY: startEvent.pageY
    };
    const run = (moveEvent) => {
      const delta = dragInfo.pageY - moveEvent.pageY;
      const newHeight = settings().panelLocation === "bottom" ? dragInfo.originalHeight + delta : dragInfo.originalHeight - delta;
      setHeight(newHeight);
      if (newHeight < 70) {
        setIsOpen(false);
      } else {
        setIsOpen(true);
      }
    };
    const unsub = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", run);
      document.removeEventListener("mouseUp", unsub);
    };
    document.addEventListener("mousemove", run);
    document.addEventListener("mouseup", unsub);
  };
  solidJs.createEffect(() => {
    if (isOpen()) {
      const previousValue = rootEl()?.parentElement?.style.paddingBottom;
      const run = () => {
        if (!panelRef) return;
        const containerHeight = panelRef.getBoundingClientRect().height;
        if (rootEl()?.parentElement) {
          setRootEl((prev) => {
            if (prev?.parentElement) {
              prev.parentElement.style.paddingBottom = `${containerHeight}px`;
            }
            return prev;
          });
        }
      };
      run();
      if (typeof window !== "undefined") {
        window.addEventListener("resize", run);
        return () => {
          window.removeEventListener("resize", run);
          if (rootEl()?.parentElement && typeof previousValue === "string") {
            setRootEl((prev) => {
              prev.parentElement.style.paddingBottom = previousValue;
              return prev;
            });
          }
        };
      }
    } else {
      if (rootEl()?.parentElement) {
        setRootEl((prev) => {
          if (prev?.parentElement) {
            prev.parentElement.removeAttribute("style");
          }
          return prev;
        });
      }
    }
    return;
  });
  solidJs.createEffect(() => {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) {
        toggleOpen();
      }
    });
  });
  useDisableTabbing.useDisableTabbing(isOpen);
  solidJs.createEffect(() => {
    if (rootEl()) {
      const el = rootEl();
      const fontSize = getComputedStyle(el).fontSize;
      el?.style.setProperty("--tsrd-font-size", fontSize);
    }
  });
  solidJs.createEffect(() => {
    keyboard.createShortcut(settings().openHotkey, () => {
      toggleOpen();
    });
  });
  solidJs.createEffect(() => {
  });
  return (() => {
    var _el$ = _tmpl$();
    web.use(setRootEl, _el$);
    web.setAttribute(_el$, "data-testid", storage.TANSTACK_DEVTOOLS);
    web.insert(_el$, web.createComponent(solidJs.Show, {
      get when() {
        return web.memo(() => !!settings().requireUrlFlag)() ? window.location.search.includes(settings().urlFlag) : true;
      },
      get children() {
        return [web.createComponent(trigger.Trigger, {
          isOpen,
          setIsOpen: toggleOpen
        }), web.createComponent(mainPanel.MainPanel, {
          isResizing,
          isOpen,
          get children() {
            return web.createComponent(contentPanel.ContentPanel, {
              ref: (ref) => panelRef = ref,
              handleDragStart: (e) => handleDragStart(panelRef, e),
              get children() {
                return [web.createComponent(tabs.Tabs, {
                  toggleOpen
                }), web.createComponent(tabContent.TabContent, {})];
              }
            });
          }
        })];
      }
    }));
    return _el$;
  })();
}
module.exports = DevTools;
//# sourceMappingURL=devtools.cjs.map

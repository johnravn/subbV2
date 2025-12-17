import { template, use, setAttribute, insert, createComponent, memo } from "solid-js/web";
import { createSignal, createEffect, Show } from "solid-js";
import { createShortcut } from "@solid-primitives/keyboard";
import { useDevtoolsSettings, useHeight, usePersistOpen } from "./context/use-devtools-context.js";
import { useDisableTabbing } from "./hooks/use-disable-tabbing.js";
import { TANSTACK_DEVTOOLS } from "./utils/storage.js";
import { Trigger } from "./components/trigger.js";
import { MainPanel } from "./components/main-panel.js";
import { ContentPanel } from "./components/content-panel.js";
import { Tabs } from "./components/tabs.js";
import { TabContent } from "./components/tab-content.js";
var _tmpl$ = /* @__PURE__ */ template(`<div>`);
function DevTools() {
  const {
    settings
  } = useDevtoolsSettings();
  const {
    setHeight
  } = useHeight();
  const {
    persistOpen,
    setPersistOpen
  } = usePersistOpen();
  const [rootEl, setRootEl] = createSignal();
  const [isOpen, setIsOpen] = createSignal(settings().defaultOpen || persistOpen());
  let panelRef = void 0;
  const [isResizing, setIsResizing] = createSignal(false);
  const toggleOpen = () => {
    const open = isOpen();
    setIsOpen(!open);
    setPersistOpen(!open);
  };
  createEffect(() => {
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
  createEffect(() => {
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
  createEffect(() => {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) {
        toggleOpen();
      }
    });
  });
  useDisableTabbing(isOpen);
  createEffect(() => {
    if (rootEl()) {
      const el = rootEl();
      const fontSize = getComputedStyle(el).fontSize;
      el?.style.setProperty("--tsrd-font-size", fontSize);
    }
  });
  createEffect(() => {
    createShortcut(settings().openHotkey, () => {
      toggleOpen();
    });
  });
  createEffect(() => {
  });
  return (() => {
    var _el$ = _tmpl$();
    use(setRootEl, _el$);
    setAttribute(_el$, "data-testid", TANSTACK_DEVTOOLS);
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!settings().requireUrlFlag)() ? window.location.search.includes(settings().urlFlag) : true;
      },
      get children() {
        return [createComponent(Trigger, {
          isOpen,
          setIsOpen: toggleOpen
        }), createComponent(MainPanel, {
          isResizing,
          isOpen,
          get children() {
            return createComponent(ContentPanel, {
              ref: (ref) => panelRef = ref,
              handleDragStart: (e) => handleDragStart(panelRef, e),
              get children() {
                return [createComponent(Tabs, {
                  toggleOpen
                }), createComponent(TabContent, {})];
              }
            });
          }
        })];
      }
    }));
    return _el$;
  })();
}
export {
  DevTools as default
};
//# sourceMappingURL=devtools.js.map

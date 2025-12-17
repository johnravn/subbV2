"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const web = require("solid-js/web");
const solidJs = require("solid-js");
const client = require("@tanstack/devtools-event-bus/client");
const devtoolsContext = require("./context/devtools-context.cjs");
const devtoolsStore = require("./context/devtools-store.cjs");
const _interopNamespaceDefaultOnly = (e) => Object.freeze(Object.defineProperty({ __proto__: null, default: e }, Symbol.toStringTag, { value: "Module" }));
class TanStackDevtoolsCore {
  #config = {
    ...devtoolsStore.initialState.settings
  };
  #plugins = [];
  #isMounted = false;
  #dispose;
  #Component;
  #eventBus;
  #eventBusConfig;
  constructor(init) {
    this.#plugins = init.plugins || [];
    this.#eventBusConfig = init.eventBusConfig;
    this.#config = {
      ...this.#config,
      ...init.config
    };
  }
  mount(el) {
    if (this.#isMounted) {
      throw new Error("Devtools is already mounted");
    }
    const mountTo = el;
    const dispose = web.render(() => {
      const _self$ = this;
      this.#Component = solidJs.lazy(() => Promise.resolve().then(() => /* @__PURE__ */ _interopNamespaceDefaultOnly(require("./devtools.cjs"))));
      const Devtools = this.#Component;
      this.#eventBus = new client.ClientEventBus(this.#eventBusConfig);
      this.#eventBus.start();
      return web.createComponent(devtoolsContext.DevtoolsProvider, {
        get plugins() {
          return _self$.#plugins;
        },
        get config() {
          return _self$.#config;
        },
        get children() {
          return web.createComponent(web.Portal, {
            mount: mountTo,
            get children() {
              return web.createComponent(Devtools, {});
            }
          });
        }
      });
    }, mountTo);
    this.#isMounted = true;
    this.#dispose = dispose;
  }
  unmount() {
    if (!this.#isMounted) {
      throw new Error("Devtools is not mounted");
    }
    this.#eventBus?.stop();
    this.#dispose?.();
    this.#isMounted = false;
  }
  setConfig(config) {
    this.#config = {
      ...this.#config,
      ...config
    };
  }
}
exports.TanStackDevtoolsCore = TanStackDevtoolsCore;
//# sourceMappingURL=core.cjs.map

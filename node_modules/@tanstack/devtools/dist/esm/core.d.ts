import { ClientEventBusConfig } from '@tanstack/devtools-event-bus/client';
import { TanStackDevtoolsConfig, TanStackDevtoolsPlugin } from './context/devtools-context.js';
export interface TanStackDevtoolsInit {
    /**
     * Configuration for the devtools shell. These configuration options are used to set the
     * initial state of the devtools when it is started for the first time. Afterwards,
     * the settings are persisted in local storage and changed through the settings panel.
     */
    config?: Partial<TanStackDevtoolsConfig>;
    /**
     * Array of plugins to be used in the devtools.
     * Each plugin has a `render` function that gives you the dom node to mount into
     *
     * Example:
     * ```ts
     *  const devtools = new TanStackDevtoolsCore({
     *    plugins: [
     *      {
     *        id: "your-plugin-id",
     *        name: "Your Plugin",
     *        render: (el) => {
     *          // Your render logic here
     *        },
     *      },
     *    ],
     *  })
     * ```
     */
    plugins?: Array<TanStackDevtoolsPlugin>;
    eventBusConfig?: ClientEventBusConfig;
}
export declare class TanStackDevtoolsCore {
    #private;
    constructor(init: TanStackDevtoolsInit);
    mount<T extends HTMLElement>(el: T): void;
    unmount(): void;
    setConfig(config: Partial<TanStackDevtoolsInit>): void;
}
export type { ClientEventBusConfig };

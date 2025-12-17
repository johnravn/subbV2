import { DevtoolsStore } from './devtools-store.cjs';
import { JSX, Setter } from 'solid-js';
export interface TanStackDevtoolsPlugin {
    /**
     * Name to be displayed in the devtools UI.
     * If a string, it will be used as the plugin name.
     * If a function, it will be called with the mount element.
     *
     * Example:
     * ```ts
     *   {
     *     // If a string, it will be used as the plugin name
     *     name: "Your Plugin",
     *     render: () => {}
     *   }
     * ```
     * or
     *
     * ```ts
     *   {
     *     // If a function, it will be called with the mount element
     *     name: (el) => {
     *       el.innerText = "Your Plugin Name"
     *       // Your name logic here
     *     },
     *     render: () => {}
     *   }
     * ```
     */
    name: string | ((el: HTMLHeadingElement) => void);
    /**
     * Unique identifier for the plugin.
     * If not provided, it will be generated based on the name.
     */
    id?: string;
    /**
     * Render the plugin UI by using the provided element. This function will be called
     * when the plugin tab is clicked and expected to be mounted.
     * @param el The mount element for the plugin.
     * @returns void
     *
     * Example:
     * ```ts
     *   render: (el) => {
     *     el.innerHTML = "<h1>Your Plugin</h1>"
     *   }
     * ```
     */
    render: (el: HTMLDivElement) => void;
}
export declare const DevtoolsContext: import('solid-js').Context<{
    store: DevtoolsStore;
    setStore: Setter<DevtoolsStore>;
} | undefined>;
interface ContextProps {
    children: JSX.Element;
    plugins?: Array<TanStackDevtoolsPlugin>;
    config?: TanStackDevtoolsConfig;
}
export type TanStackDevtoolsConfig = DevtoolsStore['settings'];
export declare const DevtoolsProvider: (props: ContextProps) => JSX.Element;
export {};

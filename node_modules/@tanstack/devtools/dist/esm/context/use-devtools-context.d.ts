import { DevtoolsStore } from './devtools-store.js';
export declare const usePlugins: () => {
    plugins: import('solid-js').Accessor<import('./devtools-context.jsx').TanStackDevtoolsPlugin[] | undefined>;
    setActivePlugin: (pluginId: string) => void;
    activePlugin: import('solid-js').Accessor<string | undefined>;
};
export declare const useDevtoolsState: () => {
    state: import('solid-js').Accessor<{
        activeTab: import('../tabs/index.jsx').TabName;
        height: number;
        activePlugin?: string | undefined;
        persistOpen: boolean;
    }>;
    setState: (newState: Partial<DevtoolsStore["state"]>) => void;
};
export declare const useDevtoolsSettings: () => {
    setSettings: (newSettings: Partial<DevtoolsStore["settings"]>) => void;
    settings: import('solid-js').Accessor<{
        defaultOpen: boolean;
        hideUntilHover: boolean;
        position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "middle-left" | "middle-right";
        panelLocation: "top" | "bottom";
        openHotkey: Array<(string & {}) | ("Alt" | "Control" | "Meta" | "Shift")>;
        requireUrlFlag: boolean;
        urlFlag: string;
    }>;
};
export declare const usePersistOpen: () => {
    persistOpen: import('solid-js').Accessor<boolean>;
    setPersistOpen: (value: boolean) => void;
};
export declare const useHeight: () => {
    height: import('solid-js').Accessor<number>;
    setHeight: (newHeight: number) => void;
};

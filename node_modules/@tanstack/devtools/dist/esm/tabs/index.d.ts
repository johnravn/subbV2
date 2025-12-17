export declare const tabs: readonly [{
    readonly name: "Plugins";
    readonly id: "plugins";
    readonly component: () => import("solid-js").JSX.Element;
    readonly icon: import("solid-js").JSX.Element;
}, {
    readonly name: "Settings";
    readonly id: "settings";
    readonly component: () => import("solid-js").JSX.Element;
    readonly icon: import("solid-js").JSX.Element;
}];
export type TabName = (typeof tabs)[number]['id'];

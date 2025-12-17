import React from "react";
export declare const IconoirContext: React.Context<Partial<React.SVGProps<SVGSVGElement>>>;
export interface IconoirProviderProps {
    iconProps?: Partial<React.SVGProps<SVGSVGElement>>;
    children: React.ReactNode;
}
export declare function IconoirProvider({ iconProps, children }: IconoirProviderProps): React.JSX.Element;

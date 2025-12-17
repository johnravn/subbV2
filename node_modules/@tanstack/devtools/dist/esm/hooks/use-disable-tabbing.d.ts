/**
 * @param isOpen A function that returns whether the devtools are open or not.
 * This is used to disable tabbing over the main devtools container while
 * the devtools are closed.
 */
export declare const useDisableTabbing: (isOpen: () => boolean) => void;

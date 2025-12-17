import { default as http } from 'node:http';
import { WebSocketServer } from 'ws';
export interface TanstackDevtoolsEvent<TEventName extends string, TPayload = any> {
    type: TEventName;
    payload: TPayload;
    pluginId?: string;
}
declare global {
    var __TANSTACK_DEVTOOLS_SERVER__: http.Server | null;
    var __TANSTACK_DEVTOOLS_WSS_SERVER__: WebSocketServer | null;
    var __EVENT_TARGET__: EventTarget | null;
}
export declare class ServerEventBus {
    #private;
    constructor({ port, debug }?: {
        port?: number | undefined;
        debug?: boolean | undefined;
    });
    private debugLog;
    private emitToServer;
    private emitEventToClients;
    private emit;
    private createSSEServer;
    private createWebSocketServer;
    private handleNewConnection;
    start(): void;
    stop(): void;
}

import WebSocket from "isomorphic-ws";
export interface EventOptions {
    autoConnect?: boolean;
    onOpen?: (event: WebSocket.Event) => void;
    onError?: (event: WebSocket.ErrorEvent) => void;
    onClose?: (event: WebSocket.CloseEvent) => void;
    onSubscribe?: (event: {
        id: string;
        params: EventParam;
    }) => void;
    protocols?: string | string[];
    wsOpts?: WebSocket.ClientOptions;
}
export interface EventParam {
    [key: string]: string;
}
export declare class ChainEventManager {
    private idCount;
    readonly url: string | URL;
    private opts;
    private ws;
    private queuedEvents;
    constructor(wsServer: string | URL, opts?: EventOptions);
    subscribe(params: EventParam | EventParam[]): void;
    unsubscribe(params: EventParam | EventParam[]): void;
    unsubscribeAll(): void;
    private _queueEvents;
    private _dequeueEvents;
    private _send;
    private wsSend;
    connect(): void;
    private _onOpen;
    private _onError;
    private _onClose;
    private _onMessage;
}

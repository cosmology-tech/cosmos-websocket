import WebSocket from "isomorphic-ws";
export interface EventOptions {
    autoConnect?: boolean;
    onOpen?: (event: WebSocket.Event) => void;
    onError?: (event: WebSocket.ErrorEvent) => void;
    onClose?: (event: WebSocket.CloseEvent) => void;
    onSubscribing?: (event: {
        id: string;
        params: EventParam;
    }) => void;
    onUnsubscribing?: (event: {
        id: string;
        params: EventParam;
    }) => void;
    onUnsubscribingAll?: () => void;
    onUnsubscribe?: (event: {
        id: string;
        params: EventParam;
    }) => void;
    onUnsubscribeAll?: () => void;
    protocols?: string | string[];
    wsOpts?: WebSocket.ClientOptions;
}
export interface EventHandler {
    method: string;
    params: EventParam;
    handler?: MessageHandler;
}
export interface EventParam {
    [key: string]: string;
}
type MessageHandler = (data: any) => void;
export declare class ChainEventManager {
    readonly url: string | URL;
    private opts;
    private ws;
    private queuedEvents;
    private eventHandlerMapping;
    constructor(wsServer: string | URL, opts?: EventOptions);
    subscribe(params: EventParam | EventParam[], handler: MessageHandler): void;
    unsubscribe(params: EventParam | EventParam[]): void;
    unsubscribeAll(): void;
    private queueEvents;
    private dequeueEvents;
    private _send;
    private wsSend;
    private sendMsgs;
    connect(): void;
    private _onOpen;
    private _onError;
    private _onClose;
    private _onMessage;
}
export {};

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
    onSubscribe?: (event: {
        id: string;
        params: EventParam;
    }) => void;
    onEventError?: (event: {
        id: string;
        method: string;
        params: EventParam;
        error: any;
    }) => void;
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
    query: string;
    [key: string]: string;
}
type MessageHandler = (data: any) => void;
export declare class ChainEventManager {
    readonly url: string | URL;
    private isUnsubscribingAll;
    private opts;
    private ws;
    private queuedEvents;
    private eventHandlerMapping;
    private queryIdMapping;
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
    private mapQueryAndId;
    private removeIdFromQueryIdMapping;
}
export {};

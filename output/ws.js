import WebSocket from "isomorphic-ws";
import { v4 as uuidv4 } from "uuid";
const METHODS = {
    SUB: "subscribe",
    UN_SUB: "unsubscribe",
    UN_SUB_ALL: "unsubscribe_all",
};
export class ChainEventManager {
    constructor(wsServer, opts) {
        this.queuedEvents = [];
        this.eventHandlerMapping = {};
        this.url = wsServer;
        this.opts = opts;
        if (this.opts?.autoConnect) {
            this.connect();
        }
    }
    subscribe(params, handler) {
        this._send(buildEventHandlers(METHODS.SUB, params, handler));
    }
    unsubscribe(params) {
        this._send(buildEventHandlers(METHODS.UN_SUB, params));
    }
    unsubscribeAll() {
        this._send([
            {
                method: METHODS.UN_SUB_ALL,
                params: {
                    query: "",
                },
            },
        ]);
    }
    queueEvents(handlers) {
        this.queuedEvents.push({
            handlers,
        });
    }
    dequeueEvents() {
        const current = this.queuedEvents.shift();
        if (current) {
            this.sendMsgs(current.handlers);
            this.dequeueEvents();
        }
    }
    _send(handlers) {
        let isConnecting = false;
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING:
                isConnecting = true;
                this.queueEvents(handlers);
                break;
            case WebSocket.OPEN:
                this.sendMsgs(handlers);
                break;
            case WebSocket.CLOSING:
            case WebSocket.CLOSED:
                throw Error("Channel has been closed.");
        }
        if (isConnecting &&
            this.queuedEvents.length &&
            this.ws.readyState === WebSocket.OPEN) {
            this.dequeueEvents();
        }
    }
    wsSend(method, id, params) {
        this.ws.send(JSON.stringify({
            method,
            params,
            id,
            jsonrpc: "2.0",
        }));
    }
    sendMsgs(handlers) {
        for (const handler of handlers) {
            const id = uuidv4().toString();
            const p = handler.params;
            const method = handler.method;
            this.eventHandlerMapping[id] = handler;
            switch (method) {
                case METHODS.SUB:
                    if (this.opts?.onSubscribing) {
                        this.opts.onSubscribing({ id, params: p });
                    }
                    break;
                case METHODS.UN_SUB:
                    if (this.opts?.onUnsubscribing) {
                        this.opts.onUnsubscribing({ params: p });
                    }
                    break;
                case METHODS.UN_SUB_ALL:
                    if (this.opts?.onUnsubscribingAll) {
                        this.opts.onUnsubscribingAll();
                    }
                    break;
            }
            this.wsSend(method, id, p);
        }
    }
    connect() {
        this.ws = new WebSocket(this.url, this.opts?.protocols, this.opts?.wsOpts);
        this.ws.onopen = this._onOpen.bind(this);
        this.ws.onerror = this._onError.bind(this);
        this.ws.onmessage = this._onMessage.bind(this);
        this.ws.onclose = this._onClose.bind(this);
    }
    _onOpen(event) {
        this.dequeueEvents();
        if (this.opts?.onOpen) {
            this.opts.onOpen(event);
        }
    }
    _onError(event) {
        if (this.opts?.onError) {
            this.opts.onError(event);
        }
    }
    _onClose(event) {
        if (this.opts?.onClose) {
            this.opts.onClose(event);
        }
    }
    _onMessage(event) {
        const data = JSON.parse(event.data);
        const eventHandler = this.eventHandlerMapping[data.id];
        switch (eventHandler.method) {
            case METHODS.SUB:
                if (eventHandler.handler) {
                    eventHandler.handler(data);
                }
                else {
                    console.log(data);
                    console.log(eventHandler);
                }
                break;
            case METHODS.UN_SUB:
                if (this.opts?.onUnsubscribe) {
                    this.opts.onUnsubscribe({ params: eventHandler.params });
                }
                break;
            case METHODS.UN_SUB_ALL:
                if (this.opts?.onUnsubscribeAll) {
                    this.opts.onUnsubscribeAll();
                }
                break;
        }
    }
}
function buildEventHandlers(method, params, handler) {
    return Array.isArray(params)
        ? params.map((param) => ({ method, params: param, handler }))
        : [{ method, params, handler }];
}

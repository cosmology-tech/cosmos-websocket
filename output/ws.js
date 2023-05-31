import WebSocket from "isomorphic-ws";
import { v4 as uuidv4 } from "uuid";
const METHODS = {
    SUB: "subscribe",
    UN_SUB: "unsubscribe",
    UN_SUB_ALL: "unsubscribe_all",
};
export class ChainEventManager {
    constructor(wsServer, opts) {
        this.idCount = 0;
        this.queuedEvents = [];
        this.url = wsServer;
        this.opts = opts;
        if (this.opts?.autoConnect) {
            this.connect();
        }
    }
    subscribe(params) {
        this._send(METHODS.SUB, Array.isArray(params) ? params : [params]);
    }
    unsubscribe(params) {
        this._send(METHODS.UN_SUB, Array.isArray(params) ? params : [params]);
    }
    unsubscribeAll() {
        this._send(METHODS.UN_SUB_ALL, [
            {
                query: "",
            },
        ]);
    }
    _queueEvents(method, params) {
        this.queuedEvents.push({
            method,
            params,
        });
    }
    _dequeueEvents() {
        const current = this.queuedEvents.shift();
        if (current) {
            this.wsSend(current.method, current.params);
            this._dequeueEvents();
        }
    }
    _send(method, params) {
        let isConnecting = false;
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING:
                isConnecting = true;
                this._queueEvents(method, params);
                break;
            case WebSocket.OPEN:
                this.wsSend(method, params);
                break;
            case WebSocket.CLOSING:
            case WebSocket.CLOSED:
                throw Error("Channel has been closed.");
        }
        if (isConnecting &&
            this.queuedEvents.length &&
            this.ws.readyState === WebSocket.OPEN) {
            this._dequeueEvents();
        }
    }
    wsSend(method, params) {
        for (const p of params) {
            const id = uuidv4().toString();
            this.ws.send(JSON.stringify({
                method: method,
                params: p,
                id: id,
                jsonrpc: "2.0",
            }));
            switch (method) {
                case METHODS.SUB:
                    if (this.opts?.onSubscribe) {
                        this.opts.onSubscribe({ id, params: p });
                    }
                    break;
                case METHODS.UN_SUB:
                    if (this.opts?.onUnsubscribe) {
                        this.opts.onUnsubscribe({ params: p });
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
    connect() {
        this.ws = new WebSocket(this.url, this.opts?.protocols, this.opts?.wsOpts);
        this.ws.onopen = this._onOpen.bind(this);
        this.ws.onerror = this._onError.bind(this);
        this.ws.onmessage = this._onMessage.bind(this);
        this.ws.onclose = this._onClose.bind(this);
    }
    _onOpen(event) {
        this._dequeueEvents();
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
        console.log(event.data);
    }
}

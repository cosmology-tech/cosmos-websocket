import WebSocket from "isomorphic-ws";

export interface EventOptions {
  autoConnect?: boolean;

  onOpen?: (event: WebSocket.Event) => void;
  onError?: (event: WebSocket.ErrorEvent) => void;
  onClose?: (event: WebSocket.CloseEvent) => void;
  onSubscribe?: (event: { id: string; params: EventParam }) => void;

  protocols?: string | string[];
  wsOpts?: WebSocket.ClientOptions;
}

//TODO:: sub with handler
export interface EventParam {
  [key: string]: string;
}

const METHODS = {
  SUB: "subscribe",
  UN_SUB: "unsubscribe",
  UN_SUB_ALL: "unsubscribe_all",
};

export class ChainEventManager {
  private idCount: number = 0;
  readonly url: string | URL;
  private opts: EventOptions;
  private ws: WebSocket;
  private queuedEvents: { method: string; params: EventParam[] }[] = [];

  constructor(wsServer: string | URL, opts?: EventOptions) {
    this.url = wsServer;
    this.opts = opts;

    if (this.opts?.autoConnect) {
      this.connect();
    }
  }

  subscribe(params: EventParam | EventParam[]) {
    this._send(METHODS.SUB, Array.isArray(params) ? params : [params]);
  }

  unsubscribe(params: EventParam | EventParam[]) {
    this._send(METHODS.UN_SUB, Array.isArray(params) ? params : [params]);
  }

  unsubscribeAll() {
    this._send(METHODS.UN_SUB_ALL, [
      {
        query: "",
      },
    ]);
  }

  private _queueEvents(method: string, params: EventParam[]) {
    this.queuedEvents.push({
      method,
      params,
    });
  }

  private _dequeueEvents() {
    const current = this.queuedEvents.shift();

    if (current) {
      this.wsSend(current.method, current.params);
      this._dequeueEvents();
    }
  }

  private _send(method: string, params: EventParam[]) {
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

    if (
      isConnecting &&
      this.queuedEvents.length &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      this._dequeueEvents();
    }
  }

  private wsSend(method: string, params: EventParam[]) {
    for (const p of params) {
      const currentId = this.idCount++;
      this.ws.send(
        JSON.stringify({
          method: method,
          params: p,
          id: currentId.toString(),
          jsonrpc: "2.0",
        })
      );
    }
  }

  connect() {
    this.ws = new WebSocket(this.url, this.opts?.protocols, this.opts?.wsOpts);

    this.ws.onopen = this._onOpen.bind(this);
    this.ws.onerror = this._onError.bind(this);
    this.ws.onmessage = this._onMessage.bind(this);
    this.ws.onclose = this._onClose.bind(this);
  }

  private _onOpen(event: WebSocket.Event) {
    this._dequeueEvents();
    if (this.opts?.onOpen) {
      this.opts.onOpen(event);
    }
  }

  private _onError(event: WebSocket.ErrorEvent) {
    if (this.opts?.onError) {
      this.opts.onError(event);
    }
  }

  private _onClose(event: WebSocket.CloseEvent) {
    if (this.opts?.onClose) {
      this.opts.onClose(event);
    }
  }

  private _onMessage(event: WebSocket.MessageEvent) {
    console.log(event.data);
  }
}

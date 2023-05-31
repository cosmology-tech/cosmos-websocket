import WebSocket from "isomorphic-ws";
import { v4 as uuidv4 } from "uuid";

export interface EventOptions {
  autoConnect?: boolean;

  onOpen?: (event: WebSocket.Event) => void;
  onError?: (event: WebSocket.ErrorEvent) => void;
  onClose?: (event: WebSocket.CloseEvent) => void;
  onSubscribing?: (event: { id: string; params: EventParam }) => void;
  onUnsubscribing?: (event: { params: EventParam }) => void;
  onUnsubscribingAll?: () => void;

  onUnsubscribe?: (event: { params: EventParam }) => void;
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

const METHODS = {
  SUB: "subscribe",
  UN_SUB: "unsubscribe",
  UN_SUB_ALL: "unsubscribe_all",
};

//TODO:: handle error case
type MessageHandler = (data: any) => void;

export class ChainEventManager {
  readonly url: string | URL;
  private opts: EventOptions;
  private ws: WebSocket;
  private queuedEvents: {
    handlers: EventHandler[];
  }[] = [];
  private eventHandlerMapping: {
    [key: string]: EventHandler;
  } = {};

  constructor(wsServer: string | URL, opts?: EventOptions) {
    this.url = wsServer;
    this.opts = opts;

    if (this.opts?.autoConnect) {
      this.connect();
    }
  }

  subscribe(params: EventParam | EventParam[], handler: MessageHandler) {
    this._send(buildEventHandlers(METHODS.SUB, params, handler));
  }

  unsubscribe(params: EventParam | EventParam[]) {
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

  private queueEvents(handlers: EventHandler[]) {
    this.queuedEvents.push({
      handlers,
    });
  }

  private dequeueEvents() {
    const current = this.queuedEvents.shift();

    if (current) {
      this.sendMsgs(current.handlers);
      this.dequeueEvents();
    }
  }

  private _send(handlers: EventHandler[]) {
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

    if (
      isConnecting &&
      this.queuedEvents.length &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      this.dequeueEvents();
    }
  }

  private wsSend(method: string, id: string, params: EventParam) {
    this.ws.send(
      JSON.stringify({
        method,
        params,
        id,
        jsonrpc: "2.0",
      })
    );
  }

  private sendMsgs(handlers: EventHandler[]) {
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

  private _onOpen(event: WebSocket.Event) {
    this.dequeueEvents();
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
    const data = JSON.parse(event.data);

    const eventHandler = this.eventHandlerMapping[data.id];

    switch (eventHandler.method) {
      case METHODS.SUB:
        if (eventHandler.handler) {
          eventHandler.handler(data);
        } else {
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

function buildEventHandlers(
  method: string,
  params: EventParam | EventParam[],
  handler?: MessageHandler
): EventHandler[] {
  return Array.isArray(params)
    ? params.map((param) => ({ method, params: param, handler }))
    : [{ method, params, handler }];
}

import WebSocket from "isomorphic-ws";
import { v4 as uuidv4 } from "uuid";

export interface EventOptions {
  autoConnect?: boolean;

  onOpen?: (event: WebSocket.Event) => void;
  onError?: (event: WebSocket.ErrorEvent) => void;
  onClose?: (event: WebSocket.CloseEvent) => void;

  onSubscribing?: (event: { id: string; params: EventParam }) => void;
  onUnsubscribing?: (event: { id: string; params: EventParam }) => void;
  onUnsubscribingAll?: () => void;

  onSubscribe?: (event: { id: string; params: EventParam }) => void;
  onEventError?: (event: {
    id: string;
    method: string;
    params: EventParam;
    error: any;
  }) => void;
  onUnsubscribe?: (event: { id: string; params: EventParam }) => void;
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

const METHODS = {
  SUB: "subscribe",
  UN_SUB: "unsubscribe",
  UN_SUB_ALL: "unsubscribe_all",
};

type MessageHandler = (data: any) => void;

export class ChainEventManager {
  readonly url: string | URL;
  private isUnsubscribingAll = false;
  private opts: EventOptions;
  private ws: WebSocket;
  private queuedEvents: {
    handlers: EventHandler[];
  }[] = [];
  private eventHandlerMapping: {
    [key: string]: EventHandler;
  } = {};
  private queryIdMapping: {
    [key: string]: string[];
  } = {};

  constructor(wsServer: string | URL, opts?: EventOptions) {
    this.url = wsServer;
    this.opts = opts;

    if (this.opts?.autoConnect) {
      this.connect();
    }
  }

  subscribe(params: EventParam | EventParam[], handler: MessageHandler) {
    if (this.isUnsubscribingAll) {
      throw new Error("unsubscribing all, can't subscribe now.");
    }

    this._send(buildEventHandlers(METHODS.SUB, params, handler));
  }

  unsubscribe(params: EventParam | EventParam[]) {
    if (this.isUnsubscribingAll) {
      throw new Error("unsubscribing all, can't unsubscribe now.");
    }

    this._send(buildEventHandlers(METHODS.UN_SUB, params));
  }

  unsubscribeAll() {
    if (this.isUnsubscribingAll) {
      throw new Error("unsubscribing all already, don't repeat.");
    }

    this.isUnsubscribingAll = true;
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

          this.mapQueryAndId(p.query, id);

          break;

        case METHODS.UN_SUB:
          if (this.opts?.onUnsubscribing) {
            this.opts.onUnsubscribing({ id, params: p });
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

    if (data.error) {
      this.eventHandlerMapping[data.id] = undefined;
      this.removeIdFromQueryIdMapping(eventHandler.params.query, data.id);

      if (this.opts?.onEventError) {
        this.opts.onEventError({
          id: data.id,
          method: eventHandler.method,
          params: eventHandler.params,
          error: data.error,
        });
      }
    } else {
      switch (eventHandler.method) {
        case METHODS.SUB:
          if (JSON.stringify(data.result) === "{}") {
            if (this.opts?.onSubscribe) {
              this.opts.onSubscribe({
                id: data.id,
                params: eventHandler.params,
              });
            }
          } else {
            if (eventHandler.handler) {
              eventHandler.handler(data.result);
            }
          }

          break;

        case METHODS.UN_SUB:
          this.eventHandlerMapping[data.id] = undefined;

          const originSubIds = this.queryIdMapping[eventHandler.params.query];

          for (const subId of originSubIds) {
            this.eventHandlerMapping[subId] = undefined;
          }

          this.queryIdMapping[eventHandler.params.query] = undefined;

          if (this.opts?.onUnsubscribe) {
            this.opts.onUnsubscribe({
              id: data.id,
              params: eventHandler.params,
            });
          }

          break;

        case METHODS.UN_SUB_ALL:
          this.eventHandlerMapping = {};
          this.queryIdMapping = {};

          if (this.opts?.onUnsubscribeAll) {
            this.opts.onUnsubscribeAll();
          }
          break;
      }
    }

    if (eventHandler.method == METHODS.UN_SUB_ALL) {
      this.isUnsubscribingAll = false;
    }
  }

  private mapQueryAndId(query: string, id: string) {
    if (!this.queryIdMapping[query]) {
      this.queryIdMapping[query] = [];
    }

    this.queryIdMapping[query].push(id);
  }

  private removeIdFromQueryIdMapping(query: string, id: string) {
    if (!this.queryIdMapping[query]) {
      return;
    }

    this.queryIdMapping[query] = this.queryIdMapping[query].filter(
      (item) => item !== id
    );
  }
}

function buildEventHandlers(
  method: string,
  params: EventParam | EventParam[],
  handler?: MessageHandler
): EventHandler[] {
  return Array.isArray(params)
    ? params.map(({ query, ...param }) => ({
        method,
        params: { query: query.trim(), ...param },
        handler,
      }))
    : [{ method, params, handler }];
}

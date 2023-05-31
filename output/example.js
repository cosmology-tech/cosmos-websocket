import { ChainEventManager } from "./ws.js";
const manager = new ChainEventManager("ws://seed1.bitcanna.io:26657/websocket", {
    onOpen: () => {
        console.log("bitcanna.io connected!");
    },
    onSubscribe: (event) => {
        console.log(`sub ${event.id}:${event.params["query"]}`);
    },
    onUnsubscribe: (event) => {
        console.log(`unsub ${event.params["query"]}`);
    },
    onUnsubscribeAll: () => {
        console.log("unsub all.");
    },
});
manager.connect();
manager.subscribe({
    query: "tm.event='NewBlock'",
});
//unsubscribe after 15 sec
mockSend(() => {
    manager.unsubscribe({
        query: "tm.event='NewBlock'",
    });
    //subscribe other two events after 15 sec
    mockSend(() => {
        manager.subscribe({
            query: "message.action='send'",
        });
    });
    mockSend(() => {
        manager.subscribe({
            query: "tm.event = 'Tx' AND tx.height = 5",
        });
        //unsubscribeAll after 15 sec
        mockSend(() => {
            manager.unsubscribeAll();
        });
    });
});
function mockSend(method) {
    setTimeout(method, 15 * 1000);
}

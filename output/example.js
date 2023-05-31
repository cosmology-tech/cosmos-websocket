import { ChainEventManager } from "./ws.js";
const manager = new ChainEventManager("ws://seed1.bitcanna.io:26657/websocket", {
    onOpen: () => {
        console.log("bitcanna.io connected!");
    },
    onSubscribing: (event) => {
        console.log(`Subscribing ${event.id}:${event.params["query"]}`);
    },
    onUnsubscribing: (event) => {
        console.log(`Unsubscribing ${event.params["query"]}`);
    },
    onUnsubscribe: (event) => {
        console.log(`Unsubscribing ${event.params["query"]} done`);
    },
    onUnsubscribingAll: () => {
        console.log("Unsubscribing all.");
    },
    onUnsubscribeAll: () => {
        console.log("Unsubscribing all Done.");
    },
});
manager.connect();
manager.subscribe({
    query: "tm.event='NewBlock'",
}, commonMessageHandler);
//unsubscribe after 15 sec
mockSend(() => {
    manager.unsubscribe({
        query: "tm.event='NewBlock'",
    });
    //subscribe other two events after 15 sec
    mockSend(() => {
        manager.subscribe({
            query: "message.action='send'",
        }, commonMessageHandler);
    });
    mockSend(() => {
        manager.subscribe({
            query: "tm.event = 'Tx' AND tx.height = 5",
        }, commonMessageHandler);
        //unsubscribeAll after 15 sec
        mockSend(() => {
            manager.unsubscribeAll();
        });
    });
});
function mockSend(method) {
    setTimeout(method, 15 * 1000);
}
function commonMessageHandler(data) {
    console.log(data);
}

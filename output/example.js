import { ChainEventManager } from "./ws.js";
const manager = new ChainEventManager("ws://seed1.bitcanna.io:26657/websocket", {
    onOpen: () => {
        console.log("bitcanna.io connected!");
    },
});
manager.connect();
manager.subscribe({
    query: "tm.event='NewBlock'",
});
setTimeout(() => {
    // manager.unsubscribe({
    //   query: "tm.event='NewBlock'",
    // });
    manager.unsubscribeAll();
}, 15 * 1000);

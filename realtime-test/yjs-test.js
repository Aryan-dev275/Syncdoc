const Y = require("yjs");

const userA = new Y.Doc();
const userB = new Y.Doc();

const textA = userA.getText("document");
const textB = userB.getText("document");

// User A makes a change
textA.insert(0, "Hello ");

// User B makes a change
textB.insert(0, "SyncDoc");

console.log("Before sync:");
console.log("User A:", textA.toString());
console.log("User B:", textB.toString());

// Synchronize A → B
const updateA = Y.encodeStateAsUpdate(userA);
Y.applyUpdate(userB, updateA);

// Synchronize B → A
const updateB = Y.encodeStateAsUpdate(userB);
Y.applyUpdate(userA, updateB);

console.log("\nAfter sync:");
console.log("User A:", textA.toString());
console.log("User B:", textB.toString());
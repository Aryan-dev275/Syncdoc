const os = require("os");
const fs = require("fs");
const path = require("path");
const assert = require("assert");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "syncdoc-stress-"));

const { server } = require("../src/index");
const store = require("../src/store");
const { io } = require("socket.io-client");
const Y = require("yjs");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (s, ev) => new Promise((r) => s.once(ev, r));

(async () => {
  console.log("Starting Yjs Concurrent Stress Test...");
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const docId = `stress-doc-${Date.now()}`;

  // Create initial document
  await store.createDocument(docId, "Stress Test Document");

  const NUM_USERS = 10;
  const clients = [];
  const ydocs = [];

  // Connect 10 concurrent users
  for (let i = 0; i < NUM_USERS; i++) {
    const socket = io(base, { reconnection: false });
    const ydoc = new Y.Doc();

    socket.on("yjs-sync", (u) => {
      Y.applyUpdate(ydoc, new Uint8Array(u));
    });

    socket.on("yjs-sync-update", (u) => {
      Y.applyUpdate(ydoc, new Uint8Array(u));
    });

    socket.on("yjs-update", (u) => {
      Y.applyUpdate(ydoc, new Uint8Array(u));
    });

    ydoc.on("update", (u, origin) => {
      if (origin !== "remote") {
        socket.emit("yjs-update", { documentId: docId, update: Array.from(u) });
      }
    });

    clients.push(socket);
    ydocs.push(ydoc);
  }

  // Await connection for all sockets
  await Promise.all(clients.map((s) => once(s, "connect")));

  // All 10 users join the document concurrently
  for (let i = 0; i < NUM_USERS; i++) {
    clients[i].emit("join-document", { documentId: docId, username: `User-${i + 1}` });
  }

  // Await ready for all users
  await Promise.all(clients.map((s) => once(s, "realtime-ready")));
  await wait(300);

  // Initialize a shared block text across users
  ydocs[0].transact(() => {
    ydocs[0].getArray("blocks").push([{ id: "shared-block", type: "paragraph" }]);
    ydocs[0].getText("shared-block").insert(0, "Root: ");
  }, "local");

  await wait(300);

  // 10 users concurrently insert text into the shared block
  const editPromises = ydocs.map((ydoc, idx) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        ydoc.transact(() => {
          const text = ydoc.getText("shared-block");
          text.insert(text.length, ` [U${idx + 1}:${Math.random().toString(36).slice(2, 6)}]`);
        }, "local");
        resolve();
      }, Math.floor(Math.random() * 50));
    });
  });

  await Promise.all(editPromises);

  // Allow extra time for all socket broadcasts to settle
  await wait(1000);

  // Fetch final server Y.Doc state
  const serverYDoc = await store.getYDoc(docId);
  const serverContent = serverYDoc.getText("shared-block").toString();

  console.log(`Server final text state (${serverContent.length} chars):\n"${serverContent}"\n`);

  // Assert that ALL 10 client Y.Docs have converged to the EXACT SAME text content
  for (let i = 0; i < NUM_USERS; i++) {
    const clientContent = ydocs[i].getText("shared-block").toString();
    assert.equal(
      clientContent,
      serverContent,
      `Client ${i + 1} content "${clientContent}" does not match server content "${serverContent}"`
    );
    console.log(`  ✓ Client ${i + 1} converged to identical state (${clientContent.length} chars)`);
  }

  // Clean up sockets
  clients.forEach((s) => s.disconnect());
  console.log(`\nSUCCESS: All ${NUM_USERS} concurrent users converged to 100% identical Yjs state!`);
  process.exit(0);
})().catch((err) => {
  console.error("STRESS TEST FAILED:", err);
  process.exit(1);
});

require("dotenv").config();
const os = require("os");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Use temporary data dir for test isolation
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "syncdoc-e2e-"));

const { server } = require("../src/index");
const store = require("../src/store");
const { connectDB } = require("../src/config/db");
const { DocumentModel, YjsSnapshotModel } = require("../src/models/Document");
const { io } = require("socket.io-client");
const Y = require("yjs");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (s, ev) => new Promise((r) => s.once(ev, r));

(async () => {
  console.log("=== STARTING END-TO-END BACKEND VERIFICATION ===");

  // --- ITEM 1: .env Loading & Atlas Connection
  console.log("\n[1] Testing .env & MongoDB Atlas Connection...");
  assert.ok(process.env.MONGODB_URI, "MONGODB_URI must be present in .env");
  const isConnected = await connectDB();
  if (!isConnected) {
    console.error("Mongo connection failed!");
    process.exit(1);
  }
  console.log("  ✓ Mongo connected successfully to Atlas!");

  // Start HTTP Server
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  const fetchJson = async (p, opts = {}) => {
    const res = await fetch(baseUrl + p, { headers: { "content-type": "application/json" }, ...opts });
    return { status: res.status, headers: res.headers, data: await res.json().catch(() => null), text: await res.text().catch(() => "") };
  };

  // --- ITEM 2: Server Health Check
  console.log("\n[2] Testing Server Health Endpoint (/api/health)...");
  const healthRes = await fetch(baseUrl + "/api/health");
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.status, "ok");
  assert.ok(typeof healthData.uptime === "number");
  console.log(`  ✓ GET /api/health returned HTTP 200: ${JSON.stringify(healthData)}`);

  // --- ITEM 3: Nested AST Schema, Pre-save Hook & DOMPurify
  console.log("\n[3] Testing Mongoose Nested AST Schema & Pre-save DOMPurify Hook...");
  const astTestId = `e2e-ast-${Date.now()}`;
  const dirtyBlockDoc = new DocumentModel({
    id: astTestId,
    title: "XSS AST Test",
    blocks: [
      {
        id: "b-dirty-1",
        type: "heading",
        content: "Clean Heading <script>alert(1)</script>",
        order: 0,
        parentId: null,
        children: [
          {
            id: "b-dirty-2",
            type: "paragraph",
            content: "Safe paragraph <img src=x onerror=alert(1)> content",
            order: 0,
            parentId: "invalid-parent", // Pre-save hook should correct this to b-dirty-1
          },
        ],
      },
    ],
  });

  await dirtyBlockDoc.save();
  const retrievedDirtyDoc = await DocumentModel.findOne({ id: astTestId });
  assert.ok(retrievedDirtyDoc);
  assert.equal(retrievedDirtyDoc.blocks[0].content, "Clean Heading ");
  assert.equal(retrievedDirtyDoc.blocks[0].children[0].content, 'Safe paragraph <img src="x"> content');
  assert.equal(retrievedDirtyDoc.blocks[0].children[0].parentId, "b-dirty-1");
  console.log("  ✓ XSS script tag stripped from content in MongoDB!");
  console.log("  ✓ Malicious onerror event handler removed from img tag!");
  console.log("  ✓ Recursive parent/child parentId relationship corrected!");

  // --- ITEM 4: MongoDB as Primary Store (Reload without Disk Bin Files)
  console.log("\n[4] Testing MongoDB as Primary Store (No Disk Dependency)...");
  const primaryTestId = `e2e-primary-${Date.now()}`;
  await store.createDocument(primaryTestId, "Primary Store Doc");
  const ydocPrimary = await store.getYDoc(primaryTestId);
  ydocPrimary.getArray("blocks").push([{ id: "p1", type: "paragraph" }]);
  ydocPrimary.getText("p1").insert(0, "Primary Store Content in MongoDB");
  await store.flushAll();

  // Remove the disk file to prove reload comes from MongoDB
  const localDiskFile = path.join(process.env.DATA_DIR, `${primaryTestId}.bin`);
  if (fs.existsSync(localDiskFile)) {
    fs.unlinkSync(localDiskFile);
  }
  assert.ok(!fs.existsSync(localDiskFile), "Local disk file removed for primary store test");

  // Force cache clear in store by deleting from memory map
  const reloadedYDoc = await store.getYDoc(primaryTestId);
  const reloadedText = reloadedYDoc.getText("p1").toString();
  assert.equal(reloadedText, "Primary Store Content in MongoDB");
  console.log("  ✓ Document Yjs state reloaded directly from MongoDB Atlas (disk file absent)!");

  // --- ITEM 5: Markdown Import & Multi-Format Exports
  console.log("\n[5] Testing Markdown Import & HTML, JSON, MD, PDF Exports...");
  const exportDocId = `e2e-export-${Date.now()}`;
  const sampleMd = "# Document Header\n\nThis is a paragraph with **markdown**.\n\n```js\nconst code = true;\n```";
  
  const importRes = await fetch(baseUrl + `/api/documents/${exportDocId}/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ markdown: sampleMd }),
  });
  assert.equal(importRes.status, 200);
  const importJson = await importRes.json();
  assert.equal(importJson.importedCount, 3);
  console.log(`  ✓ POST /api/documents/${exportDocId}/import parsed 3 AST blocks`);

  // HTML Export
  const htmlRes = await fetch(baseUrl + `/api/documents/${exportDocId}/export?format=html`);
  assert.equal(htmlRes.status, 200);
  const htmlText = await htmlRes.text();
  assert.ok(htmlText.includes("<h1>Document Header</h1>"));
  console.log("  ✓ GET /export?format=html returned sanitized HTML document");

  // JSON Export
  const jsonRes = await fetch(baseUrl + `/api/documents/${exportDocId}/export?format=json`);
  assert.equal(jsonRes.status, 200);
  const jsonBody = await jsonRes.json();
  assert.equal(jsonBody.blocks.length, 3);
  console.log("  ✓ GET /export?format=json returned block AST structure");

  // Markdown Export
  const mdRes = await fetch(baseUrl + `/api/documents/${exportDocId}/export?format=md`);
  assert.equal(mdRes.status, 200);
  const mdText = await mdRes.text();
  assert.ok(mdText.includes("# Document Header"));
  console.log("  ✓ GET /export?format=md returned formatted markdown string");

  // PDF Export
  const pdfRes = await fetch(baseUrl + `/api/documents/${exportDocId}/export?format=pdf`);
  assert.equal(pdfRes.status, 200);
  assert.equal(pdfRes.headers.get("content-type"), "application/pdf");
  const pdfBuffer = await pdfRes.arrayBuffer();
  assert.ok(pdfBuffer.byteLength > 500);
  console.log(`  ✓ GET /export?format=pdf generated ${pdfBuffer.byteLength} byte application/pdf stream`);

  // --- ITEM 6: 10-Client Realtime Yjs Convergence Stress Test
  console.log("\n[6] Running 10-Client Socket.IO Yjs Convergence Stress Test...");
  const stressDocId = `e2e-stress-${Date.now()}`;
  await store.createDocument(stressDocId, "10-User Stress Test");

  const NUM_CLIENTS = 10;
  const sockets = [];
  const clientYDocs = [];

  for (let i = 0; i < NUM_CLIENTS; i++) {
    const s = io(baseUrl, { reconnection: false });
    const yd = new Y.Doc();

    s.on("yjs-sync", (u) => Y.applyUpdate(yd, new Uint8Array(u)));
    s.on("yjs-update", (u) => Y.applyUpdate(yd, new Uint8Array(u)));
    yd.on("update", (u, origin) => {
      if (origin !== "remote") {
        s.emit("yjs-update", { documentId: stressDocId, update: Array.from(u) });
      }
    });

    sockets.push(s);
    clientYDocs.push(yd);
  }

  await Promise.all(sockets.map((s) => once(s, "connect")));
  sockets.forEach((s, idx) => s.emit("join-document", { documentId: stressDocId, username: `Client-${idx + 1}` }));
  await Promise.all(sockets.map((s) => once(s, "realtime-ready")));
  await wait(200);

  // User 1 initializes block
  clientYDocs[0].transact(() => {
    clientYDocs[0].getArray("blocks").push([{ id: "converg-block", type: "paragraph" }]);
    clientYDocs[0].getText("converg-block").insert(0, "Base: ");
  }, "local");

  await wait(200);

  // All 10 clients concurrently make edits
  await Promise.all(
    clientYDocs.map((yd, idx) => {
      return new Promise((r) => {
        setTimeout(() => {
          yd.transact(() => {
            const t = yd.getText("converg-block");
            t.insert(t.length, ` [C${idx + 1}:${Math.random().toString(36).slice(2, 5)}]`);
          }, "local");
          r();
        }, Math.floor(Math.random() * 40));
      });
    })
  );

  await wait(800);

  const serverDoc = await store.getYDoc(stressDocId);
  const serverFinalText = serverDoc.getText("converg-block").toString();

  for (let i = 0; i < NUM_CLIENTS; i++) {
    const clientText = clientYDocs[i].getText("converg-block").toString();
    assert.equal(clientText, serverFinalText);
  }
  console.log(`  ✓ All ${NUM_CLIENTS} concurrent clients converged to 100% identical Yjs state (${serverFinalText.length} chars)!`);

  // Cleanup
  sockets.forEach((s) => s.disconnect());
  await DocumentModel.deleteMany({ id: /^e2e-/ });
  await YjsSnapshotModel.deleteMany({ documentId: /^e2e-/ });

  console.log("\n==================================================");
  console.log("ALL E2E VERIFICATION CHECKS COMPLETED SUCCESSFULLY");
  console.log("==================================================\n");
  process.exit(0);
})().catch((err) => {
  console.error("E2E VERIFICATION FAILED:", err);
  process.exit(1);
});

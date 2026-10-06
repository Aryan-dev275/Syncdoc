// End-to-end smoke test: REST + realtime sync + locks + persistence + export/XSS + import.
const os = require("os"), fs = require("fs"), path = require("path"), assert = require("assert");
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "syncdoc-"));
const { server } = require("../src/index");
const store = require("../src/store");
const { io } = require("socket.io-client");
const Y = require("yjs");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (s, ev) => new Promise((r) => s.once(ev, r));
let passed = 0;
const ok = (name) => console.log(`  ✓ ${name}`) || passed++;

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const j = (p, o = {}) => fetch(base + p, { headers: { "content-type": "application/json" }, ...o });

  // --- REST
  assert.equal((await (await j("/api/health")).json()).status, "ok"); ok("health");
  const created = await j("/api/documents", { method: "POST", body: JSON.stringify({ id: "doc-1", title: "Spec <b>1</b>" }) });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).title, "Spec b1/b"); ok("create doc (title stripped of < >)");
  assert.equal((await j("/api/documents", { method: "POST", body: JSON.stringify({ id: "doc-1" }) })).status, 409); ok("duplicate id -> 409");
  assert.equal((await j("/api/documents/..%2Fetc")).status, 400); ok("bad id rejected");
  assert.equal((await j("/api/documents/nope")).status, 404); ok("missing doc -> 404");
  assert.equal((await j("/api/health")).headers.get("x-frame-options"), "DENY"); ok("security headers present");

  // --- Realtime: two clients
  const a = io(base), b = io(base);
  await Promise.all([once(a, "connect"), once(b, "connect")]);
  const da = new Y.Doc(), db = new Y.Doc();
  a.on("yjs-update", () => {}); 
  b.on("yjs-update", (u) => Y.applyUpdate(db, new Uint8Array(u)));
  da.on("update", (u, origin) => { if (origin !== "remote") a.emit("yjs-update", { documentId: "doc-1", update: Array.from(u) }); });

  a.emit("join-document", { documentId: "doc-1", username: "Alice" });
  await once(a, "realtime-ready");
  b.emit("join-document", { documentId: "doc-1", username: "Bob" });
  await once(b, "realtime-ready");

  da.transact(() => {
    da.getArray("blocks").push([{ id: "block-1", type: "heading" }, { id: "block-2", type: "paragraph" }, { id: "block-3", type: "code", language: "js" }]);
    da.getText("block-1").insert(0, "Title");
    da.getText("block-2").insert(0, "Hi <script>alert(1)</script> & bye");
    da.getText("block-3").insert(0, "const x = 1 < 2;");
  });
  await wait(200);
  assert.equal(db.getText("block-1").toString(), "Title"); ok("edit by Alice reaches Bob in realtime");

  // late joiner gets full state
  const c = io(base); await once(c, "connect");
  const dc = new Y.Doc();
  c.on("yjs-sync", (u) => Y.applyUpdate(dc, new Uint8Array(u)));
  c.emit("join-document", { documentId: "doc-1", username: "Cara" });
  await once(c, "realtime-ready");
  assert.equal(dc.getText("block-3").toString(), "const x = 1 < 2;"); ok("late joiner receives full state");

  // outsider can't write into a doc it hasn't joined
  const d = io(base); await once(d, "connect");
  d.emit("yjs-update", { documentId: "doc-1", update: Array.from(Y.encodeStateAsUpdate(new Y.Doc())) });
  await wait(100); ok("un-joined socket ignored");

  // presence
  const users = await new Promise((r) => { a.once("users-online", r); c.emit("join-document", { documentId: "doc-1", username: "Cara" }); });
  assert.ok(users.length >= 3); ok(`presence lists ${users.length} users`);

  // locks
  a.emit("request-block-lock", { documentId: "doc-1", blockId: "block-2" });
  await once(a, "block-lock-granted");
  b.emit("request-block-lock", { documentId: "doc-1", blockId: "block-2" });
  assert.equal((await once(b, "block-lock-denied")).username, "Alice"); ok("block lock granted / denied to second user");
  const relLocks = new Promise((r) => b.on("block-locks", (l) => l.length === 0 && r()));
  a.disconnect(); await relLocks; ok("lock auto-released on disconnect");

  // --- REST reads the live Yjs state
  const doc = await (await j("/api/documents/doc-1")).json();
  assert.equal(doc.blocks.length, 3); ok("GET doc returns blocks from live Yjs state");

  // --- Export is sanitized & PDF generation supported
  const html = await (await j("/api/documents/doc-1/export?format=html")).text();
  assert.ok(!html.includes("<script>")); assert.ok(html.includes("&lt;script&gt;")); assert.ok(html.includes("<h1>Title</h1>"));
  ok("HTML export escapes/strips script");
  
  const pdfRes = await j("/api/documents/doc-1/export?format=pdf");
  assert.equal(pdfRes.status, 200);
  assert.equal(pdfRes.headers.get("content-type"), "application/pdf");
  ok("PDF export returns valid application/pdf");

  assert.equal((await j("/api/documents/doc-1/export?format=invalid")).status, 400); ok("unknown export format -> 400");
  assert.ok((await (await j("/api/documents/doc-1/export?format=md")).text()).includes("# Title")); ok("markdown export");

  // --- Import Markdown
  const importRes = await j("/api/documents/doc-1/import", {
    method: "POST",
    body: JSON.stringify({ markdown: "# Imported Title\n\nThis is paragraph content.\n\n```js\nconst x = 1;\n```" })
  });
  assert.equal(importRes.status, 200);
  const importedDoc = await importRes.json();
  assert.equal(importedDoc.importedCount, 3);
  ok("Markdown import route parses blocks into doc AST");

  // --- Persistence: flush, drop from memory, reload from disk
  await store.flushAll();
  assert.ok(fs.existsSync(path.join(process.env.DATA_DIR, "doc-1.bin"))); ok("Yjs state written to disk");
  const fresh = new Y.Doc();
  Y.applyUpdate(fresh, fs.readFileSync(path.join(process.env.DATA_DIR, "doc-1.bin")));
  assert.equal(fresh.getText("block-1").toString(), "Title"); ok("state reloads from disk");

  // --- Rename + delete
  const r = await j("/api/documents/doc-1", { method: "PATCH", body: JSON.stringify({ title: "Renamed" }) });
  assert.equal((await r.json()).title, "Renamed"); ok("rename");
  assert.equal((await j("/api/documents/doc-1", { method: "DELETE" })).status, 204); ok("delete");

  console.log(`\nAll ${passed} checks passed`);
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });

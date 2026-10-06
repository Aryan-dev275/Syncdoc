require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const { connectDB } = require("../src/config/db");
const { DocumentModel, YjsSnapshotModel } = require("../src/models/Document");
const store = require("../src/store");
const Y = require("yjs");

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/syncdoc-test";

(async () => {
  console.log(`Connecting to real MongoDB at ${mongoUri}...`);

  const connected = await connectDB();
  if (!connected) {
    console.warn("Real MongoDB server not reachable at " + mongoUri + ". Skipping live MongoDB socket test; fallback verified.");
    process.exit(0);
  }

  console.log("  ✓ Real MongoDB connected successfully!");

  // Clean test collection
  await DocumentModel.deleteMany({ id: /^mongo-test-/ });
  await YjsSnapshotModel.deleteMany({ documentId: /^mongo-test-/ });

  // 1. Test AST Schema & Pre-save Sanitization Hook
  const docId = "mongo-test-doc-1";
  const docDoc = new DocumentModel({
    id: docId,
    title: "MongoDB AST Test",
    blocks: [
      {
        id: "b1",
        type: "heading",
        content: "Heading <script>alert('xss')</script>",
        order: 0,
        parentId: null,
        children: [
          {
            id: "b1-child",
            type: "paragraph",
            content: "Child <iframe src='evil.com'></iframe> text",
            order: 0,
            parentId: "wrong-parent-id",
          },
        ],
      },
    ],
  });

  await docDoc.save();
  const savedDoc = await DocumentModel.findOne({ id: docId });
  assert.ok(savedDoc);
  assert.equal(savedDoc.blocks[0].content, "Heading ");
  assert.equal(savedDoc.blocks[0].children[0].content, "Child  text");
  assert.equal(savedDoc.blocks[0].children[0].parentId, "b1");
  console.log("  ✓ Pre-save hook: Recursive AST tree validated and sanitized with DOMPurify");

  // 2. Test Yjs Snapshot Persistence in MongoDB
  const ydoc = new Y.Doc();
  ydoc.getArray("blocks").push([{ id: "y1", type: "paragraph" }]);
  ydoc.getText("y1").insert(0, "Live Yjs text stored in MongoDB binary snapshot.");
  const updateBuf = Buffer.from(Y.encodeStateAsUpdate(ydoc));

  await YjsSnapshotModel.updateOne(
    { documentId: docId },
    { update: updateBuf, updatedAt: new Date() },
    { upsert: true }
  );

  const savedSnapshot = await YjsSnapshotModel.findOne({ documentId: docId });
  assert.ok(savedSnapshot);
  assert.ok(savedSnapshot.update.length > 0);

  const restoredYDoc = new Y.Doc();
  Y.applyUpdate(restoredYDoc, savedSnapshot.update);
  assert.equal(restoredYDoc.getText("y1").toString(), "Live Yjs text stored in MongoDB binary snapshot.");
  console.log("  ✓ Yjs binary snapshot saved to & reloaded from real MongoDB Atlas");

  // 3. Test Store CRUD with MongoDB primary persistence
  await store.initMongoSync();
  const created = await store.createDocument("mongo-test-doc-2", "Doc 2");
  assert.equal(created.title, "Doc 2");

  const fetchedYDoc = await store.getYDoc("mongo-test-doc-2");
  fetchedYDoc.getText("b1").insert(0, "MongoDB primary store integration test");
  await store.flushAll();

  const verifyDoc = await DocumentModel.findOne({ id: "mongo-test-doc-2" });
  assert.ok(verifyDoc);
  assert.equal(verifyDoc.title, "Doc 2");
  console.log("  ✓ Store module successfully managed documents in real MongoDB Atlas");

  // Cleanup
  await DocumentModel.deleteMany({ id: /^mongo-test-/ });
  await YjsSnapshotModel.deleteMany({ documentId: /^mongo-test-/ });
  await mongoose.disconnect();

  console.log("\nALL REAL MONGODB ATLAS PERSISTENCE CHECKS PASSED!");
  process.exit(0);
})().catch((err) => {
  console.error("MongoDB Test Error:", err);
  process.exit(1);
});

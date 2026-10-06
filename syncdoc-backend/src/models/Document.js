const mongoose = require("mongoose");
const { sanitizeHTML } = require("../security/dompurify");

const BlockSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, default: "paragraph" },
    content: { type: String, default: "" },
    order: { type: Number, default: 0 },
    parentId: { type: String, default: null },
  },
  { _id: false }
);

BlockSchema.add({ children: [BlockSchema] });

const DocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "Untitled", maxlength: 200 },
    blocks: [BlockSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Recursive pre-save hook to validate parent/child links and sanitize content
DocumentSchema.pre("save", function () {
  const seenIds = new Set();

  function processBlock(block, expectedParentId) {
    if (!block || !block.id) {
      throw new Error("Block missing id");
    }
    if (seenIds.has(block.id)) {
      throw new Error(`Duplicate block id found: ${block.id}`);
    }
    seenIds.add(block.id);

    // Validate parent/child link
    if (expectedParentId !== undefined && block.parentId !== expectedParentId) {
      block.parentId = expectedParentId;
    }

    // Sanitize content with DOMPurify
    if (typeof block.content === "string") {
      block.content = sanitizeHTML(block.content);
    }

    // Recursively walk children
    if (Array.isArray(block.children)) {
      for (const child of block.children) {
        processBlock(child, block.id);
      }
    }
  }

  if (Array.isArray(this.blocks)) {
    for (const block of this.blocks) {
      processBlock(block, block.parentId || null);
    }
  }
});

const YjsSnapshotSchema = new mongoose.Schema(
  {
    documentId: { type: String, required: true, unique: true, index: true },
    update: { type: Buffer, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const DocumentModel = mongoose.models.Document || mongoose.model("Document", DocumentSchema);
const YjsSnapshotModel = mongoose.models.YjsSnapshot || mongoose.model("YjsSnapshot", YjsSnapshotSchema);

module.exports = { DocumentModel, YjsSnapshotModel, BlockSchema };

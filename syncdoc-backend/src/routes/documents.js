const express = require("express");
const store = require("../store");
const sanitizeDocument = require("../middleware/sanitize");
const { readBlocks, blocksToHTML } = require("../services/blocks");
const { createHTMLDocument } = require("../services/htmlExport");
const { parseMarkdownToBlocks } = require("../services/markdownParser");
const { generatePDFFromAST } = require("../services/pdfExport");

const router = express.Router();
const cleanTitle = (t) => String(t ?? "").replace(/[<>]/g, "").trim();

function writeBlocksToYDoc(ydoc, blocks) {
  ydoc.transact(() => {
    const yblocks = ydoc.getArray("blocks");
    yblocks.delete(0, yblocks.length);
    const metaArray = [];
    for (const block of blocks) {
      metaArray.push({
        id: block.id,
        type: block.type,
        language: block.language,
        order: block.order,
        parentId: block.parentId,
      });
      const ytext = ydoc.getText(block.id);
      ytext.delete(0, ytext.length);
      ytext.insert(0, block.content || "");
    }
    yblocks.push(metaArray);
  });
}

router.param("id", (req, res, next, id) => {
  if (!store.safeId(id)) return res.status(400).json({ error: "Invalid document id" });
  next();
});

router.get("/", (req, res) => res.json(store.listDocuments()));

router.post("/", async (req, res, next) => {
  try {
    const id = req.body?.id || `doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    if (!store.safeId(id)) return res.status(400).json({ error: "Invalid document id" });
    if (store.hasDocument(id)) return res.status(409).json({ error: "Document already exists" });
    const created = await store.createDocument(id, cleanTitle(req.body?.title) || "Untitled");
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!store.hasDocument(req.params.id)) return res.status(404).json({ error: "Not found" });
    const ydoc = await store.getYDoc(req.params.id);
    const blocks = readBlocks(ydoc);
    res.json({ ...store.getMeta(req.params.id), blocks });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/save", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!store.hasDocument(id)) return res.status(404).json({ error: "Not found" });
    await store.saveDoc(id);
    res.json({ status: "saved", id, savedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", sanitizeDocument, async (req, res, next) => {
  try {
    const title = cleanTitle(req.body?.title);
    if (!title) return res.status(400).json({ error: "title required" });
    const updated = await store.renameDocument(req.params.id, title);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await store.deleteDocument(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Import: POST /api/documents/:id/import
router.post("/:id/import", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!store.hasDocument(id)) {
      await store.createDocument(id, "Imported Document");
    }
    const markdown = typeof req.body === "string" ? req.body : req.body?.markdown || req.body?.content || "";
    if (!markdown) {
      return res.status(400).json({ error: "Markdown content is required" });
    }

    const blocks = parseMarkdownToBlocks(markdown);
    const ydoc = await store.getYDoc(id);
    writeBlocksToYDoc(ydoc, blocks);

    res.json({
      id,
      ...store.getMeta(id),
      importedCount: blocks.length,
      blocks: readBlocks(ydoc),
    });
  } catch (err) {
    next(err);
  }
});

// Export: GET /api/documents/:id/export?format=html|json|md|pdf
router.get("/:id/export", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!store.hasDocument(id)) return res.status(404).json({ error: "Not found" });
    const { title } = store.getMeta(id);
    const ydoc = await store.getYDoc(id);
    const blocks = readBlocks(ydoc);
    const format = String(req.query.format || "html").toLowerCase();
    const file = title.replace(/[^\w-]+/g, "_") || id;

    if (format === "html") {
      res.type("html").attachment(`${file}.html`);
      return res.send(createHTMLDocument(blocksToHTML(blocks), title));
    }
    if (format === "json") {
      res.attachment(`${file}.json`);
      return res.json({ id, title, blocks });
    }
    if (format === "md") {
      const md = blocks
        .map((b) =>
          b.type === "heading"
            ? `# ${b.content}`
            : b.type === "code"
            ? "```" + (b.language || "") + `\n${b.content}\n` + "```"
            : b.content
        )
        .join("\n\n");
      res.type("text/markdown").attachment(`${file}.md`);
      return res.send(`# ${title}\n\n${md}\n`);
    }
    if (format === "pdf") {
      const pdfBuffer = await generatePDFFromAST(title, blocks);
      res.type("application/pdf").attachment(`${file}.pdf`);
      return res.send(pdfBuffer);
    }
    res.status(400).json({ error: "format must be html, json, md or pdf" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

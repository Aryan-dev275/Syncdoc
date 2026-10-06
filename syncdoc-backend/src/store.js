const fs = require("fs");
const path = require("path");
const Y = require("yjs");
const { getIsConnected } = require("./config/db");
const { DocumentModel, YjsSnapshotModel } = require("./models/Document");
const { readBlocks } = require("./services/blocks");

const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
const META_FILE = path.join(DATA_DIR, "documents.json");
fs.mkdirSync(DATA_DIR, { recursive: true });

// Memory cache for active documents: id -> { id, title, createdAt, updatedAt }
let meta = {};
try {
  meta = JSON.parse(fs.readFileSync(META_FILE, "utf8"));
} catch {
  /* first run fallback */
}

const ydocs = new Map(); // id -> Y.Doc
const timers = new Map(); // id -> debounce timer

const safeId = (id) => /^[\w-]{1,64}$/.test(id);
const binPath = (id) => path.join(DATA_DIR, `${id}.bin`);
const saveMetaDisk = () => fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));

async function initMongoSync() {
  if (!getIsConnected()) return;
  try {
    const docs = await DocumentModel.find({});
    for (const d of docs) {
      meta[d.id] = {
        id: d.id,
        title: d.title,
        createdAt: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: d.updatedAt ? d.updatedAt.toISOString() : new Date().toISOString(),
      };
    }
    saveMetaDisk();
  } catch (e) {
    console.warn("[DB Store] Failed to sync document list from MongoDB:", e.message);
  }
}

async function saveDoc(id) {
  const ydoc = ydocs.get(id);
  if (!ydoc) return;
  const updateBuf = Buffer.from(Y.encodeStateAsUpdate(ydoc));
  const nowIso = new Date().toISOString();
  const now = new Date(nowIso);

  if (meta[id]) {
    meta[id].updatedAt = nowIso;
    saveMetaDisk();
  }

  // Always write fallback to disk
  fs.writeFileSync(binPath(id), updateBuf);

  // MongoDB is the primary store
  if (getIsConnected()) {
    try {
      const blocks = readBlocks(ydoc);
      await Promise.all([
        YjsSnapshotModel.updateOne(
          { documentId: id },
          { update: updateBuf, updatedAt: now },
          { upsert: true }
        ),
        DocumentModel.updateOne(
          { id },
          { title: meta[id]?.title || "Untitled", blocks, updatedAt: now },
          { upsert: true }
        ),
      ]);
    } catch (err) {
      console.error("[DB Store] Error saving doc snapshot to MongoDB:", err.message);
    }
  }
}

function scheduleSave(id) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => { timers.delete(id); saveDoc(id); }, 1000));
}

async function createDocument(id, title = "Untitled") {
  if (!safeId(id)) throw new Error("Invalid document id");
  const nowIso = new Date().toISOString();
  const cleanTitle = String(title).slice(0, 200);

  if (!meta[id]) {
    meta[id] = { id, title: cleanTitle, createdAt: nowIso, updatedAt: nowIso };
    saveMetaDisk();

    if (getIsConnected()) {
      try {
        await DocumentModel.create({
          id,
          title: cleanTitle,
          blocks: [],
          createdAt: new Date(nowIso),
          updatedAt: new Date(nowIso),
        });
      } catch (err) {
        console.error("[DB Store] MongoDB createDocument error:", err.message);
      }
    }
  }
  return meta[id];
}

async function getYDoc(id) {
  if (!safeId(id)) throw new Error("Invalid document id");
  if (ydocs.has(id)) return ydocs.get(id);

  const ydoc = new Y.Doc();
  let loaded = false;

  // Primary: Load from MongoDB if connected
  if (getIsConnected()) {
    try {
      const snapshot = await YjsSnapshotModel.findOne({ documentId: id });
      if (snapshot && snapshot.update) {
        Y.applyUpdate(ydoc, snapshot.update);
        loaded = true;
      }
      const docMeta = await DocumentModel.findOne({ id });
      if (docMeta) {
        meta[id] = {
          id: docMeta.id,
          title: docMeta.title,
          createdAt: docMeta.createdAt ? docMeta.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: docMeta.updatedAt ? docMeta.updatedAt.toISOString() : new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn("[DB Store] MongoDB load error, checking fallback disk:", err.message);
    }
  }

  // Fallback: Disk load
  if (!loaded) {
    try {
      Y.applyUpdate(ydoc, fs.readFileSync(binPath(id)));
    } catch {
      /* new doc */
    }
  }

  await createDocument(id);
  ydoc.on("update", () => scheduleSave(id));
  ydocs.set(id, ydoc);
  return ydoc;
}

const listDocuments = () => Object.values(meta).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
const getMeta = (id) => meta[id];
const hasDocument = (id) => Boolean(meta[id]);

async function renameDocument(id, title) {
  if (!meta[id]) return null;
  const cleanTitle = String(title).slice(0, 200);
  const nowIso = new Date().toISOString();

  meta[id].title = cleanTitle;
  meta[id].updatedAt = nowIso;
  saveMetaDisk();

  if (getIsConnected()) {
    try {
      await DocumentModel.updateOne({ id }, { title: cleanTitle, updatedAt: new Date(nowIso) });
    } catch (err) {
      console.error("[DB Store] MongoDB rename error:", err.message);
    }
  }
  return meta[id];
}

async function deleteDocument(id) {
  if (!meta[id]) return false;
  clearTimeout(timers.get(id));
  timers.delete(id);
  ydocs.get(id)?.destroy();
  ydocs.delete(id);
  delete meta[id];
  saveMetaDisk();
  fs.rmSync(binPath(id), { force: true });

  if (getIsConnected()) {
    try {
      await Promise.all([
        DocumentModel.deleteOne({ id }),
        YjsSnapshotModel.deleteOne({ documentId: id }),
      ]);
    } catch (err) {
      console.error("[DB Store] MongoDB delete error:", err.message);
    }
  }
  return true;
}

async function flushAll() {
  for (const id of ydocs.keys()) {
    await saveDoc(id);
  }
}

module.exports = {
  safeId,
  initMongoSync,
  createDocument,
  getYDoc,
  saveDoc,
  listDocuments,
  getMeta,
  hasDocument,
  renameDocument,
  deleteDocument,
  flushAll,
};

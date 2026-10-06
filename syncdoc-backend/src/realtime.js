const { Server } = require("socket.io");
const Y = require("yjs");
const store = require("./store");

/**
 * Realtime layer. Event names are kept identical to Uday's realtime-test server:
 *   client -> server: join-document, request-yjs-sync, yjs-update, cursor-update,
 *                     request-block-lock, release-block-lock, message
 *   server -> client: yjs-sync, yjs-sync-update, yjs-update, users-online,
 *                     block-locks, block-lock-granted, block-lock-denied,
 *                     cursor-update, realtime-ready, message, error-message
 */
function attachRealtime(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin },
    maxHttpBufferSize: 5e6, // 5 MB per message
  });

  const locks = new Map(); // documentId -> Map(blockId -> { userId, username })
  const getLocks = (docId) => {
    if (!locks.has(docId)) locks.set(docId, new Map());
    return locks.get(docId);
  };

  const sendUsers = (docId) => {
    const room = io.sockets.adapter.rooms.get(docId);
    const users = [...(room || [])].map((sid) => ({
      id: sid,
      username: io.sockets.sockets.get(sid)?.username || "Anonymous",
    }));
    io.to(docId).emit("users-online", users);
  };

  const sendLocks = (docId) => {
    const list = [...getLocks(docId)].map(([blockId, l]) => ({ blockId, userId: l.userId, username: l.username }));
    io.to(docId).emit("block-locks", list);
  };

  const releaseUserLocks = (socket, docId) => {
    if (!docId) return;
    const m = getLocks(docId);
    let changed = false;
    for (const [blockId, l] of m) if (l.userId === socket.id) { m.delete(blockId); changed = true; }
    if (changed) sendLocks(docId);
  };

  const validId = (id) => typeof id === "string" && store.safeId(id);
  // Only act on documents the socket has actually joined.
  const inRoom = (socket, docId) => validId(docId) && socket.documentId === docId;

  io.on("connection", (socket) => {
    socket.on("join-document", async ({ documentId, username } = {}) => {
      if (!validId(documentId)) return socket.emit("error-message", "Invalid documentId");
      if (socket.documentId && socket.documentId !== documentId) {
        releaseUserLocks(socket, socket.documentId);
        socket.leave(socket.documentId);
        sendUsers(socket.documentId);
      }
      socket.documentId = documentId;
      socket.username = String(username || "Anonymous").slice(0, 40);
      socket.join(documentId);

      const ydoc = await store.getYDoc(documentId);
      socket.emit("yjs-sync", Array.from(Y.encodeStateAsUpdate(ydoc)));
      sendUsers(documentId);
      sendLocks(documentId);
      socket.emit("realtime-ready", { documentId, message: "Realtime collaboration ready" });
    });

    socket.on("request-yjs-sync", async ({ documentId, stateVector } = {}) => {
      if (!inRoom(socket, documentId) || !Array.isArray(stateVector)) return;
      try {
        const ydoc = await store.getYDoc(documentId);
        const missing = Y.encodeStateAsUpdate(ydoc, new Uint8Array(stateVector));
        socket.emit("yjs-sync-update", Array.from(missing));
      } catch { socket.emit("error-message", "Bad state vector"); }
    });

    socket.on("yjs-update", async ({ documentId, update } = {}) => {
      if (!inRoom(socket, documentId) || !update) return;
      try {
        const ydoc = await store.getYDoc(documentId);
        Y.applyUpdate(ydoc, new Uint8Array(update));
      } catch { return socket.emit("error-message", "Bad Yjs update"); }
      socket.to(documentId).emit("yjs-update", update);
    });

    socket.on("cursor-update", ({ documentId, position, selectionEnd, blockId } = {}) => {
      if (!inRoom(socket, documentId)) return;
      socket.to(documentId).emit("cursor-update", {
        userId: socket.id, username: socket.username, position, selectionEnd, blockId,
      });
    });

    socket.on("request-block-lock", ({ documentId, blockId } = {}) => {
      if (!inRoom(socket, documentId) || typeof blockId !== "string") return;
      const m = getLocks(documentId);
      const existing = m.get(blockId);
      if (!existing) {
        m.set(blockId, { userId: socket.id, username: socket.username });
        socket.emit("block-lock-granted", { blockId });
        return sendLocks(documentId);
      }
      if (existing.userId === socket.id) return socket.emit("block-lock-granted", { blockId });
      socket.emit("block-lock-denied", { blockId, username: existing.username });
    });

    socket.on("release-block-lock", ({ documentId, blockId } = {}) => {
      if (!inRoom(socket, documentId)) return;
      const m = getLocks(documentId);
      if (m.get(blockId)?.userId === socket.id) { m.delete(blockId); sendLocks(documentId); }
    });

    socket.on("message", ({ documentId, message } = {}) => {
      if (!inRoom(socket, documentId)) return;
      io.to(documentId).emit("message", String(message).slice(0, 2000));
    });

    socket.on("disconnect", () => {
      const docId = socket.documentId;
      releaseUserLocks(socket, docId);
      if (docId) setTimeout(() => sendUsers(docId), 100);
    });
  });

  return io;
}

module.exports = attachRealtime;

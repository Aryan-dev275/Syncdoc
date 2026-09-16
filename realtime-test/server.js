const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Y = require("yjs");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

app.use(express.static("public"));

console.log("Starting SyncDoc realtime server...");

// =====================================================
// YJS DOCUMENT STORAGE
// =====================================================

const documents = new Map();

function getDocument(documentId) {

    if (!documents.has(documentId)) {

        const ydoc = new Y.Doc();

        documents.set(
            documentId,
            ydoc
        );

        console.log(
            `Created Yjs document: ${documentId}`
        );
    }

    return documents.get(documentId);
}

// =====================================================
// BLOCK LOCK STORAGE
// =====================================================

const blockLocks = new Map();

function getBlockLocks(documentId) {

    if (!blockLocks.has(documentId)) {

        blockLocks.set(
            documentId,
            new Map()
        );
    }

    return blockLocks.get(documentId);
}

// =====================================================
// SEND USERS
// =====================================================

function sendUsers(documentId) {

    const room =
        io.sockets.adapter.rooms.get(
            documentId
        );

    if (!room) {
        return;
    }

    const users = [];

    room.forEach((socketId) => {

        const userSocket =
            io.sockets.sockets.get(
                socketId
            );

        if (userSocket) {

            users.push({

                id: socketId,

                username:
                    userSocket.username ||
                    "Anonymous"

            });
        }
    });

    io.to(documentId).emit(
        "users-online",
        users
    );
}

// =====================================================
// SEND BLOCK LOCKS
// =====================================================

function sendBlockLocks(documentId) {

    const locks =
        getBlockLocks(documentId);

    const result = [];

    locks.forEach(
        (lock, blockId) => {

            result.push({

                blockId: blockId,

                userId:
                    lock.userId,

                username:
                    lock.username

            });
        }
    );

    io.to(documentId).emit(
        "block-locks",
        result
    );
}

// =====================================================
// RELEASE USER LOCKS
// =====================================================

function releaseUserLocks(socket) {

    const documentId =
        socket.documentId;

    if (!documentId) {
        return;
    }

    const locks =
        getBlockLocks(documentId);

    let changed = false;

    locks.forEach(
        (lock, blockId) => {

            if (
                lock.userId ===
                socket.id
            ) {

                locks.delete(
                    blockId
                );

                changed = true;

                console.log(
                    `${socket.username || "Anonymous"} released ${blockId}`
                );
            }
        }
    );

    if (changed) {

        sendBlockLocks(
            documentId
        );
    }
}

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "🟢 User connected:",
            socket.id
        );

        // =================================================
        // JOIN DOCUMENT
        // =================================================

        socket.on(
            "join-document",
            ({
                documentId,
                username
            }) => {

                socket.documentId =
                    documentId;

                socket.username =
                    username ||
                    "Anonymous";

                socket.join(
                    documentId
                );

                console.log(
                    `👤 ${socket.username} joined ${documentId}`
                );

                const ydoc =
                    getDocument(
                        documentId
                    );

                /*
                 * Send complete state only
                 * for the initial join.
                 */

                const currentState =
                    Y.encodeStateAsUpdate(
                        ydoc
                    );

                socket.emit(
                    "yjs-sync",
                    Array.from(
                        currentState
                    )
                );

                sendUsers(
                    documentId
                );

                sendBlockLocks(
                    documentId
                );

                socket.emit(
                    "realtime-ready",
                    {

                        documentId:
                            documentId,

                        message:
                            "Realtime collaboration ready"

                    }
                );
            }
        );

        // =================================================
        // STATE VECTOR SYNCHRONIZATION
        // =================================================

        socket.on(
            "request-yjs-sync",
            ({
                documentId,
                stateVector
            }) => {

                console.log(
                    `🔄 Yjs state-vector sync requested by ${
                        socket.username ||
                        socket.id
                    }`
                );

                const ydoc =
                    getDocument(
                        documentId
                    );

                /*
                 * Convert the state vector
                 * received from the client
                 * into Uint8Array.
                 */

                const clientStateVector =
                    new Uint8Array(
                        stateVector
                    );

                /*
                 * Yjs calculates only the
                 * updates missing from the client.
                 */

                const missingUpdate =
                    Y.encodeStateAsUpdate(
                        ydoc,
                        clientStateVector
                    );

                socket.emit(
                    "yjs-sync-update",
                    Array.from(
                        missingUpdate
                    )
                );

                console.log(
                    `📦 Sent ${missingUpdate.length} bytes of missing Yjs updates`
                );
            }
        );

        // =================================================
        // CHAT MESSAGE
        // =================================================

        socket.on(
            "message",
            ({
                documentId,
                message
            }) => {

                io.to(documentId).emit(
                    "message",
                    message
                );
            }
        );

        // =================================================
        // YJS UPDATE FROM CLIENT
        // =================================================

        socket.on(
            "yjs-update",
            ({
                documentId,
                update
            }) => {

                const ydoc =
                    getDocument(
                        documentId
                    );

                const updateArray =
                    new Uint8Array(
                        update
                    );

                /*
                 * Apply the update to
                 * the server-side Yjs document.
                 */

                Y.applyUpdate(
                    ydoc,
                    updateArray
                );

                /*
                 * Send the update to
                 * every other user in
                 * the same document.
                 */

                socket
                    .to(documentId)
                    .emit(
                        "yjs-update",
                        update
                    );

                console.log(
                    `📡 Yjs update received for ${documentId}`
                );
            }
        );

        // =================================================
        // CURSOR UPDATE
        // =================================================

        socket.on(
            "cursor-update",
            ({
                documentId,
                username,
                position,
                selectionEnd,
                blockId
            }) => {

                socket
                    .to(documentId)
                    .emit(
                        "cursor-update",
                        {

                            userId:
                                socket.id,

                            username:
                                username,

                            position:
                                position,

                            selectionEnd:
                                selectionEnd,

                            blockId:
                                blockId

                        }
                    );
            }
        );

        // =================================================
        // REQUEST BLOCK LOCK
        // =================================================

        socket.on(
            "request-block-lock",
            ({
                documentId,
                blockId
            }) => {

                const locks =
                    getBlockLocks(
                        documentId
                    );

                const existingLock =
                    locks.get(
                        blockId
                    );

                // Block is available
                if (!existingLock) {

                    locks.set(
                        blockId,
                        {

                            userId:
                                socket.id,

                            username:
                                socket.username

                        }
                    );

                    socket.emit(
                        "block-lock-granted",
                        {
                            blockId:
                                blockId
                        }
                    );

                    sendBlockLocks(
                        documentId
                    );

                    console.log(
                        `🔒 ${socket.username} locked ${blockId}`
                    );

                    return;
                }

                // Already owned by this user
                if (
                    existingLock.userId ===
                    socket.id
                ) {

                    socket.emit(
                        "block-lock-granted",
                        {
                            blockId:
                                blockId
                        }
                    );

                    return;
                }

                // Locked by another user
                socket.emit(
                    "block-lock-denied",
                    {

                        blockId:
                            blockId,

                        username:
                            existingLock.username

                    }
                );
            }
        );

        // =================================================
        // RELEASE BLOCK LOCK
        // =================================================

        socket.on(
            "release-block-lock",
            ({
                documentId,
                blockId
            }) => {

                const locks =
                    getBlockLocks(
                        documentId
                    );

                const existingLock =
                    locks.get(
                        blockId
                    );

                if (
                    existingLock &&
                    existingLock.userId ===
                    socket.id
                ) {

                    locks.delete(
                        blockId
                    );

                    console.log(
                        `🔓 ${socket.username} released ${blockId}`
                    );

                    sendBlockLocks(
                        documentId
                    );
                }
            }
        );

        // =================================================
        // DISCONNECT
        // =================================================

        socket.on(
            "disconnect",
            (reason) => {

                console.log(
                    `🔴 ${
                        socket.username ||
                        socket.id
                    } disconnected`
                );

                console.log(
                    `Reason: ${reason}`
                );

                releaseUserLocks(
                    socket
                );

                const documentId =
                    socket.documentId;

                if (documentId) {

                    setTimeout(
                        () => {

                            sendUsers(
                                documentId
                            );

                        },
                        100
                    );
                }
            }
        );
    }
);

// =====================================================
// START SERVER
// =====================================================

server.listen(
    3000,
    () => {

        console.log(
            "Server running on http://localhost:3000"
        );
    }
);
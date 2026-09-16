const io = require("socket.io-client");
const Y = require("yjs");

const SERVER_URL = "http://localhost:3000";
const DOCUMENT_ID = "stress-test-document";

const TOTAL_USERS = 10;

const clients = [];

console.log("======================================");
console.log("   SyncDoc 10-User Stress Test");
console.log("======================================");
console.log();


// ========================================
// CREATE 10 USERS
// ========================================

for (let i = 1; i <= TOTAL_USERS; i++) {

    const username = `User-${i}`;

    const socket = io(SERVER_URL);

    const ydoc = new Y.Doc();

    const ytext =
        ydoc.getText("block-1");


    const client = {

        username,
        socket,
        ydoc,
        ytext,
        connected: false,
        synced: false

    };


    clients.push(client);


    // ====================================
    // CONNECT
    // ====================================

    socket.on("connect", () => {

        client.connected = true;

        console.log(
            `🟢 ${username} connected`
        );


        socket.emit(
            "join-document",
            {

                documentId:
                    DOCUMENT_ID,

                username:
                    username

            }
        );

    });


    // ====================================
    // RECEIVE INITIAL STATE
    // ====================================

    socket.on(
        "yjs-sync",
        (update) => {

            const updateArray =
                new Uint8Array(update);


            Y.applyUpdate(
                ydoc,
                updateArray,
                "server-sync"
            );


            client.synced = true;

        }
    );


    // ====================================
    // RECEIVE REMOTE UPDATE
    // ====================================

    socket.on(
        "yjs-update",
        (update) => {

            const updateArray =
                new Uint8Array(update);


            Y.applyUpdate(
                ydoc,
                updateArray,
                "remote"
            );

        }
    );


    // ====================================
    // SEND LOCAL YJS UPDATE
    // ====================================

    ydoc.on(
        "update",
        (update, origin) => {

            if (
                origin === "remote" ||
                origin === "server-sync"
            ) {

                return;

            }


            socket.emit(
                "yjs-update",
                {

                    documentId:
                        DOCUMENT_ID,

                    update:
                        Array.from(update)

                }
            );

        }
    );

}


// ========================================
// WAIT FOR ALL USERS
// ========================================

function waitForUsers() {

    return new Promise((resolve) => {

        const interval =
            setInterval(() => {

                const connected =
                    clients.filter(
                        client =>
                            client.connected
                    ).length;


                console.log(
                    `Connected users: ${connected}/${TOTAL_USERS}`
                );


                if (
                    connected ===
                    TOTAL_USERS
                ) {

                    clearInterval(
                        interval
                    );

                    resolve();

                }

            }, 500);

    });

}


// ========================================
// WAIT FOR YJS SYNC
// ========================================

function waitForSync() {

    return new Promise((resolve) => {

        const interval =
            setInterval(() => {

                const synced =
                    clients.filter(
                        client =>
                            client.synced
                    ).length;


                console.log(
                    `Synced users: ${synced}/${TOTAL_USERS}`
                );


                if (
                    synced ===
                    TOTAL_USERS
                ) {

                    clearInterval(
                        interval
                    );

                    resolve();

                }

            }, 500);

    });

}


// ========================================
// PERFORM CONCURRENT EDITS
// ========================================

function performConcurrentEdits() {

    console.log();
    console.log(
        "======================================"
    );

    console.log(
        "Starting concurrent edits..."
    );

    console.log(
        "======================================"
    );

    console.log();


    clients.forEach(
        (client, index) => {

            const text =
                `[${client.username} edited] `;


            // Every user edits at almost
            // exactly the same time

            setTimeout(() => {

                client.ytext.insert(
                    0,
                    text
                );


                console.log(
                    `✏️ ${client.username} inserted text`
                );


            }, 100 + index * 10);

        }
    );

}


// ========================================
// CHECK CONVERGENCE
// ========================================

function checkResult() {

    console.log();
    console.log(
        "======================================"
    );

    console.log(
        "Checking final document states..."
    );

    console.log(
        "======================================"
    );

    console.log();


    const states = clients.map(
        client =>
            client.ytext.toString()
    );


    states.forEach(
        (state, index) => {

            console.log(
                `User-${index + 1}: ${state}`
            );

        }
    );


    console.log();


    // ====================================
    // CHECK ALL STATES
    // ====================================

    const firstState =
        states[0];


    const allSame =
        states.every(
            state =>
                state === firstState
        );


    console.log(
        "======================================"
    );


    if (allSame) {

        console.log(
            "✅ STRESS TEST PASSED"
        );

        console.log();

        console.log(
            `All ${TOTAL_USERS} users have the same final document.`
        );

        console.log(
            "Yjs CRDT convergence is working."
        );

    } else {

        console.log(
            "❌ STRESS TEST FAILED"
        );

        console.log();

        console.log(
            "Users have different document states."
        );

    }


    console.log(
        "======================================"
    );


    // ====================================
    // CLOSE CONNECTIONS
    // ====================================

    clients.forEach(
        client => {

            client.socket.disconnect();

        }
    );


    process.exit(
        allSame ? 0 : 1
    );

}


// ========================================
// MAIN TEST
// ========================================

async function runStressTest() {

    await waitForUsers();

    console.log();

    await waitForSync();

    console.log();

    // Give Socket.io/Yjs a moment

    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                1000
            )
    );


    performConcurrentEdits();


    // Wait for all updates
    // to travel through server

    setTimeout(() => {

        checkResult();

    }, 5000);

}


runStressTest();
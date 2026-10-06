# SyncDoc Backend

Merges the team's work into one Node/Express service:

| From | Used for |
|---|---|
| Uday (`realtime-test/server.js`) | Socket.IO + Yjs realtime sync, presence, cursors, block locks (`src/realtime.js`) |
| Sharanya (`server/*`) | DOMPurify sanitizing, security headers, HTML export (`src/security`, `src/middleware`, `src/services/htmlExport.js`) |
| Aryan (frontend) | Block model: `heading`, `paragraph`, `code` (`src/services/blocks.js`) |
| New | REST document API, disk persistence, md/json export, input validation |

## Run
```
npm install
npm start          # http://localhost:3000   (npm run dev for auto-reload)
npm test           # 20-check end-to-end smoke test
```
Env (see `.env.example`): `PORT`, `CORS_ORIGIN` (frontend URL, default Vite `http://localhost:5173`), `DATA_DIR`.

## REST API
| Method | Path | |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/documents` | list |
| POST | `/api/documents` `{id?, title?}` | create |
| GET | `/api/documents/:id` | meta + `blocks[]` from live state |
| PATCH | `/api/documents/:id` `{title}` | rename |
| DELETE | `/api/documents/:id` | delete |
| GET | `/api/documents/:id/export?format=html\|md\|json` | download (HTML is sanitized) |

## Document model in Yjs
- `ydoc.getArray("blocks")` -> `[{ id, type, language? }]` (order + type)
- `ydoc.getText(blockId)` -> text of each block

## Socket.IO events (same names as Uday's server)
Client -> server: `join-document {documentId, username}`, `request-yjs-sync {documentId, stateVector}`,
`yjs-update {documentId, update}`, `cursor-update`, `request-block-lock`, `release-block-lock`, `message`.
Server -> client: `yjs-sync`, `yjs-sync-update`, `yjs-update`, `users-online`, `block-locks`,
`block-lock-granted`, `block-lock-denied`, `cursor-update`, `realtime-ready`, `error-message`.

## Connecting Aryan's frontend
`npm i socket.io-client yjs` in the frontend, then `io("http://localhost:3000")`, emit `join-document`
with the active doc id, and replace the `useState` blocks in `Editor.jsx` with the Yjs
`blocks` array / per-block `Y.Text` (see `test/smoke.test.js` for the exact calls).

## Not included yet
Authentication/permissions (anyone with a document id can join), rate limiting, PDF export
(Sharanya's PDF export is client-side via html2canvas and stays in the frontend), a real database.

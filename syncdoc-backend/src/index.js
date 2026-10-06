require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const store = require("./store");
const { connectDB } = require("./config/db");
const securityHeaders = require("./middleware/securityHeaders");
const documentsRouter = require("./routes/documents");
const attachRealtime = require("./realtime");

const PORT = Number(process.env.PORT) || 3000;
const ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim());

const app = express();
app.use(securityHeaders);
app.use(cors({ origin: ORIGINS }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.use("/api/documents", documentsRouter);

app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Internal server error" });
});

const server = http.createServer(app);
attachRealtime(server, ORIGINS);

if (require.main === module) {
  (async () => {
    await connectDB();
    await store.initMongoSync();
    server.listen(PORT, () => console.log(`SyncDoc backend on http://localhost:${PORT}`));
  })();

  const shutdown = () => { store.flushAll(); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

module.exports = { app, server };

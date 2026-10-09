import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./src/server/socket";
import { syncCatalogue } from "./src/server/content-index";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  void handle(req, res);
});

const io = new Server(httpServer, {
  path: "/socket.io",
  // Same-origin only; cookies carry identity.
  cors: process.env.PUBLIC_ORIGIN ? { origin: process.env.PUBLIC_ORIGIN, credentials: true } : undefined,
  maxHttpBufferSize: 16_000,
  pingInterval: 10_000,
  pingTimeout: 8_000,
  connectionStateRecovery: { maxDisconnectionDuration: 60_000 },
});
registerSocketHandlers(io);

// Keep the database's question index in step with the bundled datasets (idempotent).
syncCatalogue()
  .then((r) => r.questionsAdded && console.log(`▶ Indexed ${r.questionsAdded} new questions`))
  .catch((e) => console.error("catalogue sync failed", e));

httpServer.listen(port, hostname, () => {
  console.log(`▶ PartyVerse ready on http://localhost:${port} (${dev ? "dev" : "production"})`);
});

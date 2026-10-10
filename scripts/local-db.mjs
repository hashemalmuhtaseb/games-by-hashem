#!/usr/bin/env node
/**
 * A private Postgres for local development and end-to-end tests — no system install needed.
 *
 *   npm run db:local        # starts Postgres on 127.0.0.1:54400 (data in ./.localdb), Ctrl+C to stop
 *
 * Then use DATABASE_URL="postgresql://postgres:partyverse@127.0.0.1:54400/partyverse" in .env and run
 * `npx prisma db push` once. Uses the embedded-postgres dev dependency (binaries live in node_modules).
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.cwd(), ".localdb");
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "partyverse", port: 54400, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });

if (!existsSync(dir)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("partyverse");
} catch {
  /* already exists */
}
console.log("▶ Local Postgres ready: postgresql://postgres:partyverse@127.0.0.1:54400/partyverse");

const stop = async () => {
  await pg.stop().catch(() => undefined);
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => undefined, 1 << 30);

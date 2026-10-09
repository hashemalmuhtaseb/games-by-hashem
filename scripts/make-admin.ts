import { db } from "../src/lib/db";

/** Usage: npm run make-admin -- <username> [ADMIN|MODERATOR|USER] */
const [username, role = "ADMIN"] = process.argv.slice(2);
if (!username || !["ADMIN", "MODERATOR", "USER"].includes(role)) {
  console.error("Usage: npm run make-admin -- <username> [ADMIN|MODERATOR|USER]");
  process.exit(1);
}
db.user
  .updateMany({ where: { username: { equals: username, mode: "insensitive" } }, data: { role: role as "ADMIN" } })
  .then((r) => {
    console.log(r.count ? `${username} is now ${role}.` : `No account named ${username}. Register it first.`);
    if (!r.count) process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

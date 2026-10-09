import { db } from "../src/lib/db";
import { syncCatalogue } from "../src/server/content-index";

syncCatalogue()
  .then((r) => {
    console.log(`Seeded: ${r.games} games, ${r.sources} sources, ${r.categories} categories, ${r.questionsAdded} new of ${r.questionsInCatalogue} questions.`);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

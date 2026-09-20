import { db } from "./database/data-source";
(async () => {
  await db.initialize();
  await db.runMigrations({ transaction: "all" });
  await db.destroy();
  console.log("Migrations applied.");
})().catch(() => {
  console.error("Migration failed; check database configuration.");
  process.exitCode = 1;
});

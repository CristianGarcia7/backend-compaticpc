import { db, Users } from "./database/data-source";
(async () => {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!email)
    throw new Error("Set ADMIN_EMAIL to an existing registered account.");
  await db.initialize();
  const result = await db
    .getRepository(Users)
    .update({ email }, { role: "admin" });
  await db.destroy();
  if (!result.affected) throw new Error("Register the account first.");
  console.log("Administrator role granted.");
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

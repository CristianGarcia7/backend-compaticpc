import { NestFactory } from "@nestjs/core";
import "dotenv/config";
import "reflect-metadata";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { db } from "./database/data-source";
async function bootstrap() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await db.initialize();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3100), "127.0.0.1");
}
bootstrap().catch(() => {
  console.error("Startup failed. Check environment, database and migrations.");
  process.exitCode = 1;
});

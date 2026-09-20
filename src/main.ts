import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import "reflect-metadata";
import { AppModule } from "./app.module";
import { db } from "./database/data-source";
async function bootstrap() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await db.initialize();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(helmet());
  app.use(express.json({ limit: "24kb" }));
  app.use(cookieParser());
  const origin = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:3000";
  const rates = new Map<string, { count: number; reset: number }>();
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.setHeader("Cache-Control", "no-store");
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        req.headers.origin !== origin
      ) {
        res.status(403).json({ message: "Origen no permitido." });
        return;
      }
      const now = Date.now();
      if (rates.size > 10000) {
        for (const [k, v] of rates) if (v.reset < now) rates.delete(k);
        if (rates.size > 10000) {
          res.status(503).json({ message: "Servidor ocupado." });
          return;
        }
      }
      const bucket = req.path.startsWith("/api/auth/")
        ? "auth"
        : req.method === "POST" && req.path === "/api/analyses"
          ? "ai"
          : "general";
      const key = `${req.ip}:${bucket}`;
      const rate = rates.get(key);
      const limit = bucket === "auth" ? 30 : bucket === "ai" ? 15 : 240;
      if (!rate || rate.reset < now)
        rates.set(key, { count: 1, reset: now + 60000 });
      else if (++rate.count > limit) {
        res.setHeader("Retry-After", "60");
        res
          .status(429)
          .json({ message: "Demasiadas solicitudes. Espere un minuto." });
        return;
      }
      next();
    },
  );
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3100), "127.0.0.1");
}
bootstrap().catch(() => {
  console.error("Startup failed. Check environment, database and migrations.");
  process.exitCode = 1;
});

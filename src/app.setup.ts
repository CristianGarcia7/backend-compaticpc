import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
// HTTP middleware shared by main.ts and the tests.
export function configureApp(app: NestExpressApplication) {
  // nginx is the single proxy in front: req.ip becomes the forwarded client
  // address, so each user gets their own rate-limit bucket.
  app.set("trust proxy", 1);
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
}

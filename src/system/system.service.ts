import { Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { current } from "../common/api.service";
import { Analyses, db, EquipmentRows } from "../database/data-source";
import { GeminiHealthService } from "./gemini-health.service";
@Injectable()
export class SystemService {
  constructor(
    @Inject(GeminiHealthService) private readonly gemini: GeminiHealthService,
  ) {}
  // Overridable in tests so they never need a real database.
  dbCheck = async () => {
    await db.query("SELECT 1");
  };
  async health() {
    const [dbStatus, gemini] = await Promise.all([
      this.dbCheck().then(
        () => "ok" as const,
        () => "error" as const,
      ),
      this.gemini.snapshot(),
    ]);
    return {
      status: dbStatus === "ok" ? "ok" : "error",
      db: dbStatus,
      gemini: gemini.status,
    };
  }
  async config() {
    return {
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      demoEnabled: process.env.DEMO_ENABLED === "true",
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      gemini: this.gemini.snapshot(),
    };
  }
  async dashboard(req: Request) {
    const user = await current(req);
    const query = db.getRepository(Analyses);
    const [equipment, analyses, recent] = await Promise.all([
      db.getRepository(EquipmentRows).countBy({ ownerId: user.id }),
      query.countBy({ ownerId: user.id }),
      query.find({
        where: { ownerId: user.id },
        order: { createdAt: "DESC" },
        take: 5,
      }),
    ]);
    return { equipment, analyses, recent };
  }
}

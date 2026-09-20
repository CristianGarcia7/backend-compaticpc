import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { current } from "../common/api.service";
import { Analyses, db, EquipmentRows } from "../database/data-source";
@Injectable()
export class SystemService {
  health() {
    return { status: "ok" };
  }
  config() {
    return {
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      demoEnabled: process.env.DEMO_ENABLED === "true",
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
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

import { Injectable, NotFoundException } from "@nestjs/common";
import type { Request } from "express";
import {
  current,
  equipmentInput,
  identifier,
  parse,
} from "../common/api.service";
import { db, EquipmentRows } from "../database/data-source";
@Injectable()
export class EquipmentService {
  async equipment(req: Request) {
    const user = await current(req);
    return db.getRepository(EquipmentRows).find({
      where: { ownerId: user.id },
      order: { createdAt: "DESC" },
      take: 200,
    });
  }
  async createEquipment(req: Request, body: unknown) {
    const user = await current(req);
    return db
      .getRepository(EquipmentRows)
      .save({ ...parse(equipmentInput, body), ownerId: user.id });
  }
  async deleteEquipment(req: Request, id: string) {
    const user = await current(req);
    const deleted = await db
      .getRepository(EquipmentRows)
      .delete({ id: identifier(id), ownerId: user.id });
    if (!deleted.affected) throw new NotFoundException();
    return { ok: true };
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import type { Request } from "express";
import {
  admin,
  componentInput,
  current,
  identifier,
  parse,
} from "../common/api.service";
import { Components, db } from "../database/data-source";
@Injectable()
export class ComponentsService {
  async components(req: Request) {
    await current(req);
    return db
      .getRepository(Components)
      .find({ order: { name: "ASC" }, take: 200 });
  }
  async createComponent(req: Request, body: unknown) {
    await admin(req);
    return db.getRepository(Components).save(parse(componentInput, body));
  }
  async updateComponent(req: Request, id: string, body: unknown) {
    await admin(req);
    const repo = db.getRepository(Components);
    const row = await repo.findOneBy({ id: identifier(id) });
    if (!row) throw new NotFoundException();
    return repo.save({ ...row, ...parse(componentInput, body) });
  }
  async deleteComponent(req: Request, id: string) {
    await admin(req);
    const result = await db
      .getRepository(Components)
      .delete({ id: identifier(id) });
    if (!result.affected) throw new NotFoundException();
    return { ok: true };
  }
}

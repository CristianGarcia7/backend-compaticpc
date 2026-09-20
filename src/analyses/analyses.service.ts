import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { askGemini, demoResult } from "../analyses/gemini.service";
import {
  current,
  ownedAnalysis,
  parse,
  queryInput,
} from "../common/api.service";
import { Analyses, db, EquipmentRows } from "../database/data-source";
@Injectable()
export class AnalysesService {
  async analyse(req: Request, body: unknown) {
    const user = await current(req);
    const input = parse(queryInput, body);
    const equipment = await db
      .getRepository(EquipmentRows)
      .findOneBy({ id: input.equipmentId, ownerId: user.id });
    if (!equipment) throw new NotFoundException("Equipo no encontrado.");
    if (input.mode === "demo" && process.env.DEMO_ENABLED !== "true")
      throw new ForbiddenException("La demostración está deshabilitada.");
    const payload = {
      equipment: {
        brand: equipment.brand,
        model: equipment.model,
        board: equipment.board,
      },
      category: input.category,
      reference: input.reference,
      specifications: input.specifications,
    };
    const result =
      input.mode === "demo" ? demoResult(payload) : await askGemini(payload);
    return db.getRepository(Analyses).save({
      ownerId: user.id,
      equipment,
      category: input.category,
      reference: input.reference,
      specifications: input.specifications,
      result,
      provider: input.mode === "demo" ? "demo" : "gemini",
      model:
        input.mode === "demo"
          ? "curated-v1"
          : process.env.GEMINI_MODEL || "gemini-3.6-flash",
    });
  }
  async history(req: Request) {
    const user = await current(req);
    const search =
      typeof req.query.search === "string"
        ? req.query.search.slice(0, 120)
        : "";
    const q = db
      .getRepository(Analyses)
      .createQueryBuilder("a")
      .where("a.ownerId = :owner", { owner: user.id });
    if (search)
      q.andWhere("(a.reference ILIKE :search OR a.category ILIKE :search)", {
        search: `%${search.replace(/[\\%_]/g, "\\$&")}%`,
      });
    return q.orderBy("a.createdAt", "DESC").take(100).getMany();
  }
  detail(req: Request, id: string) {
    return ownedAnalysis(req, id);
  }
  async feedback(req: Request, id: string, body: unknown) {
    const row = await ownedAnalysis(req, id);
    const input = parse(
      z.object({ feedback: z.enum(["useful", "not-useful"]) }).strict(),
      body,
    );
    return db.getRepository(Analyses).save({ ...row, ...input });
  }
  async pdf(req: Request, id: string, res: Response) {
    const row = await ownedAnalysis(req, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="compatipc-${row.id}.pdf"`,
    );
    const doc = new PDFDocument({ margin: 48 });
    doc.pipe(res);
    doc.fontSize(24).fillColor("#136c57").text("CompatiPC");
    doc
      .fontSize(11)
      .fillColor("#334155")
      .text("Informe de compatibilidad técnica")
      .moveDown();
    if (row.provider === "demo")
      doc
        .fillColor("#a35b00")
        .text("DEMOSTRACIÓN / NO GEMINI / DATOS NO VERIFICADOS")
        .moveDown();
    doc
      .fillColor("#111827")
      .text(
        `Consulta: ${row.id}\nFecha: ${row.createdAt.toISOString()}\nEquipo: ${row.equipment.brand} ${row.equipment.model}\nPlaca: ${row.equipment.board}\nComponente: ${row.reference}\nCategoría: ${row.category}\nProveedor: ${row.provider} / ${row.model}`,
      )
      .moveDown();
    const labels: any = {
      compatible: "Compatible según datos aportados",
      conditional: "Requiere verificación",
      incompatible: "Incompatible según datos aportados",
    };
    doc
      .fontSize(17)
      .text(labels[row.result.verdict])
      .fontSize(11)
      .text(row.result.summary)
      .moveDown();
    for (const [key, title] of [
      ["checks", "Comprobaciones"],
      ["risks", "Riesgos"],
      ["alternatives", "Alternativas"],
    ]) {
      doc.fontSize(14).text(title).fontSize(11);
      for (const item of row.result[key]) doc.text(`- ${item}`);
      doc.moveDown();
    }
    doc
      .fontSize(9)
      .fillColor("#64748b")
      .text(
        "Orientación técnica, no certificación. Confirme especificaciones y seguridad con documentación oficial antes de comprar o instalar. La respuesta de IA puede contener errores.",
      );
    doc.end();
  }
}

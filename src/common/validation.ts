import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
export const text = (max = 160) => z.string().trim().min(1).max(max);
export const registration = z
  .object({
    name: text(80),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(10).max(128),
  })
  .strict();
export const credentials = registration.omit({ name: true });
export const equipmentInput = z
  .object({
    brand: text(60),
    model: text(120),
    board: text(240),
    serial: z.string().trim().max(100).default(""),
  })
  .strict();
export const categories = z.enum([
  "RAM",
  "Almacenamiento",
  "Procesador",
  "Tarjeta gráfica",
  "Fuente de poder",
]);
export const queryInput = z
  .object({
    equipmentId: z.uuid(),
    category: categories,
    reference: text(160),
    specifications: text(3000),
    mode: z.enum(["gemini", "demo"]),
  })
  .strict();
export const componentInput = z
  .object({
    name: text(160),
    category: categories,
    specifications: text(3000),
    source: text(400),
  })
  .strict();
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException(
      "Datos inválidos. Revise los campos y sus límites.",
    );
  return result.data;
}
export function identifier(id: string) {
  return parse(z.uuid(), id);
}

import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { LessThan } from "typeorm";
import { publicUser, sessionHash } from "../auth/password.service";
import { Analyses, db, Sessions, User, Users } from "../database/data-source";
import { identifier } from "./validation";
export * from "./validation";
export async function current(req: Request): Promise<User> {
  const token = req.cookies?.compatipc_session;
  if (typeof token !== "string" || token.length > 100)
    throw new UnauthorizedException("Inicie sesión para continuar.");
  const session = await db
    .getRepository(Sessions)
    .findOneBy({ id: sessionHash(token) });
  if (!session || session.expiresAt.getTime() < Date.now())
    throw new UnauthorizedException(
      "Su sesión expiró. Inicie sesión nuevamente.",
    );
  const user = await db.getRepository(Users).findOneBy({ id: session.userId });
  if (!user) throw new UnauthorizedException();
  return user;
}
export async function admin(req: Request) {
  const user = await current(req);
  if (user.role !== "admin")
    throw new ForbiddenException("Acceso exclusivo para administradores.");
  return user;
}
export async function ownedAnalysis(req: Request, id: string) {
  const user = await current(req);
  const row = await db
    .getRepository(Analyses)
    .findOneBy({ id: identifier(id), ownerId: user.id });
  if (!row) throw new NotFoundException("Consulta no encontrada.");
  return row;
}
const SESSION_MAX_AGE = 1000 * 60 * 60 * 12;
// Read at call time so NODE_ENV loaded after import (dotenv) still applies.
// Secure only in production: local development runs over plain http.
export function sessionCookieOptions(
  env: NodeJS.ProcessEnv = process.env,
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/api",
    maxAge: SESSION_MAX_AGE,
  };
}
export async function setSession(res: Response, user: User) {
  const token = randomBytes(32).toString("base64url");
  await db.getRepository(Sessions).delete({ expiresAt: LessThan(new Date()) });
  await db.getRepository(Sessions).save({
    id: sessionHash(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE),
  });
  res.cookie("compatipc_session", token, sessionCookieOptions());
  return publicUser(user);
}

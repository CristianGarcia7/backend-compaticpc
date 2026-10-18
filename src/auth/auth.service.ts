import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  hashPassword,
  publicUser,
  sessionHash,
  verifyPassword,
} from "../auth/password.service";
import {
  credentials,
  current,
  parse,
  registration,
  sessionCookieOptions,
  setSession,
} from "../common/api.service";
import { db, Sessions, Users } from "../database/data-source";
@Injectable()
export class AuthService {
  async register(body: unknown, res: Response) {
    const input = parse(registration, body);
    const repo = db.getRepository(Users);
    try {
      const user = await repo.save({
        ...input,
        password: hashPassword(input.password),
        role: "technician",
      });
      return await setSession(res, user);
    } catch (error: any) {
      if (error.code === "23505")
        throw new BadRequestException(
          "No se pudo crear la cuenta con ese correo.",
        );
      throw error;
    }
  }
  async login(body: unknown, res: Response) {
    const input = parse(credentials, body);
    const user = await db
      .getRepository(Users)
      .findOneBy({ email: input.email });
    const valid = verifyPassword(
      input.password,
      user?.password || "00000000000000000000000000000000:" + "00".repeat(64),
    );
    if (!user || !valid)
      throw new UnauthorizedException("Correo o contraseña incorrectos.");
    return setSession(res, user);
  }
  // TODO: password reset by email (POST auth/forgot-password + auth/reset-password
  // with a single-use, hashed, expiring token). Requires mail infrastructure,
  // which is out of scope for this delivery.
  async logout(req: Request, res: Response) {
    const token = req.cookies?.compatipc_session;
    if (typeof token === "string")
      await db.getRepository(Sessions).delete({ id: sessionHash(token) });
    res.clearCookie("compatipc_session", sessionCookieOptions());
    return { ok: true };
  }
  async me(req: Request) {
    return publicUser(await current(req));
  }
}

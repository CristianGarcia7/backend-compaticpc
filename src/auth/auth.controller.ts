import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
@Controller("api")
export class AuthController {
  constructor(@Inject(AuthService) private readonly service: AuthService) {}
  @Post("auth/register") async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.service.register(body, res);
  }
  @Post("auth/login") @HttpCode(200) async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.service.login(body, res);
  }
  @Post("auth/logout") @HttpCode(200) async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.service.logout(req, res);
  }
  @Get("auth/me") async me(@Req() req: Request) {
    return this.service.me(req);
  }
}

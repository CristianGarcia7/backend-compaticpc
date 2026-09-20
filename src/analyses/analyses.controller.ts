import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AnalysesService } from "./analyses.service";
@Controller("api")
export class AnalysesController {
  constructor(
    @Inject(AnalysesService) private readonly service: AnalysesService,
  ) {}
  @Post("analyses") async analyse(@Req() req: Request, @Body() body: unknown) {
    return this.service.analyse(req, body);
  }
  @Get("analyses") async history(@Req() req: Request) {
    return this.service.history(req);
  }
  @Get("analyses/:id") detail(@Req() req: Request, @Param("id") id: string) {
    return this.service.detail(req, id);
  }
  @Patch("analyses/:id/feedback") async feedback(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.feedback(req, id, body);
  }
  @Get("analyses/:id/pdf") async pdf(
    @Req() req: Request,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    return this.service.pdf(req, id, res);
  }
}

import { Controller, Get, Inject, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { SystemService } from "./system.service";
@Controller("api")
export class SystemController {
  constructor(@Inject(SystemService) private readonly service: SystemService) {}
  @Get("health") async health(@Res({ passthrough: true }) res: Response) {
    const health = await this.service.health();
    // Load balancers and uptime monitors read the status code.
    if (health.db !== "ok") res.status(503);
    return health;
  }
  @Get("config") config() {
    return this.service.config();
  }
  @Get("dashboard") async dashboard(@Req() req: Request) {
    return this.service.dashboard(req);
  }
}

import { Controller, Get, Inject, Req } from "@nestjs/common";
import type { Request } from "express";
import { SystemService } from "./system.service";
@Controller("api")
export class SystemController {
  constructor(@Inject(SystemService) private readonly service: SystemService) {}
  @Get("health") health() {
    return this.service.health();
  }
  @Get("config") config() {
    return this.service.config();
  }
  @Get("dashboard") async dashboard(@Req() req: Request) {
    return this.service.dashboard(req);
  }
}

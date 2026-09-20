import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { ComponentsService } from "./components.service";
@Controller("api")
export class ComponentsController {
  constructor(
    @Inject(ComponentsService) private readonly service: ComponentsService,
  ) {}
  @Get("components") async components(@Req() req: Request) {
    return this.service.components(req);
  }
  @Post("components") async createComponent(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    return this.service.createComponent(req, body);
  }
  @Patch("components/:id") async updateComponent(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateComponent(req, id, body);
  }
  @Delete("components/:id") async deleteComponent(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.service.deleteComponent(req, id);
  }
}

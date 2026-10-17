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
import { EquipmentService } from "./equipment.service";
@Controller("api")
export class EquipmentController {
  constructor(
    @Inject(EquipmentService) private readonly service: EquipmentService,
  ) {}
  @Get("equipment") async equipment(@Req() req: Request) {
    return this.service.equipment(req);
  }
  @Post("equipment") async createEquipment(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    return this.service.createEquipment(req, body);
  }
  @Patch("equipment/:id") async updateEquipment(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.service.updateEquipment(req, id, body);
  }
  @Delete("equipment/:id") async deleteEquipment(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.service.deleteEquipment(req, id);
  }
}

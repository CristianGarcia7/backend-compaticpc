import { Module } from "@nestjs/common";
import { GeminiHealthService } from "./gemini-health.service";
import { SystemController } from "./system.controller";
import { SystemService } from "./system.service";
@Module({
  controllers: [SystemController],
  providers: [SystemService, GeminiHealthService],
})
export class SystemModule {}

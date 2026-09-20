import { Module } from "@nestjs/common";
import { AnalysesModule } from "./analyses/analyses.module";
import { AuthModule } from "./auth/auth.module";
import { ComponentsModule } from "./components/components.module";
import { EquipmentModule } from "./equipment/equipment.module";
import { SystemModule } from "./system/system.module";
@Module({
  imports: [
    SystemModule,
    AuthModule,
    EquipmentModule,
    ComponentsModule,
    AnalysesModule,
  ],
})
export class AppModule {}

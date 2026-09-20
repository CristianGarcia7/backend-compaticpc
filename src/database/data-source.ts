import "dotenv/config";
import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  Analyses,
  Components,
  EquipmentRows,
  Sessions,
  Users,
} from "./entities";
import { Initial1789770000000 } from "./migrations/1789770000000-initial";
export * from "./entities";
export const db = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [Users, EquipmentRows, Components, Analyses, Sessions],
  migrations: [Initial1789770000000],
  synchronize: false,
  logging: false,
});

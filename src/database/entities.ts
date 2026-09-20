import { EntitySchema } from "typeorm";
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
}
export interface Equipment {
  id: string;
  ownerId: string;
  brand: string;
  model: string;
  board: string;
  serial: string;
  createdAt: Date;
}
export interface Component {
  id: string;
  name: string;
  category: string;
  specifications: string;
  source: string;
}
export interface Analysis {
  id: string;
  ownerId: string;
  equipment: Equipment;
  category: string;
  reference: string;
  specifications: string;
  result: any;
  provider: string;
  model: string;
  feedback: string | null;
  createdAt: Date;
}
export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}
const uuid = {
  type: "uuid" as const,
  primary: true,
  generated: "uuid" as const,
};
export const Users = new EntitySchema<User>({
  name: "users",
  columns: {
    id: uuid,
    name: { type: String },
    email: { type: String, unique: true },
    password: { type: String },
    role: { type: String, default: "technician" },
  },
});
export const EquipmentRows = new EntitySchema<Equipment>({
  name: "equipment",
  columns: {
    id: uuid,
    ownerId: { type: "uuid" },
    brand: { type: String },
    model: { type: String },
    board: { type: String },
    serial: { type: String },
    createdAt: { type: Date, createDate: true },
  },
});
export const Components = new EntitySchema<Component>({
  name: "components",
  columns: {
    id: uuid,
    name: { type: String },
    category: { type: String },
    specifications: { type: String },
    source: { type: String },
  },
});
export const Analyses = new EntitySchema<Analysis>({
  name: "analyses",
  columns: {
    id: uuid,
    ownerId: { type: "uuid" },
    equipment: { type: "jsonb" },
    category: { type: String },
    reference: { type: String },
    specifications: { type: String },
    result: { type: "jsonb" },
    provider: { type: String },
    model: { type: String },
    feedback: { type: String, nullable: true },
    createdAt: { type: Date, createDate: true },
  },
});
export const Sessions = new EntitySchema<Session>({
  name: "sessions",
  columns: {
    id: { type: String, primary: true },
    userId: { type: "uuid" },
    expiresAt: { type: Date },
  },
});

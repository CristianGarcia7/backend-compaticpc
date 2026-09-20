import { MigrationInterface, QueryRunner } from "typeorm";
export class Initial1789770000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;
 CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar NOT NULL,email varchar UNIQUE NOT NULL,password varchar NOT NULL,role varchar NOT NULL DEFAULT 'technician');
 CREATE TABLE equipment(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"ownerId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,brand varchar NOT NULL,model varchar NOT NULL,board varchar NOT NULL,serial varchar NOT NULL,"createdAt" timestamptz NOT NULL DEFAULT now());
 CREATE TABLE components(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name varchar NOT NULL,category varchar NOT NULL,specifications varchar NOT NULL,source varchar NOT NULL);
 CREATE TABLE analyses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),"ownerId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,equipment jsonb NOT NULL,category varchar NOT NULL,reference varchar NOT NULL,specifications varchar NOT NULL,result jsonb NOT NULL,provider varchar NOT NULL,model varchar NOT NULL,feedback varchar,"createdAt" timestamptz NOT NULL DEFAULT now());
 CREATE INDEX analyses_owner ON analyses("ownerId","createdAt"); CREATE INDEX equipment_owner ON equipment("ownerId");
 CREATE TABLE sessions(id varchar PRIMARY KEY,"userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,"expiresAt" timestamptz NOT NULL);`);
    for (const [name, category, specifications] of [
      [
        "HP · ejemplo RAM DDR4",
        "RAM",
        "Ejemplo ilustrativo: DDR4 SODIMM 8 GB, 1.2 V. Verificar el manual exacto del equipo.",
      ],
      [
        "Lenovo · ejemplo SSD NVMe",
        "Almacenamiento",
        "Ejemplo ilustrativo: SSD M.2 2280 NVMe. Verificar interfaz, ranura y firmware.",
      ],
      [
        "Dell · ejemplo memoria DDR3",
        "RAM",
        "Ejemplo ilustrativo: DDR3 DIMM 4 GB. No intercambiable con DDR4.",
      ],
    ])
      await q.query(
        "INSERT INTO components(name,category,specifications,source) VALUES($1,$2,$3,$4)",
        [
          name,
          category,
          specifications,
          "DEMOSTRACIÓN · especificaciones no verificadas por el fabricante",
        ],
      );
  }
  async down(q: QueryRunner) {
    await q.query("DROP TABLE sessions,analyses,components,equipment,users");
  }
}

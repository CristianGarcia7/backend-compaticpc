import { MigrationInterface, QueryRunner } from "typeorm";
import { CatalogEntry } from "./1789780000000-catalog-datasheets";
// Checked on 2026-10-18 with curl -sIL: each new URL ends in HTTP 200 on a
// product-specific document. The previous links redirected to a generic
// Samsung page and to a Crucial 404.
export const datasheetFixes = [
  {
    name: "Samsung 970 EVO Plus MZ-V7S1T0BW",
    url: "https://download.semiconductor.samsung.com/resources/data-sheet/Samsung_NVMe_SSD_970_EVO_Plus_Data_Sheet_Rev.3.0.pdf",
    previous:
      "https://semiconductor.samsung.com/consumer-storage/internal-ssd/970evoplus/",
  },
  {
    // Official Crucial datasheet, hosted by Micron (linked from crucial.com MX500 support).
    name: "Crucial MX500 CT1000MX500SSD1",
    url: "https://assets.micron.com/adobe/assets/urn:aaid:aem:3c743a1f-9319-4b34-9b20-15cdad1ee2ce/renditions/original/as/crucial-mx500-ssd-productflyer-en.pdf",
    previous: "https://www.crucial.com/ssd/mx500/ct1000mx500ssd1",
  },
];
// Official NVIDIA figures: 450 W total graphics power, 850 W required system power.
export const rtx4090: CatalogEntry = {
  name: "NVIDIA GeForce RTX 4090",
  category: "Tarjeta gráfica",
  specifications:
    "PCIe 4.0, 24GB GDDR6X, potencia gráfica 450W, fuente recomendada 850W, 3 cables PCIe de 8 pines (adaptador incluido) o cable PCIe Gen 5 de 450W o más",
  source: "Ficha técnica oficial NVIDIA",
  datasheetUrl:
    "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/",
};
// Only a row still holding the expected link changes: an admin edit survives.
const GUARDED_UPDATE = `UPDATE components SET "datasheetUrl"=$2 WHERE name=$1 AND "datasheetUrl" IS NOT DISTINCT FROM $3`;
export class CatalogDatasheetFixes1789800000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    for (const fix of datasheetFixes)
      await q.query(GUARDED_UPDATE, [fix.name, fix.url, fix.previous]);
    const c = rtx4090;
    await q.query(
      `INSERT INTO components(name,category,specifications,source,"datasheetUrl") SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar WHERE NOT EXISTS (SELECT 1 FROM components WHERE name=$1::varchar)`,
      [c.name, c.category, c.specifications, c.source, c.datasheetUrl],
    );
  }
  async down(q: QueryRunner) {
    for (const fix of datasheetFixes)
      await q.query(GUARDED_UPDATE, [fix.name, fix.previous, fix.url]);
    // Only the row this migration inserted, never an admin-edited one.
    await q.query(
      "DELETE FROM components WHERE name=$1 AND specifications=$2 AND source=$3",
      [rtx4090.name, rtx4090.specifications, rtx4090.source],
    );
  }
}

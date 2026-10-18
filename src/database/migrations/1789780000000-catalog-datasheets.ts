import { MigrationInterface, QueryRunner } from "typeorm";
export interface CatalogEntry {
  name: string;
  category: string;
  specifications: string;
  source: string;
  datasheetUrl: string | null;
}
const entry = (
  name: string,
  category: string,
  specifications: string,
  source: string,
  datasheetUrl: string | null,
): CatalogEntry => ({ name, category, specifications, source, datasheetUrl });
// Reviewed against the manufacturer pages. datasheetUrl is null when no stable
// official page exists (EVGA and WD redirect the product to a generic page).
export const catalog: CatalogEntry[] = [
  entry(
    "Crucial MX500 CT1000MX500SSD1",
    "Almacenamiento",
    "SSD SATA III (6 Gb/s) 2.5 pulgadas, 1TB, 7mm de espesor, lectura hasta 560MB/s, escritura hasta 510MB/s",
    "Ficha técnica oficial Crucial",
    "https://www.crucial.com/ssd/mx500/ct1000mx500ssd1",
  ),
  entry(
    "Samsung 970 EVO Plus MZ-V7S1T0BW",
    "Almacenamiento",
    "SSD NVMe M.2 2280, PCIe 3.0 x4, 1TB, lectura hasta 3500MB/s, escritura hasta 3300MB/s",
    "Ficha técnica oficial Samsung",
    "https://semiconductor.samsung.com/consumer-storage/internal-ssd/970evoplus/",
  ),
  entry(
    "Seagate BarraCuda ST1000DM010",
    "Almacenamiento",
    "HDD 3.5 pulgadas, SATA III (6 Gb/s), 1TB, 7200RPM, caché 64MB",
    "Ficha técnica oficial Seagate",
    "https://www.seagate.com/www-content/datasheets/pdfs/3-5-barracudaDS1900-14-2007US-en_US.pdf",
  ),
  entry(
    "Western Digital Blue SN570 WDS100T3B0C",
    "Almacenamiento",
    "SSD NVMe M.2 2280, PCIe 3.0 x4, 1TB, lectura hasta 3500MB/s",
    "Ficha técnica oficial Western Digital",
    null,
  ),
  entry(
    "Corsair RM750x",
    "Fuente de poder",
    "750W, 80 Plus Gold, formato ATX, totalmente modular",
    "Ficha técnica oficial Corsair",
    "https://www.corsair.com/us/en/p/psu/cp-9020199-na/rm750x-750-watt-80-plus-gold-certified-fully-modular-psu-cp-9020199-na",
  ),
  entry(
    "EVGA 600 BR",
    "Fuente de poder",
    "600W, 80 Plus Bronze, formato ATX, no modular",
    "Ficha técnica oficial EVGA",
    null,
  ),
  entry(
    "AMD Ryzen 5 5600X",
    "Procesador",
    "Socket AM4, 6 núcleos / 12 hilos, TDP 65W, incluye disipador Wraith Stealth, memoria DDR4",
    "Ficha técnica oficial AMD",
    "https://www.amd.com/en/products/processors/desktops/ryzen/5000-series/amd-ryzen-5-5600x.html",
  ),
  entry(
    "Intel Core i5-12400F",
    "Procesador",
    "Socket LGA1700, 6 núcleos / 12 hilos, sin gráficos integrados, potencia base 65W (turbo máx. 117W), memoria DDR4-3200 o DDR5-4800",
    "Ficha técnica oficial Intel",
    "https://www.intel.com/content/www/us/en/products/sku/134587/intel-core-i512400f-processor-18m-cache-up-to-4-40-ghz/specifications.html",
  ),
  entry(
    "Corsair Vengeance LPX CMK16GX4M2B3200C16",
    "RAM",
    "DIMM DDR4 (escritorio, UDIMM), kit 2x8GB (16GB), 3200MHz, CL16, 1.35V",
    "Ficha técnica oficial Corsair",
    "https://www.corsair.com/us/en/p/memory/cmk16gx4m2b3200c16/vengeance-lpx-16gb-2-x-8gb-ddr4-dram-3200mhz-c16-memory-kit-black-cmk16gx4m2b3200c16",
  ),
  entry(
    "Crucial CT8G4SFRA32A",
    "RAM",
    "SO-DIMM DDR4 (portátil), 8GB, 3200MHz, CL22, 1.2V",
    "Ficha técnica oficial Crucial",
    "https://www.crucial.com/memory/ddr4/ct8g4sfra32a",
  ),
  entry(
    "Kingston FURY Beast KF432C16BB1/8",
    "RAM",
    "DIMM DDR4 (escritorio), 8GB, 3200MHz, CL16, 1.35V, un solo módulo",
    "Ficha técnica oficial Kingston",
    "https://www.kingston.com/en/memory/gaming/kingston-fury-beast-ddr4-memory",
  ),
  entry(
    "Kingston FURY Impact KF556S40IB-16",
    "RAM",
    "SO-DIMM DDR5 (portátil), 16GB, 5600MHz, CL40, 1.1V",
    "Ficha técnica oficial Kingston",
    "https://www.kingston.com/datasheets/KF556S40IB-16.pdf",
  ),
  entry(
    "AMD Radeon RX 6600",
    "Tarjeta gráfica",
    "PCIe 4.0 x8, 8GB GDDR6, potencia típica de la tarjeta 132W, conector de 8 pines",
    "Ficha técnica oficial AMD",
    "https://www.amd.com/en/products/graphics/desktops/radeon/6000-series/amd-radeon-rx-6600.html",
  ),
  entry(
    "NVIDIA GeForce RTX 4060",
    "Tarjeta gráfica",
    "PCIe 4.0 x8, 8GB GDDR6, potencia gráfica 115W, conector de 8 pines, fuente recomendada 550W",
    "Ficha técnica oficial NVIDIA",
    "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4060-4060ti/",
  ),
  entry(
    "Dell 65W USB-C Adapter 492-BDQM",
    "Cargador",
    "Cargador USB-C Power Delivery 65W, salida 20V 3.25A (también 15V 3A, 9V 3A y 5V 3A), entrada 100-240 VAC",
    "Ficha técnica oficial Dell",
    "https://www.dell.com/en-us/shop/dell-65w-usb-c-adapter/apd/492-bdqm/pc-accessories",
  ),
  entry(
    "Lenovo USB-C 65W AC Adapter 4X20M26268",
    "Cargador",
    "Cargador USB-C Power Delivery 65W con voltaje inteligente (5V, 9V, 15V o 20V), para ThinkPad con USB-C",
    "Ficha técnica oficial Lenovo",
    "https://www.lenovo.com/us/en/p/accessories-and-software/chargers-and-batteries/chargers/4x20m26268",
  ),
  entry(
    "HP 65W Smart AC Adapter H6Y89AA",
    "Cargador",
    "Cargador 65W, conector de punta 4.5 mm en ángulo recto; incluye adaptador a punta de 7.4 mm; cable de 180 cm",
    "Ficha técnica oficial HP",
    "https://www.hp.com/ie-en/products/accessories/product-details/5409407",
  ),
  entry(
    "HP HT03XL L11119-855",
    "Batería",
    "Batería Li-ion de 3 celdas, 41Wh, 3.6Ah, código HT03XL, número de parte L11119-855",
    "Ficha técnica oficial HP",
    "https://www.hp.com/us-en/parts-store/products/lithium-batteries/hp-3-cell-41wh-li-ion-battery-with-3-6ah-capacity-ht03xl-l11119-855",
  ),
];
// Production values before this migration (restored by down()).
const previous: [string, string, string, string][] = [
  [
    "Crucial MX500 CT1000MX500SSD1",
    "Almacenamiento",
    "SSD SATA III 2.5 pulgadas, 1TB, 7mm de espesor",
    "Ficha técnica oficial Crucial",
  ],
  [
    "Samsung 970 EVO Plus MZ-V7S1T0BW",
    "Almacenamiento",
    "SSD NVMe M.2 2280, PCIe 3.0 x4, 1TB, lectura hasta 3500MB/s",
    "Ficha técnica oficial Samsung",
  ],
  [
    "Seagate BarraCuda ST1000DM010",
    "Almacenamiento",
    "HDD 3.5 pulgadas, SATA III, 1TB, 7200RPM, caché 64MB",
    "Ficha técnica oficial Seagate",
  ],
  [
    "Western Digital Blue SN570 WDS100T3B0C",
    "Almacenamiento",
    "SSD NVMe M.2 2280, PCIe 3.0 x4, 1TB",
    "Ficha técnica oficial Western Digital",
  ],
  [
    "Corsair RM750x",
    "Fuente de poder",
    "750W, 80 Plus Gold, formato ATX, totalmente modular",
    "Ficha técnica oficial Corsair",
  ],
  [
    "EVGA 600 BR",
    "Fuente de poder",
    "600W, 80 Plus Bronze, formato ATX, no modular",
    "Ficha técnica oficial EVGA",
  ],
  [
    "AMD Ryzen 5 5600X",
    "Procesador",
    "Socket AM4, 6 núcleos / 12 hilos, TDP 65W, incluye disipador",
    "Ficha técnica oficial AMD",
  ],
  [
    "Intel Core i5-12400F",
    "Procesador",
    "Socket LGA1700, 6 núcleos / 12 hilos, sin gráficos integrados, TDP 65W",
    "Ficha técnica oficial Intel",
  ],
  [
    "Corsair Vengeance LPX CMK16GX4M2B3200C16",
    "RAM",
    "UDIMM DDR4 (escritorio), kit 2x8GB (16GB), 3200MHz, CL16, 1.35V",
    "Ficha técnica oficial Corsair",
  ],
  [
    "Crucial CT8G4SFRA32A",
    "RAM",
    "SO-DIMM DDR4, 8GB, 3200MHz, CL22, 1.2V",
    "Ficha técnica oficial Crucial",
  ],
  [
    "Kingston FURY Beast KF432C16BB1/8",
    "RAM",
    "SO-DIMM DDR4, 8GB, 3200MHz, CL16, 1.35V, un solo módulo",
    "Ficha técnica oficial Kingston",
  ],
  [
    "Kingston FURY Impact KF556S40IB-16",
    "RAM",
    "SO-DIMM DDR5, 16GB, 5600MHz, CL40, 1.1V",
    "Ficha técnica oficial Kingston",
  ],
  [
    "AMD Radeon RX 6600",
    "Tarjeta gráfica",
    "PCIe 4.0 x8, 8GB GDDR6, TDP 132W, conector de 8 pines",
    "Ficha técnica oficial AMD",
  ],
  [
    "NVIDIA GeForce RTX 4060",
    "Tarjeta gráfica",
    "PCIe 4.0 x8, 8GB GDDR6, TDP 115W, conector de 8 pines",
    "Ficha técnica oficial NVIDIA",
  ],
];
export class CatalogDatasheets1789780000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `ALTER TABLE components ADD COLUMN "datasheetUrl" varchar NULL`,
    );
    // Upsert by name: production rows are corrected in place, demo rows untouched.
    // components.name has no UNIQUE constraint, so if an admin created duplicate
    // names, every row with that name receives the corrected values.
    for (const c of catalog) {
      const params = [
        c.name,
        c.category,
        c.specifications,
        c.source,
        c.datasheetUrl,
      ];
      await q.query(
        `UPDATE components SET category=$2,specifications=$3,source=$4,"datasheetUrl"=$5 WHERE name=$1`,
        params,
      );
      await q.query(
        `INSERT INTO components(name,category,specifications,source,"datasheetUrl") SELECT $1::varchar,$2::varchar,$3::varchar,$4::varchar,$5::varchar WHERE NOT EXISTS (SELECT 1 FROM components WHERE name=$1::varchar)`,
        params,
      );
    }
  }
  async down(q: QueryRunner) {
    for (const params of previous)
      await q.query(
        "UPDATE components SET category=$2,specifications=$3,source=$4 WHERE name=$1",
        params,
      );
    const known = new Set(previous.map(([name]) => name));
    const added = catalog.map((c) => c.name).filter((n) => !known.has(n));
    await q.query("DELETE FROM components WHERE name = ANY($1)", [added]);
    await q.query(`ALTER TABLE components DROP COLUMN "datasheetUrl"`);
  }
}

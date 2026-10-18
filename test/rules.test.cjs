const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateRules,
  rulesVerdict,
  matchCatalog,
  catalogWarnings,
} = require("../dist/analyses/rules");
function run(input) {
  const rules = evaluateRules(input);
  return { rules, verdict: rulesVerdict(rules) };
}
function rule(rules, id) {
  return rules.find((r) => r.id === id);
}
const z790 = {
  brand: "Personalizado",
  model: "PC de escritorio",
  board: "ASUS PRIME Z790-P, DDR5, ATX",
};
test("DDR4 module in a DDR5 board is incompatible", () => {
  const { rules, verdict } = run({
    equipment: z790,
    category: "RAM",
    reference: "Corsair Vengeance LPX",
    specifications: "UDIMM DDR4 16GB 3200MHz",
  });
  assert.equal(rule(rules, "ram-generation").status, "fail");
  assert.equal(verdict, "incompatible");
});
test("DDR5 DIMM in a Z790 DDR5 board is compatible", () => {
  const { rules, verdict } = run({
    equipment: z790,
    category: "RAM",
    reference: "Kingston FURY Beast DDR5",
    specifications: "DIMM DDR5 16GB 5600MHz CL36",
  });
  assert.equal(rule(rules, "ram-generation").status, "pass");
  assert.equal(rule(rules, "ram-form-factor").status, "pass");
  assert.equal(verdict, "compatible");
});
test("SO-DIMM module in a desktop is incompatible", () => {
  const { rules, verdict } = run({
    equipment: {
      brand: "Dell",
      model: "OptiPlex torre",
      board: "Chipset B660 DDR4 DIMM",
    },
    category: "RAM",
    reference: "Crucial CT8G4SFRA32A",
    specifications: "SO-DIMM DDR4 8GB 3200MHz",
  });
  assert.equal(rule(rules, "ram-form-factor").status, "fail");
  assert.equal(verdict, "incompatible");
});
test("DIMM module in a laptop is incompatible", () => {
  const { rules } = run({
    equipment: {
      brand: "HP",
      model: "Pavilion portátil 15",
      board: "DDR4 SO-DIMM",
    },
    category: "RAM",
    reference: "Módulo de escritorio",
    specifications: "DIMM DDR4 8GB",
  });
  assert.equal(rule(rules, "ram-form-factor").status, "fail");
});
test("underpowered power supply is incompatible", () => {
  const { rules, verdict } = run({
    equipment: {
      brand: "Personalizado",
      model: "Estación de trabajo",
      board: "Z790 ATX, CPU Core i9-13900K 253W, GPU RTX 4090 450W",
    },
    category: "Fuente de poder",
    reference: "EVGA 600 BR",
    specifications: "600W, 80 Plus Bronze, ATX",
  });
  assert.equal(rule(rules, "psu-capacity").status, "fail");
  assert.equal(verdict, "incompatible");
});
test("sufficient power supply passes with headroom", () => {
  const { rules, verdict } = run({
    equipment: {
      brand: "Personalizado",
      model: "PC",
      board: "B550 ATX, CPU Ryzen 5 5600X 65W, GPU RX 6600 132W",
    },
    category: "Fuente de poder",
    reference: "Corsair RM750x",
    specifications: "750W 80 Plus Gold",
  });
  assert.equal(rule(rules, "psu-capacity").status, "pass");
  assert.equal(verdict, "compatible");
});
test("power supply without system TDP data is unknown and conditional", () => {
  const { rules, verdict } = run({
    equipment: { brand: "Genérico", model: "PC", board: "B550" },
    category: "Fuente de poder",
    reference: "EVGA 600 BR",
    specifications: "600W",
  });
  assert.equal(rule(rules, "psu-capacity").status, "unknown");
  assert.equal(verdict, "conditional");
});
test("underpowered charger is incompatible", () => {
  const { rules, verdict } = run({
    equipment: {
      brand: "Dell",
      model: "XPS 15 9520 portátil",
      board: "Requiere cargador USB-C 130W",
    },
    category: "Cargador",
    reference: "Dell 65W USB-C",
    specifications: "Cargador USB-C Power Delivery 65W, 20V 3.25A",
  });
  assert.equal(rule(rules, "charger-power").status, "fail");
  assert.equal(rule(rules, "charger-connector").status, "pass");
  assert.equal(verdict, "incompatible");
});
test("barrel charger with a different tip or voltage is incompatible", () => {
  const { rules } = run({
    equipment: {
      brand: "HP",
      model: "ProBook portátil",
      board: "Cargador 65W 19.5V punta 4.5x3.0mm",
    },
    category: "Cargador",
    reference: "Genérico",
    specifications: "90W 19V punta 7.4x5.0mm",
  });
  assert.equal(rule(rules, "charger-power").status, "pass");
  assert.equal(rule(rules, "charger-connector").status, "fail");
});
test("USB-C charger on a barrel-only laptop is incompatible", () => {
  const { rules } = run({
    equipment: {
      brand: "HP",
      model: "portátil",
      board: "Cargador 65W punta 4.5mm",
    },
    category: "Cargador",
    reference: "Lenovo 65W",
    specifications: "USB-C 65W",
  });
  assert.equal(rule(rules, "charger-connector").status, "fail");
});
test("battery voltage mismatch is incompatible and matching data is compatible", () => {
  const equipment = {
    brand: "Dell",
    model: "Latitude portátil",
    board: "Batería 11.4V 42Wh 3 celdas",
  };
  assert.equal(
    run({
      equipment,
      category: "Batería",
      reference: "Batería genérica",
      specifications: "7.6V 42Wh",
    }).verdict,
    "incompatible",
  );
  assert.equal(
    run({
      equipment,
      category: "Batería",
      reference: "Batería original",
      specifications: "11.4V 42Wh 3 celdas",
    }).verdict,
    "compatible",
  );
});
test("CPU socket is inferred from the chipset", () => {
  const amd = run({
    equipment: { brand: "MSI", model: "PC", board: "MSI B550-A PRO" },
    category: "Procesador",
    reference: "Intel Core i5-12400F",
    specifications: "Socket LGA1700, 65W",
  });
  assert.equal(rule(amd.rules, "cpu-socket").status, "fail");
  assert.equal(amd.verdict, "incompatible");
  const intel = run({
    equipment: { brand: "ASUS", model: "PC", board: "B760M DDR5" },
    category: "Procesador",
    reference: "Intel Core i5-12400F",
    specifications: "LGA 1700",
  });
  assert.equal(rule(intel.rules, "cpu-socket").status, "pass");
});
test("missing generation data stays unknown and conditional", () => {
  const { rules, verdict } = run({
    equipment: { brand: "Ejemplo", model: "Modelo", board: "Placa sin datos" },
    category: "RAM",
    reference: "Memoria",
    specifications: "8GB",
  });
  assert.equal(rule(rules, "ram-generation").status, "unknown");
  assert.equal(verdict, "conditional");
});
test("categories without deterministic rules are conditional", () => {
  assert.equal(
    run({
      equipment: z790,
      category: "Almacenamiento",
      reference: "SSD",
      specifications: "NVMe M.2 2280",
    }).verdict,
    "conditional",
  );
});
const catalog = [
  {
    name: "Kingston FURY Beast KF432C16BB1/8",
    category: "RAM",
    specifications: "DIMM DDR4 (escritorio), 8GB, 3200MHz, CL16, 1.35V",
    source: "Ficha técnica oficial Kingston",
    datasheetUrl: "https://www.kingston.com/",
  },
  {
    name: "HP · ejemplo RAM DDR4",
    category: "RAM",
    specifications: "Ejemplo ilustrativo: DDR4 SODIMM 8 GB",
    source: "DEMOSTRACIÓN · especificaciones no verificadas por el fabricante",
    datasheetUrl: null,
  },
];
test("catalog matches by part number regardless of case and punctuation", () => {
  assert.equal(matchCatalog(catalog, "kf432c16bb1-8")?.name, catalog[0].name);
  assert.equal(
    matchCatalog(catalog, "Kingston FURY Beast KF432C16BB1/8")?.name,
    catalog[0].name,
  );
  assert.equal(matchCatalog(catalog, "Memoria desconocida"), null);
  assert.equal(matchCatalog(catalog, "HP · ejemplo RAM DDR4"), null);
});
test("catalog datasheet facts drive rules and contradictions become warnings", () => {
  const input = {
    equipment: z790,
    category: "RAM",
    reference: "KF432C16BB1/8",
    specifications: "SO-DIMM DDR5 8GB",
    catalog: catalog[0],
  };
  const warnings = catalogWarnings(input);
  assert.ok(warnings.some((w) => /DIMM/.test(w) && /SO-DIMM/.test(w)));
  assert.ok(warnings.some((w) => /DDR4/.test(w) && /DDR5/.test(w)));
  const rules = evaluateRules(input);
  assert.equal(rule(rules, "ram-generation").status, "fail");
  assert.match(rule(rules, "ram-generation").source, /kingston/i);
  assert.equal(
    catalogWarnings({ ...input, specifications: "DDR4 DIMM" }).length,
    0,
  );
});
const realCatalog = [
  catalog[0],
  {
    name: "Kingston FURY Impact KF556S40IB-16",
    category: "RAM",
    specifications: "SO-DIMM DDR5 (portátil), 16GB, 5600MHz, CL40, 1.1V",
    source: "Ficha técnica oficial Kingston",
    datasheetUrl: null,
  },
  {
    name: "AMD Ryzen 5 5600X",
    category: "Procesador",
    specifications: "Socket AM4, 6 núcleos / 12 hilos, TDP 65W",
    source: "Ficha técnica oficial AMD",
    datasheetUrl: null,
  },
];
test("generic references never bind a catalog row by substring", () => {
  const reference = "AMD Ryzen 5";
  const match = matchCatalog(realCatalog, reference);
  assert.equal(match, null);
  const input = {
    equipment: { brand: "MSI", model: "PC", board: "MSI B650 TOMAHAWK" },
    category: "Procesador",
    reference,
    specifications: "Ryzen 5 7600, socket AM5",
    catalog: match,
  };
  const rules = evaluateRules(input);
  assert.equal(rule(rules, "cpu-socket").status, "pass");
  assert.notEqual(rulesVerdict(rules), "incompatible");
  assert.deepEqual(catalogWarnings(input), []);
});
test("ambiguous references return no catalog match", () => {
  assert.equal(matchCatalog(realCatalog, "Kingston FURY"), null);
  assert.equal(
    matchCatalog(realCatalog, "Kingston KF432C16BB1/8 o KF556S40IB-16"),
    null,
  );
});
test("confident matches use the exact name or a full part number", () => {
  assert.equal(
    matchCatalog(realCatalog, "Kingston FURY Beast KF432C16BB1/8")?.name,
    realCatalog[0].name,
  );
  assert.equal(
    matchCatalog(realCatalog, "amd ryzen 5 5600x")?.name,
    "AMD Ryzen 5 5600X",
  );
  assert.equal(
    matchCatalog(realCatalog, "Ryzen 5600X")?.name,
    "AMD Ryzen 5 5600X",
  );
});

// Regression tests for the PR review findings (B-1 to B-7 and nits).
test("B-1 charger voltage is read after the charger keyword, not the battery", () => {
  const equipment = {
    brand: "HP",
    model: "ProBook portátil",
    board: "batería 11.4V 41Wh, cargador 65W 19.5V punta 4.5 mm",
  };
  const charger = run({
    equipment,
    category: "Cargador",
    reference: "HP 65W",
    specifications: "65W 19.5V punta 4.5 mm",
  });
  assert.equal(rule(charger.rules, "charger-voltage").status, "pass");
  assert.equal(charger.verdict, "compatible");
  const battery = run({
    equipment,
    category: "Batería",
    reference: "HT03XL",
    specifications: "11.4V 41Wh",
  });
  assert.equal(rule(battery.rules, "battery-voltage").status, "pass");
  const ram = run({
    equipment: {
      brand: "HP",
      model: "portátil",
      board: "DDR4 SO-DIMM 1.2V, cargador 19.5V",
    },
    category: "Cargador",
    reference: "Genérico",
    specifications: "65W 19.5V",
  });
  assert.equal(rule(ram.rules, "charger-voltage").status, "pass");
});
test("B-1 several equipment voltages for the same part are unknown", () => {
  const { rules } = run({
    equipment: {
      brand: "HP",
      model: "portátil",
      board: "cargador 19.5V o cargador 20V",
    },
    category: "Cargador",
    reference: "Genérico",
    specifications: "65W 12V",
  });
  assert.equal(rule(rules, "charger-voltage").status, "unknown");
});
test("B-2 compact desktops without a stated slot type are not a hard fail", () => {
  for (const board of [
    "ASRock DeskMini B760 mini-ITX",
    "Dell OptiPlex Micro",
    "Intel NUC 12",
  ]) {
    const { rules, verdict } = run({
      equipment: { brand: "Varios", model: "Equipo", board },
      category: "RAM",
      reference: "Crucial CT8G4SFRA32A",
      specifications: "SO-DIMM DDR4 8GB",
    });
    assert.notEqual(rule(rules, "ram-form-factor").status, "fail", board);
    assert.notEqual(verdict, "incompatible", board);
  }
});
test("B-2 an inferred desktop only warns about SO-DIMM", () => {
  const { rules } = run({
    equipment: { brand: "Dell", model: "torre", board: "B660 DDR4" },
    category: "RAM",
    reference: "Módulo",
    specifications: "SO-DIMM DDR4 8GB",
  });
  assert.equal(rule(rules, "ram-form-factor").status, "warn");
});
test("B-2 laptop model codes are not read as desktop chipsets", () => {
  const { rules } = run({
    equipment: { brand: "ASUS", model: "VivoBook X570ZD", board: "DDR4" },
    category: "Procesador",
    reference: "Ryzen",
    specifications: "Socket AM4",
  });
  assert.equal(rule(rules, "cpu-socket").status, "unknown");
});
test("B-3 an explicit socket wins over other socket mentions", () => {
  const { rules } = run({
    equipment: { brand: "MSI", model: "PC", board: "MSI B650 TOMAHAWK AM5" },
    category: "Procesador",
    reference: "Ryzen 5 7600",
    specifications: "Disipador compatible AM4 y AM5; socket AM5",
  });
  assert.equal(rule(rules, "cpu-socket").status, "pass");
  const ambiguous = run({
    equipment: { brand: "MSI", model: "PC", board: "B650" },
    category: "Procesador",
    reference: "Ryzen",
    specifications: "Compatible AM4 y AM5",
  });
  assert.equal(rule(ambiguous.rules, "cpu-socket").status, "unknown");
});
test("B-4 a PSU inside the 30 % margin warns instead of failing", () => {
  const { rules, verdict } = run({
    equipment: {
      brand: "Personalizado",
      model: "PC",
      board: "Z790 ATX, CPU Core i9-13900K 253W, GPU RTX 4090 450W",
    },
    category: "Fuente de poder",
    reference: "1000W",
    specifications: "1000W 80 Plus Gold",
  });
  assert.equal(rule(rules, "psu-capacity").status, "warn");
  assert.equal(verdict, "conditional");
});
test("B-5 a CPU TDP is never used as the charger requirement", () => {
  const { rules } = run({
    equipment: {
      brand: "Dell",
      model: "portátil",
      board: "Core i7-1165G7 28W",
    },
    category: "Cargador",
    reference: "Genérico",
    specifications: "45W USB-C",
  });
  assert.equal(rule(rules, "charger-power").status, "unknown");
});
test("B-6 included tip adapters count and inner diameters are compared", () => {
  const hp = {
    name: "HP 65W Smart AC Adapter H6Y89AA",
    category: "Cargador",
    specifications:
      "Cargador 65W, conector de punta 4.5 mm en ángulo recto; incluye adaptador a punta de 7.4 mm; cable de 180 cm",
    source: "Ficha técnica oficial HP",
    datasheetUrl: null,
  };
  const adapter = run({
    equipment: {
      brand: "HP",
      model: "portátil",
      board: "cargador 65W punta 7.4 mm",
    },
    category: "Cargador",
    reference: "H6Y89AA",
    specifications: "",
    catalog: hp,
  });
  assert.equal(rule(adapter.rules, "charger-connector").status, "pass");
  const inner = run({
    equipment: {
      brand: "HP",
      model: "portátil",
      board: "cargador 65W punta 4.5x3.0mm",
    },
    category: "Cargador",
    reference: "Genérico",
    specifications: "65W punta 4.5x2.5mm",
  });
  assert.equal(rule(inner.rules, "charger-connector").status, "fail");
});
test("B-7 a family token does not bind a different capacity SKU", () => {
  const rows = [
    {
      name: "Crucial MX500 CT1000MX500SSD1",
      category: "Almacenamiento",
      specifications: "SSD SATA 1TB",
      source: "Ficha técnica oficial Crucial",
      datasheetUrl: null,
    },
  ];
  assert.equal(matchCatalog(rows, "Crucial MX500 500GB CT500MX500SSD1"), null);
  assert.equal(matchCatalog(rows, "CT1000MX500SSD1")?.name, rows[0].name);
});
test("nit: 'comparte' is not a part number label", () => {
  const { rules } = run({
    equipment: {
      brand: "Dell",
      model: "portátil",
      board: "Batería 11.4V; comparte chasis",
    },
    category: "Batería",
    reference: "Batería",
    specifications: "11.4V",
  });
  assert.equal(rule(rules, "battery-part"), undefined);
});
test("nit: 'sin PD' is not read as USB-C", () => {
  const { rules } = run({
    equipment: {
      brand: "HP",
      model: "portátil",
      board: "cargador 65W punta 4.5 mm",
    },
    category: "Cargador",
    reference: "Genérico",
    specifications: "65W sin PD, punta 4.5 mm",
  });
  assert.equal(rule(rules, "charger-connector").status, "pass");
});
// H2: the GPU manufacturer's required system power.
const rm750x = {
  name: "Corsair RM750x",
  category: "Fuente de poder",
  specifications: "750W, 80 Plus Gold, formato ATX, totalmente modular",
  source: "Ficha técnica oficial Corsair",
  datasheetUrl: "https://www.corsair.com/rm750x",
};
test("H2 RTX 4090 with an RM750x fails below NVIDIA's 850 W system power", () => {
  const { rules, verdict } = run({
    equipment: {
      brand: "ASUS",
      model: "PRIME Z790-P",
      board:
        "ASUS PRIME Z790-P, escritorio ATX, socket LGA1700; CPU Core i5-12400F 117 W, GPU RTX 4090 450 W",
    },
    category: "Fuente de poder",
    reference: "Corsair RM750x",
    specifications: "",
    catalog: rm750x,
  });
  const psu = rule(rules, "psu-capacity");
  assert.equal(psu.status, "fail");
  assert.match(psu.detail, /850 W/);
  assert.match(psu.detail, /RTX 4090/);
  assert.match(psu.source, /nvidia\.com\/en-us\/geforce\/graphics-cards\/40-series\/rtx-4090/);
  assert.equal(verdict, "incompatible");
});
test("H2 RTX 4060 with an RM750x meets NVIDIA's 550 W and stays compatible", () => {
  const { rules, verdict } = run({
    equipment: {
      brand: "MSI",
      model: "MAG B550 TOMAHAWK",
      board: "B550 ATX; CPU Ryzen 5 5600X 65 W, GPU RTX 4060 115 W",
    },
    category: "Fuente de poder",
    reference: "Corsair RM750x",
    specifications: "",
    catalog: rm750x,
  });
  assert.equal(rule(rules, "psu-capacity").status, "pass");
  assert.match(rule(rules, "psu-capacity").detail, /550 W/);
  assert.equal(verdict, "compatible");
});
test("H2 a recommended PSU stated in the text wins and is cited", () => {
  for (const phrase of [
    "fuente recomendada 850 W",
    "recommended PSU 850W",
    "850 W system power",
  ]) {
    const { rules } = run({
      equipment: {
        brand: "Personalizado",
        model: "PC",
        board: `B550 ATX; CPU Ryzen 5 5600X 65 W, GPU genérica 300 W, ${phrase}`,
      },
      category: "Fuente de poder",
      reference: "Fuente 750W",
      specifications: "750W 80 Plus Gold",
    });
    const psu = rule(rules, "psu-capacity");
    assert.equal(psu.status, "fail", phrase);
    assert.match(psu.detail, /850 W/, phrase);
    assert.match(psu.source, /equipo registrado/, phrase);
  }
});
test("H2 the recommendation phrase is never read as the PSU or GPU wattage", () => {
  const { rules } = run({
    equipment: { brand: "Personalizado", model: "PC", board: "B550 ATX" },
    category: "Fuente de poder",
    reference: "Fuente genérica",
    specifications:
      "1000W 80 Plus Gold; CPU Ryzen 5 5600X 65 W, GPU RTX 4090 (fuente recomendada 850 W)",
  });
  const psu = rule(rules, "psu-capacity");
  assert.match(psu.detail, /fuente de 1000 W/);
  assert.doesNotMatch(psu.detail, /GPU 850 W/);
});
test("H2 a known GPU without TDP still fails a PSU below its requirement", () => {
  const { rules, verdict } = run({
    equipment: { brand: "Personalizado", model: "PC", board: "Z790 ATX, GPU RTX 4090" },
    category: "Fuente de poder",
    reference: "EVGA 600 BR",
    specifications: "600W",
  });
  assert.equal(rule(rules, "psu-capacity").status, "fail");
  assert.equal(verdict, "incompatible");
});
test("H2 raw-sum failure and margin warning keep working with a recommendation", () => {
  const below = run({
    equipment: {
      brand: "Personalizado",
      model: "PC",
      board: "Z790 ATX, CPU Core i9-13900K 253W, GPU RTX 4090 450W",
    },
    category: "Fuente de poder",
    reference: "Fuente",
    specifications: "700W",
  });
  assert.equal(rule(below.rules, "psu-capacity").status, "fail");
  assert.match(rule(below.rules, "psu-capacity").detail, /no alcanza el consumo estimado/);
  const margin = run({
    equipment: {
      brand: "Personalizado",
      model: "PC",
      board: "Z790 ATX, CPU Core i9-13900K 253W, GPU RTX 4090 450W",
    },
    category: "Fuente de poder",
    reference: "Fuente",
    specifications: "900W",
  });
  assert.equal(rule(margin.rules, "psu-capacity").status, "warn");
});
// H3: storage. Equipment texts come from the technical validation cases.
const samsung970 = {
  name: "Samsung 970 EVO Plus MZ-V7S1T0BW",
  category: "Almacenamiento",
  specifications:
    "SSD NVMe M.2 2280, PCIe 3.0 x4, 1TB, lectura hasta 3500MB/s, escritura hasta 3300MB/s",
  source: "Ficha técnica oficial Samsung",
  datasheetUrl: null,
};
const primeZ790 = {
  brand: "ASUS",
  model: "PRIME Z790-P",
  board:
    "ASUS PRIME Z790-P, escritorio ATX, socket LGA1700, 4 ranuras DIMM DDR5, M.2 Key M 2242/2260/2280 PCIe 4.0 x4",
};
const thinkpadE14 = {
  brand: "Lenovo",
  model: "ThinkPad E14 Gen 4 (Intel)",
  board:
    "Portátil, 8 GB soldada + 1 ranura SO-DIMM DDR4-3200; adaptador 65 W USB-C PD 3.0; batería integrada Li-Polymer 57 Wh; 2 ranuras M.2 2242 PCIe NVMe",
};
const storage = (equipment, extra = {}) =>
  run({
    equipment,
    category: "Almacenamiento",
    reference: "Samsung 970 EVO Plus MZ-V7S1T0BW",
    specifications: "",
    catalog: samsung970,
    ...extra,
  });
test("H3 an M.2 2280 NVMe SSD in an M.2 Key M 2242/2260/2280 PCIe slot is compatible", () => {
  const { rules, verdict } = storage(primeZ790);
  assert.equal(rule(rules, "storage-form-factor").status, "pass");
  assert.equal(rule(rules, "storage-interface").status, "pass");
  assert.equal(rule(rules, "storage-key").status, "pass");
  assert.equal(verdict, "compatible");
});
test("H3 an M.2 2280 SSD in a laptop with only M.2 2242 slots is incompatible", () => {
  const { rules, verdict } = storage(thinkpadE14);
  const shape = rule(rules, "storage-form-factor");
  assert.equal(shape.status, "fail");
  assert.match(shape.detail, /2280/);
  assert.match(shape.detail, /2242/);
  assert.equal(rule(rules, "storage-interface").status, "pass");
  assert.equal(verdict, "incompatible");
});
test("H3 a SATA M.2 B+M drive fails in a slot stated as PCIe/NVMe only", () => {
  const { rules, verdict } = storage(primeZ790, {
    reference: "SSD M.2 SATA genérico",
    specifications: "SSD M.2 2280 SATA III, clave B+M, 512GB",
    catalog: null,
  });
  assert.equal(rule(rules, "storage-interface").status, "fail");
  assert.equal(rule(rules, "storage-key").status, "pass");
  assert.equal(verdict, "incompatible");
});
test("H3 an NVMe M-key drive fails in a slot stated as Key B SATA", () => {
  const { rules, verdict } = storage({
    brand: "Genérico",
    model: "Mini PC",
    board: "Mini PC, 1 ranura M.2 Key B 2280 SATA",
  });
  assert.equal(rule(rules, "storage-key").status, "fail");
  assert.equal(rule(rules, "storage-interface").status, "fail");
  assert.equal(verdict, "incompatible");
});
test("H3 equipment that does not state its storage slot never fails", () => {
  for (const board of [
    "Portátil, 2 ranuras SO-DIMM DDR4",
    "escritorio ATX, socket AM4, 4 ranuras DIMM DDR4",
    "MacBook Air M2, portátil",
  ]) {
    const { rules, verdict } = storage({ brand: "X", model: "Y", board });
    assert.equal(rules.some((r) => r.status === "fail"), false, board);
    assert.equal(verdict, "conditional", board);
  }
});
test("H3 an M.2 slot without stated lengths or interface warns or is unknown", () => {
  const { rules, verdict } = storage({
    brand: "X",
    model: "Y",
    board: "escritorio ATX, 1 ranura M.2",
  });
  assert.notEqual(rule(rules, "storage-form-factor").status, "fail");
  assert.equal(rule(rules, "storage-interface").status, "unknown");
  assert.equal(verdict, "conditional");
});
test("H3 a 2.5-inch SATA SSD needs a stated bay and SATA port to pass", () => {
  const mx500 = {
    reference: "Crucial MX500 CT1000MX500SSD1",
    catalog: {
      name: "Crucial MX500 CT1000MX500SSD1",
      category: "Almacenamiento",
      specifications:
        "SSD SATA III (6 Gb/s) 2.5 pulgadas, 1TB, 7mm de espesor, lectura hasta 560MB/s, escritura hasta 510MB/s",
      source: "Ficha técnica oficial Crucial",
      datasheetUrl: null,
    },
  };
  const stated = storage(
    {
      brand: "MSI",
      model: "MAG B550 TOMAHAWK",
      board: "escritorio ATX, socket AM4, 6 puertos SATA 6Gb/s, bahías de 2.5 pulgadas",
    },
    mx500,
  );
  assert.equal(rule(stated.rules, "storage-form-factor").status, "pass");
  assert.equal(rule(stated.rules, "storage-interface").status, "pass");
  assert.equal(stated.verdict, "compatible");
  const silent = storage(
    { brand: "MSI", model: "MAG B550 TOMAHAWK", board: "escritorio ATX, socket AM4" },
    mx500,
  );
  assert.equal(silent.rules.some((r) => r.status === "fail"), false);
  assert.equal(silent.verdict, "conditional");
});
test("H3 a drive without form factor or interface is unknown", () => {
  const { rules, verdict } = storage(primeZ790, {
    reference: "SSD 1TB",
    specifications: "1TB",
    catalog: null,
  });
  assert.equal(rule(rules, "storage-form-factor").status, "unknown");
  assert.equal(rule(rules, "storage-interface").status, "unknown");
  assert.equal(verdict, "conditional");
});
// H4: case B2 of the technical validation (HP battery in a ThinkPad E14 Gen 4).
test("H4 a Wh-only mismatch warns and asks for the part number and form factor", () => {
  const { rules, verdict } = run({
    equipment: thinkpadE14,
    category: "Batería",
    reference: "HP HT03XL L11119-855",
    specifications: "",
    catalog: {
      name: "HP HT03XL L11119-855",
      category: "Batería",
      specifications:
        "Batería Li-ion de 3 celdas, 41Wh, 3.6Ah, código HT03XL, número de parte L11119-855",
      source: "Ficha técnica oficial HP",
      datasheetUrl: null,
    },
  });
  const capacity = rule(rules, "battery-capacity");
  assert.equal(capacity.status, "warn");
  assert.match(capacity.detail, /41 Wh/);
  assert.match(capacity.detail, /57 Wh/);
  assert.match(capacity.detail, /número de parte/);
  assert.match(capacity.detail, /formato/);
  assert.equal(rule(rules, "battery-voltage").status, "unknown");
  assert.equal(verdict, "conditional");
});

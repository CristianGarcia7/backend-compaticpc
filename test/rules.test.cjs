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
      board: "Chipset B660 DDR4",
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

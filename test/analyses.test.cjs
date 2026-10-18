const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  db,
  Sessions,
  Users,
  EquipmentRows,
  Components,
  Analyses,
} = require("../dist/database/data-source");
const { AnalysesService } = require("../dist/analyses/analyses.service");
const original = { getRepository: db.getRepository, fetch: globalThis.fetch };
const env = { ...process.env };
const req = { cookies: { compatipc_session: "test-session" } };
const equipmentId = "3ebf2fa2-8e8f-4c60-a144-1318a462e94a";
const user = {
  id: "owner-a",
  name: "A",
  email: "a@example.test",
  role: "technician",
};
const equipment = {
  id: equipmentId,
  ownerId: user.id,
  brand: "Personalizado",
  model: "PC de escritorio",
  board: "ASUS PRIME Z790-P DDR5 ATX",
  serial: "PRIVATE",
};
const catalog = [
  {
    id: "c1",
    name: "Kingston FURY Beast KF432C16BB1/8",
    category: "RAM",
    specifications: "DIMM DDR4 (escritorio), 8GB, 3200MHz, CL16, 1.35V",
    source: "Ficha técnica oficial Kingston",
    datasheetUrl: "https://www.kingston.com/",
  },
];
afterEach(() => {
  db.getRepository = original.getRepository;
  globalThis.fetch = original.fetch;
  process.env = { ...env };
});
function mockDb() {
  process.env.SESSION_SECRET = "test-secret-not-used-in-production";
  const saved = [];
  db.getRepository = (schema) => {
    if (schema === Sessions)
      return {
        findOneBy: async () => ({
          userId: user.id,
          expiresAt: new Date(Date.now() + 100000),
        }),
      };
    if (schema === Users) return { findOneBy: async () => user };
    if (schema === EquipmentRows) return { findOneBy: async () => equipment };
    if (schema === Components) return { find: async () => catalog };
    if (schema === Analyses)
      return {
        save: async (row) => {
          saved.push(row);
          return row;
        },
      };
    throw new Error("unexpected repository");
  };
  return saved;
}
const body = {
  equipmentId,
  category: "RAM",
  reference: "KF432C16BB1/8",
  specifications: "SO-DIMM DDR4 8GB",
};
test("demo mode stores rules and catalog contradiction warnings", async () => {
  process.env.DEMO_ENABLED = "true";
  mockDb();
  const row = await new AnalysesService().analyse(req, {
    ...body,
    mode: "demo",
  });
  assert.equal(row.provider, "demo");
  assert.equal(row.result.verdict, "incompatible");
  assert.equal(
    row.result.rules.find((r) => r.id === "ram-generation").status,
    "fail",
  );
  assert.ok(row.result.warnings.some((w) => /SO-DIMM/.test(w)));
});
test("a rule failure overrides a compatible Gemini verdict", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  mockDb();
  let prompt = "";
  globalThis.fetch = async (_url, options) => {
    prompt = options.body;
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  verdict: "compatible",
                  summary: "La memoria parece compatible con el equipo.",
                  checks: ["Revisión general"],
                  risks: [],
                  alternatives: [],
                }),
              },
            ],
          },
        },
      ],
    });
  };
  const row = await new AnalysesService().analyse(req, {
    ...body,
    mode: "gemini",
  });
  assert.equal(row.provider, "gemini");
  assert.equal(row.result.verdict, "incompatible");
  assert.ok(row.result.rules.length >= 2);
  assert.match(prompt, /deterministicChecks/);
  assert.match(prompt, /catalogSpecifications/);
  assert.equal(prompt.includes("PRIVATE"), false);
});

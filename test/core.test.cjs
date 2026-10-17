const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  ResultSchema,
  AnalysisResultSchema,
  demoResult,
  askGemini,
  modelPayload,
  mergeRules,
} = require("../dist/analyses/gemini.service");
const { evaluateRules } = require("../dist/analyses/rules");
const {
  hashPassword,
  verifyPassword,
  sessionHash,
  publicUser,
} = require("../dist/auth/password.service");
const {
  parse,
  registration,
  queryInput,
  equipmentInput,
} = require("../dist/common/validation");
const input = {
  equipment: {
    brand: "Ejemplo",
    model: "Modelo didáctico",
    board: "Ranura DDR4",
  },
  category: "RAM",
  reference: "Memoria prueba",
  specifications: "DDR3 4GB",
};
// Plain Gemini output (no rules/warnings), as the provider returns it.
const geminiOutput = {
  verdict: "compatible",
  summary: "La memoria parece compatible con el equipo indicado.",
  checks: ["Generación revisada"],
  risks: [],
  alternatives: [],
};
const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
});
test("password hashes are salted and correct password is required", () => {
  const a = hashPassword("correct-password");
  assert.notEqual(a, hashPassword("correct-password"));
  assert.equal(verifyPassword("correct-password", a), true);
  assert.equal(verifyPassword("wrong-password", a), false);
});
test("public user never exposes password", () => {
  assert.deepEqual(
    publicUser({
      id: "id",
      name: "A",
      email: "a@example.test",
      role: "technician",
      password: "secret",
    }),
    { id: "id", name: "A", email: "a@example.test", role: "technician" },
  );
});
test("registration cannot assign roles", () => {
  assert.throws(() =>
    parse(registration, {
      name: "A",
      email: "a@example.test",
      password: "long-password",
      role: "admin",
    }),
  );
});
test("request validation rejects oversized and missing fields", () => {
  assert.throws(() =>
    parse(equipmentInput, { brand: "A", model: "B", board: "x".repeat(241) }),
  );
  assert.throws(() => parse(queryInput, { equipmentId: "invalid" }));
});
test("battery and charger categories are accepted", () => {
  for (const category of ["Batería", "Cargador"])
    assert.equal(
      parse(queryInput, {
        equipmentId: "3ebf2fa2-8e8f-4c60-a144-1318a462e94a",
        category,
        reference: "Ref",
        specifications: "65W",
        mode: "demo",
      }).category,
      category,
    );
});
test("Gemini payload excludes serial and owner even if caller supplies them", () => {
  const payload = modelPayload({
    ...input,
    equipment: {
      ...input.equipment,
      serial: "PRIVATE_SERIAL",
      ownerId: "PRIVATE_OWNER",
    },
  });
  assert.equal(JSON.stringify(payload).includes("PRIVATE"), false);
  assert.equal(payload.generationConfig.responseMimeType, "application/json");
});
test("explicit demo uses the rules engine for the DDR generation mismatch", () => {
  const result = demoResult(input);
  assert.equal(result.verdict, "incompatible");
  assert.match(result.risks.join(" "), /DEMOSTRACIÓN/);
  assert.equal(
    result.rules.find((r) => r.id === "ram-generation").status,
    "fail",
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(AnalysisResultSchema.safeParse(result).success, true);
});
test("demo no longer returns a fixed placeholder for compatible data", () => {
  const result = demoResult({
    ...input,
    equipment: { ...input.equipment, board: "Z790 DDR5" },
    specifications: "DIMM DDR5 16GB",
  });
  assert.equal(result.verdict, "compatible");
  assert.ok(result.checks.every((c) => !/Por verificar/.test(c)));
});
test("a rule failure forces incompatible even if Gemini says compatible", () => {
  const rules = evaluateRules(input);
  const merged = mergeRules(geminiOutput, rules, ["aviso"]);
  assert.equal(merged.verdict, "incompatible");
  assert.deepEqual(merged.rules, rules);
  assert.deepEqual(merged.warnings, ["aviso"]);
  assert.match(merged.checks[0], /Generación de memoria/);
  assert.ok(merged.checks.length <= 8);
  assert.equal(AnalysisResultSchema.safeParse(merged).success, true);
});
test("passing rules keep the Gemini verdict", () => {
  const rules = [
    { id: "x", label: "Regla", status: "pass", detail: "Correcta" },
  ];
  assert.equal(mergeRules(geminiOutput, rules, []).verdict, "compatible");
});
test("Gemini payload carries deterministic rule results as facts", () => {
  const payload = modelPayload({ ...input, rules: evaluateRules(input) });
  const text = payload.contents[0].parts[0].text;
  assert.match(text, /deterministicChecks/);
  assert.match(text, /ram-generation/);
});
test("demo does not assert compatibility from insufficient information", () => {
  assert.equal(
    demoResult({ ...input, specifications: "Unknown" }).verdict,
    "conditional",
  );
});
test("AI schema rejects unsupported verdict, extra fields and excessive arrays", () => {
  const valid = geminiOutput;
  assert.equal(ResultSchema.safeParse(valid).success, true);
  assert.equal(
    ResultSchema.safeParse({ ...valid, verdict: "probably" }).success,
    false,
  );
  assert.equal(ResultSchema.safeParse({ ...valid, score: 99 }).success, false);
  assert.equal(
    ResultSchema.safeParse({ ...valid, risks: Array(9).fill("risk") }).success,
    false,
  );
});
// askGemini still rejects; AnalysesService turns the rejection into a rules fallback.
function captureLogs() {
  const { Logger } = require("@nestjs/common");
  const lines = [];
  const original = {
    error: Logger.prototype.error,
    warn: Logger.prototype.warn,
  };
  Logger.prototype.error = (msg) => lines.push(String(msg));
  Logger.prototype.warn = (msg) => lines.push(String(msg));
  return {
    lines,
    restore: () => Object.assign(Logger.prototype, original),
  };
}
test("missing key rejects with an actionable message for the technician", async () => {
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(
    askGemini(input),
    (e) => e.getStatus() === 503 && /GEMINI_API_KEY/.test(e.message),
  );
});
test("provider error is logged with status and masked body, never the key", async () => {
  process.env.GEMINI_API_KEY = "AIzaSyTESTKEY1234567890abcdefghij";
  const logs = captureLogs();
  try {
    await assert.rejects(
      askGemini(
        input,
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: 429,
                message: `Quota exceeded for key ${process.env.GEMINI_API_KEY} ${"x".repeat(3000)}`,
              },
            }),
            { status: 429 },
          ),
      ),
      (e) =>
        e.getStatus() === 503 &&
        /429/.test(e.message) &&
        !/revise cuota y configuración del servidor/i.test(e.message),
    );
  } finally {
    logs.restore();
  }
  const line = logs.lines.join("\n");
  assert.match(line, /429/);
  assert.match(line, /Quota exceeded/);
  assert.equal(line.includes("AIzaSyTESTKEY1234567890abcdefghij"), false);
  assert.ok(line.length < 1300);
});
test("rejected key and missing model produce distinct technician messages", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const logs = captureLogs();
  try {
    await assert.rejects(
      askGemini(input, async () => new Response("denied", { status: 403 })),
      (e) => /clave/i.test(e.message),
    );
    await assert.rejects(
      askGemini(input, async () => new Response("nope", { status: 404 })),
      (e) => /GEMINI_MODEL/.test(e.message),
    );
  } finally {
    logs.restore();
  }
});
test("malformed provider output is rejected and logged", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const logs = captureLogs();
  try {
    await assert.rejects(
      askGemini(input, async () =>
        Response.json({
          candidates: [{ content: { parts: [{ text: "not JSON" }] } }],
        }),
      ),
      (e) => e.getStatus() === 502,
    );
  } finally {
    logs.restore();
  }
  assert.ok(logs.lines.some((l) => /inválida|invalid/i.test(l)));
});
test("timeout is a 504 and is logged", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const logs = captureLogs();
  try {
    await assert.rejects(
      askGemini(input, async () => {
        const e = new Error("timeout");
        e.name = "TimeoutError";
        throw e;
      }),
      (e) => e.getStatus() === 504 && /20 segundos/.test(e.message),
    );
  } finally {
    logs.restore();
  }
  assert.ok(logs.lines.some((l) => /timeout|tiempo/i.test(l)));
});
test("valid structured Gemini response is accepted with server-side key header", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const expected = geminiOutput;
  const actual = await askGemini(input, async (url, options) => {
    assert.match(url, /generateContent$/);
    assert.equal(options.headers["x-goog-api-key"], "test-key");
    assert.ok(options.signal);
    return Response.json({
      candidates: [
        { content: { parts: [{ text: JSON.stringify(expected) }] } },
      ],
    });
  });
  assert.deepEqual(actual, expected);
});

test("Gemini uses the supported default and respects an explicit model override", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  for (const model of [undefined, "configured-test-model"]) {
    if (model === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = model;
    await askGemini(input, async (url) => {
      assert.equal(
        url,
        `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-3.6-flash"}:generateContent`,
      );
      return Response.json({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(geminiOutput) }] } },
        ],
      });
    });
  }
});

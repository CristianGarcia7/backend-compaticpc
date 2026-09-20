const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  ResultSchema,
  demoResult,
  askGemini,
  modelPayload,
} = require("../dist/analyses/gemini.service");
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
test("explicit demo recognizes the curated DDR generation mismatch", () => {
  const result = demoResult(input);
  assert.equal(result.verdict, "incompatible");
  assert.match(result.risks.join(" "), /DEMOSTRACIÓN/);
  assert.equal(ResultSchema.safeParse(result).success, true);
});
test("demo does not assert compatibility from insufficient information", () => {
  assert.equal(
    demoResult({ ...input, specifications: "Unknown" }).verdict,
    "conditional",
  );
});
test("AI schema rejects unsupported verdict, extra fields and excessive arrays", () => {
  const valid = demoResult(input);
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
test("missing key is explicit 503, never demo fallback", async () => {
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(askGemini(input), (e) => e.getStatus() === 503);
});
test("provider error remains 503, never successful fallback", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  await assert.rejects(
    askGemini(input, async () => new Response("{}", { status: 429 })),
    (e) => e.getStatus() === 503,
  );
});
test("malformed provider output is rejected", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  await assert.rejects(
    askGemini(input, async () =>
      Response.json({
        candidates: [{ content: { parts: [{ text: "not JSON" }] } }],
      }),
    ),
    (e) => e.getStatus() === 502,
  );
});
test("timeout is a 504", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  await assert.rejects(
    askGemini(input, async () => {
      const e = new Error("timeout");
      e.name = "TimeoutError";
      throw e;
    }),
    (e) => e.getStatus() === 504,
  );
});
test("valid structured Gemini response is accepted with server-side key header", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const expected = demoResult(input);
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
          { content: { parts: [{ text: JSON.stringify(demoResult(input)) }] } },
        ],
      });
    });
  }
});

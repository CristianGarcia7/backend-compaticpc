const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { Logger } = require("@nestjs/common");
const { GeminiHealthService } = require("../dist/system/gemini-health.service");
const { SystemService } = require("../dist/system/system.service");
const env = { ...process.env };
const logError = Logger.prototype.error;
afterEach(() => {
  process.env = { ...env };
  Logger.prototype.error = logError;
});
function health({ status = 200, now = 0 } = {}) {
  const service = new GeminiHealthService();
  const calls = [];
  let clock = now;
  service.now = () => clock;
  service.fetcher = async (url, options) => {
    calls.push({ url, options });
    return new Response("{}", {
      status: typeof status === "function" ? status() : status,
    });
  };
  return { service, calls, tick: (ms) => (clock += ms) };
}
test("Gemini health is unconfigured without a key and never calls the network", async () => {
  delete process.env.GEMINI_API_KEY;
  const { service, calls } = health();
  const result = await service.check();
  assert.equal(result.status, "unconfigured");
  assert.equal(calls.length, 0);
  assert.ok(result.checkedAt);
});
test("Gemini health reads model metadata only and caches success for 5 minutes", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "test-model";
  const { service, calls, tick } = health();
  assert.equal((await service.check()).status, "ok");
  assert.equal(
    calls[0].url,
    "https://generativelanguage.googleapis.com/v1beta/models/test-model",
  );
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers["x-goog-api-key"], "test-key");
  tick(4 * 60 * 1000);
  await service.check();
  assert.equal(calls.length, 1);
  tick(2 * 60 * 1000);
  await service.check();
  assert.equal(calls.length, 2);
});
test("Gemini health failures are cached for a shorter time and explained", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  Logger.prototype.error = () => {};
  const { service, calls, tick } = health({ status: 403 });
  const result = await service.check();
  assert.equal(result.status, "unavailable");
  assert.match(result.detail, /403/);
  assert.equal(result.detail.includes("test-key"), false);
  tick(30 * 1000);
  await service.check();
  assert.equal(calls.length, 1);
  tick(31 * 1000);
  await service.check();
  assert.equal(calls.length, 2);
});
test("Gemini health network errors are unavailable, not thrown", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  Logger.prototype.error = () => {};
  const service = new GeminiHealthService();
  service.fetcher = async () => {
    throw new Error("ECONNRESET");
  };
  assert.equal((await service.check()).status, "unavailable");
});
function system(dbOk, gemini = { status: "ok", checkedAt: "now" }) {
  const service = new SystemService({ check: async () => gemini });
  service.dbCheck = async () => {
    if (!dbOk) throw new Error("down");
  };
  return service;
}
test("health reports database and Gemini status", async () => {
  assert.deepEqual(await system(true).health(), {
    status: "ok",
    db: "ok",
    gemini: "ok",
  });
  assert.deepEqual(
    await system(false, { status: "unavailable", checkedAt: "now" }).health(),
    { status: "error", db: "error", gemini: "unavailable" },
  );
});
test("config keeps geminiConfigured and adds the cached Gemini check", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const gemini = { status: "ok", checkedAt: "2026-10-17T00:00:00.000Z" };
  const config = await system(true, gemini).config();
  assert.equal(config.geminiConfigured, true);
  assert.deepEqual(config.gemini, gemini);
});

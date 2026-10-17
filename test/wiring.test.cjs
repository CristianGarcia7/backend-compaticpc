require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { SystemService } = require("../dist/system/system.service");
const { GeminiHealthService } = require("../dist/system/gemini-health.service");
test("Nest modules and controllers initialize without opening a listener", async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await app.init();
    // Never reach the network or a real database from the wiring test.
    app.get(GeminiHealthService).fetcher = async () =>
      new Response("{}", { status: 200 });
    const system = app.get(SystemService);
    system.dbCheck = async () => {};
    const health = await system.health();
    assert.equal(health.status, "ok");
    assert.equal(health.db, "ok");
    assert.ok(["ok", "unconfigured"].includes(health.gemini));
  } finally {
    await app.close();
  }
});

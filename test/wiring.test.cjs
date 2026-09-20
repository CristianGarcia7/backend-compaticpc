require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { SystemService } = require("../dist/system/system.service");
test("Nest modules and controllers initialize without opening a listener", async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await app.init();
    assert.deepEqual(app.get(SystemService).health(), { status: "ok" });
  } finally {
    await app.close();
  }
});

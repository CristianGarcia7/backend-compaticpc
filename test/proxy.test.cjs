require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { configureApp } = require("../dist/app.setup");
// Behind nginx every request comes from 127.0.0.1: the rate limiter must key
// on the client address that nginx forwards, or all users share one bucket.
test("rate limiting keys on the forwarded client IP (trust proxy 1)", async () => {
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  configureApp(app);
  await app.listen(0, "127.0.0.1");
  try {
    const { port } = app.getHttpServer().address();
    const hit = (ip) =>
      fetch(`http://127.0.0.1:${port}/api/auth/__probe`, {
        headers: { "X-Forwarded-For": ip },
      }).then((r) => r.status);
    for (let i = 0; i < 30; i++) assert.notEqual(await hit("203.0.113.10"), 429);
    assert.equal(await hit("203.0.113.10"), 429);
    assert.notEqual(await hit("198.51.100.20"), 429);
  } finally {
    await app.close();
  }
});

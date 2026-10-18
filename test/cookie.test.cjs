const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sessionCookieOptions } = require("../dist/common/api.service");
test("session cookie is Secure in production and keeps HttpOnly + SameSite=Lax", () => {
  const options = sessionCookieOptions({ NODE_ENV: "production" });
  assert.equal(options.secure, true);
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/api");
});
test("session cookie is not Secure outside production (local http)", () => {
  for (const NODE_ENV of [undefined, "development", "test"]) {
    const options = sessionCookieOptions({ NODE_ENV });
    assert.equal(options.secure, false);
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, "lax");
  }
});
test("session cookie options are read at call time, not at import time", () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.equal(sessionCookieOptions().secure, true);
    process.env.NODE_ENV = "development";
    assert.equal(sessionCookieOptions().secure, false);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});

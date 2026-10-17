const { test } = require("node:test");
const assert = require("node:assert/strict");
const { db } = require("../dist/database/data-source");
const {
  CatalogDatasheets1789780000000,
  catalog,
} = require("../dist/database/migrations/1789780000000-catalog-datasheets");
const { parse, componentInput } = require("../dist/common/validation");
function runner() {
  const queries = [];
  return {
    queries,
    query: async (sql, params = []) => {
      queries.push({ sql, params });
      return [];
    },
  };
}
test("catalog migration is registered after the initial migration", () => {
  const names = db.options.migrations.map((m) => m.name);
  assert.ok(
    names.indexOf("CatalogDatasheets1789780000000") >
      names.indexOf("Initial1789770000000"),
  );
});
test("up adds datasheetUrl and upserts rows by name", async () => {
  const q = runner();
  await new CatalogDatasheets1789780000000().up(q);
  assert.match(q.queries[0].sql, /ADD COLUMN "datasheetUrl"/);
  const kingston = q.queries.find(
    (x) =>
      /^UPDATE/.test(x.sql) &&
      x.params[0] === "Kingston FURY Beast KF432C16BB1/8",
  );
  assert.match(kingston.params[2], /^DIMM DDR4/);
  assert.ok(
    q.queries.some(
      (x) =>
        /^INSERT/.test(x.sql) &&
        /NOT EXISTS/.test(x.sql) &&
        x.params[0] === "Kingston FURY Beast KF432C16BB1/8",
    ),
  );
  // Demo rows are never touched.
  assert.equal(
    q.queries.some((x) => x.params.some((p) => /ejemplo/i.test(String(p)))),
    false,
  );
});
test("catalog entries are real, categorized and link only https sources", () => {
  const categories = new Set(catalog.map((c) => c.category));
  for (const c of ["Batería", "Cargador", "RAM", "Fuente de poder"])
    assert.ok(categories.has(c));
  for (const entry of catalog) {
    assert.equal(/DEMOSTRACI/i.test(entry.source), false);
    if (entry.datasheetUrl !== null)
      assert.match(entry.datasheetUrl, /^https:\/\//);
  }
});
test("down restores previous specs, removes new rows and drops the column", async () => {
  const q = runner();
  await new CatalogDatasheets1789780000000().down(q);
  const kingston = q.queries.find(
    (x) =>
      /^UPDATE/.test(x.sql) &&
      x.params[0] === "Kingston FURY Beast KF432C16BB1/8",
  );
  assert.match(kingston.params[2], /^SO-DIMM/);
  assert.ok(
    q.queries.some(
      (x) =>
        /^DELETE/.test(x.sql) &&
        x.params[0].includes("HP 65W Smart AC Adapter H6Y89AA"),
    ),
  );
  assert.match(q.queries.at(-1).sql, /DROP COLUMN "datasheetUrl"/);
});
test("component input accepts an optional http(s) datasheet URL only", () => {
  const base = {
    name: "Pieza",
    category: "Cargador",
    specifications: "65W USB-C",
    source: "Ficha técnica",
  };
  assert.equal(parse(componentInput, base).datasheetUrl, undefined);
  assert.equal(
    parse(componentInput, { ...base, datasheetUrl: "https://example.com/a" })
      .datasheetUrl,
    "https://example.com/a",
  );
  assert.equal(
    parse(componentInput, { ...base, datasheetUrl: null }).datasheetUrl,
    null,
  );
  assert.throws(() =>
    parse(componentInput, { ...base, datasheetUrl: "javascript:alert(1)" }),
  );
});

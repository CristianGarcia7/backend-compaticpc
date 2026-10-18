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
// H5: stale datasheet links (Samsung redirected to a generic page, Crucial 404).
const {
  CatalogDatasheetFixes1789800000000,
  datasheetFixes,
  rtx4090,
} = require("../dist/database/migrations/1789800000000-catalog-datasheet-fixes");
test("datasheet fix migration is registered after the feedback migration", () => {
  const names = db.options.migrations.map((m) => m.name);
  assert.ok(
    names.indexOf("CatalogDatasheetFixes1789800000000") >
      names.indexOf("FeedbackReason1789790000000"),
  );
});
test("datasheet fixes replace both stale links with product-specific https URLs", async () => {
  const q = runner();
  await new CatalogDatasheetFixes1789800000000().up(q);
  for (const name of [
    "Samsung 970 EVO Plus MZ-V7S1T0BW",
    "Crucial MX500 CT1000MX500SSD1",
  ]) {
    const fix = datasheetFixes.find((f) => f.name === name);
    const before = catalog.find((c) => c.name === name).datasheetUrl;
    assert.notEqual(fix.url, before);
    assert.equal(fix.previous, before);
    assert.match(fix.url, /^https:\/\//);
    const update = q.queries.find(
      (x) => /^UPDATE/.test(x.sql) && x.params[0] === name,
    );
    assert.equal(update.params[1], fix.url);
    assert.match(update.sql, /"datasheetUrl"/);
  }
  assert.match(datasheetFixes[0].url + datasheetFixes[1].url, /970_EVO_Plus/);
  assert.match(datasheetFixes[0].url + datasheetFixes[1].url, /mx500/);
  const insert = q.queries.find((x) => /^INSERT/.test(x.sql));
  assert.match(insert.sql, /NOT EXISTS/);
  assert.equal(insert.params[0], rtx4090.name);
  assert.match(rtx4090.specifications, /fuente recomendada 850W/);
});
test("datasheet fixes down restores the previous links and removes only its own row", async () => {
  const q = runner();
  await new CatalogDatasheetFixes1789800000000().down(q);
  for (const fix of datasheetFixes) {
    const update = q.queries.find(
      (x) => /^UPDATE/.test(x.sql) && x.params[0] === fix.name,
    );
    assert.equal(update.params[1], fix.previous);
  }
  const del = q.queries.find((x) => /^DELETE/.test(x.sql));
  assert.match(del.sql, /specifications/);
  assert.deepEqual(del.params.slice(0, 1), [rtx4090.name]);
});

const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { db, Sessions, Users } = require("../dist/database/data-source");
const { EquipmentService } = require("../dist/equipment/equipment.service");
const { AnalysesService } = require("../dist/analyses/analyses.service");
const {
  FeedbackReason1789790000000,
} = require("../dist/database/migrations/1789790000000-feedback-reason");
const original = db.getRepository;
const req = { cookies: { compatipc_session: "test-session" } };
const id = "3ebf2fa2-8e8f-4c60-a144-1318a462e94a";
const user = {
  id: "owner-a",
  name: "A",
  email: "a@example.test",
  role: "technician",
};
afterEach(() => {
  db.getRepository = original;
});
function mock(row) {
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
    return {
      findOneBy: async (filter) => {
        assert.deepEqual(filter, { id, ownerId: user.id });
        return row;
      },
      save: async (value) => {
        saved.push(value);
        return value;
      },
    };
  };
  return saved;
}
const equipment = {
  id,
  ownerId: user.id,
  brand: "HP",
  model: "Pavilion",
  board: "DDR4 SO-DIMM",
  serial: "S1",
};
test("equipment edit is owner-scoped and returns 404 for foreign equipment", async () => {
  const saved = mock(null);
  await assert.rejects(
    new EquipmentService().updateEquipment(req, id, { brand: "Dell" }),
    (e) => e.getStatus() === 404,
  );
  assert.equal(saved.length, 0);
});
test("equipment edit applies only the provided fields", async () => {
  const saved = mock(equipment);
  const row = await new EquipmentService().updateEquipment(req, id, {
    board: "  DDR5 SO-DIMM  ",
  });
  assert.equal(row.board, "DDR5 SO-DIMM");
  assert.equal(row.serial, "S1");
  assert.equal(row.ownerId, user.id);
  assert.equal(saved.length, 1);
});
test("equipment edit rejects empty, unknown and oversized fields", async () => {
  for (const body of [
    {},
    { ownerId: "other" },
    { model: "x".repeat(121) },
    { brand: "" },
  ]) {
    mock(equipment);
    await assert.rejects(
      new EquipmentService().updateEquipment(req, id, body),
      (e) => e.getStatus() === 400,
    );
  }
});
const analysis = { id, ownerId: user.id, feedback: null, feedbackReason: null };
test("feedback stores a trimmed optional reason", async () => {
  mock(analysis);
  const row = await new AnalysesService().feedback(req, id, {
    feedback: "not-useful",
    reason: "  Falta la ficha del cargador  ",
  });
  assert.equal(row.feedback, "not-useful");
  assert.equal(row.feedbackReason, "Falta la ficha del cargador");
});
test("feedback without a reason clears a previous reason", async () => {
  mock({ ...analysis, feedback: "not-useful", feedbackReason: "antes" });
  const row = await new AnalysesService().feedback(req, id, {
    feedback: "useful",
  });
  assert.equal(row.feedbackReason, null);
});
test("feedback rejects reasons longer than 500 characters", async () => {
  mock(analysis);
  await assert.rejects(
    new AnalysesService().feedback(req, id, {
      feedback: "useful",
      reason: "x".repeat(501),
    }),
    (e) => e.getStatus() === 400,
  );
});
test("feedback reason migration is reversible", async () => {
  const sql = [];
  const q = { query: async (s) => sql.push(s) };
  await new FeedbackReason1789790000000().up(q);
  await new FeedbackReason1789790000000().down(q);
  assert.match(sql[0], /ADD COLUMN "feedbackReason"/);
  assert.match(sql[1], /DROP COLUMN "feedbackReason"/);
});

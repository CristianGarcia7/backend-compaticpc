const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  db,
  Sessions,
  Users,
  Analyses,
  EquipmentRows,
} = require("../dist/database/data-source");
const { current, admin, ownedAnalysis } = require("../dist/common/api.service");
const { EquipmentService } = require("../dist/equipment/equipment.service");
const { AnalysesService } = require("../dist/analyses/analyses.service");
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
function mock(findOwned) {
  process.env.SESSION_SECRET = "test-secret-not-used-in-production";
  db.getRepository = function (schema) {
    if (schema === Sessions)
      return {
        findOneBy: async () => ({
          userId: user.id,
          expiresAt: new Date(Date.now() + 100000),
        }),
      };
    if (schema === Users) return { findOneBy: async () => user };
    return {
      findOneBy: findOwned,
      delete: async (filter) => {
        assert.equal(filter.ownerId, user.id);
        return { affected: 0 };
      },
    };
  };
}
test("no cookie is unauthorized before any repository access", async () => {
  await assert.rejects(current({ cookies: {} }), (e) => e.getStatus() === 401);
});
test("expired database session is rejected", async () => {
  process.env.SESSION_SECRET = "test-secret";
  db.getRepository = () => ({
    findOneBy: async () => ({ userId: "a", expiresAt: new Date(0) }),
  });
  await assert.rejects(current(req), (e) => e.getStatus() === 401);
});
test("technician cannot invoke admin permission helper", async () => {
  mock(async () => null);
  await assert.rejects(admin(req), (e) => e.getStatus() === 403);
});
test("analysis detail always scopes ID to authenticated owner", async () => {
  mock(async (filter) => {
    assert.deepEqual(filter, { id, ownerId: user.id });
    return null;
  });
  await assert.rejects(ownedAnalysis(req, id), (e) => e.getStatus() === 404);
});
test("deletion does not leak or delete equipment belonging to another user", async () => {
  mock(async () => null);
  await assert.rejects(
    new EquipmentService().deleteEquipment(req, id),
    (e) => e.getStatus() === 404,
  );
});
test("analysis cannot use equipment outside owner scope", async () => {
  mock(async (filter) => {
    assert.deepEqual(filter, { id, ownerId: user.id });
    return null;
  });
  await assert.rejects(
    new AnalysesService().analyse(req, {
      equipmentId: id,
      category: "RAM",
      reference: "Reference",
      specifications: "DDR4",
      mode: "demo",
    }),
    (e) => e.getStatus() === 404,
  );
});
test("PDF checks ownership before writing response headers", async () => {
  mock(async () => null);
  await assert.rejects(
    new AnalysesService().pdf(req, id, {
      setHeader() {
        throw new Error("Must not write headers");
      },
    }),
    (e) => e.getStatus() === 404,
  );
});
test("feedback checks ownership before modifying data", async () => {
  mock(async () => null);
  await assert.rejects(
    new AnalysesService().feedback(req, id, { feedback: "useful" }),
    (e) => e.getStatus() === 404,
  );
});

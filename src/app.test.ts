import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { authenticate } from "./auth.js";
import { buildApp } from "./app.js";
import { apiKeys, users } from "./store.js";
describe("planted API bugs", () => {
  test.fails("rejects inactive keys", () => {
    expect(authenticate("revoked-token")).toBeNull();
  });
  test("server responds", async () => {
    const app = buildApp();
    try {
      const res = await app.inject({ method: "POST", url: "/api/tokens" });
      expect(res.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});

describe("admin endpoint authorization", () => {
  let app: ReturnType<typeof buildApp>;
  const initialKeyCount = apiKeys.length;
  const initialUserCount = users.length;

  beforeEach(() => {
    users.push({ id: "test-admin", role: "admin", orgId: "org_a" });
    apiKeys.push(
      { id: "test-admin-key", token: "admin-token", userId: "test-admin", active: true },
      { id: "test-revoked-key", token: "revoked-admin-token", userId: "test-admin", active: false },
      { id: "test-orphan-key", token: "orphan-token", userId: "missing-user", active: true },
    );
    app = buildApp();
  });

  afterEach(async () => {
    apiKeys.splice(initialKeyCount);
    users.splice(initialUserCount);
    await app.close();
  });

  test.each([
    undefined,
    "Bearer invalid-token",
    "Basic live-token",
    "Bearer revoked-admin-token",
    "Bearer orphan-token",
    "Bearer",
    "admin-token",
    "Bearer admin-token extra",
  ])("rejects missing or invalid credentials: %s", async (authorization) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: authorization ? { authorization } : {},
      payload: { role: "admin" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ ok: false });
  });

  test("rejects a member claiming an admin role", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: { authorization: "Bearer live-token" },
      payload: { role: "admin" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ ok: false });
  });

  test("allows an authenticated admin without a request body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: { authorization: "Bearer admin-token" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, granted: "admin" });
  });

  test("uses the stored admin role even when the body claims member", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: { authorization: "Bearer admin-token" },
      payload: { role: "member" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, granted: "admin" });
  });
});

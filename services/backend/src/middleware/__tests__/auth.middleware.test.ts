import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAuthMiddleware } from "../auth.middleware";

function createUserServiceStub(user?: {
  id: string;
  username: string;
  displayName: string;
  role: "viewer" | "analyst" | "admin";
}) {
  return {
    validateSession: (token: string) => (token === "valid-token" ? user : undefined),
  };
}

describe("auth.middleware public route matrix", () => {
  it("allows public auth routes without token when auth is required", async () => {
    const app = express();
    app.use(createAuthMiddleware(createUserServiceStub() as any, true));
    app.get("/api/auth/orgs/:code/verify", (_req, res) => res.json({ ok: true }));
    app.post("/api/auth/register", (_req, res) => res.json({ ok: true }));
    app.get("/api/auth/registrations/lookup/:token", (_req, res) => res.json({ ok: true }));
    app.post("/api/auth/password-reset/request", (_req, res) => res.json({ ok: true }));
    app.post("/api/auth/password-reset/confirm", (_req, res) => res.json({ ok: true }));

    expect((await request(app).get("/api/auth/orgs/ACME/verify")).status).toBe(200);
    expect((await request(app).post("/api/auth/register")).status).toBe(200);
    expect((await request(app).get("/api/auth/registrations/lookup/token-1")).status).toBe(200);
    expect((await request(app).post("/api/auth/password-reset/request")).status).toBe(200);
    expect((await request(app).post("/api/auth/password-reset/confirm")).status).toBe(200);
  });

  it("blocks non-public auth routes without token when auth is required", async () => {
    const app = express();
    app.use(createAuthMiddleware(createUserServiceStub() as any, true));
    app.get("/api/auth/users", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/api/auth/users");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required");
  });

  it("hydrates req.user when a valid token is provided", async () => {
    const app = express();
    app.use(createAuthMiddleware(createUserServiceStub({
      id: "u1",
      username: "alice",
      displayName: "Alice",
      role: "admin",
    }) as any, true));
    app.get("/secured", (req, res) => res.json({ username: req.user?.username ?? null }));

    const res = await request(app)
      .get("/secured")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("alice");
  });
});

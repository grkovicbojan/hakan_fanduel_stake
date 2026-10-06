import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { pool } from "../src/db/pool.js";
import { ensureUserFromIdentity, linkLegacyUser } from "../src/auth/store.js";
import { hashPassword } from "../src/auth/utils.js";

test("SportBet links a legacy account only after its old password and keeps its row ID", async () => {
  const sharedId = crypto.randomUUID();
  const row = { id: crypto.randomUUID(), email: "older@example.test",
    password_hash: hashPassword("older-SportBet-password"), hub_user_id: null };
  const originalHash = row.password_hash;
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const query = async (sql, values = []) => {
    const statement = String(sql).replace(/\s+/g, " ").trim();
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement)) return { rows: [] };
    if (statement.includes("FROM users WHERE hub_user_id = $1")) {
      return { rows: row.hub_user_id === values[0] ? [{ ...row }] : [] };
    }
    if (statement.includes("FROM users WHERE email = $1")) {
      return { rows: row.email === values[0] ? [{ ...row }] : [] };
    }
    if (statement.startsWith("UPDATE users SET hub_user_id")) {
      row.hub_user_id = values[0];
      return { rows: [{ id: row.id, email: row.email }] };
    }
    throw new Error(`Unexpected query: ${statement}`);
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  try {
    await assert.rejects(ensureUserFromIdentity(sharedId, row.email),
      (error) => error.code === "link_required");
    assert.equal((await linkLegacyUser(sharedId, row.email, "wrong")).code, "bad_password");
    assert.equal(row.hub_user_id, null);
    const linked = await linkLegacyUser(sharedId, row.email, "older-SportBet-password");
    assert.equal(linked.code, "linked");
    assert.equal(row.id, linked.user.id);
    assert.equal(row.password_hash, originalHash);
    assert.equal((await ensureUserFromIdentity(sharedId, row.email)).id, row.id);
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

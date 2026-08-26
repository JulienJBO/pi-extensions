import assert from "node:assert/strict";
import { AntigravityAccountPool, type AntigravityAccount } from "../src/accounts/index.ts";

const transitions: string[] = [];
let additional: AntigravityAccount[] = [
  { id: "antigravity-2", label: "account 2", apiKey: "account-2-key" },
  { id: "antigravity-3", label: "account 3", apiKey: "account-3-key" },
];
const pool = new AntigravityAccountPool({
  resolveAdditionalAccounts: async () => additional,
  onTransition: ({ from, to }) => transitions.push(`${from.label}->${to.label}`),
});

let accounts = await pool.resolve("account-1-key");
assert.deepEqual(
  accounts.map((account) => account.label),
  ["account 1", "account 2", "account 3"],
);

pool.markRateLimited(accounts[0], accounts);
assert.equal(pool.getPreferred().label, "account 2");
assert.deepEqual(transitions, ["account 1->account 2"]);

accounts = await pool.resolve("account-1-key");
assert.deepEqual(
  accounts.map((account) => account.label),
  ["account 2", "account 3", "account 1"],
);

pool.markRateLimited(accounts[0], accounts);
assert.equal(pool.getPreferred().label, "account 3");
assert.deepEqual(transitions, ["account 1->account 2", "account 2->account 3"]);

accounts = await pool.resolve("account-1-key");
pool.markSuccessful(accounts[0]);
assert.equal(pool.getPreferred().label, "account 3");

additional = [
  { id: "antigravity-2", label: "account 2", apiKey: "account-1-key" },
  { id: "antigravity-3", label: "account 3", apiKey: "account-3-key" },
];
accounts = await pool.resolve("account-1-key");
assert.deepEqual(
  accounts.map((account) => account.label),
  ["account 3", "account 1"],
  "the same Google credential must not be tried twice",
);

additional = [];
pool.reset();
accounts = await pool.resolve("account-1-key");
assert.deepEqual(accounts.map((account) => account.label), ["account 1"]);
pool.markRateLimited(accounts[0], accounts);
assert.equal(pool.getPreferred().label, "account 1", "no transition without a linked fallback");

const brokenAdditionalAccounts = new AntigravityAccountPool({
  resolveAdditionalAccounts: async () => {
    throw new Error("refresh failed");
  },
});
accounts = await brokenAdditionalAccounts.resolve("account-1-key");
assert.deepEqual(accounts.map((account) => account.label), ["account 1"]);

console.log("account pool: ok");

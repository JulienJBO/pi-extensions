import assert from "node:assert/strict";
import {
  getLinkedAccounts,
  getNextAvailableSlot,
  getSlotId,
  getSlotLabel,
  readAuthStore,
  removeAntigravityAccount,
  saveAntigravityAccount,
  writeAuthStore,
} from "../src/accounts/store.ts";
import { formatAccountSummaryText } from "../src/accounts/ui.ts";
import { AntigravityAccountPool } from "../src/accounts/pool.ts";

// Test in a clean temporary mock environment
const originalAuth = readAuthStore();
try {
  // Clear mock
  writeAuthStore({});
  assert.deepEqual(getLinkedAccounts(), []);
  assert.deepEqual(getNextAvailableSlot(), {
    slotNumber: 1,
    id: "antigravity",
    label: "account 1",
  });

  // Save account 1
  saveAntigravityAccount("antigravity", {
    access: "token1",
    refresh: "refresh1",
    expires: Date.now() + 3600000,
    email: "user1@example.com",
    projectId: "proj-1",
  });

  let linked = getLinkedAccounts();
  assert.equal(linked.length, 1);
  assert.equal(linked[0]?.id, "antigravity");
  assert.equal(linked[0]?.email, "user1@example.com");

  assert.deepEqual(getNextAvailableSlot(), {
    slotNumber: 2,
    id: "antigravity-2",
    label: "account 2",
  });

  // Save account 2
  saveAntigravityAccount("antigravity-2", {
    access: "token2",
    refresh: "refresh2",
    expires: Date.now() + 3600000,
    email: "user2@example.com",
    projectId: "proj-2",
  });

  linked = getLinkedAccounts();
  assert.equal(linked.length, 2);
  assert.equal(linked[1]?.id, "antigravity-2");
  assert.equal(linked[1]?.email, "user2@example.com");

  assert.deepEqual(getNextAvailableSlot(), {
    slotNumber: 3,
    id: "antigravity-3",
    label: "account 3",
  });

  // Test pool formatting
  const pool = new AntigravityAccountPool();
  const summary = formatAccountSummaryText(pool);
  assert(summary.includes("user1@example.com"));
  assert(summary.includes("user2@example.com"));

  // Remove account 1
  assert.equal(removeAntigravityAccount("antigravity"), true);
  linked = getLinkedAccounts();
  assert.equal(linked.length, 1);
  assert.equal(linked[0]?.id, "antigravity-2");

  // Next slot should reuse slot 1
  assert.deepEqual(getNextAvailableSlot(), {
    slotNumber: 1,
    id: "antigravity",
    label: "account 1",
  });

  assert.equal(getSlotId(1), "antigravity");
  assert.equal(getSlotId(5), "antigravity-5");
  assert.equal(getSlotLabel(5), "account 5");

  console.log("account store & slot management: ok");
} finally {
  writeAuthStore(originalAuth);
}

import assert from "node:assert/strict";
import type { Context } from "@earendil-works/pi-ai";
import { AntigravityAccountPool } from "../src/accounts/index.ts";
import { ANTIGRAVITY_MODELS } from "../src/models/index.ts";
import { createAntigravityStream } from "../src/stream/index.ts";

function apiKey(token: string): string {
  return JSON.stringify({ token, projectId: `${token}-project` });
}

const originalFetch = globalThis.fetch;
const calls: string[] = [];
const transitions: string[] = [];

globalThis.fetch = async (_input, init) => {
  const authorization = new Headers(init?.headers).get("authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  calls.push(token);

  if (token === "account-1-token" || token === "account-2-token") {
    return new Response(
      JSON.stringify({ error: { message: "Individual quota reached. Resets in 4 hours." } }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
  }

  if (token === "account-3-token") {
    const body = [
      `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "account 3 worked" }] }, finishReason: "STOP" }] } })}`,
      "data: [DONE]",
      "",
    ].join("\n");
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  }

  throw new Error(`unexpected token: ${token}`);
};

try {
  const pool = new AntigravityAccountPool({
    resolveAdditionalAccounts: async () => [
      { id: "antigravity-2", label: "account 2", apiKey: apiKey("account-2-token") },
      { id: "antigravity-3", label: "account 3", apiKey: apiKey("account-3-token") },
    ],
    onTransition: ({ from, to }) => transitions.push(`${from.label}->${to.label}`),
  });
  const streamProvider = createAntigravityStream(pool);
  const model = ANTIGRAVITY_MODELS.find((candidate) => candidate.id === "gemini-3.7-flash");
  assert.ok(model);

  const context: Context = {
    systemPrompt: "test",
    messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
    tools: [],
  };
  const stream = streamProvider(model, context, { apiKey: apiKey("account-1-token") });

  let finalText = "";
  let terminalEvent = "";
  for await (const event of stream) {
    if (event.type === "text_delta") finalText += event.delta;
    if (event.type === "done" || event.type === "error") terminalEvent = event.type;
  }

  assert.equal(terminalEvent, "done");
  assert.equal(finalText, "account 3 worked");
  assert.deepEqual(calls, ["account-1-token", "account-2-token", "account-3-token"]);
  assert.deepEqual(transitions, ["account 1->account 2", "account 2->account 3"]);
  assert.equal(pool.getPreferred().label, "account 3");
  console.log("account failover stream: ok");
} finally {
  globalThis.fetch = originalFetch;
}

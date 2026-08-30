import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter(
      (block): block is { type: "text"; text: string } =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text)
    .join("\n");
}

function hasTitleworthyUserPrompt(
  entries: Array<{ message: { role: string; content?: unknown } }>,
): boolean {
  const userText = entries
    .filter((entry) => entry.message.role === "user")
    .map((entry) => textFromContent(entry.message.content).trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!userText) return false;

  const normalized = userText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return !/^(?:hi|hello|hey|yo|sup|test|testing|thanks|thank you|ok|okay|bye|goodbye)$/.test(
    normalized,
  );
}

function cleanTitle(raw: string): string | undefined {
  const title = raw
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.replace(/^(?:session\s+)?title\s*:\s*/i, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .trim();

  if (!title) return undefined;
  return title.length <= 72 ? title : `${title.slice(0, 71).trimEnd()}…`;
}

export default function (pi: ExtensionAPI) {
  let attempted = false;

  pi.on("session_start", () => {
    attempted = false;
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (attempted || pi.getSessionName() || !ctx.model) return;

    const messages = ctx.sessionManager.getBranch().filter(
      (
        entry,
      ): entry is typeof entry & {
        message: { role: string; content?: unknown };
      } =>
        entry.type === "message" &&
        "role" in entry.message &&
        (entry.message.role === "user" || entry.message.role === "assistant"),
    );

    // Avoid forcing the model to invent specificity for content-free sessions.
    // Do not mark the attempt complete, so a later substantive prompt can retry.
    if (!hasTitleworthyUserPrompt(messages)) return;

    attempted = true;

    const conversation = messages
      .slice(-10)
      .map((entry) => {
        const text = textFromContent(entry.message.content)
          .trim()
          .slice(0, 2_000);
        return `${entry.message.role}: ${text}`;
      })
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 12_000);

    if (!conversation) return;

    try {
      const response = await ctx.modelRegistry.complete(
        ctx.model,
        {
          systemPrompt:
            "Write a specific, searchable 3-7 word title grounded only in the supplied " +
            "conversation. Never invent technologies, tasks, or details not present in it. " +
            "Return only the title with no quotes, markdown, or prefix.",
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: conversation }],
              timestamp: Date.now(),
            },
          ],
        },
        { maxTokens: 80, signal: AbortSignal.timeout(30_000) },
      );

      const title = cleanTitle(textFromContent(response.content));
      if (title && !pi.getSessionName()) {
        pi.setSessionName(title);
        if (ctx.hasUI) ctx.ui.notify(`Session named: ${title}`, "info");
      }
    } catch (error) {
      console.error("[auto-session-title]", error);
    }
  });
}

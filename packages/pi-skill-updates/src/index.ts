import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { scanAllSkills } from "./scanner.js";
import type { SkillScanResult } from "./types.js";
import { formatScanMarkdown, formatShortHash } from "./ui.js";
import { updateAllOutdatedSkills, updateSingleSkill } from "./updater.js";

export default function (pi: ExtensionAPI) {
  let lastScanResult: SkillScanResult | null = null;
  let lastScanTime = 0;
  const CACHE_TTL_MS = 60_000; // 1 minute cache

  async function getOrRunScan(
    cwd: string,
    force: boolean = false,
  ): Promise<SkillScanResult> {
    const now = Date.now();
    if (!force && lastScanResult && now - lastScanTime < CACHE_TTL_MS) {
      return lastScanResult;
    }
    const result = await scanAllSkills(cwd);
    lastScanResult = result;
    lastScanTime = now;
    return result;
  }

  function updateStatusWidget(ctx: ExtensionContext, result: SkillScanResult) {
    if (!ctx.hasUI) return;

    if (result.updatesCount > 0) {
      const outdated = result.skills.filter(
        (s) => s.status === "update-available",
      );
      const preview = outdated
        .map(
          (s) =>
            `${s.name} (${formatShortHash(s.currentHash)} ➔ ${formatShortHash(s.latestHash)})`,
        )
        .join(", ");

      // Display persistent status in footer
      ctx.ui.setStatus(
        "skill-updates",
        `⚡ ${result.updatesCount} skill update(s) available: ${preview} | Run /skills:check`,
      );

      // Render widget above editor
      ctx.ui.setWidget("skill-updates-banner", [
        `📦 Skill Updates: ${result.updatesCount} available (${preview})`,
        `   Type /skills:check to inspect or /skills:update to update all.`,
      ]);
    } else {
      ctx.ui.setStatus("skill-updates", undefined);
      ctx.ui.setWidget("skill-updates-banner", undefined);
    }
  }

  // 1. Slash Command: /skills:check or /skill-updates
  const handleCheckCommand = async (
    args: string,
    ctx: ExtensionCommandContext,
  ) => {
    const force = args.includes("--force") || args.includes("-f");
    if (ctx.hasUI) {
      ctx.ui.notify("Scanning installed skills for updates...", "info");
    }

    const result = await getOrRunScan(ctx.cwd, force || true);
    updateStatusWidget(ctx, result);
    const markdown = formatScanMarkdown(result);

    if (!ctx.hasUI) {
      console.log(markdown);
      return;
    }

    if (result.updatesCount > 0) {
      const outdatedList = result.skills
        .filter((s) => s.status === "update-available")
        .map(
          (s) =>
            `${s.name} (${formatShortHash(s.currentHash)} ➔ ${formatShortHash(s.latestHash)})`,
        )
        .join(", ");

      const choice = await ctx.ui.select(
        `📦 ${result.updatesCount} Skill Update(s) Available: ${outdatedList}`,
        [
          "✨ Update all outdated skills now",
          "🔍 View full skills report",
          "⏭️ Dismiss",
        ],
      );

      if (choice === "✨ Update all outdated skills now") {
        ctx.ui.notify("Updating skills...", "info");
        const updateRes = await updateAllOutdatedSkills(result.skills, ctx.cwd);
        if (updateRes.successCount > 0) {
          ctx.ui.notify(
            `✅ Successfully updated ${updateRes.successCount} skill(s)!`,
            "info",
          );
        }
        if (updateRes.failCount > 0) {
          ctx.ui.notify(
            `⚠️ Failed to update ${updateRes.failCount} skill(s).`,
            "error",
          );
        }
        // Rescan and clear widget
        lastScanResult = null;
        const freshScan = await getOrRunScan(ctx.cwd, true);
        updateStatusWidget(ctx, freshScan);
      } else if (choice === "🔍 View full skills report") {
        await ctx.ui.select("Agent Skills Status", [markdown, "Back"]);
      }
    } else {
      ctx.ui.notify(
        `All ${result.totalCount} skills are up to date! 🟢`,
        "info",
      );
    }
  };

  pi.registerCommand("skills:check", {
    description: "Scan installed agent skills and check for updates",
    handler: handleCheckCommand,
  });

  // 2. Slash Command: /skills:update [skillName]
  pi.registerCommand("skills:update", {
    description: "Update a specific skill or all outdated skills",
    handler: async (args, ctx) => {
      const target = args.trim();
      if (target) {
        if (ctx.hasUI) {
          ctx.ui.notify(`Updating skill '${target}'...`, "info");
        }
        const res = await updateSingleSkill(target, "global", ctx.cwd);
        if (res.success) {
          if (ctx.hasUI) {
            ctx.ui.notify(`✅ Updated skill '${target}' successfully!`, "info");
          } else {
            console.log(`✅ Updated skill '${target}' successfully!`);
          }
        } else {
          const msg = `❌ Failed to update skill '${target}': ${res.error || res.output}`;
          if (ctx.hasUI) {
            ctx.ui.notify(msg, "error");
          } else {
            console.error(msg);
          }
        }
        lastScanResult = null;
        const freshScan = await getOrRunScan(ctx.cwd, true);
        updateStatusWidget(ctx, freshScan);
        return;
      }

      // No target specified: scan and update all outdated
      if (ctx.hasUI) {
        ctx.ui.notify("Checking for outdated skills...", "info");
      }
      const result = await getOrRunScan(ctx.cwd, true);
      if (result.updatesCount === 0) {
        if (ctx.hasUI) {
          ctx.ui.notify("All skills are already up to date! 🟢", "info");
        } else {
          console.log("All skills are already up to date! 🟢");
        }
        updateStatusWidget(ctx, result);
        return;
      }

      if (ctx.hasUI) {
        ctx.ui.notify(
          `Updating ${result.updatesCount} outdated skill(s)...`,
          "info",
        );
      }
      const updateRes = await updateAllOutdatedSkills(result.skills, ctx.cwd);
      if (ctx.hasUI) {
        ctx.ui.notify(
          `Update finished: ${updateRes.successCount} succeeded, ${updateRes.failCount} failed.`,
          updateRes.failCount > 0 ? "error" : "info",
        );
      } else {
        console.log(
          `Update finished: ${updateRes.successCount} succeeded, ${updateRes.failCount} failed.`,
        );
      }
      lastScanResult = null;
      const fresh = await getOrRunScan(ctx.cwd, true);
      updateStatusWidget(ctx, fresh);
    },
  });

  // 3. On load / session start: scan immediately and show widget/status if updates available
  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    try {
      const scan = await getOrRunScan(ctx.cwd, false);
      updateStatusWidget(ctx, scan);
      if (scan.updatesCount > 0 && ctx.hasUI) {
        ctx.ui.notify(
          `⚡ ${scan.updatesCount} skill update(s) available. Run /skills:check to view.`,
          "info",
        );
      }
    } catch {}
  });
}

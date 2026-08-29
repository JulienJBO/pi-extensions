import type { InstalledSkillInfo, SkillScanResult } from "./types.js";

export function formatShortHash(hash?: string): string {
  if (!hash) return "-";
  if (hash.startsWith("sha256:")) {
    return hash.slice(7, 15);
  }
  return hash.length > 8 ? hash.slice(0, 8) : hash;
}

export function getStatusBadge(status: InstalledSkillInfo["status"]): string {
  switch (status) {
    case "update-available":
      return "🟡 UPDATE AVAILABLE";
    case "up-to-date":
      return "🟢 UP TO DATE";
    case "local-only":
      return "⚪ LOCAL ONLY";
    case "check-failed":
      return "🔴 CHECK FAILED";
    case "checking":
      return "⏳ CHECKING";
  }
}

export function formatScanMarkdown(result: SkillScanResult): string {
  const {
    skills,
    totalCount,
    updatesCount,
    upToDateCount,
    failedCount,
    localCount,
  } = result;

  const lines: string[] = [];
  lines.push("# 📦 Agent Skills Status");
  lines.push("");
  lines.push(
    `> **Total Skills:** ${totalCount} | **Updates Available:** ${updatesCount} | **Up to Date:** ${upToDateCount} | **Local:** ${localCount}${failedCount > 0 ? ` | **Errors:** ${failedCount}` : ""}`,
  );
  lines.push("");

  if (updatesCount > 0) {
    lines.push("### 🚀 Available Updates");
    for (const skill of skills.filter((s) => s.status === "update-available")) {
      const cur = formatShortHash(skill.currentHash);
      const lat = formatShortHash(skill.latestHash);
      lines.push(
        `- **\`${skill.name}\`** (${skill.scope}) : \`${cur}\` ➔ \`${lat}\` from \`${skill.source}\``,
      );
      if (skill.description) {
        lines.push(`  *${skill.description}*`);
      }
      lines.push(
        `  Command: \`npx skills update ${skill.name} ${skill.scope === "global" ? "-g" : "-p"} -y\``,
      );
    }
    lines.push("");
  }

  lines.push("### 📋 All Skills Summary");
  lines.push("| Skill | Status | Scope | Source | Current | Latest |");
  lines.push("| :--- | :--- | :--- | :--- | :--- | :--- |");

  for (const skill of skills) {
    const badge = getStatusBadge(skill.status);
    const cur = formatShortHash(skill.currentHash);
    const lat = formatShortHash(skill.latestHash);
    const src =
      skill.source.length > 25 ? skill.source.slice(0, 24) + "…" : skill.source;
    lines.push(
      `| **${skill.name}** | ${badge} | ${skill.scope} | \`${src}\` | \`${cur}\` | \`${lat}\` |`,
    );
  }

  if (failedCount > 0) {
    lines.push("");
    lines.push("### ⚠️ Check Warnings");
    for (const skill of skills.filter((s) => s.status === "check-failed")) {
      lines.push(
        `- **${skill.name}**: ${skill.errorMessage || "Unknown error"}`,
      );
    }
  }

  return lines.join("\n");
}

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { InstalledSkillInfo, UpdateExecutionResult } from "./types.js";

const execAsync = promisify(exec);

export async function updateSingleSkill(
  skillName: string,
  scope: "global" | "project" = "global",
  cwd: string = process.cwd(),
): Promise<UpdateExecutionResult> {
  const scopeFlag = scope === "global" ? "-g" : "-p";
  const command = `npx -y skills update ${skillName} ${scopeFlag} -y`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 60_000,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
      },
    });

    const output = (stdout + "\n" + stderr).trim();
    const isSuccess =
      !output.toLowerCase().includes("failed to update") &&
      !output.toLowerCase().includes("error:");

    return {
      skillName,
      success: isSuccess,
      output,
      error: isSuccess ? undefined : output,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      skillName,
      success: false,
      output: "",
      error: msg,
    };
  }
}

export async function updateAllOutdatedSkills(
  skills: InstalledSkillInfo[],
  cwd: string = process.cwd(),
): Promise<{
  results: UpdateExecutionResult[];
  successCount: number;
  failCount: number;
}> {
  const outdated = skills.filter((s) => s.status === "update-available");
  if (outdated.length === 0) {
    return { results: [], successCount: 0, failCount: 0 };
  }

  const results: UpdateExecutionResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const skill of outdated) {
    const res = await updateSingleSkill(skill.name, skill.scope, cwd);
    results.push(res);
    if (res.success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  return {
    results,
    successCount,
    failCount,
  };
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  InstalledSkillInfo,
  SkillLockFile,
  SkillScanResult,
  SkillScope,
  SkillSourceType,
} from "./types.js";

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
  url?: string;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated?: boolean;
}

function parseFrontmatter(content: string): {
  name?: string;
  description?: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const body = match[1];
  const nameMatch = body.match(/^name:\s*(.+)$/m);
  const descMatch = body.match(/^description:\s*(.+)$/m);
  return {
    name: nameMatch
      ? nameMatch[1].trim().replace(/^['"]|['"]$/g, "")
      : undefined,
    description: descMatch
      ? descMatch[1].trim().replace(/^['"]|['"]$/g, "")
      : undefined,
  };
}

function parseGitHubOwnerRepo(
  source: string,
): { owner: string; repo: string } | null {
  const cleaned = source
    .replace(/^git\+https?:\/\//, "")
    .replace(/^https?:\/\//, "")
    .replace(/^git@github\.com:/, "")
    .replace(/^github\.com\//, "")
    .replace(/\.git$/, "");

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

function getSkillFolderFromSkillPath(skillPath?: string): string {
  if (!skillPath) return "";
  let normalized = skillPath.replace(/\\/g, "/");
  if (normalized.toLowerCase().endsWith("/skill.md")) {
    normalized = normalized.slice(0, -9);
  } else if (normalized.toLowerCase().endsWith("skill.md")) {
    normalized = normalized.slice(0, -8);
  }
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

function getGitHubToken(): string | undefined {
  return (
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.PI_GITHUB_TOKEN
  );
}

async function fetchGitHubTree(
  owner: string,
  repo: string,
  ref: string = "HEAD",
): Promise<{ data?: GitHubTreeResponse; error?: string }> {
  const token = getGitHubToken();
  const headers: Record<string, string> = {
    "User-Agent": "pi-skill-updates/0.1.0",
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        return {
          error:
            "GitHub API rate limit reached. Set GITHUB_TOKEN environment variable to increase limit.",
        };
      }
      if (res.status === 404) {
        return {
          error: `Repository ${owner}/${repo} or ref ${ref} not found on GitHub`,
        };
      }
      return {
        error: `GitHub API returned HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = (await res.json()) as GitHubTreeResponse;
    return { data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Failed to connect to GitHub API: ${msg}` };
  }
}

async function fetchWellKnownDigest(
  baseUrl: string,
): Promise<{ digest?: string; error?: string }> {
  try {
    const cleanBase = baseUrl.replace(/\/$/, "");
    const url = `${cleanBase}/.well-known/agent-skills/index.json`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "pi-skill-updates/0.1.0",
        "X-Skills-Update-Check": "1",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { error: `HTTP ${res.status} when fetching well-known index` };
    }
    const data = (await res.json()) as { digest?: string };
    return { digest: data.digest };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  }
}

function readLockFileSafe(filePath: string): SkillLockFile | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as SkillLockFile;
  } catch {
    return null;
  }
}

function collectSkillsFromDir(
  dirPath: string,
  scope: SkillScope,
  knownMap: Map<string, InstalledSkillInfo>,
) {
  if (!fs.existsSync(dirPath)) return;

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() || entry.isSymbolicLink()) {
        const skillMdPath = path.join(fullPath, "SKILL.md");
        if (fs.existsSync(skillMdPath)) {
          const skillName = entry.name;
          if (!knownMap.has(skillName)) {
            let description: string | undefined;
            try {
              const text = fs.readFileSync(skillMdPath, "utf-8");
              const parsed = parseFrontmatter(text);
              description = parsed.description;
            } catch {}

            knownMap.set(skillName, {
              name: skillName,
              scope,
              path: fullPath,
              sourceType: "local",
              source: "local-directory",
              status: "local-only",
              description,
            });
          }
        }
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name !== "SKILL.md"
      ) {
        const skillName = entry.name.slice(0, -3);
        if (!knownMap.has(skillName)) {
          let description: string | undefined;
          try {
            const text = fs.readFileSync(fullPath, "utf-8");
            const parsed = parseFrontmatter(text);
            description = parsed.description;
          } catch {}

          if (description) {
            knownMap.set(skillName, {
              name: skillName,
              scope,
              path: fullPath,
              sourceType: "local",
              source: "local-file",
              status: "local-only",
              description,
            });
          }
        }
      }
    }
  } catch {}
}

export async function scanAllSkills(cwd: string): Promise<SkillScanResult> {
  const homeDir = os.homedir();
  const skillMap = new Map<string, InstalledSkillInfo>();

  // 1. Read Global Lockfile
  const globalLockPath = path.join(homeDir, ".agents", ".skill-lock.json");
  const globalLock = readLockFileSafe(globalLockPath);

  if (globalLock?.skills) {
    for (const [name, entry] of Object.entries(globalLock.skills)) {
      const sourceType = (entry.sourceType as SkillSourceType) || "unknown";
      const skillDir = path.join(homeDir, ".agents", "skills", name);
      let description: string | undefined;

      try {
        const mdPath = path.join(skillDir, "SKILL.md");
        if (fs.existsSync(mdPath)) {
          const parsed = parseFrontmatter(fs.readFileSync(mdPath, "utf-8"));
          description = parsed.description;
        }
      } catch {}

      skillMap.set(`global:${name}`, {
        name,
        scope: "global",
        path: skillDir,
        sourceType,
        source: entry.source,
        sourceUrl: entry.sourceUrl,
        skillPath: entry.skillPath,
        currentHash: entry.skillFolderHash,
        ref: entry.ref,
        status: "checking",
        description,
      });
    }
  }

  // 2. Read Project Lockfile(s)
  const projectLockCandidates = [
    path.join(cwd, ".agents", ".skill-lock.json"),
    path.join(cwd, ".skill-lock.json"),
    path.join(cwd, "skills-lock.json"),
  ];

  for (const pLockPath of projectLockCandidates) {
    const pLock = readLockFileSafe(pLockPath);
    if (pLock?.skills) {
      for (const [name, entry] of Object.entries(pLock.skills)) {
        const key = `project:${name}`;
        if (skillMap.has(key)) continue;

        const sourceType = (entry.sourceType as SkillSourceType) || "unknown";
        const skillDir = path.join(cwd, ".agents", "skills", name);
        let description: string | undefined;

        try {
          const mdPath = path.join(skillDir, "SKILL.md");
          if (fs.existsSync(mdPath)) {
            const parsed = parseFrontmatter(fs.readFileSync(mdPath, "utf-8"));
            description = parsed.description;
          }
        } catch {}

        skillMap.set(key, {
          name,
          scope: "project",
          path: skillDir,
          sourceType,
          source: entry.source,
          sourceUrl: entry.sourceUrl,
          skillPath: entry.skillPath,
          currentHash: entry.skillFolderHash,
          ref: entry.ref,
          status: "checking",
          description,
        });
      }
    }
  }

  // 3. Scan local skill directories for untracked skills
  const localDirs: Array<{ path: string; scope: SkillScope }> = [
    { path: path.join(homeDir, ".pi", "agent", "skills"), scope: "global" },
    { path: path.join(homeDir, ".agents", "skills"), scope: "global" },
    { path: path.join(cwd, ".pi", "skills"), scope: "project" },
    { path: path.join(cwd, ".agents", "skills"), scope: "project" },
  ];

  for (const { path: dir, scope } of localDirs) {
    const tempMap = new Map<string, InstalledSkillInfo>();
    collectSkillsFromDir(dir, scope, tempMap);
    for (const [skillName, info] of tempMap.entries()) {
      const key = `${scope}:${skillName}`;
      if (!skillMap.has(key)) {
        skillMap.set(key, info);
      }
    }
  }

  const skills = Array.from(skillMap.values());

  // 4. Batch GitHub repos to minimize requests
  const githubRepoMap = new Map<
    string,
    { owner: string; repo: string; ref: string; skills: InstalledSkillInfo[] }
  >();

  for (const skill of skills) {
    if (
      skill.sourceType === "github" ||
      (skill.source &&
        (skill.source.includes("/") || skill.sourceUrl?.includes("github.com")))
    ) {
      const parsed = parseGitHubOwnerRepo(skill.sourceUrl || skill.source);
      if (parsed) {
        const ref = skill.ref || "HEAD";
        const key = `${parsed.owner}/${parsed.repo}@${ref}`;
        const group = githubRepoMap.get(key) || {
          owner: parsed.owner,
          repo: parsed.repo,
          ref,
          skills: [],
        };
        group.skills.push(skill);
        githubRepoMap.set(key, group);
      }
    }
  }

  // 5. Query GitHub Trees in parallel
  await Promise.all(
    Array.from(githubRepoMap.values()).map(async (group) => {
      const result = await fetchGitHubTree(group.owner, group.repo, group.ref);
      if (result.error || !result.data) {
        for (const skill of group.skills) {
          skill.status = "check-failed";
          skill.errorMessage =
            result.error || "Failed to fetch repository tree";
        }
        return;
      }

      const treeResponse = result.data;
      for (const skill of group.skills) {
        const folderPath = getSkillFolderFromSkillPath(skill.skillPath);
        let latestHash: string | undefined;

        if (!folderPath) {
          // Root skill
          latestHash = treeResponse.sha;
        } else {
          const treeItem = treeResponse.tree.find(
            (e) => e.type === "tree" && e.path === folderPath,
          );
          if (treeItem) {
            latestHash = treeItem.sha;
          }
        }

        if (!latestHash) {
          // Fallback: check if SKILL.md exists directly in tree
          const blobItem = treeResponse.tree.find(
            (e) =>
              e.type === "blob" && e.path === (skill.skillPath || "SKILL.md"),
          );
          if (blobItem) {
            latestHash = blobItem.sha;
          }
        }

        if (latestHash) {
          skill.latestHash = latestHash;
          if (skill.currentHash) {
            if (skill.currentHash.toLowerCase() !== latestHash.toLowerCase()) {
              skill.status = "update-available";
            } else {
              skill.status = "up-to-date";
            }
          } else {
            skill.status = "up-to-date";
          }
        } else {
          skill.status = "check-failed";
          skill.errorMessage = `Skill path '${skill.skillPath || folderPath}' not found in remote repository`;
        }
      }
    }),
  );

  // 6. Handle well-known and remaining sources
  await Promise.all(
    skills
      .filter((s) => s.status === "checking")
      .map(async (skill) => {
        if (skill.sourceType === "well-known" && skill.sourceUrl) {
          const wkResult = await fetchWellKnownDigest(skill.sourceUrl);
          if (wkResult.digest) {
            skill.latestHash = wkResult.digest;
            if (skill.currentHash && skill.currentHash !== wkResult.digest) {
              skill.status = "update-available";
            } else {
              skill.status = "up-to-date";
            }
          } else {
            skill.status = "check-failed";
            skill.errorMessage =
              wkResult.error || "Failed to fetch well-known digest";
          }
        } else if (
          skill.sourceType === "local" ||
          skill.source === "local-directory" ||
          skill.source === "local-file"
        ) {
          skill.status = "local-only";
        } else {
          // Unchecked / unknown
          skill.status = "up-to-date";
        }
      }),
  );

  // Sort: update-available first, then check-failed, then up-to-date, then local-only
  const statusOrder: Record<string, number> = {
    "update-available": 0,
    "check-failed": 1,
    "up-to-date": 2,
    "local-only": 3,
    checking: 4,
  };

  skills.sort((a, b) => {
    const orderDiff =
      (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });

  const updatesCount = skills.filter(
    (s) => s.status === "update-available",
  ).length;
  const upToDateCount = skills.filter((s) => s.status === "up-to-date").length;
  const failedCount = skills.filter((s) => s.status === "check-failed").length;
  const localCount = skills.filter((s) => s.status === "local-only").length;

  return {
    skills,
    totalCount: skills.length,
    updatesCount,
    upToDateCount,
    failedCount,
    localCount,
    scannedAt: new Date().toISOString(),
  };
}

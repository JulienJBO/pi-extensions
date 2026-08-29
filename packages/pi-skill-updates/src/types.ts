export type SkillScope = "global" | "project";

export type SkillSourceType =
  "github" | "well-known" | "npm" | "git" | "local" | "unknown";

export type SkillUpdateStatus =
  | "up-to-date"
  | "update-available"
  | "local-only"
  | "check-failed"
  | "checking";

export interface SkillLockEntry {
  source: string;
  sourceType?: string;
  sourceUrl?: string;
  sourceBaseUrl?: string;
  wellKnownDigest?: string;
  skillPath?: string;
  skillFolderHash?: string;
  installedAt?: string;
  updatedAt?: string;
  ref?: string;
}

export interface SkillLockFile {
  version?: number;
  skills?: Record<string, SkillLockEntry>;
  dismissed?: Record<string, unknown>;
  lastSelectedAgents?: string[];
}

export interface InstalledSkillInfo {
  name: string;
  scope: SkillScope;
  path?: string;
  sourceType: SkillSourceType;
  source: string;
  sourceUrl?: string;
  currentHash?: string;
  latestHash?: string;
  currentVersion?: string;
  latestVersion?: string;
  status: SkillUpdateStatus;
  errorMessage?: string;
  description?: string;
  skillPath?: string;
  ref?: string;
}

export interface SkillScanResult {
  skills: InstalledSkillInfo[];
  totalCount: number;
  updatesCount: number;
  upToDateCount: number;
  failedCount: number;
  localCount: number;
  scannedAt: string;
}

export interface UpdateExecutionResult {
  skillName?: string;
  success: boolean;
  output: string;
  error?: string;
}

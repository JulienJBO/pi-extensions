import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const packagesDir = path.join(rootDir, "packages");

const targetArg = process.argv[2];

console.log("🔍 Running typechecks and tests...");
execSync("npm run typecheck", { stdio: "inherit", cwd: rootDir });
execSync("npm run test", { stdio: "inherit", cwd: rootDir });

const packageDirs = targetArg
  ? [path.join(packagesDir, targetArg)]
  : fs.readdirSync(packagesDir).map((dir) => path.join(packagesDir, dir));

for (const pkgDir of packageDirs) {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
  const { name, version } = pkg;

  console.log("\n--------------------------------------------------");
  console.log(`📦 Checking ${name}@${version}...`);

  let isPublished = false;
  try {
    const publishedVersion = execSync(`npm view ${name}@${version} version 2>/dev/null`, {
      encoding: "utf-8",
    }).trim();
    if (publishedVersion === version) {
      isPublished = true;
    }
  } catch {
    isPublished = false;
  }

  if (isPublished) {
    console.log(`⏭️  ${name}@${version} is already published on npm. Skipping.`);
    continue;
  }

  console.log(`🚀 Publishing ${name}@${version} to npm...`);
  try {
    const relPkgDir = path.relative(rootDir, pkgDir);
    execSync(`npm publish --workspace="${relPkgDir}" --access public`, {
      stdio: "inherit",
      cwd: rootDir,
    });
    console.log(`✅ Successfully published ${name}@${version}!`);
  } catch (error) {
    console.error(`❌ Failed to publish ${name}:`, error.message);
  }
}

console.log("\n🎉 Done!");

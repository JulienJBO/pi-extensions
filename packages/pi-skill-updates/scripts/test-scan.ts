import { scanAllSkills } from "../src/scanner.js";
import { formatScanMarkdown } from "../src/ui.js";

async function main() {
  console.log("Scanning skills for updates...");
  const result = await scanAllSkills(process.cwd());
  console.log("\n" + formatScanMarkdown(result));
}

main().catch(console.error);

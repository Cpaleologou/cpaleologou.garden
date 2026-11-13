// One command to publish: vault -> site content -> build check -> commit -> push.
// GitHub Actions then builds and deploys christianp.space (.github/workflows/deploy.yml).
//
//   npm run deploy            publish
//   npm run deploy -- --dry   sync + build + show what would be committed, no commit or push

import { execSync } from "node:child_process";

const BRANCH = "astro";
const dry = process.argv.includes("--dry");
const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const out = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();

const branch = out("git rev-parse --abbrev-ref HEAD");
if (branch !== BRANCH) {
  console.error(`✋ On branch "${branch}". Deploys go out from "${BRANCH}"; switch with: git switch ${BRANCH}`);
  process.exit(1);
}

run("node scripts/build-garden.mjs");
run("npm run build --silent", { stdio: ["inherit", "ignore", "inherit"] }); // fail before committing a broken site
console.log("✅ Site builds.");

run("git add -A");
const changed = out("git status --porcelain");
// Commits made by hand (e.g. site code changes) that haven't been pushed yet.
const unpushed = Number(out(`git rev-list --count origin/${BRANCH}..HEAD`));
if (!changed && !unpushed) {
  console.log("Nothing new to publish.");
  process.exit(0);
}
if (changed) console.log(changed.split("\n").length + " changed files.");
if (unpushed) console.log(`${unpushed} unpushed commit(s).`);
if (dry) {
  run("git reset -q");
  console.log("Dry run: nothing committed or pushed.");
  process.exit(0);
}

if (changed) {
  const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  run(`git commit -q -m ${JSON.stringify(`Garden sync: ${stamp}`)}`);
}
run(`git push origin ${BRANCH}`);
console.log("🚀 Pushed. GitHub Actions will publish christianp.space in a minute or two.");

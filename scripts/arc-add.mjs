// Needs: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=<ca bundle> when behind a proxy.
// Installs free Arc UI registry items without the shadcn CLI.
// Usage: node scripts/arc-add.mjs button progress line-chart
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const BASE = "https://uiarc.dev/r";
const seen = new Set();
const npmDeps = new Set();

function targetPath(target) {
  if (target.startsWith("@components/")) return join("src/components", target.slice(12));
  if (target.startsWith("~/.claude/")) return join(".claude", target.slice(10));
  return join("src", target);
}

async function add(nameOrUrl) {
  const url = nameOrUrl.startsWith("http") ? nameOrUrl : `${BASE}/${nameOrUrl}.json`;
  if (seen.has(url)) return;
  seen.add(url);
  const res = await fetch(url);
  if (!res.ok) { console.error(`skip ${nameOrUrl}: ${res.status} (Pro or unknown)`); return; }
  const item = await res.json();
  for (const dep of item.registryDependencies ?? []) await add(dep);
  (item.dependencies ?? []).filter((d) => /^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(d)).forEach((d) => npmDeps.add(d));
  for (const f of item.files ?? []) {
    const out = targetPath(f.target);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, f.content);
  }
  console.log(`added ${item.name}`);
}

for (const n of process.argv.slice(2)) await add(n);
if (npmDeps.size) execSync(`npm install ${[...npmDeps].join(" ")}`, { stdio: "inherit" });

import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, join, sep } from "node:path";

const generated = [];

async function discover(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await discover(path);
    } else if (entry.name.endsWith(".sql") && path.split(sep).includes("_tests")) {
      generated.push(path);
    }
  }
}

await discover(join(process.cwd(), "src", "app"));
await mkdir(join(process.cwd(), "supabase", "tests"), { recursive: true });

const copied = [];
try {
  for (const [index, source] of generated.entries()) {
    const target = join(
      process.cwd(),
      "supabase",
      "tests",
      `zz_generated_${String(index + 1).padStart(3, "0")}_${basename(source)}`
    );
    await cp(source, target);
    copied.push(target);
  }

  const result = spawnSync("supabase", ["test", "db"], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  await Promise.all(copied.map((path) => rm(path, { force: true })));
}

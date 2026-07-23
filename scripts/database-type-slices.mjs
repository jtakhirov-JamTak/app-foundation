import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

async function walk(directory, found) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path, found);
    } else if (entry.name === "database-type-slice.json") {
      found.push(path);
    }
  }
}

export async function readDatabaseTypeSlices(root = process.cwd()) {
  const configs = [];
  await walk(join(root, "src", "app"), configs);

  return Promise.all(
    configs.sort().map(async (configPath) => {
      const parsed = JSON.parse(await readFile(configPath, "utf8"));
      if (
        !parsed ||
        !Array.isArray(parsed.tables) ||
        !Array.isArray(parsed.functions) ||
        typeof parsed.output !== "string"
      ) {
        throw new Error(`Invalid database type slice: ${configPath}`);
      }
      return {
        configPath,
        tables: new Set(parsed.tables),
        functions: new Set(parsed.functions),
        outputPath: resolve(dirname(configPath), parsed.output),
      };
    }),
  );
}

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (existsSync(new URL("../dist/index.js", import.meta.url))) {
  process.exit(0);
}

const result = spawnSync("pnpm", ["--silent", "build"], {
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);

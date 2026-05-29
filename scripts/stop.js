import { spawnSync } from "node:child_process";

const result = spawnSync("docker", ["compose", "down"], {
  stdio: "inherit"
});

process.exit(result.status ?? 0);


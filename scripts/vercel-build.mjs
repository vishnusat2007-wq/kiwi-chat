#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const deployKey = process.env.CONVEX_DEPLOY_KEY?.trim();
const command = deployKey
  ? [
      "npx",
      "convex",
      "deploy",
      "--cmd",
      "next build",
      "--preview-run",
      "seed:ensureSeed",
    ]
  : ["npx", "next", "build"];

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);

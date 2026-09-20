#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const deployKey = process.env.CONVEX_DEPLOY_KEY?.trim();

if (!deployKey) {
  console.warn(
    [
      "",
      "  ⚠️  CONVEX_DEPLOY_KEY is not set.",
      "  Next.js will still build. Convex functions will NOT be pushed.",
      "  Create a key: Convex dashboard → Settings → Deploy Keys,",
      "  then add CONVEX_DEPLOY_KEY on Vercel (Production + Preview).",
      "  Dashboard: https://dashboard.convex.dev/t/vishnu-satyavarapu/kiwi-chat/flippant-swan-205",
      "",
    ].join("\n"),
  );
}

const command = deployKey
  ? [
      "npx",
      "convex",
      "deploy",
      "--cmd",
      "next build",
      "--cmd-url-env-var-name",
      "NEXT_PUBLIC_CONVEX_URL",
      "--preview-run",
      "seed:ensureSeed",
    ]
  : ["npx", "next", "build"];

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);

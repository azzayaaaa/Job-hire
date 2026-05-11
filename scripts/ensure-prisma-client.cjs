const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const schema = process.argv[2] || "prisma/schema.prisma";
const output = process.argv[3] || "node_modules/.prisma/client";
const clientDir = path.resolve(process.cwd(), output);
const indexFile = path.join(clientDir, "index.js");
const engineFile = path.join(clientDir, "query_engine-windows.dll.node");

const hasClient =
  fs.existsSync(indexFile) &&
  (process.platform !== "win32" || fs.existsSync(engineFile));

if (hasClient) {
  console.log("[Prisma] Client already exists; skipping generate.");
  process.exit(0);
}

console.log("[Prisma] Client missing; running prisma generate.");

const prismaBin = path.resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

const result = spawnSync(prismaBin, ["generate", "--schema", schema], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);

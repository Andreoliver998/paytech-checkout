const { spawnSync } = require("child_process");
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", "..", ".env"),
  override: true,
});

const prismaCli = require.resolve("prisma/build/index.js");
const args = process.argv.slice(2);

const result = spawnSync(process.execPath, [prismaCli, ...args], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

const { execSync } = require("node:child_process");
const fs = require("node:fs");
try {
  execSync("npx vite build", { stdio: "pipe" });
} catch (e) {
  fs.writeFileSync("error.txt", e.stderr, { encoding: "utf-8" });
  console.log("Error logged to error.txt");
}

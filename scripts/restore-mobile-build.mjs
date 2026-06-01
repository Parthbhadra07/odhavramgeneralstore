import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const middleware = path.join(root, "src", "middleware.ts");
const backup = path.join(root, "src", "middleware.web.ts");

if (fs.existsSync(backup)) {
  fs.copyFileSync(backup, middleware);
  console.log("[mobile] Restored web middleware");
}

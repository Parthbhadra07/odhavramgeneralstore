/**
 * Pin Android Gradle Plugin 8.5.1 across Capacitor modules (default is 8.7.2).
 * Run after `npx cap sync` — see npm run cap:sync
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGP_FROM = "8.7.2";
const AGP_TO = "8.5.1";
const GRADLE_FROM = /gradle-8\.(9|10|11)\.\d+-all\.zip/g;
const GRADLE_TO = "gradle-8.7-all.zip";

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === "build" || name === ".gradle") continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (name.endsWith(".gradle") || name === "gradle-wrapper.properties") {
      files.push(full);
    }
  }
  return files;
}

function patchFile(file) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  text = text.replaceAll(
    `com.android.tools.build:gradle:${AGP_FROM}`,
    `com.android.tools.build:gradle:${AGP_TO}`
  );
  text = text.replace(GRADLE_FROM, GRADLE_TO);
  if (text !== before) {
    fs.writeFileSync(file, text);
    console.log("[agp] patched", path.relative(root, file));
  }
}

const targets = [
  path.join(root, "android"),
  path.join(root, "node_modules", "@capacitor"),
];

let count = 0;
for (const base of targets) {
  for (const file of walk(base)) {
    patchFile(file);
    count++;
  }
}

console.log(`[agp] Done. AGP ${AGP_TO} + Gradle ${GRADLE_TO.replace(".zip", "")} (${count} files scanned)`);

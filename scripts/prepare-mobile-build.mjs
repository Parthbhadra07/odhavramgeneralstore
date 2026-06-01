import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const middleware = path.join(root, "src", "middleware.ts");
const stub = path.join(root, "src", "middleware.mobile-stub.ts");
const backup = path.join(root, "src", "middleware.web.ts");

/** Next.js static export does not support middleware — swap to no-op stub */
if (!fs.existsSync(backup)) {
  fs.copyFileSync(middleware, backup);
}

const stubContent = `import { NextResponse } from "next/server";

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
`;

fs.writeFileSync(stub, stubContent);
fs.copyFileSync(stub, middleware);
console.log("[mobile] Using middleware stub for static export");

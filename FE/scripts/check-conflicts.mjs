import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const excluded = new Set([
  "node_modules", "dist", "artifacts", "test-results", "playwright-report", ".git",
]);
const failures = [];
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name)) scan(file);
    } else if (entry.isFile() && /\.(?:[cm]?js|tsx?|css|json|md|html|txt)$/.test(entry.name)) {
      fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, index) => {
        if (/^(?:<{7}(?: |$)|={7}$|>{7}(?: |$)|\|{7}(?: |$))/.test(line))
          failures.push(`${path.relative(root, file)}:${index + 1}`);
      });
    }
  }
}
scan(root);
if (failures.length) {
  console.error(`Unresolved merge conflicts:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else console.log("FE: no unresolved merge conflicts.");

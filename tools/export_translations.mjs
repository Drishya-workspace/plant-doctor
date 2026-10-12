import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourcePath = "C:/Users/Dell/Downloads/plant_app/plant_app/templates/index.html";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "app", "src", "main", "assets");
const source = fs.readFileSync(sourcePath, "utf8");

function extractObject(variableName) {
  const marker = `const ${variableName} =`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${variableName} not found`);
  const start = source.indexOf("{", markerIndex);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return vm.runInNewContext(`(${source.slice(start, index + 1)})`);
    }
  }
  throw new Error(`Could not parse ${variableName}`);
}

fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(
  path.join(assets, "translations.json"),
  JSON.stringify({
    ui: extractObject("uiText"),
    namesHi: extractObject("diseaseHi"),
    infoHi: extractObject("infoHi"),
  }),
  "utf8",
);

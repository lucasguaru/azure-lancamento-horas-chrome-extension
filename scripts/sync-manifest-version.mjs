import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const pkgPath = resolve(root, "package.json");
const manifestPath = resolve(root, "public", "manifest.json");
const stampPath = resolve(root, ".build-version.json");

function safeParseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

const pkg = safeParseJson(await readFile(pkgPath, "utf8"), null);
if (!pkg?.version) {
  throw new Error("Não foi possível ler package.json version.");
}

const manifest = safeParseJson(await readFile(manifestPath, "utf8"), null);
if (!manifest?.manifest_version) {
  throw new Error("Não foi possível ler public/manifest.json.");
}

const stamp = safeParseJson(await readFile(stampPath, "utf8"), null);
const buildStamp = stamp?.ymd && stamp?.n ? `${stamp.ymd}.${stamp.n}` : null;

manifest.version = String(pkg.version);
manifest.version_name = buildStamp ? `${pkg.version} (build ${buildStamp})` : String(pkg.version);

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");


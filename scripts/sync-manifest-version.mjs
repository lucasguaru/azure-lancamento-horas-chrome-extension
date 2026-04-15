import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { bumpBuildVersion } from "./build-version.mjs";

const root = resolve(process.cwd());
const pkgPath = resolve(root, "package.json");
const manifestPath = resolve(root, "public", "manifest.json");

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

// Um único bump por build; o Vite só lê o mesmo valor (sem incrementar de novo).
const buildStamp = bumpBuildVersion(root);

manifest.version = String(pkg.version);
manifest.version_name = `${pkg.version} (build ${buildStamp})`;

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

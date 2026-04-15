import { readFile, readdir, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const root = resolve(process.cwd());
const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
const version = String(pkg?.version || "").trim();
if (!version) throw new Error("Não foi possível ler package.json version.");

const distDir = resolve(root, "dist");
const outZipBasename = `chrome-ado-hours-${version}.zip`;
const outZipPath = resolve(distDir, outZipBasename);

// Remove ZIP anterior para não incluí-lo ao empacotar de novo.
try {
  await unlink(outZipPath);
} catch {
  // ok se não existir
}

const entries = await readdir(distDir);
const toZip = entries.filter((e) => !e.endsWith(".zip"));
if (toZip.length === 0) {
  throw new Error("dist/ está vazio. Rode npm run build antes do zip.");
}

// Empacota o conteúdo de dist/ na raiz do ZIP (sem pasta dist/ dentro).
// cwd = distDir: o primeiro argumento é o .zip gerado dentro de dist/, o restante são arquivos relativos a dist/.
const bestzipBin = resolve(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "bestzip.cmd" : "bestzip"
);
const quoted = (s) => `"${s.replace(/"/g, '\\"')}"`;
const args = [quoted(outZipBasename), ...toZip.map(quoted)].join(" ");
const cmd = `${quoted(bestzipBin)} ${args}`;
await execAsync(cmd, { cwd: distDir });

console.log(outZipPath);

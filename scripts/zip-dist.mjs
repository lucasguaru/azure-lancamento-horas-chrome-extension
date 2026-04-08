import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const root = resolve(process.cwd());
const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
const version = String(pkg?.version || "").trim();
if (!version) throw new Error("Não foi possível ler package.json version.");

const outZip = `dist/chrome-ado-hours-${version}.zip`;

// Em Windows, chamar npx via spawn/execFile pode falhar com EINVAL dependendo do ambiente.
// Usamos exec com o bin local do node_modules para ser previsível.
const bestzipBin = process.platform === "win32" ? ".\\node_modules\\.bin\\bestzip.cmd" : "./node_modules/.bin/bestzip";
const cmd = `"${bestzipBin}" "${outZip}" dist/*`;
await execAsync(cmd, { cwd: root });

console.log(outZip);


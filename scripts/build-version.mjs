import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @typedef {{ ymd: string; n: number }} BuildStamp
 */

/**
 * Incrementa o contador do dia em `.build-version.json` e devolve o stamp (ex.: `2026.04.08.9`).
 * Deve rodar uma única vez antes do `vite build` (ex.: no prebuild).
 * @param {string} projectRoot
 * @returns {string}
 */
export function bumpBuildVersion(projectRoot) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ymd = `${y}.${m}.${d}`;

  const stampPath = resolve(projectRoot, ".build-version.json");
  /** @type {BuildStamp | null} */
  let stamp = null;
  try {
    stamp = JSON.parse(readFileSync(stampPath, "utf8"));
  } catch {
    stamp = null;
  }

  const nextN = stamp?.ymd === ymd ? Number(stamp?.n || 0) + 1 : 1;
  const next = /** @type {BuildStamp} */ ({ ymd, n: nextN });
  try {
    writeFileSync(stampPath, JSON.stringify(next, null, 2), "utf8");
  } catch {
    // segue sem persistir
  }

  return `${ymd}.${nextN}`;
}

/**
 * Lê o stamp atual (sem incrementar). Use após `bumpBuildVersion` no mesmo processo de build.
 * @param {string} projectRoot
 * @returns {string}
 */
export function readBuildVersion(projectRoot) {
  const stampPath = resolve(projectRoot, ".build-version.json");
  const stamp = JSON.parse(readFileSync(stampPath, "utf8"));
  if (!stamp?.ymd || stamp?.n == null) {
    throw new Error(".build-version.json inválido. Rode o prebuild antes do Vite.");
  }
  return `${stamp.ymd}.${stamp.n}`;
}

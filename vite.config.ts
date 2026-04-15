import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Lê o stamp já gravado pelo `prebuild` (sem incrementar de novo). */
function readBuildVersionFromStamp(projectRoot: string): string {
  const stampPath = resolve(projectRoot, ".build-version.json");
  const stamp = JSON.parse(readFileSync(stampPath, "utf8")) as { ymd?: string; n?: number };
  if (!stamp?.ymd || stamp.n == null) {
    throw new Error(".build-version.json inválido. Use `npm run build` (prebuild atualiza o stamp).");
  }
  return `${stamp.ymd}.${stamp.n}`;
}

export default defineConfig(() => {
  const buildVersion = readBuildVersionFromStamp(__dirname);
  const holidaysPath = resolve(__dirname, "public", "holidays", "br-national-2026-2030.json");
  let holidaysJson = "[]";
  try {
    holidaysJson = readFileSync(holidaysPath, "utf8");
  } catch {
    holidaysJson = "[]";
  }
  return {
    define: {
      __BUILD_VERSION__: JSON.stringify(buildVersion),
      __BR_NATIONAL_HOLIDAYS_2026_2030__: holidaysJson
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, "src/content/content-main.ts"),
        formats: ["es" as const],
        fileName: () => "content.js"
      },
      rollupOptions: {
        output: {
          entryFileNames: "content.js",
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]"
        }
      }
    }
  };
});

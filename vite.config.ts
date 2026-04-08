import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

type BuildStamp = { ymd: string; n: number };

function computeBuildVersion(projectRoot: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const ymd = `${y}.${m}.${d}`;

  const stampPath = resolve(projectRoot, ".build-version.json");
  let stamp: BuildStamp | null = null;
  try {
    stamp = JSON.parse(readFileSync(stampPath, "utf8"));
  } catch {
    stamp = null;
  }

  const nextN = stamp?.ymd === ymd ? Number(stamp?.n || 0) + 1 : 1;
  const next: BuildStamp = { ymd, n: nextN };
  try {
    writeFileSync(stampPath, JSON.stringify(next, null, 2), "utf8");
  } catch {
    // Se falhar por permissão/FS, segue sem persistir.
  }

  return `${ymd}.${nextN}`;
}

export default defineConfig(() => {
  const buildVersion = computeBuildVersion(__dirname);
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
      formats: ["es"],
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

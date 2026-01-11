import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { copyFileSync, existsSync, mkdirSync, cpSync } from "fs";
import { fileURLToPath } from "url";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-manifest",
      closeBundle() {
        copyFileSync(
          resolve(__dirname, "src/manifest.json"),
          resolve(__dirname, "dist/manifest.json")
        );
        
        // Copy PDF.js worker if it exists
        const workerPath = resolve(__dirname, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
        if (existsSync(workerPath)) {
          const distDir = resolve(__dirname, "dist");
          const workerDir = resolve(distDir, "pdfjs");
          if (!existsSync(workerDir)) {
            mkdirSync(workerDir, { recursive: true });
          }
          copyFileSync(workerPath, resolve(workerDir, "pdf.worker.min.mjs"));
        }
        
        // Copy icons directory if it exists
        const iconsSourcePath = resolve(__dirname, "public/icons");
        const iconsDestPath = resolve(__dirname, "dist/icons");
        if (existsSync(iconsSourcePath)) {
          if (!existsSync(iconsDestPath)) {
            mkdirSync(iconsDestPath, { recursive: true });
          }
          cpSync(iconsSourcePath, iconsDestPath, { recursive: true });
        }
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        contentScript: resolve(__dirname, "src/contentScript.ts"),
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep contentScript and background at root for manifest references
          if (chunkInfo.name === "contentScript" || chunkInfo.name === "background") {
            return "[name].js";
          }
          // Popup chunks go to assets (handled by Vite automatically)
          return "assets/[name].js";
        },
        chunkFileNames: "assets/chunk-[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === "index.html") {
            return "[name][extname]";
          }
          return "assets/[name][extname]";
        },
        // Build as IIFE format - required for Chrome extension content scripts
        // Popup will also work with IIFE in extension context
        format: "iife",
        name: "ContextCopilot",
        // CRITICAL: Inline all dynamic imports to avoid chunk files with import statements
        // This ensures contentScript.js is a single self-contained IIFE bundle
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared"),
    },
  },
});

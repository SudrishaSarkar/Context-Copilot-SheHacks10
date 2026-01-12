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
    emptyOutDir: false, // Don't clear - contentScript and background are built separately first
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        // Note: contentScript and background are built separately
        // See package.json scripts for build:content and build:background
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
        // Note: This will create chunks, but we'll handle them in the plugin
        format: "iife",
        name: "ContextCopilot",
      },
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../shared"),
    },
  },
});

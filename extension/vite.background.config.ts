import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false, // Don't clear - we're building into shared dist folder
    rollupOptions: {
      input: resolve(__dirname, "src/background.ts"),
      output: {
        entryFileNames: "[name].js",
        format: "iife",
        name: "ContextCopilot",
        inlineDynamicImports: true,
      },
    },
  },
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** Ассеты + lazy-load скрипты. Бандл копируется в post-vite-build.mjs. */
const STATIC_COPY = [
  { src: "styles", dest: "styles" },
  { src: "img", dest: "img" },
  { src: "icons", dest: "icons" },
  { src: "music", dest: "music" },
  { src: "manifest.webmanifest", dest: "." },
  { src: "sw.js", dest: "." },
  { src: "pwa-precache.js", dest: "." },
  { src: "styles.css", dest: "." },
];

export default defineConfig({
  root: ROOT,
  publicDir: false,
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssMinify: false,
    rollupOptions: {
      input: path.resolve(ROOT, "index.vite.html"),
    },
  },
  plugins: [
    viteStaticCopy({
      targets: STATIC_COPY,
    }),
  ],
});

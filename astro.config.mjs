// @ts-check
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import preact from "@astrojs/preact";
import { remarkObsidian } from "./src/plugins/remark-obsidian.mjs";

export default defineConfig({
  site: "https://christianp.space",
  // Mirrors Quartz's output: notes are notes/foo.html (served at /notes/foo) and
  // folder pages are notes/index.html (served at /notes/), so every old URL keeps working.
  build: { format: "preserve" },
  trailingSlash: "ignore",
  markdown: {
    processor: unified({
      remarkPlugins: [remarkObsidian],
    }),
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
    },
  },
  integrations: [preact()],
  vite: {
    // Pre-bundle the client libraries so the first dev page load doesn't 504.
    optimizeDeps: { include: ["d3-force", "preact", "preact/hooks"] },
  },
});

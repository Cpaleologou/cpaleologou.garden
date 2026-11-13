// Builds the Pagefind search index from the finished site in dist/.
//   node scripts/search-index.mjs         -> dist/pagefind      (production; run by `npm run build`)
//   node scripts/search-index.mjs --dev   -> public/pagefind    (so search also works under `npm run dev`)
// Only pages marked data-pagefind-body (the note pages) are indexed.

import fs from "node:fs/promises";
import * as pagefind from "pagefind";

const dev = process.argv.includes("--dev");
const outputPath = dev ? "public/pagefind" : "dist/pagefind";

// A dev index left in public/ gets copied into dist/ by astro build; always start clean.
await fs.rm(outputPath, { recursive: true, force: true });
if (!dev) await fs.rm("dist/pagefind", { recursive: true, force: true });

const { index, errors } = await pagefind.createIndex({});
if (!index) throw new Error(errors.join("\n"));
const { page_count, errors: addErrors } = await index.addDirectory({ path: "dist" });
if (addErrors.length) throw new Error(addErrors.join("\n"));
const { errors: writeErrors } = await index.writeFiles({ outputPath });
if (writeErrors.length) throw new Error(writeErrors.join("\n"));
await pagefind.close();
console.log(`🔎 Indexed ${page_count} pages into ${outputPath}`);

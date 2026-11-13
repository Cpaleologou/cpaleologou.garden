// Publishes the Obsidian garden into this Astro site.
//
// Port of ~/quartz/garden-builder.mjs: same vault folders, same publish check,
// same transforms (link pretty-printing, book link map, spacing, currency,
// lowercase internal links). Differences:
//   - writes to src/content/garden + public/assets instead of Quartz's content/
//   - also copies images named in frontmatter (`cover:`), not only body embeds
//   - warns when two published notes share a title (e.g. an iCloud "Note 1.md" copy)
//
// The vault is the single source of truth: edit notes (including ```widget
// blocks) in Obsidian, then run `npm run sync`.

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";

// --- CONFIGURATION ---
const VAULT_PATH = "/Users/christianpaleologou/Library/Mobile Documents/iCloud~md~obsidian/Documents";
const SOURCE_ROOT = path.join(VAULT_PATH, "Thoughts/03-Garden");
const SOURCE_IMAGES = path.join(VAULT_PATH, "Thoughts/99-Files");
const DEST_NOTES = path.resolve("src/content/garden");
const DEST_IMAGES = path.resolve("public/assets");

const FOLDERS_TO_SYNC = [
  { name: "Root", source: SOURCE_ROOT, dest: DEST_NOTES },
  { name: "Notes", source: path.join(SOURCE_ROOT, "notes"), dest: path.join(DEST_NOTES, "notes") },
  { name: "Writing", source: path.join(SOURCE_ROOT, "writing"), dest: path.join(DEST_NOTES, "writing") },
  { name: "Now", source: path.join(SOURCE_ROOT, "now"), dest: path.join(DEST_NOTES, "now") },
  { name: "Investing", source: path.join(SOURCE_ROOT, "investing"), dest: path.join(DEST_NOTES, "investing") },
  // Vault folder stays "library" but publishes to /books, so Library.md keeps /library.
  { name: "Library", source: path.join(SOURCE_ROOT, "library"), dest: path.join(DEST_NOTES, "books") },
];

// Frontmatter keys whose value is an image filename to publish alongside the note.
const IMAGE_FIELDS = ["cover"];

// Readwise source note titles -> published book note paths. Keep in sync with
// garden-builder.mjs until Quartz is retired.
const BOOK_LINK_MAP = {
  "🟢 The Most Important Thing Uncommon Sense for the Thoughtful Investor": "/books/the-most-important-thing",
  "🟢 The Elements of Power": "/books/the-elements-of-power",
  "🟢 Breakneck": "/books/breakneck",
  "🟢 Scale": "/books/scale",
  "🟢 Capital Returns": "/books/capital-returns",
  "🟡 The Intelligent Investor": "/books/the-intelligent-investor",
  "🟢 The Burnout Society": "/books/the-burnout-society",
  "🟢 Where the Money Is Value Investing in the Digital Age": "/books/where-the-money-is",
};

const STATUS_EMOJI = /^[🟢🟡]\s*/u;
const stripStatusEmoji = (text) => text.replace(STATUS_EMOJI, "");

// --- MARKDOWN SPACING NORMALIZER (unchanged from garden-builder.mjs) ---
export function normalizeSpacing(body) {
  const isBlank = (l) => l.trim() === "";
  const isHeading = (l) => /^#{1,6}\s/.test(l);
  const isImage = (l) => /^\s*(!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\))\s*$/.test(l);
  const isTableRow = (l) => /^\s*\|/.test(l);
  const isQuote = (l) => /^\s*>/.test(l);
  const isFence = (l) => /^\s*(```|~~~)/.test(l);

  const lines = body.split("\n");
  const out = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : null;

    if (isFence(line)) {
      if (!inFence && out.length && !isBlank(out[out.length - 1])) out.push("");
      out.push(line);
      if (inFence && next !== null && !isBlank(next)) out.push("");
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    const prev = out.length ? out[out.length - 1] : null;
    const needsSpaceBefore =
      isHeading(line) ||
      isImage(line) ||
      (isTableRow(line) && prev !== null && !isTableRow(prev)) ||
      (isQuote(line) && prev !== null && !isQuote(prev));
    if (needsSpaceBefore && prev !== null && !isBlank(prev)) out.push("");

    out.push(line);

    const needsSpaceAfter = isHeading(line) || isImage(line) || (isTableRow(line) && next !== null && !isTableRow(next));
    if (needsSpaceAfter && next !== null && !isBlank(next)) out.push("");
  }

  const collapsed = [];
  let blanks = 0;
  for (const l of out) {
    if (isBlank(l)) {
      if (++blanks === 1) collapsed.push("");
    } else {
      blanks = 0;
      collapsed.push(l);
    }
  }
  while (collapsed.length && isBlank(collapsed[0])) collapsed.shift();
  while (collapsed.length && isBlank(collapsed[collapsed.length - 1])) collapsed.pop();
  return collapsed.join("\n");
}

// --- CURRENCY ESCAPER (unchanged): `$` + digit is money, not math ---
export function escapeCurrency(body) {
  const out = [];
  let inFence = false;
  let inMathBlock = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (!inFence && /^\s*\$\$\s*$/.test(line)) {
      inMathBlock = !inMathBlock;
      out.push(line);
      continue;
    }
    if (inFence || inMathBlock) {
      out.push(line);
      continue;
    }
    out.push(
      line
        .split(/(`[^`]*`)/)
        .map((seg) => (seg.startsWith("`") ? seg : seg.replace(/(?<!\\)\$(?=\d)/g, "\\$")))
        .join(""),
    );
  }
  return out.join("\n");
}

// --- INTERNAL LINK CASING (unchanged): match lowercase-hyphen slugs ---
export function lowercaseInternalLinks(body) {
  const normalizePath = (p) => {
    const split = p.search(/[?#]/);
    const pathPart = split === -1 ? p : p.slice(0, split);
    const rest = split === -1 ? "" : p.slice(split);
    let normalized = pathPart.toLowerCase().replace(/\s+/g, "-");
    normalized = normalized.replace(/^\/library\/(?=.)/, "/books/");
    return normalized + rest;
  };
  return body
    .replace(/\]\((\/(?!\/)[^)\s]*)\)/g, (_m, p) => `](${normalizePath(p)})`)
    .replace(/href="(\/(?!\/)[^"]*)"/g, (_m, p) => `href="${normalizePath(p)}"`);
}

// --- EXECUTION ---
async function copyImage(rawLink, sourceDir, fileName, missing) {
  const clean = rawLink.replace(/\s+["'][^"']*["']\s*$/, "").split("?")[0].split("#")[0].trim();
  if (!clean || /^[a-z]+:/i.test(clean)) return;
  let name;
  try {
    name = path.basename(decodeURIComponent(clean));
  } catch {
    name = path.basename(clean);
  }
  const candidates = [path.join(SOURCE_IMAGES, name), path.join(sourceDir, name)];
  const src = candidates.find((c) => existsSync(c));
  if (!src) return missing.push(`${fileName}: ${name}`);
  const dest = path.join(DEST_IMAGES, name);
  if (!existsSync(dest)) await fs.copyFile(src, dest);
}

async function buildGarden() {
  if (!existsSync(SOURCE_ROOT)) {
    console.error(`Vault not found at ${SOURCE_ROOT}`);
    process.exit(1);
  }
  console.log("🌱 Publishing garden from the vault…");

  await fs.rm(DEST_NOTES, { recursive: true, force: true });
  await fs.rm(DEST_IMAGES, { recursive: true, force: true });
  await fs.mkdir(DEST_IMAGES, { recursive: true });

  const publicFiles = new Set();
  const staged = [];
  for (const folder of FOLDERS_TO_SYNC) {
    if (!existsSync(folder.source)) {
      console.warn(`⚠️  Skipping ${folder.name}: ${folder.source} not found`);
      continue;
    }
    await fs.mkdir(folder.dest, { recursive: true });
    for (const item of await fs.readdir(folder.source)) {
      if (!item.endsWith(".md")) continue;
      const parsed = matter(await fs.readFile(path.join(folder.source, item), "utf8"));
      if (!(parsed.data.publish === true || parsed.data.publish === "true")) continue;
      publicFiles.add(item.replace(/\.md$/, ""));
      staged.push({ fileName: item, sourceDir: folder.source, destDir: folder.dest, parsed });
    }
  }

  const missing = [];
  const titles = new Map();
  for (const { fileName, sourceDir, destDir, parsed } of staged) {
    let body = parsed.content;
    const data = { ...parsed.data };

    for (const m of body.matchAll(/!\[\[(.*?)(?:\|.*?)?\]\]/g)) await copyImage(m[1], sourceDir, fileName, missing);
    for (const m of body.matchAll(/!\[.*?\]\((.*?)\)/g)) await copyImage(m[1], sourceDir, fileName, missing);
    for (const m of body.matchAll(/<img[^>]+src="\/?(?:assets\/)?([^"]+)"/g)) await copyImage(m[1], sourceDir, fileName, missing);
    for (const field of IMAGE_FIELDS) {
      if (typeof data[field] === "string") {
        // Accept "Cover.webp", "[[Cover.webp]]" or "![[Cover.webp]]" in the property.
        data[field] = data[field].replace(/^!?\[\[|\]\]$/g, "").trim();
        await copyImage(data[field], sourceDir, fileName, missing);
      }
    }

    body = body.replace(/(!)?\[\[(.*?)(?:\|.*?)?\]\]/g, (match, isImage, linkTarget) => {
      if (isImage) return match;
      const core = path.basename(linkTarget.split("|")[0].split("#")[0]);
      if (publicFiles.has(core)) return match;
      if (BOOK_LINK_MAP[core]) {
        const alias = linkTarget.split("|")[1];
        return `[${stripStatusEmoji(alias || core)}](${encodeURI(BOOK_LINK_MAP[core])})`;
      }
      return path.basename(stripStatusEmoji(linkTarget.split("|")[0].split("#")[0]));
    });

    if (data.Date) {
      data.date = data.Date;
      delete data.Date;
    }

    body = lowercaseInternalLinks(escapeCurrency(normalizeSpacing(body)));
    await fs.writeFile(path.join(destDir, fileName), matter.stringify(body, data));

    const title = String(data.title ?? fileName.replace(/\.md$/, ""));
    titles.set(title, [...(titles.get(title) ?? []), path.relative(SOURCE_ROOT, path.join(sourceDir, fileName))]);
  }

  for (const [title, files] of titles) {
    if (files.length > 1) console.warn(`⚠️  ${files.length} published notes are titled "${title}": ${files.join(", ")}`);
  }
  for (const m of missing) console.warn(`⚠️  Missing image — ${m}`);
  console.log(`✅ Published ${staged.length} notes.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) buildGarden();

// Shared, framework-free helpers for the garden: slugs and the wikilink index.
// Plain .mjs so both astro.config.mjs (remark plugin) and pages can import it.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export const CONTENT_DIR = path.resolve("src/content/garden");

/**
 * Quartz-compatible slug: lowercase each path segment and turn spaces into
 * hyphens, leaving all other characters alone. This keeps every existing
 * christianp.space URL working (e.g. "Jan. 30, 2026 - Welcome" ->
 * "jan.-30,-2026---welcome").
 */
export function slugify(relPath) {
  return relPath
    .replace(/\\/g, "/")
    .replace(/\.mdx?$/i, "")
    .split("/")
    .map((seg) =>
      seg
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        // Quartz's special cases, verified against the live sitemap:
        // "A & B" -> "a--and--b", "60%" -> "60-percent", ? and " dropped.
        .replace(/&/g, "-and-")
        .replace(/%/g, "-percent")
        .replace(/[?"#]/g, ""),
    )
    .join("/");
}

/** Lookup key for wikilink targets: case-, quote- and whitespace-insensitive. */
export function linkKey(name) {
  return name
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\.mdx?$/i, "")
    .trim()
    .toLowerCase();
}

/** GitHub-style heading anchor, matching Astro's heading ids closely enough for links. */
export function headingSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name.endsWith(".md") ? [full] : [];
  });
}

let cache = { at: 0, index: null };

/**
 * Map of every name a note can be linked by -> { slug, title }.
 * Obsidian resolves "shortest path" links by file name, so the basename is the
 * primary key; full relative paths and frontmatter aliases are added too.
 * Cached briefly so a dev-server rebuild of many pages reads the folder once.
 */
export function getLinkIndex() {
  if (cache.index && Date.now() - cache.at < 2000) return cache.index;
  const index = new Map();
  for (const file of walk(CONTENT_DIR)) {
    const rel = path.relative(CONTENT_DIR, file);
    const slug = slugify(rel);
    let data = {};
    try {
      data = matter(fs.readFileSync(file, "utf8")).data ?? {};
    } catch {}
    const title = typeof data.title === "string" ? data.title : path.basename(rel, ".md");
    const entry = { slug, title };
    const aliases = Array.isArray(data.aliases) ? data.aliases : data.aliases ? [data.aliases] : [];
    for (const key of [rel, path.basename(rel), ...aliases.map(String)]) {
      const k = linkKey(key);
      // First writer wins for basenames, so a duplicate name in another folder
      // doesn't silently hijack links. Full paths are always unique.
      if (!index.has(k)) index.set(k, entry);
    }
  }
  cache = { at: Date.now(), index };
  return index;
}

/** Resolve the target part of [[target#heading|alias]] to { slug, title, anchor } or null. */
export function resolveWikiTarget(raw) {
  const [target, heading] = raw.split("#");
  const hit = getLinkIndex().get(linkKey(target));
  if (!hit) return null;
  return { ...hit, anchor: heading ? headingSlug(heading) : "" };
}

/** Every outgoing internal link in a raw markdown body, as slugs. */
export function extractLinks(body) {
  const out = new Set();
  for (const m of body.matchAll(/(?<!!)\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g)) {
    const hit = resolveWikiTarget(m[1]);
    if (hit) out.add(hit.slug);
  }
  for (const m of body.matchAll(/\]\((\/[^)#\s]+)/g)) {
    const slug = decodeURI(m[1]).replace(/^\//, "").replace(/\/$/, "");
    if (slug && !slug.startsWith("assets/")) out.add(slug);
  }
  return [...out];
}

export const IMAGE_EXT = /\.(webp|png|jpe?g|gif|svg|avif)$/i;

export function assetUrl(name) {
  // encodeURI keeps "+" literal (Vite's dev server won't decode %2B), while
  // still escaping spaces and non-ASCII names like "Ryōan-ji.jpg".
  return "/assets/" + encodeURI(name.trim()).replace(/#/g, "%23").replace(/\?/g, "%3F");
}

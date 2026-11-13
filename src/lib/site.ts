import { getCollection, type CollectionEntry } from "astro:content";
import { extractLinks, assetUrl } from "./garden.mjs";

export type Note = CollectionEntry<"garden">;

export const SECTIONS = {
  writing: { title: "Writing", blurb: "Longer essays, once the ideas have come together." },
  investing: { title: "Investing", blurb: "Deep dives into public companies." },
  notes: { title: "Notes", blurb: "Single ideas. Fragments of what I've learned while reading." },
  books: { title: "Books", blurb: "Notes on books I've read." },
  now: { title: "Now", blurb: "What I'm doing currently." },
} as const;
export type SectionKey = keyof typeof SECTIONS;

/** Growth stages, in the garden's own cartographic vocabulary. */
export const STAGES = {
  terraincognita: { label: "Terra Incognita", blurb: "Raw notes and observations. Potentially wrong." },
  surveyed: { label: "Surveyed", blurb: "Ideas starting to come together. Still developing." },
  gazetteer: { label: "Gazetteer", blurb: "Rare, fully-formed thoughts." },
} as const;
export type StageKey = keyof typeof STAGES;

export const sectionOf = (n: Note): SectionKey | null => {
  const s = n.id.includes("/") ? n.id.split("/")[0] : null;
  return s && s in SECTIONS ? (s as SectionKey) : null;
};

export const stageOf = (n: Note): StageKey | null => {
  for (const t of n.data.tags) {
    const k = t.toLowerCase();
    if (k in STAGES) return k as StageKey;
  }
  return null;
};

export const titleOf = (n: Note) => n.data.title ?? n.id.split("/").pop()!;

/** Tags minus the growth-stage tags, which are shown as a badge instead. */
export const topicsOf = (n: Note) => n.data.tags.filter((t) => !(t.toLowerCase() in STAGES) && t.toLowerCase() !== "book");

export const tagSlug = (t: string) => t.toLowerCase().replace(/\s+/g, "-");

export const plantedOf = (n: Note) => n.data.date;
export const tendedOf = (n: Note) => n.data["Last Updated"] ?? n.data.date;

export const formatDate = (d?: Date) =>
  d ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "";

/** First image in the body: the fallback thumbnail. */
function firstImageOf(n: Note): string | null {
  const body = n.body ?? "";
  const wiki = /!\[\[([^\]|]+\.(?:webp|png|jpe?g|gif|avif))/i.exec(body);
  if (wiki) return assetUrl(wiki[1]);
  const html = /<img[^>]+src="([^"]+)"/i.exec(body);
  return html ? html[1] : null;
}

let coverMapPromise: Promise<Map<string, string>> | null = null;
/**
 * Card images, in priority order:
 *   1. a `cover:` frontmatter property on the note itself
 *   2. for books, the cover used for that book on the hand-built Library page
 *   3. the first image in the note
 */
function coverMap() {
  coverMapPromise ??= getCollection("garden", (n) => n.id === "library").then(([library]) => {
    const map = new Map<string, string>();
    const body = library?.body ?? "";
    for (const m of body.matchAll(/\[!\[[^\]]*\]\(([^)\s]+)[^)]*\)\]\((\/books\/[^)#\s]+)\)/g)) {
      const img = m[1].startsWith("/") || /^https?:/.test(m[1]) ? m[1] : assetUrl(decodeURI(m[1]));
      map.set(decodeURI(m[2]).replace(/^\//, ""), img);
    }
    return map;
  });
  return coverMapPromise;
}

export async function coverOf(n: Note): Promise<string | null> {
  if (n.data.cover) return assetUrl(n.data.cover);
  return (await coverMap()).get(n.id) ?? firstImageOf(n);
}

/** Plain-text excerpt, used when a note has no `description`. */
export function excerptOf(n: Note, max = 170): string {
  if (n.data.description) return n.data.description;
  const text = (n.body ?? "")
    .replace(/^#+ .*$/gm, "")
    .replace(/^>\s*\[!.*$/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_, a, b) => b || a)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]|\\(?=\$)/g, "")
    .replace(/\[\^\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}

const byDateDesc = (a: Note, b: Note) => (tendedOf(b)?.getTime() ?? 0) - (tendedOf(a)?.getTime() ?? 0);

let gardenPromise: Promise<Note[]> | null = null;
/** Every published page except the hand-written homepage source. */
export function getGarden(): Promise<Note[]> {
  gardenPromise ??= getCollection("garden", (n) => n.id !== "index").then((all) => all.sort(byDateDesc));
  return gardenPromise;
}

export async function getSection(key: SectionKey) {
  return (await getGarden()).filter((n) => sectionOf(n) === key);
}

export interface GraphData {
  nodes: { id: string; title: string; section: string | null; stage: string | null }[];
  links: { source: string; target: string }[];
}

let graphPromise: Promise<{ graph: GraphData; backlinks: Map<string, string[]> }> | null = null;
export function getGraph() {
  graphPromise ??= (async () => {
    const notes = await getGarden();
    const ids = new Set(notes.map((n) => n.id));
    const links: GraphData["links"] = [];
    const backlinks = new Map<string, string[]>();
    for (const n of notes) {
      for (const target of extractLinks(n.body ?? "")) {
        if (target === n.id || !ids.has(target)) continue;
        links.push({ source: n.id, target });
        backlinks.set(target, [...(backlinks.get(target) ?? []), n.id]);
      }
    }
    const nodes = notes.map((n) => ({ id: n.id, title: titleOf(n), section: sectionOf(n), stage: stageOf(n) }));
    return { graph: { nodes, links }, backlinks };
  })();
  return graphPromise;
}

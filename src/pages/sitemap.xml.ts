import type { APIContext } from "astro";
import { getGarden, SECTIONS, tagSlug, tendedOf } from "../lib/site";

/** Same shape and path as Quartz's sitemap: every note, folder page and tag page. */
export async function GET({ site }: APIContext) {
  const notes = await getGarden();
  const base = site!.href.replace(/\/$/, "");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");
  const urls: { loc: string; lastmod?: Date }[] = [
    { loc: `${base}/` },
    ...Object.keys(SECTIONS).map((s) => ({ loc: `${base}/${s}/` })),
    { loc: `${base}/tags/` },
    ...notes.map((n) => ({ loc: `${base}/${encodeURI(n.id)}`, lastmod: tendedOf(n) })),
    ...[...new Set(notes.flatMap((n) => n.data.tags.map(tagSlug)))].map((t) => ({ loc: `${base}/tags/${encodeURI(t)}` })),
  ];
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : ""}</url>`)
      .join("\n") +
    `\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml" } });
}

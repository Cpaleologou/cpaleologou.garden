import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getGarden, titleOf, excerptOf, tendedOf } from "./site";

/** The site feed. Served at /index.xml (Quartz's path, for existing subscribers) and /rss.xml. */
export async function feed(context: APIContext) {
  const notes = (await getGarden()).filter((n) => tendedOf(n)).slice(0, 30);
  return rss({
    title: "christianp.space",
    description: "Notes and essays on investing, philosophy, history, and technology.",
    site: context.site!,
    trailingSlash: false,
    items: notes.map((n) => ({
      title: titleOf(n),
      link: `/${n.id}`,
      pubDate: tendedOf(n),
      description: excerptOf(n, 300),
    })),
  });
}

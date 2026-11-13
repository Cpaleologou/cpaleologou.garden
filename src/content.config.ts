import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { slugify } from "./lib/garden.mjs";

const optionalDate = z.preprocess((v) => (v ? v : undefined), z.coerce.date().optional());

const tagList = z.preprocess(
  (v) => (v == null ? [] : Array.isArray(v) ? v : [v]),
  z.array(z.coerce.string().transform((t) => t.replace(/^#/, "").trim())),
);

const garden = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/garden",
    generateId: ({ entry }) => slugify(entry),
  }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    /** Image filename (from the vault's 99-Files) used on cards, e.g. `cover: NintendoCover.webp`. */
    cover: z.string().optional(),
    date: optionalDate,
    "Last Updated": optionalDate,
    tags: tagList,
    aliases: z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.coerce.string())),
  }),
});

export const collections = { garden };

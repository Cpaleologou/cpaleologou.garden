# christianp.space (Christian's digital garden)

Astro 7 site, live at https://christianp.space. It replaced a Quartz site in Nov 2026. README.md maps the code; this
file covers how to work in it. Node ≥ 22.23.4.

## Where things live

- **Content is in the Obsidian vault, not this repo.** Notes: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Thoughts/03-Garden/`
  (`notes/`, `writing/`, `investing/`, `now/`, `library/` → published as `/books`, plus `index.md` and `Library.md`).
  Images: `Thoughts/99-Files/`. Only notes with `publish: "true"` go out.
- `npm run sync` (`scripts/build-garden.mjs`) wipes and rebuilds `src/content/garden/` and `public/assets/` from the
  vault. **Never edit those two folders by hand**; the next sync erases it. Make content changes in the vault.
- Growth stage = a `#TerraIncognita` / `#Surveyed` / `#Gazetteer` tag. Card image = a `cover: File.webp` property.

## Editing the vault

- Before editing vault files, copy the originals to `.vault-backups/<date>-<what>/` (gitignored, stays on this Mac).
- Change frontmatter as text (insert/replace the exact line), matching the file's existing quote style and
  indentation. Don't round-trip it through a YAML library; that reformats Christian's notes.
- Never delete or rename vault notes without asking. Watch for iCloud duplicates like `Note 1.md`; the sync warns
  when two published notes share a title.

## Publishing

- `npm run deploy` = sync → build → commit → push the `astro` branch → GitHub Actions publishes (about a minute).
  `npm run deploy -- --dry` stops before committing. Deploy only when Christian asks.
- **Never push the `v5` branch or run `npm run deploy` in `~/quartz`.** That republishes the old Quartz site over
  this one. (Running the Quartz workflow on `v5` is the intentional rollback.)
- Keep every existing URL working. Slugs must match Quartz's (`slugify` in `src/lib/garden.mjs`: lowercase, spaces
  → `-`, `&` → `-and-`, `%` → `-percent`, drop `?"#`). If you touch slugs or routes, compare `dist/` against the live
  `https://christianp.space/sitemap.xml`.
- After deploying, confirm on the live site (fetch the page with a cache-busting `?t=` query), not via the GitHub API
  (unauthenticated requests get rate-limited).

## Interactive widgets

A note embeds one with a fenced block. Obsidian shows it as code; the site mounts a Preact component:

````md
```widget dcf
title: "Quote any text that contains a colon"
price: 8781
```
````

To add one: create `src/widgets/<Name>.tsx` (default export, props = the YAML), register it in `src/widgets/host.ts`,
style it in `src/widgets/widgets.css` using the site's CSS variables (`--accent`, `--surface`, `--rule`, `--ink-2`…)
so light and dark mode both work. `ReverseDcf.tsx` is the reference implementation. Then:

1. Ask for (or derive) the starting numbers with units and at least one known-correct output, and check the math
   reproduces it before building UI (the Nintendo DCF was checked against 14.6% implied growth at ¥8,781).
2. Put the block in the vault note, `npm run sync`, and test in the dev server: desktop and 375px wide (no sideways
   scroll), light and dark.
3. Prefer reusing an existing widget with new props over writing a near-duplicate.

Photo galleries are a `> [!gallery] Title` callout of `![[photo.webp|caption]]` embeds (`[!gallery|2]` sets the
column count), handled in `src/plugins/remark-obsidian.mjs` and `src/scripts/lightbox.ts`.

## Gotchas

- After editing `src/plugins/remark-obsidian.mjs` (or the Astro config), restart with `npx astro dev --force`. The
  content layer caches rendered markdown, and Vite otherwise serves stale pre-bundled deps (504 "Outdated Optimize Dep").
- Pages swap client-side (`<ClientRouter />`): bundled scripts run once. Use custom elements or document-level
  listeners, and `astro:page-load` for per-page setup. The router intercepts link clicks; a link that must not
  navigate needs a capture-phase handler (see `lightbox.ts`).
- Search uses Pagefind, indexed after `astro build`. In dev, run `npm run search:dev` first.
- Which sections show the graph and the table of contents: `showGraph` / `showToc` in `src/pages/[...slug].astro`.
- A hidden browser preview pane pauses IntersectionObserver and animation frames, so the graph and lazy images
  won't start until it's visible.

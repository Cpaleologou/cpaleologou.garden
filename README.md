# christianp.space — Astro trial

Trial rebuild of the Quartz garden in Astro 7. The Obsidian vault is the single source of truth; URLs match the Quartz site.

```bash
npm run sync     # publish notes + images straight from the vault (scripts/build-garden.mjs)
npm run dev      # http://localhost:4321
npm run search:dev   # build a search index for the dev server (re-run to pick up new notes)
npm run build    # static site in dist/
npm run deploy   # sync from the vault, check the build, commit, push -> GitHub Pages
npm run deploy -- --dry   # same, but stop before committing
```

Deploys go out from the `astro` branch of `Cpaleologou/cpaleologou.garden` via `.github/workflows/deploy.yml`.
Notes and images are committed with the site because GitHub Actions can't read the iCloud vault.
Rollback to Quartz: Actions → "Deploy Quartz site to GitHub Pages" → Run workflow on `v5`.

## How it fits together

| Piece | File |
|---|---|
| Obsidian syntax: `[[links]]`, `![[images]]`, `> [!callouts]`, widget blocks | `src/plugins/remark-obsidian.mjs` |
| Quartz-compatible slugs, wikilink index | `src/lib/garden.mjs` |
| Collections, sections, growth stages, backlinks, graph data | `src/lib/site.ts`, `src/content.config.ts` |
| Note page (header, prose, backlinks, TOC, graph rail) | `src/pages/[...slug].astro` |
| Homepage / section listings / tags | `src/pages/index.astro`, `[section].astro`, `tags/[tag].astro` |
| Graph (canvas + d3-force) | `src/scripts/graph.ts`, `src/components/GraphView.astro` |
| Hover previews | `src/scripts/link-previews.ts` |
| Search (Pagefind, ⌘K / Ctrl+K / "/") | `src/components/Search.astro`, `scripts/search-index.mjs` |
| Palette and typography | `src/styles/global.css` |

Growth stages come from the `#TerraIncognita`, `#Surveyed`, `#Gazetteer` tags.

**Card images.** Add a `cover:` property to a note in Obsidian with an image filename from `99-Files`
(`cover: NintendoCover.webp`; `[[NintendoCover.webp]]` also works). The sync copies it. Without one, books use
their cover from `Library.md` and everything else uses the note's first image.

**Icons.** Christian's SVGs live in `public/icons/` and render through `src/components/Icon.astro`.

## Photo galleries

In Obsidian, paste or drag photos into a gallery callout. Captions are optional, after a `|`:

```md
> [!gallery] Japan, June 2026
> ![[Kyoto_Arashiyama.webp|Bamboo grove at 7am, before the crowds]]
> ![[Kyoto_Ramen.webp]]
> ![[Osaka_Castle.webp|Osaka Castle]]
```

On the site it becomes a photo grid (3 columns, 2 on phones; `[!gallery|2]` sets the column count). Clicking a
photo opens a viewer with arrows, ← → keys, swipe, captions and a counter.

## Interactive widgets

Write a fenced block in any note, in Obsidian, with YAML settings:

````md
```widget dcf
title: "Nintendo: what is the market pricing in?"   # quote anything with a colon
currency: ¥
price: 8781
shares: 1.21
fcf: 254.584
netDebt: -1.967
```
````

Obsidian shows it as a code block; the site renders a live Preact component. To add a new widget, create
`src/widgets/<Name>.tsx` (default export) and register it in `src/widgets/host.ts`. Each widget is loaded only
on pages that use it.

## Not yet built

KaTeX math, social preview images, alias redirects, git-based dates.

import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { registerCondition } from "./quartz/plugins/loader/conditions"
import { PageTypeDispatcher } from "./quartz/plugins/pageTypes"
import { DesktopOnly, MobileOnly } from "./quartz/components"
import type { QuartzComponent } from "./quartz/components"
import { RecentNotes } from "@quartz-community/recent-notes"

/**
 * Custom render condition: hide a component on the site index and on the
 * hand-built Library page, which supplies its own header markup.
 * Referenced from quartz.config.yaml as `condition: not-index-or-library`.
 *
 * Must be registered before loadQuartzConfig(), because conditions are
 * resolved while the layout is being built.
 */
registerCondition("not-index-or-library", (props) => {
  const slug = props.fileData.slug
  return slug !== "index" && slug !== "library"
})

const config = await loadQuartzConfig()

// Six RecentNotes instances (writing/investing/notes x desktop-sidebar and
// mobile-afterBody). These need `filter` callbacks, which YAML cannot express,
// so they are built here rather than in quartz.config.yaml.
//
// hideFolderPages matters: a bare `startsWith("writing/")` also matches the
// generated folder page at `writing/index`, which inflated the counts — the
// list advertised "See 2 more" against 4 real posts, and "See 247 more"
// against 249 notes.
const recentIn = (title: string, folder: string) => (): QuartzComponent =>
  RecentNotes({
    title,
    limit: 3,
    showTags: false,
    hideFolderPages: true,
    linkToMore: `${folder}/`,
    filter: (f) => (f.slug ? f.slug.startsWith(`${folder}/`) : false),
  })

const recentWriting = recentIn("Recent Writing", "writing")
const recentInvesting = recentIn("Recent Investing", "investing")
const recentNotes = recentIn("Recent Notes", "notes")

const base = await loadQuartzLayout()

// Mobile recent lists sit below the article. Each byPageType entry carries its
// own fully-built afterBody, so appending only to `defaults` would be silently
// dropped on every page type that has an override — hence the explicit map.
const withMobileRecents = <T extends { afterBody?: QuartzComponent[] }>(l: T): T => ({
  ...l,
  afterBody: [
    ...(l.afterBody ?? []),
    MobileOnly(recentWriting()) as QuartzComponent,
    MobileOnly(recentInvesting()) as QuartzComponent,
    MobileOnly(recentNotes()) as QuartzComponent,
  ],
})

const layout = {
  defaults: withMobileRecents(base.defaults),
  byPageType: Object.fromEntries(
    Object.entries(base.byPageType).map(([pageType, l]) => {
      // The 404 frame renders no sidebars or afterBody chrome; leave it alone.
      if (pageType === "404") return [pageType, l]

      const next = withMobileRecents(l)
      if (pageType !== "content") return [pageType, next]

      // Notes keep the recent-notes rail; the explorer is excluded for
      // `content` in quartz.config.yaml and stays on folder/tag listings.
      return [
        pageType,
        {
          ...next,
          // Long-form first (writing, investing), then the much larger notes
          // bucket last.
          left: [
            ...(next.left ?? base.defaults.left ?? []),
            DesktopOnly(recentWriting()) as QuartzComponent,
            DesktopOnly(recentInvesting()) as QuartzComponent,
            DesktopOnly(recentNotes()) as QuartzComponent,
          ],
        },
      ]
    }),
  ),
}

export { layout }

/**
 * NOTE (Quartz 5.0.0): the `layout` export above is documented as the TS
 * override hook, but nothing in the build actually imports it — build.ts only
 * takes the default export, and loadQuartzConfig() wires its *own*
 * loadQuartzLayout() result into the PageTypeDispatcher emitter. So we swap
 * that emitter for one built from the layout above; otherwise these overrides
 * are silently dropped. Re-check this after any Quartz upgrade.
 */
const dispatcherIndex = config.plugins.emitters.findIndex((e) => e.name === "PageTypeDispatcher")
if (dispatcherIndex === -1) {
  throw new Error(
    "PageTypeDispatcher emitter not found — Quartz internals changed; quartz.ts layout override needs updating.",
  )
}
config.plugins.emitters[dispatcherIndex] = PageTypeDispatcher({
  defaults: layout.defaults,
  byPageType: layout.byPageType,
})

export default config

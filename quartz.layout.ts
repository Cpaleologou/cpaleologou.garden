import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { SimpleSlug } from "./quartz/util/path"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    // Mobile: Recent Writing (specifically from /writing)
    Component.MobileOnly(
      Component.RecentNotes({
        title: "Recent Writing",
        limit: 3,
        showTags: false,
        linkToMore: "writing/" as SimpleSlug, 
        filter: (f) => f.slug ? f.slug.startsWith("writing/") : false,
      })
    ),
    // Mobile: Recent Notes (specifically from /notes)
    Component.MobileOnly(
      Component.RecentNotes({
        title: "Recent Notes",
        limit: 3,
        showTags: false,
        linkToMore: "notes/" as SimpleSlug, 
        filter: (f) => f.slug ? f.slug.startsWith("notes/") : false,
      })
    ),
  ],
  footer: Component.Footer({
    links: {
      GitHub: "https://github.com/jackyzha0/quartz",
      "Discord Community": "https://discord.gg/cRFFHYye7t",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ConditionalRender({
      component: Component.ArticleTitle(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ConditionalRender({
      component: Component.ContentMeta(),
      condition: (page) => page.fileData.slug !== "index" && page.fileData.slug !== "Library",
    }),
    Component.ConditionalRender({
      component: Component.TagList(),
      condition: (page) => page.fileData.slug !== "index" && page.fileData.slug !== "Library",
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
       // { Component: Component.ReaderMode() },
      ],
    }),
    // Desktop: Recent Writing (New Section)
    Component.DesktopOnly( 
      Component.RecentNotes({
        title: "Recent Writing",
        limit: 3,
        showTags: false,
        linkToMore: "writing/" as SimpleSlug,
        filter: (f) => f.slug ? f.slug.startsWith("writing/") : false,
      })
    ),
    // Desktop: Recent Notes
    Component.DesktopOnly( 
      Component.RecentNotes({
        title: "Recent Notes",
        limit: 3,
        showTags: false,
        linkToMore: "notes/" as SimpleSlug, 
        filter: (f) => f.slug ? f.slug.startsWith("notes/") : false,
      })
    ),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer(),
  ],
  right: [],
}
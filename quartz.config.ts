import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "christianp.space",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "en-US",
    baseUrl: "christianp.space",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: {
          name: "Newsreader",
          weights: [400, 500, 600, 700],
        },
        body: {
          name: "Source Serif 4",
          weights: [400, 600],
        },
        code: {
          name: "IBM Plex Mono",
          weights: [400, 500],
        },
      },
      colors: {
        lightMode: {
          light: "#F0EFE9",        // Bone White: The main paper background
          lightgray: "#DBD8CC",    // Stone Grey: For subtle borders or inactive elements
          gray: "#6E7460",         // Deepened sage: secondary text/icons — now WCAG-legible on bone
          darkgray: "#3E4438",     // Dark olive-grey: sub-headers and secondary text
          dark: "#23281E",         // Near-black olive: main body text (high contrast)
          secondary: "#1A2421",    // Olive Drab: Primary Brand Color (Headlines)
          tertiary: "#B34D00",     // Burnt Orange, deepened for link contrast on bone
          highlight: "rgba(75, 83, 32, 0.08)", // Very faint Olive for hover states
          textHighlight: "#E8C54766", // Muted Gold: for highlighting text
        },
        darkMode: {
          light: "#1a2318",       // Deep binding green — background (not black, genuinely green)
          lightgray: "#26311f",   // Slightly lighter green — card/sidebar surfaces
          gray: "#8fa07c",        // Muted sage, lightened for contrast — secondary text, icons
          darkgray: "#d4c9a8",    // Aged cream — sub-headers, metadata
          dark: "#ece5d0",        // Warm parchment — main body text (slightly brighter)
          secondary: "#F0EFE9",   // Aged cream — headlines
          tertiary: "#d99b2e",    // Gold, brightened for link contrast on deep green
          highlight: "rgba(217, 155, 46, 0.12)",
          textHighlight: "#d99b2e55",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      //Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config

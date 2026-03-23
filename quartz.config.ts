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
          name: "Playfair Display",
          weights: [500, 600, 700],
        },
        body: {
          name: "Merriweather",
          weights: [300, 400],
        },
        code: {
          name: "Courier Prime",
          weights: [400, 700],
        },
      },
      colors: {
        lightMode: {
          light: "#F0EFE9",        // Bone White: The main paper background
          lightgray: "#D8D6CC",    // Stone Grey: For subtle borders or inactive elements
          gray: "#8C9178",         // Sage: For secondary icons or disabled text
          darkgray: "#1A2421",     // Olive Drab: For subheaders and secondary text
          dark: "#4B5320",         // Dark Forest: The "almost black" for main body text
          secondary: "#1A2421",    // Olive Drab: Primary Brand Color (Headlines)
          tertiary: "#CC5500",     // Burnt Orange: Accent color for buttons/links
          highlight: "rgba(75, 83, 32, 0.10)", // Very faint Olive for hover states
          textHighlight: "#E8C54788", // Muted Gold: For highlighting text (more natural than neon yellow)
        },
        darkMode: {
          light: "#1a2318",       // Deep binding green — background (not black, genuinely green)
          lightgray: "#243020",   // Slightly lighter green — card/sidebar surfaces  
          gray: "#7a8a6a",        // Muted sage — secondary text, icons
          darkgray: "#d4c9a8",    // Aged cream — sub-headers, metadata
          dark: "#e8dfc4",        // Warm parchment — main body text
          secondary: "#F0EFE9",   // Aged cream — headlines
          tertiary: "#c8860a",    // Deeper gold — links/accent (richer than the orange, more gilt)
          highlight: "rgba(200, 134, 10, 0.12)",
          textHighlight: "#c8860a88",
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

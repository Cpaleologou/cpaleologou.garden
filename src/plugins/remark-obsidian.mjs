// Turns Obsidian-flavoured markdown into HTML-ready mdast:
//   [[Note]] / [[Note|alias]] / [[Note#Heading]]  -> internal links (or a muted span if unpublished)
//   ![[image.webp]] / ![[image.webp|400]] / ![[image.webp|Caption]] -> images / figures
//   > [!type] Title                                -> callouts
//   > [!gallery] Title + image embeds              -> photo gallery with lightbox
//   ```widget name  (YAML props)                   -> <garden-widget> interactive islands
//   bare relative images ![x](Cover.jpg)           -> /assets/Cover.jpg

import { visit, SKIP } from "unist-util-visit";
import YAML from "yaml";
import { resolveWikiTarget, IMAGE_EXT, assetUrl } from "../lib/garden.mjs";

const WIKI = /(!?)\[\[([^\]]+?)\]\]/g;

const escapeAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function imageHtml(file, option, { figure }) {
  const sizeMatch = option && /^\s*(\d+)(?:x(\d+))?\s*$/.exec(option);
  const caption = option && !sizeMatch ? option.trim() : "";
  const attrs = [
    `src="${assetUrl(file)}"`,
    `alt="${escapeAttr(caption || file.replace(IMAGE_EXT, "").replace(/[_-]+/g, " "))}"`,
    `loading="lazy"`,
    `decoding="async"`,
  ];
  if (sizeMatch) attrs.push(`width="${sizeMatch[1]}"`);
  const img = `<img ${attrs.join(" ")}>`;
  if (figure && caption) return `${img}<figcaption>${escapeAttr(caption)}</figcaption>`;
  return img;
}

function wikilinks(tree) {
  visit(tree, "text", (node, index, parent) => {
    if (!parent || parent.type === "link" || !node.value.includes("[[")) return;
    const matches = [...node.value.matchAll(WIKI)];
    if (!matches.length) return;

    // An embed that is the only thing in its paragraph becomes a <figure>.
    const onlyEmbed =
      parent.type === "paragraph" &&
      parent.children.length === 1 &&
      matches.length === 1 &&
      matches[0][1] === "!" &&
      node.value.trim() === matches[0][0];

    const out = [];
    let last = 0;
    for (const m of matches) {
      const [full, bang, inner] = m;
      if (m.index > last) out.push({ type: "text", value: node.value.slice(last, m.index) });
      last = m.index + full.length;

      const [target, ...rest] = inner.split("|");
      const option = rest.join("|");

      if (bang && IMAGE_EXT.test(target.trim())) {
        out.push({ type: "html", value: imageHtml(target, option, { figure: onlyEmbed }) });
        continue;
      }

      const label = option.trim() || target.split("#").filter(Boolean).join(" › ").trim();
      const hit = resolveWikiTarget(target.trim());
      if (hit) {
        out.push({
          type: "link",
          url: "/" + hit.slug + (hit.anchor ? "#" + hit.anchor : ""),
          data: { hProperties: { className: ["internal"], "data-slug": hit.slug } },
          children: [{ type: "text", value: label }],
        });
      } else {
        out.push({
          type: "emphasis",
          data: { hName: "span", hProperties: { className: ["broken-link"], title: "Not published yet" } },
          children: [{ type: "text", value: label }],
        });
      }
    }
    if (last < node.value.length) out.push({ type: "text", value: node.value.slice(last) });

    if (onlyEmbed) parent.data = { ...parent.data, hName: "figure", hProperties: { className: ["embed"] } };
    parent.children.splice(index, 1, ...out);
    return [SKIP, index + out.length];
  });
}

function markdownLinksAndImages(tree) {
  visit(tree, "link", (node) => {
    if (node.url.startsWith("/") && !node.url.startsWith("/assets/")) {
      const slug = decodeURI(node.url.split("#")[0]).replace(/^\/|\/$/g, "");
      node.data = { ...node.data, hProperties: { className: ["internal"], "data-slug": slug } };
    }
  });
  visit(tree, "image", (node) => {
    if (!/^([a-z]+:|\/|#)/i.test(node.url)) node.url = assetUrl(decodeURI(node.url));
  });
}

function callouts(tree) {
  visit(tree, "blockquote", (node) => {
    const para = node.children[0];
    const first = para?.type === "paragraph" ? para.children[0] : null;
    if (first?.type !== "text") return;
    const m = /^\[!([\w-]+)(?:\|[^\]]*)?\]([+-]?)[ \t]*([^\n]*)\n?/.exec(first.value);
    if (!m) return;
    const [, rawType, , rawTitle] = m;
    const type = rawType.toLowerCase();
    first.value = first.value.slice(m[0].length);
    if (!first.value) para.children.shift();
    if (!para.children.length) node.children.shift();

    node.children.unshift({
      type: "paragraph",
      data: { hName: "div", hProperties: { className: ["callout-title"] } },
      children: [{ type: "text", value: rawTitle.trim() || type[0].toUpperCase() + type.slice(1) }],
    });
    node.data = { hName: "aside", hProperties: { className: ["callout"], "data-callout": type } };
  });
}


/** Flatten a node's text, keeping markdown images as ![alt](url) so they can be read back. */
function flatText(node) {
  if (node.type === "text") return node.value;
  if (node.type === "image") return `![${node.alt ?? ""}](${node.url})`;
  if (node.type === "break") return "\n";
  return (node.children ?? []).map(flatText).join(node.type === "blockquote" ? "\n" : "");
}

/**
 * > [!gallery] Optional title          (or [!gallery|2] to force two columns)
 * > ![[photo.webp|Optional caption]]
 * > ![[another.webp]]
 * becomes a photo grid; clicking opens a swipeable lightbox (scripts/lightbox.ts).
 */
function galleries(tree) {
  visit(tree, "blockquote", (node, index, parent) => {
    const head = flatText(node);
    const m = /^\[!gallery(?:\|([^\]]*))?\][+-]?[ \t]*([^\n]*)/i.exec(head);
    if (!m || !parent) return;
    const n = parseInt(m[1] ?? "", 10);
    const cols = Number.isFinite(n) ? Math.min(4, Math.max(1, n)) : null;
    const title = m[2].trim();
    const items = [];
    const re = /!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]|!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
    for (const g of head.slice(m[0].length).matchAll(re)) {
      if (g[1]) {
        if (!IMAGE_EXT.test(g[1].trim())) continue;
        const opt = (g[2] ?? "").trim();
        items.push({ src: assetUrl(g[1]), caption: /^\d+(x\d+)?$/.test(opt) ? "" : opt, name: g[1].trim() });
      } else {
        const url = /^([a-z]+:|\/)/i.test(g[4]) ? g[4] : assetUrl(decodeURI(g[4]));
        items.push({ src: url, caption: g[3].trim(), name: g[4] });
      }
    }
    if (!items.length) return;
    const alt = (it) => escapeAttr(it.caption || it.name.replace(IMAGE_EXT, "").replace(/[_-]+/g, " "));
    const html =
      `<figure class="gallery"${cols ? ` style="--cols:${cols}"` : ""} data-count="${items.length}">` +
      (title ? `<figcaption class="gallery-title">${escapeAttr(title)}</figcaption>` : "") +
      `<ul class="gallery-grid">` +
      items
        .map(
          (it, i) =>
            `<li><a class="gallery-item" href="${it.src}" data-index="${i}" data-caption="${escapeAttr(it.caption)}">` +
            `<img src="${it.src}" alt="${alt(it)}" loading="lazy" decoding="async"></a>` +
            (it.caption ? `<span class="gallery-caption">${escapeAttr(it.caption)}</span>` : "") +
            `</li>`,
        )
        .join("") +
      `</ul></figure>`;
    parent.children[index] = { type: "html", value: html };
  });
}

function widgets(tree) {
  visit(tree, "code", (node, index, parent) => {
    if (node.lang !== "widget" || !parent) return;
    const name = (node.meta ?? "").trim().split(/\s+/)[0];
    let props = {};
    try {
      props = YAML.parse(node.value) ?? {};
    } catch (err) {
      props = { __error: String(err) };
    }
    parent.children[index] = {
      type: "html",
      value:
        `<garden-widget data-pagefind-ignore="all" name="${escapeAttr(name)}" data-props="${escapeAttr(JSON.stringify(props))}">` +
        `<div class="widget-loading">Loading interactive model…</div></garden-widget>`,
    };
  });
}

export function remarkObsidian() {
  return (tree) => {
    widgets(tree);
    galleries(tree);
    callouts(tree);
    wikilinks(tree);
    markdownLinksAndImages(tree);
  };
}

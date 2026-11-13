// Hover previews for internal links: fetch the linked page once, show its
// title and opening paragraphs in a floating card. Mouse/pen only.

const cache = new Map<string, Promise<DocumentFragment | null>>();
let card: HTMLElement | null = null;
let showTimer = 0;
let hideTimer = 0;
let activeLink: HTMLAnchorElement | null = null;

function load(href: string) {
  if (!cache.has(href)) {
    cache.set(
      href,
      fetch(href)
        .then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, "text/html");
          const title = doc.querySelector("[data-preview-title]");
          const prose = doc.querySelector("[data-preview-body]");
          if (!prose) return null;
          const frag = document.createDocumentFragment();
          if (title) {
            const h = document.createElement("p");
            h.className = "preview-title";
            h.textContent = title.textContent;
            frag.append(h);
          }
          const body = document.createElement("div");
          body.className = "preview-body prose";
          // Keep it light: drop scripts, widgets and graphs from the preview.
          prose.querySelectorAll("script, garden-widget, garden-graph, .footnotes").forEach((el) => el.remove());
          body.append(...Array.from(prose.children).slice(0, 40).map((el) => document.importNode(el, true)));
          body.querySelectorAll("img").forEach((img) => img.setAttribute("loading", "lazy"));
          frag.append(body);
          return frag;
        })
        .catch(() => null),
    );
  }
  return cache.get(href)!;
}

function hide() {
  card?.remove();
  card = null;
  activeLink = null;
}

async function show(link: HTMLAnchorElement) {
  const url = new URL(link.href);
  const frag = await load(url.pathname);
  if (!frag || activeLink !== link) return;
  hide();
  activeLink = link;
  card = document.createElement("div");
  card.className = "link-preview";
  card.append(frag.cloneNode(true));
  document.body.append(card);

  const r = link.getBoundingClientRect();
  const w = Math.min(400, window.innerWidth - 24);
  const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
  const below = r.bottom + 10;
  const fitsBelow = below + 360 < window.innerHeight;
  card.style.width = w + "px";
  card.style.left = left + window.scrollX + "px";
  card.style.top = (fitsBelow ? below : r.top - 10 - Math.min(card.offsetHeight, 360)) + window.scrollY + "px";

  if (url.hash) {
    const target = card.querySelector(decodeURIComponent(url.hash).replace(/[^#\w-]/g, ""));
    // Scroll only the card, not the page behind it.
    if (target instanceof HTMLElement) card.scrollTop = target.offsetTop - 12;
  }
  card.addEventListener("pointerenter", () => clearTimeout(hideTimer));
  card.addEventListener("pointerleave", () => (hideTimer = window.setTimeout(hide, 200)));
}

document.addEventListener("pointerover", (e) => {
  if (e.pointerType === "touch") return;
  const link = (e.target as Element).closest?.("a.internal") as HTMLAnchorElement | null;
  if (!link || link === activeLink || link.closest(".link-preview")) return;
  clearTimeout(hideTimer);
  clearTimeout(showTimer);
  activeLink = link;
  showTimer = window.setTimeout(() => show(link), 280);
});

document.addEventListener("pointerout", (e) => {
  const link = (e.target as Element).closest?.("a.internal");
  if (!link || link.closest(".link-preview")) return;
  clearTimeout(showTimer);
  hideTimer = window.setTimeout(hide, 200);
});

document.addEventListener("astro:before-swap", hide);

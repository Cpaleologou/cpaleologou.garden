// Full-size image viewer.
//  - Any image in a note: click to enlarge.
//  - Gallery photos: click to open the gallery, then ← / → keys, the arrow
//    buttons, or a swipe to move between photos.
// Esc, a click on the backdrop, or navigating away closes it.

interface Slide { src: string; alt: string; caption: string }

let dialog: HTMLDialogElement | null = null;
let slides: Slide[] = [];
let current = 0;

const ICON = {
  prev: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

function show(i: number) {
  if (!dialog) return;
  current = (i + slides.length) % slides.length;
  const s = slides[current];
  const img = dialog.querySelector<HTMLImageElement>(".lb-img")!;
  img.src = s.src;
  img.alt = s.alt;
  const cap = dialog.querySelector<HTMLElement>(".lb-caption")!;
  cap.textContent = s.caption;
  cap.hidden = !s.caption;
  const count = dialog.querySelector<HTMLElement>(".lb-count")!;
  count.textContent = slides.length > 1 ? `${current + 1} / ${slides.length}` : "";
  // Warm the neighbours so arrowing through feels instant.
  for (const d of [1, -1]) {
    if (slides.length > 1) new Image().src = slides[(current + d + slides.length) % slides.length].src;
  }
}

function open(list: Slide[], start: number) {
  dialog?.remove();
  slides = list;
  const multi = list.length > 1;
  dialog = document.createElement("dialog");
  dialog.className = `lightbox${multi ? " is-gallery" : ""}`;
  dialog.setAttribute("aria-label", multi ? "Photo gallery" : "Image");
  dialog.innerHTML = `
    <div class="lb-bar"><span class="lb-count"></span><button class="lb-btn lb-close" type="button" aria-label="Close">${ICON.close}</button></div>
    <figure class="lb-stage">
      <img class="lb-img" alt="">
      <figcaption class="lb-caption"></figcaption>
    </figure>
    ${multi ? `<button class="lb-btn lb-prev" type="button" aria-label="Previous photo">${ICON.prev}</button>
               <button class="lb-btn lb-next" type="button" aria-label="Next photo">${ICON.next}</button>` : ""}`;

  dialog.addEventListener("click", (e) => {
    const t = e.target as Element;
    if (t.closest(".lb-prev")) return show(current - 1);
    if (t.closest(".lb-next")) return show(current + 1);
    // On a single image, clicking anywhere closes; in a gallery, only the backdrop or ✕ does.
    if (t.closest(".lb-close") || !multi || t === dialog || t.classList.contains("lb-stage")) dialog?.close();
  });
  dialog.addEventListener("keydown", (e) => {
    if (!multi) return;
    if (e.key === "ArrowRight") { e.preventDefault(); show(current + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); show(current - 1); }
  });

  // Swipe between photos on touch screens.
  let startX = 0, startY = 0;
  dialog.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  dialog.addEventListener("touchend", (e) => {
    if (!multi) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
  });

  dialog.addEventListener("close", () => { dialog?.remove(); dialog = null; });
  document.body.append(dialog);
  show(start);
  dialog.showModal();
}

// Capture phase, so this runs before Astro's client router, which would otherwise
// treat the gallery links (plain <a href="photo.webp"> for no-JS readers) as navigation.
document.addEventListener("click", (e) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return; // let "open in new tab" work
  const target = e.target as Element;

  const item = target.closest?.(".gallery-item") as HTMLAnchorElement | null;
  if (item) {
    e.preventDefault();
    const gallery = item.closest(".gallery")!;
    const list = [...gallery.querySelectorAll<HTMLAnchorElement>(".gallery-item")].map((a) => ({
      src: a.getAttribute("href")!,
      alt: a.querySelector("img")?.alt ?? "",
      caption: a.dataset.caption ?? "",
    }));
    open(list, Number(item.dataset.index ?? 0));
    return;
  }

  const img = target.closest?.(".prose img") as HTMLImageElement | null;
  if (!img || img.closest("a, .book-header, .library-grid, .link-preview, garden-widget")) return;
  e.preventDefault();
  const caption = img.closest("figure")?.querySelector("figcaption")?.textContent ?? "";
  open([{ src: img.currentSrc || img.src, alt: img.alt, caption }], 0);
}, true);

document.addEventListener("astro:before-swap", () => dialog?.close());

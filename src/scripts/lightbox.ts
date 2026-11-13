// Click an image in a note to see it full size. Esc, a click, or navigating closes it.

let dialog: HTMLDialogElement | null = null;

function open(img: HTMLImageElement) {
  dialog?.remove();
  dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  const big = document.createElement("img");
  big.src = img.currentSrc || img.src;
  big.alt = img.alt;
  dialog.append(big);
  const caption = img.closest("figure")?.querySelector("figcaption")?.textContent;
  if (caption) {
    const p = document.createElement("p");
    p.textContent = caption;
    dialog.append(p);
  }
  dialog.addEventListener("click", () => dialog?.close());
  dialog.addEventListener("close", () => { dialog?.remove(); dialog = null; });
  document.body.append(dialog);
  dialog.showModal();
}

document.addEventListener("click", (e) => {
  const img = (e.target as Element).closest?.(".prose img") as HTMLImageElement | null;
  if (!img || img.closest("a, .book-header, .library-grid, .link-preview, garden-widget")) return;
  e.preventDefault();
  open(img);
});

document.addEventListener("astro:before-swap", () => dialog?.close());

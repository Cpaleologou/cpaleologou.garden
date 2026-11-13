// <garden-graph> — a canvas force-directed link graph.
// data-current: slug to centre on; data-depth: neighbourhood radius (-1 = everything);
// data-lazy: wait for an "activate" event (used by the full-graph dialog).

import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY,
  type Simulation, type SimulationNodeDatum, type SimulationLinkDatum,
} from "d3-force";
import { navigate } from "astro:transitions/client";

interface GNode extends SimulationNodeDatum { id: string; title: string; degree: number }
type GLink = SimulationLinkDatum<GNode>;
interface GraphJson { nodes: { id: string; title: string }[]; links: { source: string; target: string }[] }

let dataPromise: Promise<GraphJson> | null = null;
const loadGraph = () => (dataPromise ??= fetch("/graph.json").then((r) => r.json()));

function neighbourhood(data: GraphJson, current: string, depth: number) {
  const adj = new Map<string, Set<string>>();
  for (const { source, target } of data.links) {
    if (!adj.has(source)) adj.set(source, new Set());
    if (!adj.has(target)) adj.set(target, new Set());
    adj.get(source)!.add(target);
    adj.get(target)!.add(source);
  }
  let keep: Set<string>;
  if (depth < 0 || !current) {
    keep = new Set(data.nodes.map((n) => n.id));
  } else {
    keep = new Set([current]);
    let frontier = [current];
    for (let d = 0; d < depth; d++) {
      const next: string[] = [];
      for (const id of frontier) for (const nb of adj.get(id) ?? []) if (!keep.has(nb)) { keep.add(nb); next.push(nb); }
      frontier = next;
    }
  }
  const nodes: GNode[] = data.nodes
    .filter((n) => keep.has(n.id))
    .map((n) => ({ id: n.id, title: n.title, degree: adj.get(n.id)?.size ?? 0 }));
  const links: GLink[] = data.links.filter((l) => keep.has(l.source) && keep.has(l.target)).map((l) => ({ ...l }));
  return { nodes, links, adj };
}

class GardenGraph extends HTMLElement {
  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d")!;
  private sim?: Simulation<GNode, GLink>;
  private nodes: GNode[] = [];
  private links: GLink[] = [];
  private adj = new Map<string, Set<string>>();
  private hover: GNode | null = null;
  private drag: GNode | null = null;
  private panning: { x: number; y: number; tx: number; ty: number } | null = null;
  private moved = false;
  private view = { k: 1, x: 0, y: 0 };
  /** Set once the reader pans/zooms, so auto-fit stops fighting them. */
  private userViewed = false;
  private colors = { node: "", current: "", link: "", text: "", bg: "" };
  private ro?: ResizeObserver;
  private started = false;
  private raf = 0;

  connectedCallback() {
    this.style.position = "relative";
    this.canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:grab";
    this.append(this.canvas);
    if (this.dataset.lazy) {
      this.addEventListener("activate", () => this.start(), { once: true });
    } else {
      // Only simulate graphs that are actually on screen (the note page renders
      // one in the sidebar and one below the article; CSS hides one of them).
      this.io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { this.io?.disconnect(); this.start(); }
      });
      this.io.observe(this);
    }
  }
  private io?: IntersectionObserver;

  disconnectedCallback() {
    this.sim?.stop();
    this.ro?.disconnect();
    this.io?.disconnect();
    cancelAnimationFrame(this.raf);
    document.removeEventListener("themechange", this.onTheme);
  }

  private onTheme = () => { this.readColors(); this.draw(); };

  private readColors() {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    this.colors = { node: v("--muted"), current: v("--accent"), link: v("--rule"), text: v("--ink-2"), bg: v("--surface") };
  }

  private async start() {
    if (this.started) return;
    this.started = true;
    const data = await loadGraph();
    const current = this.dataset.current ?? "";
    const depth = Number(this.dataset.depth ?? 2);
    let sub = neighbourhood(data, current, depth);
    // Hub pages (Library, index-like notes) explode at two hops; keep them readable.
    if (depth > 1 && sub.nodes.length > 40) sub = neighbourhood(data, current, 1);
    ({ nodes: this.nodes, links: this.links, adj: this.adj } = sub);
    this.readColors();
    document.addEventListener("themechange", this.onTheme);

    const full = depth < 0;
    this.sim = forceSimulation(this.nodes)
      .force("link", forceLink<GNode, GLink>(this.links).id((d) => d.id).distance(full ? 30 : 62).strength(full ? 0.6 : 0.4))
      .force("charge", forceManyBody().strength(full ? -45 : -220))
      .force("center", forceCenter(0, 0))
      .force("x", forceX(0).strength(full ? 0.06 : 0.04))
      .force("y", forceY(0).strength(full ? 0.06 : 0.04))
      .force("collide", forceCollide<GNode>((d) => this.radius(d) + 3))
      .on("tick", () => { if (!this.userViewed) this.fit(); this.draw(); });

    const pin = this.nodes.find((n) => n.id === current);
    if (pin && !full) { pin.fx = 0; pin.fy = 0; }

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this);
    this.resize();
    this.bindPointer();
  }

  /** Zoom and centre so every node fits the box with some breathing room. */
  private fit() {
    if (!this.nodes.length) return;
    const { width, height } = this.getBoundingClientRect();
    if (!width || !height) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of this.nodes) {
      x0 = Math.min(x0, n.x ?? 0); x1 = Math.max(x1, n.x ?? 0);
      y0 = Math.min(y0, n.y ?? 0); y1 = Math.max(y1, n.y ?? 0);
    }
    const pad = 36; // room for labels at the edges
    const k = Math.min(1.1, Math.max(0.2, Math.min((width - pad * 2) / (x1 - x0 || 1), (height - pad * 2) / (y1 - y0 || 1))));
    this.view = { k, x: (-(x0 + x1) / 2) * k, y: (-(y0 + y1) / 2) * k };
  }

  private radius(n: GNode) {
    return 2.5 + Math.sqrt(n.degree) * 1.35 + (n.id === this.dataset.current ? 2 : 0);
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = this.getBoundingClientRect();
    this.canvas.width = Math.max(1, width * dpr);
    this.canvas.height = Math.max(1, height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.userViewed) this.fit();
    this.draw();
  }

  private toWorld(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - r.width / 2 - this.view.x) / this.view.k,
      y: (clientY - r.top - r.height / 2 - this.view.y) / this.view.k,
    };
  }

  private hit(clientX: number, clientY: number) {
    const p = this.toWorld(clientX, clientY);
    let best: GNode | null = null;
    let bestD = Infinity;
    for (const n of this.nodes) {
      const d = Math.hypot((n.x ?? 0) - p.x, (n.y ?? 0) - p.y);
      if (d < this.radius(n) + 5 / this.view.k && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  private bindPointer() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      this.moved = false;
      const n = this.hit(e.clientX, e.clientY);
      if (n) {
        this.drag = n;
        this.sim?.alphaTarget(0.25).restart();
      } else {
        this.panning = { x: e.clientX, y: e.clientY, tx: this.view.x, ty: this.view.y };
        c.style.cursor = "grabbing";
      }
    });
    c.addEventListener("pointermove", (e) => {
      if (this.drag) {
        const p = this.toWorld(e.clientX, e.clientY);
        this.drag.fx = p.x; this.drag.fy = p.y;
        this.moved = true;
      } else if (this.panning) {
        this.view.x = this.panning.tx + e.clientX - this.panning.x;
        this.view.y = this.panning.ty + e.clientY - this.panning.y;
        this.moved = true;
        this.userViewed = true;
        this.draw();
      } else {
        const n = this.hit(e.clientX, e.clientY);
        if (n !== this.hover) { this.hover = n; c.style.cursor = n ? "pointer" : "grab"; this.draw(); }
      }
    });
    const end = (e: PointerEvent) => {
      const n = this.drag;
      if (n) {
        this.sim?.alphaTarget(0);
        if (n.id !== this.dataset.current || this.dataset.depth === "-1") { n.fx = null; n.fy = null; }
        if (!this.moved && e.type === "pointerup") {
          this.closest("dialog")?.close();
          navigate("/" + n.id);
        }
      }
      this.drag = null;
      this.panning = null;
      c.style.cursor = this.hover ? "pointer" : "grab";
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("pointerleave", () => { if (this.hover) { this.hover = null; this.draw(); } });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.userViewed = true;
      const r = c.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2;
      const my = e.clientY - r.top - r.height / 2;
      const k = Math.min(4, Math.max(0.3, this.view.k * Math.exp(-e.deltaY * 0.0015)));
      this.view.x = mx - ((mx - this.view.x) * k) / this.view.k;
      this.view.y = my - ((my - this.view.y) * k) / this.view.k;
      this.view.k = k;
      this.draw();
    }, { passive: false });
  }

  private draw() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.paint());
  }

  private paint() {
    const { ctx, colors, view } = this;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + view.x, h / 2 + view.y);
    ctx.scale(view.k, view.k);

    const focus = this.hover;
    const near = focus ? this.adj.get(focus.id) ?? new Set<string>() : null;
    const lit = (id: string) => !focus || id === focus.id || near!.has(id);

    ctx.lineWidth = 1 / view.k;
    for (const l of this.links) {
      const s = l.source as GNode, t = l.target as GNode;
      const on = focus && (s.id === focus.id || t.id === focus.id);
      ctx.strokeStyle = on ? colors.current : colors.node;
      ctx.globalAlpha = on ? 0.9 : focus ? 0.08 : 0.28;
      ctx.lineWidth = (on ? 1.6 : 1) / view.k;
      ctx.beginPath();
      ctx.moveTo(s.x ?? 0, s.y ?? 0);
      ctx.lineTo(t.x ?? 0, t.y ?? 0);
      ctx.stroke();
    }

    const current = this.dataset.current;
    for (const n of this.nodes) {
      ctx.globalAlpha = lit(n.id) ? 1 : 0.25;
      ctx.fillStyle = n.id === current || n === focus ? colors.current : colors.node;
      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, this.radius(n), 0, Math.PI * 2);
      ctx.fill();
    }

    // Labels: the current note, the hovered note and its neighbours, and
    // everything once zoomed in far enough.
    const fontPx = 11 / Math.min(view.k, 1.6);
    ctx.font = `${fontPx}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const showAll = view.k > 2.2;
    for (const n of this.nodes) {
      const show = n.id === current || n === focus || (focus && near!.has(n.id)) || (showAll && !focus);
      if (!show) continue;
      const label = n.title.length > 34 ? n.title.slice(0, 32) + "…" : n.title;
      const y = (n.y ?? 0) + this.radius(n) + 3;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3 / view.k;
      ctx.strokeStyle = colors.bg;
      ctx.strokeText(label, n.x ?? 0, y);
      ctx.fillStyle = n === focus || n.id === current ? colors.current : colors.text;
      ctx.fillText(label, n.x ?? 0, y);
    }
    ctx.restore();
  }
}

if (!customElements.get("garden-graph")) customElements.define("garden-graph", GardenGraph);

// Bargaining zone for booking direct: when does a hotel and a traveller (with their
// agent) both come out ahead by skipping the OTA?
//
//   hotel ceiling  H = take rate − hotel's cost of handling a direct booking − agent fee
//   traveller gain   = discount − v      (v = value of the OTA's services for that kind of stay)
//   hotel gain       = H − discount
//   deal zone        = v < discount < H; at the midpoint each side gains (H − v) / 2
//
// Usage in a note (all figures in % of the booking price):
//
// ```widget bargain
// title: "The deal zone for booking direct"
// takeRate: 15
// hotelCosts: 3
// agentFee: 3
// selected: 1          # which type the chart opens on (0-based)
// types:
//   - { name: "Large chain, primary city", value: 2.5, share: 15 }
//   - { name: "Medium hotel, secondary city", value: 9.5, share: 40 }
//   - { name: "Small hotel or alt. accommodation, remote", value: 14, share: 45 }
// ```

import { useEffect, useRef, useState } from "preact/hooks";
import "./widgets.css";

interface HotelType { name: string; value: number; share: number }
interface Props {
  title?: string;
  takeRate?: number;
  hotelCosts?: number;
  agentFee?: number;
  selected?: number;
  types: HotelType[];
}

const fmt = (x: number, d = 1) => `${Number(x.toFixed(d))}%`;
const pts = (x: number) => `${Number(x.toFixed(2))} ${Math.abs(x) === 1 ? "point" : "points"}`;

function zone(ceiling: number, value: number) {
  return value < ceiling
    ? { deal: true as const, lo: value, hi: ceiling, mid: (value + ceiling) / 2, gain: (ceiling - value) / 2 }
    : { deal: false as const, gap: value - ceiling };
}

export default function BargainZone(p: Props) {
  const initial = {
    take: p.takeRate ?? 15,
    costs: p.hotelCosts ?? 3,
    agent: p.agentFee ?? 3,
    values: p.types.map((t) => t.value),
    selected: Math.min(Math.max(p.selected ?? 0, 0), p.types.length - 1),
  };
  const [take, setTake] = useState(initial.take);
  const [costs, setCosts] = useState(initial.costs);
  const [agent, setAgent] = useState(initial.agent);
  const [values, setValues] = useState(initial.values);
  const [sel, setSel] = useState(initial.selected);
  // Draw the chart at its real on-screen width so text stays a readable size on phones.
  const chartBox = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = chartBox.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const reset = () => {
    setTake(initial.take); setCosts(initial.costs); setAgent(initial.agent);
    setValues(initial.values); setSel(initial.selected);
  };

  const ceiling = take - costs - agent;
  const v = values[sel];
  const z = zone(ceiling, v);
  const results = p.types.map((t, i) => ({ ...t, value: values[i], z: zone(ceiling, values[i]) }));
  const dealShare = results.filter((r) => r.z.deal).reduce((s, r) => s + r.share, 0);
  const totalShare = results.reduce((s, r) => s + r.share, 0) || 100;

  // ---- chart geometry ----
  // Narrow screens put the line labels inside the plot instead of in a right-hand margin.
  const compact = W < 520;
  const H = compact ? 280 : 310, padL = 44, padR = compact ? 10 : 122, padT = 46, padB = 40;
  const xMax = Math.max(25, Math.ceil((Math.max(take, v) + 5) / 5) * 5);
  const yLim = Math.max(15, Math.ceil(Math.max(Math.abs(ceiling), v, xMax - v, Math.abs(ceiling - xMax)) / 5) * 5);
  const x = (d: number) => padL + (d / xMax) * (W - padL - padR);
  const y = (g: number) => padT + ((yLim - g) / (2 * yLim)) * (H - padT - padB);
  const xTicks = Array.from({ length: xMax / 5 + 1 }, (_, i) => i * 5);
  const yTicks = [-yLim, -yLim / 2, 0, yLim / 2, yLim];
  const travellerEnd = { x: x(xMax), y: y(xMax - v) };
  const hotelEnd = { x: x(xMax), y: y(ceiling - xMax) };
  // Keep the two end labels from overlapping.
  const labelGap = 14;
  const [tLabelY, hLabelY] =
    Math.abs(travellerEnd.y - hotelEnd.y) < labelGap
      ? travellerEnd.y < hotelEnd.y
        ? [travellerEnd.y - labelGap / 2, hotelEnd.y + labelGap / 2]
        : [travellerEnd.y + labelGap / 2, hotelEnd.y - labelGap / 2]
      : [travellerEnd.y, hotelEnd.y];
  const inRange = (d: number) => d >= 0 && d <= xMax;
  // Rough width of a 10.5px monospace label; used to keep labels inside the chart.
  const textW = (t: string) => t.length * 6.4;
  /** Anchor a label on whichever side of x has room (preferring `prefer`). */
  const place = (px: number, label: string, prefer: "start" | "end") => {
    const w = textW(label) + 6;
    const fitsEnd = px - w >= 4;
    const fitsStart = px + w <= W - 4;
    const side = prefer === "end" ? (fitsEnd || !fitsStart ? "end" : "start") : (fitsStart || !fitsEnd ? "start" : "end");
    return { x: side === "end" ? px - 6 : px + 6, anchor: side };
  };
  const valueLabel = `Booking's value ${fmt(v)}`;
  const ceilingLabel = `Hotel's ceiling ${fmt(ceiling)}`;
  const vPos = place(x(v), valueLabel, v > ceiling ? "start" : "end");
  const cPos = place(x(ceiling), ceilingLabel, v > ceiling ? "end" : "start");
  // If both labels end up on the same side, put them on separate rows.
  const stacked = vPos.anchor === cPos.anchor;
  const midLabel = z.deal ? `Each side gains ${pts(z.gain)}` : "";
  const midPos = z.deal ? place(x(z.mid), midLabel, "end") : null;

  return (
    <figure class="gw bargain">
      <header class="gw-head">
        <div>
          <p class="gw-eyebrow">Interactive model</p>
          <h4 class="gw-title">{p.title ?? "The deal zone for booking direct"}</h4>
        </div>
        <button class="gw-reset" type="button" onClick={reset}>Reset</button>
      </header>

      <div class="bz-types" role="tablist" aria-label="Type of stay">
        {results.map((r, i) => (
          <button
            type="button" role="tab" aria-selected={i === sel}
            class={`bz-type${i === sel ? " is-active" : ""}${r.z.deal ? " has-deal" : ""}`}
            onClick={() => setSel(i)}
          >
            <span class="bz-type-name">{r.name}</span>
            <span class="bz-type-meta">{r.share}% of room nights · {r.z.deal ? "deal" : "no deal"}</span>
          </button>
        ))}
      </div>

      <div class="gw-grid">
        <div class="gw-controls">
          <Slider label="Booking's take rate" value={take} min={8} max={25} step={0.5} format={(n) => fmt(n)} onInput={setTake} />
          <Slider label="Hotel's cost of a direct booking" value={costs} min={0} max={10} step={0.5} format={(n) => fmt(n)} onInput={setCosts} />
          <Slider label="Agent's fee" value={agent} min={0} max={10} step={0.5} format={(n) => fmt(n)} onInput={setAgent} />
          <Slider
            label={`Booking's value: ${p.types[sel].name.toLowerCase()}`} value={v} min={0} max={20} step={0.5}
            format={(n) => fmt(n)} accent
            onInput={(n) => setValues(values.map((old, i) => (i === sel ? n : old)))}
          />
        </div>

        <div class="gw-results">
          <div class="gw-stat">
            <span class="gw-label">Most the hotel can discount</span>
            <span class="gw-big">{fmt(Math.max(ceiling, 0))}</span>
            <span class="gw-sub">{fmt(take)} commission saved, minus {fmt(costs)} in costs and {fmt(agent)} to the agent.</span>
          </div>
          <div class="gw-stat">
            <span class="gw-label">{p.types[sel].name}</span>
            {z.deal ? (
              <>
                <span class="gw-big accent">{fmt(z.lo)}–{fmt(z.hi)}</span>
                <span class="gw-sub">Any discount in this range leaves both better off. Splitting it, each side gains {pts(z.gain)}.</span>
              </>
            ) : (
              <>
                <span class="gw-big">No deal</span>
                <span class="gw-sub">Booking's {fmt(v)} of value is {pts(z.gap)} more than the hotel can give back.</span>
              </>
            )}
          </div>
          <div class="gw-stat small">
            <span class="gw-label">Room nights where going direct works</span>
            <span class="gw-mid">{fmt((dealShare / totalShare) * 100, 0)}</span>
          </div>
        </div>
      </div>

      <div ref={chartBox} class="bz-chart-box">
      <svg class="gw-chart bz-chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={z.deal
          ? `Deal zone from ${fmt(z.lo)} to ${fmt(z.hi)} off the Booking price`
          : `No deal zone: Booking's value of ${fmt(v)} is above the hotel's ceiling of ${fmt(ceiling)}`}>
        {yTicks.map((t) => (
          <g>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} class={t === 0 ? "axis" : "grid"} />
            <text x={padL - 8} y={y(t)} class="tick" text-anchor="end" dominant-baseline="middle">{t}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text x={x(t)} y={H - padB + 16} class="tick" text-anchor="middle">{t}%</text>
        ))}
        <text x={(padL + W - padR) / 2} y={H - 4} class="tick axis-title" text-anchor="middle">Direct discount off the Booking price</text>
        <text x={12} y={(padT + H - padB) / 2} class="tick axis-title" text-anchor="middle"
          transform={`rotate(-90 12 ${(padT + H - padB) / 2})`}>Gain from going direct (pts)</text>

        {z.deal && (
          <g>
            <rect x={x(z.lo)} y={padT} width={Math.max(0, x(z.hi) - x(z.lo))} height={H - padT - padB} class="zone" />
            <text x={x(z.hi) + 6} y={H - padB - 8} class="zone-label">Deal zone</text>
          </g>
        )}

        {/* Markers for Booking's value and the hotel's ceiling; labels point away from each other */}
        {inRange(v) && (
          <g>
            <line x1={x(v)} x2={x(v)} y1={stacked ? padT - 30 : padT - 8} y2={padT} class="marker" />
            <text x={vPos.x} y={stacked ? padT - 26 : padT - 12} class="marker-label" text-anchor={vPos.anchor}>{valueLabel}</text>
          </g>
        )}
        {inRange(ceiling) && (
          <g>
            <line x1={x(ceiling)} x2={x(ceiling)} y1={padT - 8} y2={padT} class="marker" />
            <text x={cPos.x} y={padT - 12} class="marker-label" text-anchor={cPos.anchor}>{ceilingLabel}</text>
          </g>
        )}

        <line x1={x(0)} y1={y(-v)} x2={travellerEnd.x} y2={travellerEnd.y} class="line traveller" />
        <line x1={x(0)} y1={y(ceiling)} x2={hotelEnd.x} y2={hotelEnd.y} class="line hotel" />
        {compact ? (
          <>
            <text x={travellerEnd.x - 2} y={travellerEnd.y + (travellerEnd.y < hotelEnd.y ? -10 : 16)} class="end-label traveller" text-anchor="end">Traveller's gain</text>
            <text x={hotelEnd.x - 2} y={hotelEnd.y + (hotelEnd.y <= travellerEnd.y ? -10 : 16)} class="end-label hotel" text-anchor="end">Hotel's gain</text>
          </>
        ) : (
          <>
            <text x={travellerEnd.x + 8} y={tLabelY} class="end-label traveller" dominant-baseline="middle">Traveller's gain</text>
            <text x={hotelEnd.x + 8} y={hLabelY} class="end-label hotel" dominant-baseline="middle">Hotel's gain</text>
          </>
        )}

        {z.deal && inRange(z.mid) && (
          <g>
            <circle cx={x(z.mid)} cy={y(z.gain)} r="5" class="mid" />
            <text x={midPos!.x} y={y(z.gain) - 12} class="mid-label" text-anchor={midPos!.anchor}>{midLabel}</text>
          </g>
        )}
      </svg>
      </div>

      <p class="gw-note">
        The hotel saves the {fmt(take)} commission but takes on about {fmt(costs)} of costs Booking carries today and pays the
        agent {fmt(agent)}, so it can discount at most {fmt(ceiling)}. The traveller only switches if the discount beats
        what Booking's services are worth to them. Pick a type of stay above to see its zone; changes to the sliders
        update all three.
      </p>
    </figure>
  );
}

function Slider(props: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onInput: (v: number) => void; accent?: boolean;
}) {
  return (
    <label class={`gw-slider${props.accent ? " accent" : ""}`}>
      <span class="gw-slider-row">
        <span class="gw-label">{props.label}</span>
        <output>{props.format(props.value)}</output>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onInput={(e) => props.onInput(Number((e.target as HTMLInputElement).value))} />
    </label>
  );
}

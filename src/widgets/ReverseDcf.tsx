// Reverse DCF explorer: what growth is the market pricing in, and what is the
// business worth under your own assumptions?
//
// Usage in a note (all money in billions except the share price):
//
// ```widget dcf
// title: "Nintendo: what is the market pricing in?"   # quote text containing a colon
// currency: ¥
// price: 8781          # per share
// shares: 1.21         # billions
// fcf: 254.584         # base-year free cash flow, billions
// netDebt: -1.967      # billions; negative = net cash
// discount: 9          # %
// terminal: 3          # %
// years: 10
// growth: 8            # starting point for "your" growth, %
// marginOfSafety: 25   # %
// reference: { label: FY21 record, value: 600 }
// ```

import { useMemo, useState } from "preact/hooks";
import "./widgets.css";

interface Props {
  title?: string;
  currency?: string;
  price: number;
  shares: number;
  fcf: number;
  netDebt?: number;
  discount?: number;
  terminal?: number;
  years?: number;
  growth?: number;
  marginOfSafety?: number;
  reference?: { label: string; value: number };
}

/** PV of `years` of FCF growing at g, plus a Gordon terminal value. Rates as decimals. */
function valueOf(g: number, fcf0: number, r: number, tg: number, years: number) {
  let pvFlows = 0;
  let f = fcf0;
  const flows: number[] = [];
  for (let t = 1; t <= years; t++) {
    f *= 1 + g;
    flows.push(f);
    pvFlows += f / (1 + r) ** t;
  }
  const tv = (f * (1 + tg)) / (r - tg);
  const pvTerminal = tv / (1 + r) ** years;
  return { ev: pvFlows + pvTerminal, pvTerminal, flows };
}

/** Growth rate at which the DCF equals a target enterprise value (bisection). */
function impliedGrowth(targetEv: number, fcf0: number, r: number, tg: number, years: number) {
  let lo = -0.5;
  let hi = 1.5;
  if (valueOf(hi, fcf0, r, tg, years).ev < targetEv) return Infinity;
  if (valueOf(lo, fcf0, r, tg, years).ev > targetEv) return -Infinity;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (valueOf(mid, fcf0, r, tg, years).ev > targetEv) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

const pct = (x: number, digits = 1) =>
  Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : x > 0 ? ">150%" : "<−50%";

export default function ReverseDcf(p: Props) {
  const cur = p.currency ?? "$";
  const initial = {
    price: p.price,
    discount: p.discount ?? 9,
    terminal: p.terminal ?? 3,
    growth: p.growth ?? 8,
  };
  const [price, setPrice] = useState(initial.price);
  const [discount, setDiscount] = useState(initial.discount);
  const [terminal, setTerminal] = useState(initial.terminal);
  const [growth, setGrowth] = useState(initial.growth);

  const years = p.years ?? 10;
  const netDebt = p.netDebt ?? 0;
  const mos = (p.marginOfSafety ?? 25) / 100;
  const r = discount / 100;
  const tg = Math.min(terminal, discount - 0.5) / 100;

  const money = (b: number, digits = 0) =>
    `${cur}${b.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })}B`;
  const perShare = (v: number) => `${cur}${Math.round(v).toLocaleString("en-US")}`;

  const result = useMemo(() => {
    const marketEv = price * p.shares - netDebt; // shares in billions -> billions of currency
    const implied = impliedGrowth(marketEv, p.fcf, r, tg, years);
    const mine = valueOf(growth / 100, p.fcf, r, tg, years);
    const impliedPath = Number.isFinite(implied) ? valueOf(implied, p.fcf, r, tg, years).flows : [];
    const equity = mine.ev - netDebt;
    const intrinsic = equity / p.shares;
    return {
      implied,
      intrinsic,
      buyBelow: intrinsic * (1 - mos),
      gap: price / intrinsic - 1,
      terminalShare: mine.pvTerminal / mine.ev,
      flows: mine.flows,
      impliedPath,
    };
  }, [price, r, tg, growth, years, p.fcf, p.shares, netDebt, mos]);

  const reset = () => {
    setPrice(initial.price);
    setDiscount(initial.discount);
    setTerminal(initial.terminal);
    setGrowth(initial.growth);
  };

  // ---- chart geometry ----
  const W = 640, H = 230, padL = 52, padR = 12, padT = 14, padB = 30;
  const ref = p.reference;
  const maxY = Math.max(...result.flows, ...result.impliedPath.slice(0, years), ref?.value ?? 0, p.fcf) * 1.12;
  const x = (i: number) => padL + ((i + 0.5) * (W - padL - padR)) / years;
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);
  const barW = ((W - padL - padR) / years) * 0.56;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxY);
  const impliedLine = result.impliedPath.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const verdict =
    result.gap > 0.02 ? `${pct(result.gap, 0)} above` : result.gap < -0.02 ? `${pct(-result.gap, 0)} below` : "roughly at";

  return (
    <figure class="gw dcf">
      <header class="gw-head">
        <div>
          <p class="gw-eyebrow">Interactive model</p>
          <h4 class="gw-title">{p.title ?? "Reverse DCF"}</h4>
        </div>
        <button class="gw-reset" type="button" onClick={reset}>Reset</button>
      </header>

      <div class="gw-grid">
        <div class="gw-controls">
          <Slider label="Share price" value={price} min={Math.round(p.price * 0.4)} max={Math.round(p.price * 1.6)}
            step={Math.max(1, Math.round(p.price / 400))} format={(v) => perShare(v)} onInput={setPrice} />
          <Slider label="Discount rate" value={discount} min={5} max={14} step={0.25} format={(v) => `${v.toFixed(2)}%`} onInput={setDiscount} />
          <Slider label="Terminal growth" value={terminal} min={0} max={5} step={0.25} format={(v) => `${v.toFixed(2)}%`} onInput={setTerminal} />
          <Slider label={`Your FCF growth, years 1–${years}`} value={growth} min={-5} max={25} step={0.5}
            format={(v) => `${v.toFixed(1)}% / yr`} onInput={setGrowth} accent />
        </div>

        <div class="gw-results">
          <div class="gw-stat">
            <span class="gw-label">Market-implied FCF growth</span>
            <span class="gw-big">{pct(result.implied)}</span>
            <span class="gw-sub">per year for {years} years, to justify {perShare(price)}</span>
          </div>
          <div class="gw-stat">
            <span class="gw-label">Value at your {growth.toFixed(1)}% growth</span>
            <span class="gw-big accent">{perShare(result.intrinsic)}</span>
            <span class="gw-sub">Price is {verdict} this. Buy below {perShare(result.buyBelow)} ({Math.round(mos * 100)}% margin of safety).</span>
          </div>
          <div class="gw-stat small">
            <span class="gw-label">Value from terminal year onward</span>
            <span class="gw-mid">{pct(result.terminalShare, 0)}</span>
          </div>
        </div>
      </div>

      <svg class="gw-chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Projected free cash flow: your ${growth}% growth versus the market-implied ${pct(result.implied)}`}>
        {ticks.map((t) => (
          <g>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} class="grid" />
            <text x={padL - 8} y={y(t)} class="tick" text-anchor="end" dominant-baseline="middle">{money(t)}</text>
          </g>
        ))}
        {result.flows.map((v, i) => (
          <rect x={x(i) - barW / 2} y={y(v)} width={barW} height={Math.max(0, y(0) - y(v))} rx="3" class="bar" />
        ))}
        {impliedLine && <path d={impliedLine} class="implied" />}
        {result.impliedPath.map((v, i) => <circle cx={x(i)} cy={y(v)} r="3" class="implied-dot" />)}
        {ref && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(ref.value)} y2={y(ref.value)} class="ref" />
            <text x={W - padR} y={y(ref.value) - 6} class="ref-label" text-anchor="end">{ref.label}: {money(ref.value)}</text>
          </g>
        )}
        {result.flows.map((_, i) => (
          <text x={x(i)} y={H - 10} class="tick" text-anchor="middle">Y{i + 1}</text>
        ))}
      </svg>
      <figcaption class="gw-legend">
        <span><i class="sw bar" /> Free cash flow at your growth</span>
        <span><i class="sw implied" /> Path the market is pricing in</span>
        {ref && <span><i class="sw ref" /> {ref.label}</span>}
      </figcaption>
      <p class="gw-note">
        Starts from {money(p.fcf, 1)} of free cash flow, grows it for {years} years, then at the terminal rate forever,
        discounted at the discount rate. {netDebt < 0 ? `Net cash of ${money(-netDebt, 1)}` : `Net debt of ${money(netDebt, 1)}`} and {p.shares.toLocaleString("en-US")}B shares convert enterprise value to a per-share figure.
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

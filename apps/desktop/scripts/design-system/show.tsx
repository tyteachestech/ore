import { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { CHANNELS, grid, icon, ICONS, type ChannelId } from "../../src/ambience-art";
import { dots } from "../../src/dots";
import { EndMark } from "../../src/EndMark";
import { Gem } from "../../src/Gem";
import * as Icons from "../../src/icons";
import { LampRing } from "../../src/Lamp";
import { Mole, type Mood } from "../../src/Mole";
import { PixelGem, PixelKeep, PixelQuestion, PixelTry } from "../../src/PixelIcon";
import { DotBar, DotNumber, DotRing } from "../../src/Ring";

/* The design system page's live previews (docs/design/brand.md): each one mounts the app's own component with the
   app's own stylesheet, so the page can't drift from what is built. `build.ts` bundles this as `window.Ore`. */

const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
  <figure className="ds-cell">
    <div className="ds-art">{children}</div>
    <figcaption>{label}</figcaption>
  </figure>
);

const Gems = () => (
  <div className="ds-row" data-color="blue">
    <Cell label="Rough"><Gem kind="rough" size={36} /></Cell>
    <Cell label="One answer from cut"><Gem kind="ready" size={36} /></Cell>
    <Cell label="Cut"><Gem kind="cut" size={36} /></Cell>
    <Cell label="Won back"><Gem kind="cut" size={36} seam /></Cell>
    <Cell label="Polished"><Gem kind="cut" size={36} polished /></Cell>
    <Cell label="To win back"><Gem kind="dull" size={36} /></Cell>
    <Cell label="Empty"><Gem kind="empty" size={36} /></Cell>
  </div>
);

const Progress = () => (
  <div className="ds-row">
    {[0, 0.3, 0.7, 1].map((s) => (
      <Cell key={s} label={`${Math.round(s * 100)}%`}><span className="ring"><DotRing size={64} share={s} /></span></Cell>
    ))}
    <Cell label="Bar"><DotBar share={0.4} n={10} className="ds-bar" /></Cell>
    <Cell label="Hero number"><span className="ds-hero">18</span></Cell>
    <Cell label="Result number"><span className="ds-ink"><DotNumber value={25} height={28} /></span></Cell>
  </div>
);

const ICON_LIST = Object.entries(Icons).filter(([name, v]) => typeof v === "function" && /^[A-Z]/.test(name)) as [string, Icons.Icon][];
const IconGrid = () => (
  <div className="ds-stack">
    <div className="ds-row ds-tight">
      <span style={{ color: "var(--keep-solid)" }}><PixelKeep size={16} /></span>
      <span style={{ color: "var(--card-solid)" }}><PixelGem size={16} /></span>
      <span style={{ color: "var(--question-solid)" }}><PixelQuestion size={16} /></span>
      <span style={{ color: "var(--apply-solid)" }}><PixelTry size={16} /></span>
    </div>
    <div className="ds-icons">{ICON_LIST.map(([name, I]) => <span key={name} title={name}><I size={16} /></span>)}</div>
  </div>
);

const MOODS: Exclude<Mood, "idle">[] = ["happy", "curious", "proud", "laugh", "wave", "wink", "sleepy", "surprised"];
function MoleShow() {
  const [mood, setMood] = useState<Mood>("peek");
  const [cue, setCue] = useState(0);
  return (
    <div className="ds-row">
      <Mole size={96} mood={mood} cue={cue} bare />
      <div className="ds-row ds-tight">
        {MOODS.map((m) => <button key={m} className="settings-btn" onClick={() => (setMood(m), setCue((c) => c + 1))}>{m[0]!.toUpperCase() + m.slice(1)}</button>)}
      </div>
    </div>
  );
}

/** The radio's button while a channel plays, as `OrbPlaying` in Radio.tsx draws it; the level here is a slow swell. */
function orb(c: HTMLCanvasElement, id: ChannelId) {
  const ORB = 52, AMBER = "255,178,36", dpr = Math.min(3, devicePixelRatio || 1), g = grid(11, 11);
  c.width = ORB * dpr; c.height = ORB * dpr;
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lv = 0;
  const tick = () => {
    const t = still ? 0 : performance.now() / 1000, mid = ORB / 2, d = 2.3, o = mid - 5.5 * d;
    const level = 0.45 + 0.3 * Math.sin(t * 0.9) + 0.15 * Math.sin(t * 2.7);
    lv += (level - lv) * 0.2;
    g.clear();
    icon(g, id, 0, 0, 1, t || -1);
    ctx.clearRect(0, 0, ORB, ORB);
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
      const v = g.lit[y * 11 + x]!;
      if (v <= 0) continue;
      ctx.fillStyle = `rgba(${AMBER},${v})`;
      ctx.beginPath(); ctx.arc(o + x * d + d / 2, o + y * d + d / 2, d * 0.42, 0, 7); ctx.fill();
    }
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2 - Math.PI / 2, w = 0.5 + 0.5 * Math.sin(k * 1.7 + t * 3);
      ctx.fillStyle = `rgba(${AMBER},${0.25 + 0.6 * lv * w})`;
      ctx.beginPath(); ctx.arc(mid + Math.cos(a) * 21, mid + Math.sin(a) * 21, 1.1 + lv * 1.1 * w, 0, 7); ctx.fill();
    }
    if (!still && c.isConnected) requestAnimationFrame(tick);
  };
  tick();
}
const Lamp = () => (
  <div className="ds-row">
    <Cell label="Off">
      <span className="radio-orb ds-orb"><svg className="radio-orb-dots" viewBox="0 0 16 16" width="26" height="26"><path d={dots(ICONS.speaker)} /></svg></span>
    </Cell>
    {CHANNELS.map((ch) => (
      <Cell key={ch.id} label={ch.name}>
        <span className="radio-orb playing ds-orb"><canvas className="radio-orb-dots" style={{ width: 52, height: 52 }} ref={(c) => void (c && orb(c, ch.id))} /></span>
      </Cell>
    ))}
    <Cell label="Reading aloud">
      <span className="listen-bar"><button className="ctl lamp"><LampRing size={26} level={beat} /><Icons.Pause size={15} /></button></span>
    </Cell>
    <Cell label="Tutor writing"><span className="tutor-bubble ds-orb"><Mole mood="thinking" signal={beat} /></span></Cell>
  </div>
);
/** A stand-in for words being spoken or written: a beat about three times a second, fading between. */
const beat = () => 0.35 + 0.65 * Math.max(0, 1 - ((performance.now() % 340) / 340) * 1.4);

const Marks = () => (
  <ul className="end-tally ds-row">
    {(["gem", "calendar", "comet"] as const).map((k) => <li key={k} className="ds-cell"><span className="ds-ink"><EndMark kind={k} size={48} /></span><figcaption>{k[0]!.toUpperCase() + k.slice(1)}</figcaption></li>)}
  </ul>
);

function Controls() {
  const [on, setOn] = useState(1);
  const types = [["Key point", PixelGem, "var(--card-solid)"], ["Question", PixelQuestion, "var(--question-solid)"], ["Try it", PixelTry, "var(--apply-solid)"]] as const;
  return (
    <div className="ds-row">
      <Cell label="The one main action"><button className="pill-btn">Start review <kbd>↵</kbd></button></Cell>
      <Cell label="Any other button"><button className="settings-btn">Start</button></Cell>
      <Cell label="A choice of a few">
        <div className="intents">
          {types.map(([name, I, c], i) => (
            <button key={name} className={`intent${on === i ? " on" : ""}`} onClick={() => setOn(i)}><span style={{ color: c, display: "inline-flex", marginRight: 6, verticalAlign: "middle" }}><I size={16} /></span>{name}</button>
          ))}
        </div>
      </Cell>
      <Cell label="An answer">
        <div className="review-rate ds-rate">{["Again", "Hard", "Good", "Easy"].map((r, i) => <button key={r} className={`rate-${i + 1}${i === 2 ? " suggested" : ""}`}>{r}</button>)}</div>
      </Cell>
    </div>
  );
}

const SHOWS = { gems: Gems, progress: Progress, icons: IconGrid, mole: MoleShow, lamp: Lamp, marks: Marks, controls: Controls };

(window as unknown as { Ore: unknown }).Ore = {
  show(name: keyof typeof SHOWS, el: HTMLElement) {
    const Show = SHOWS[name];
    createRoot(el).render(<Show />);
  },
};

// The iPhone's text size (Dynamic Type, F70). The phone build multiplies every font size in the app's CSS by
// --type (scaleFontSizes, run by vite.config.ts), and the app sets --type from the size iOS gives its body
// text: 17pt at the default size, so a phone set larger or smaller reads everything larger or smaller.

const TYPED = /var\(--type/;
// Titles grow less than body text, as iOS's own Large Title does (34pt at the default size, 40 at the largest
// regular size, 44 at the first accessibility size): a title of 28px or more takes about half the change.
const TITLE = 28;
const scaled = (v: string) => {
  if (TYPED.test(v) || !/\d(px|pt)\b/.test(v)) return v;
  return parseFloat(v) >= TITLE ? `calc(${v} * (1 + (var(--type, 1) - 1) * 0.47))` : `calc(${v} * var(--type, 1))`;
};

/** The CSS with each fixed font size and line height times --type; sizes in em, % or keywords already follow. */
export function scaleFontSizes(css: string): string {
  return css
    .replace(/(font-size|line-height|--[\w-]+-size)(\s*:\s*)([^;}]+?)(\s*!important)?(?=\s*[;}])/g, (_, prop, colon, v, imp = "") => prop + colon + scaled(v.trim()) + imp)
    // The shorthand's size and line height (`font: 600 13px/1.4 var(--font)`).
    .replace(/\bfont\s*:[^;}]+/g, (decl) => (TYPED.test(decl) ? decl : decl.replace(/(\d*\.?\d+px)(\/(\d*\.?\d+px))?/, (_, size, _s, lh) => `${scaled(size)}${lh ? `/${scaled(lh)}` : ""}`)));
}

/** The largest scale: the first accessibility size (28pt). The screens' bars, buttons and rows hold text up to
 *  there; past it words break inside a title and buttons clip theirs, so the larger accessibility sizes read as it. */
export const MAX_TYPE = 28 / 17;

/** iOS's body size for this phone over the default 17pt, up to MAX_TYPE; 1 where the web view has no Dynamic Type. */
export function typeScale(body: number | undefined): number {
  if (!body) return 1;
  return Math.round(Math.min(body / 17, MAX_TYPE) * 1000) / 1000;
}

/** Sets --type on <html> and keeps it there when he changes the size in Settings while Ore is open. */
export function followTextSize(): void {
  if (!CSS.supports("font", "-apple-system-body")) return;
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body";
  probe.textContent = "x";
  document.documentElement.append(probe);
  const set = () => document.documentElement.style.setProperty("--type", String(typeScale(parseFloat(getComputedStyle(probe).fontSize))));
  set();
  new ResizeObserver(set).observe(probe);
  document.addEventListener("visibilitychange", set);
}

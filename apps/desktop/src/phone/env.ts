// The phone build reads process.env at run time (vite.config.ts), so it has to exist before any
// module that reads it loads: main.tsx imports this first. core.ts adds the library's variables.
if (import.meta.env.VITE_PHONE === "1") {
  const g = globalThis as unknown as { process?: { env: Record<string, string> } };
  g.process ??= { env: { NODE_ENV: import.meta.env.PROD ? "production" : "development" } };
}
// `.phone` on <html> styles the phone build, popovers included: they render outside the screens.
if (import.meta.env.VITE_PHONE === "1") {
  document.documentElement.classList.add("phone");
  // An app, not a page: no pinch zoom, and content may run under the notch (the screens pad for it).
  document.querySelector('meta[name="viewport"]')?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
  // iOS scrolls the whole page to show a focused field, sliding the screen under the status bar;
  // the screens scroll inside themselves, so the page stays put.
  window.addEventListener("scroll", () => window.scrollY && window.scrollTo(0, 0));
}

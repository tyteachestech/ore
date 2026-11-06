import { spawn } from "node:child_process";
import { MIN_WORDS, wordCount } from "./check.ts";

// Add from the browser (D96 phase 3): the page open in Safari or a Chromium browser, read through
// AppleScript, so a page that needs his sign-in (Medium, NYT, X, Notion, Reddit) comes in as he
// sees it. The browser is the one whose window is frontmost of all browser windows: the page he
// was just reading, even with Ore in front.

/** The page in a browser tab: its HTML as rendered (after scripts ran), or Safari's text when
 *  JavaScript from Apple Events is off. */
export interface Tab {
  browser: string;
  url: string;
  title?: string;
  html?: string;
  text?: string;
}

// JXA: the frontmost browser window by on-screen order, then its tab. Prints one JSON line.
const SCRIPT = String.raw`
ObjC.import("CoreGraphics");
ObjC.import("AppKit");
const SAFARI = ["com.apple.Safari", "com.apple.SafariTechnologyPreview"];
const CHROMIUM = ["com.google.Chrome", "com.google.Chrome.canary", "company.thebrowser.Browser", "company.thebrowser.dia", "net.imput.helium", "com.brave.Browser", "com.microsoft.edgemac", "com.vivaldi.Vivaldi"];
const JS_HTML = "document.documentElement.outerHTML";
const JS_TEXT = "document.body ? document.body.innerText : ''";
function run() {
  const wins = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements, 0))) || [];
  let bundle = null;
  for (const w of wins) {
    if (w.kCGWindowLayer !== 0) continue;
    const app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(w.kCGWindowOwnerPID);
    const id = app && !app.isNil() ? ObjC.unwrap(app.bundleIdentifier) : null;
    if (SAFARI.includes(id) || CHROMIUM.includes(id)) { bundle = id; break; }
  }
  if (!bundle) return JSON.stringify({ error: "none" });
  const app = Application(bundle);
  const out = { browser: app.name() };
  const attempt = (f) => { try { return f(); } catch (e) { out.jsError = String(e); return null; } };
  if (SAFARI.includes(bundle)) {
    if (!app.documents.length) return JSON.stringify({ error: "none" });
    const doc = app.documents[0];
    out.url = doc.url(); out.title = doc.name();
    out.html = attempt(() => app.doJavaScript(JS_HTML, { in: doc }));
    out.text = out.html ? attempt(() => app.doJavaScript(JS_TEXT, { in: doc })) : doc.text();
    if (!out.html) try { out.html = doc.source(); } catch (e) {}
  } else {
    if (!app.windows.length) return JSON.stringify({ error: "none" });
    const tab = app.windows[0].activeTab();
    out.url = tab.url(); out.title = tab.title();
    out.html = attempt(() => tab.execute({ javascript: JS_HTML }));
    if (out.html) out.text = attempt(() => tab.execute({ javascript: JS_TEXT }));
  }
  return JSON.stringify(out);
}`;

const PERMISSION = /-1743|not authori[sz]ed|not allowed/i;

/** The page in the frontmost browser window. Throws with the next step when there is none, or the
 *  browser won't hand it over. */
export async function frontTab(run: (script: string) => Promise<string> = osascript): Promise<Tab> {
  let raw: string;
  try {
    raw = await run(SCRIPT);
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (PERMISSION.test(msg)) throw new Error(`Ore isn’t allowed to read your browser. Turn it on in System Settings › Privacy & Security › Automation, then try again.`);
    if (process.platform !== "darwin") throw e;
    throw new Error(`Couldn’t read the page from your browser (${msg.trim().split("\n").pop()}). Copy its text and paste it here instead.`);
  }
  const t = JSON.parse(raw) as Tab & { error?: string; jsError?: string };
  if (t.error || !t.url) throw new Error("No page is open in Safari or Chrome. Open the page there, then add it from the browser again.");
  if (!/^https?:\/\//i.test(t.url)) throw new Error(`${t.browser} is showing “${t.url}”, not a web page. Open the page you want, then try again.`);
  if (!t.html && !t.text) {
    if (t.jsError && PERMISSION.test(t.jsError)) throw new Error(`Ore isn’t allowed to read ${t.browser}. Turn it on in System Settings › Privacy & Security › Automation, then try again.`);
    const menu = t.browser === "Safari" ? "Safari’s Develop menu (turn on Settings › Advanced › Show features for web developers)" : `${t.browser}’s View › Developer menu`;
    throw new Error(`${t.browser} needs one setting to share the page: turn on “Allow JavaScript from Apple Events” in ${menu}, then try again.`);
  }
  return { browser: t.browser, url: t.url, title: t.title || undefined, html: t.html || undefined, text: t.text || undefined };
}

function osascript(script: string): Promise<string> {
  if (process.platform !== "darwin") return Promise.reject(new Error("Adding from the browser works on a Mac only. Copy the page’s text and paste it here instead."));
  return new Promise((resolve, reject) => {
    const p = spawn("osascript", ["-l", "JavaScript", "-e", script]);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err || `osascript exited ${code}`))));
  });
}

/** The tab's visible text as paragraphs, for when its HTML holds no article (an app built in the
 *  browser): only when there is enough of it to read. */
export function tabText(text: string | undefined): string | null {
  const paras = (text ?? "")
    .split(/\n\s*\n|\n(?=\S)/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  const body = paras.join("\n\n");
  return wordCount(body) >= MIN_WORDS ? body + "\n" : null;
}

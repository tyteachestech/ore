// Links whose page is not the thing to read, pointed at what is: a GitHub repo at its README, a
// file on GitHub or nbviewer at its raw text, a shared Google Doc or Slides deck at its export, an
// arXiv abstract at the paper's full HTML. Others pass through.

export type Rewrite =
  /** Fetch this instead; `base` resolves the README's relative links and images. */
  | { kind: "fetch"; url: string; title?: string; author?: string; base?: string }
  /** A GitHub repo: its README, found through the API (raw guesses when that is refused). */
  | { kind: "readme"; owner: string; repo: string };

const GH_REPO = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?(?:[?#].*)?$/;
const GH_TREE = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/tree\/[^?#]+$/;
const GH_BLOB = /^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/blob\/([^?#]+)/;
const NBVIEWER = /^https?:\/\/nbviewer\.(?:org|jupyter\.org)\/github\/([\w.-]+)\/([\w.-]+)\/blob\/([^?#]+)/;
const GDOC = /^https?:\/\/docs\.google\.com\/document\/d\/([\w-]+)/;
const GSLIDES = /^https?:\/\/docs\.google\.com\/presentation\/d\/([\w-]+)/;
const ARXIV = /^https?:\/\/(?:www\.)?arxiv\.org\/abs\/([\w.\/-]+?)(?:v\d+)?\/?(?:[?#].*)?$/;
/** github.com paths that are site pages, not repos. */
const GH_PAGES = new Set(["orgs", "topics", "settings", "marketplace", "explore", "features", "pricing", "sponsors", "collections", "trending"]);

export function rewrite(url: string): Rewrite | null {
  let m = url.match(GH_BLOB) ?? url.match(NBVIEWER);
  if (m) {
    const raw = `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
    return { kind: "fetch", url: raw, author: m[1], base: raw };
  }
  m = url.match(GH_REPO) ?? url.match(GH_TREE);
  if (m && !GH_PAGES.has(m[1]!)) return { kind: "readme", owner: m[1]!, repo: m[2]! };
  if ((m = url.match(GDOC))) return { kind: "fetch", url: `https://docs.google.com/document/d/${m[1]}/export?format=docx` };
  if ((m = url.match(GSLIDES))) return { kind: "fetch", url: `https://docs.google.com/presentation/d/${m[1]}/export/pptx` };
  if ((m = url.match(ARXIV))) return { kind: "fetch", url: `https://arxiv.org/html/${m[1]}` };
  return null;
}

/** Relative links and images in Markdown made absolute against the file they came from: images
 *  from the raw file's folder, links to their page on GitHub. */
export function absolutize(md: string, base: string): string {
  const page = base.replace(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\//, "https://github.com/$1/$2/blob/");
  const resolve = (href: string, against: string) => {
    if (/^(?:[a-z][\w+.-]*:|#|\/\/)/i.test(href)) return href;
    try {
      return new URL(href, against).href;
    } catch {
      return href;
    }
  };
  return md
    .replace(/(!\[[^\]]*\]\()([^)\s]+)/g, (_, pre, href) => pre + resolve(href, base))
    .replace(/((?:^|[^!])\[[^\]]*\]\()([^)\s]+)/g, (_, pre, href) => pre + resolve(href, page))
    .replace(/(<img\b[^>]*\bsrc=["'])([^"']+)/gi, (_, pre, href) => pre + resolve(href, base));
}

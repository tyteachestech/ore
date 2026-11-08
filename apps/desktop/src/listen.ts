// Listen (D85): the source read aloud by the Mac's own voices (the webview's speech, which is
// AVSpeechSynthesizer: offline, free), a sentence at a time so the page can follow it.

const BLOCKS = "p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dt, dd";

/** The text's sentences in reading order, as ranges. Code blocks and a transcript's [mm:ss] stamps
 *  are skipped; a block holding other blocks (a list item with paragraphs) reads through them. */
export function sentences(root: HTMLElement): Range[] {
  const out: Range[] = [];
  const seg = new Intl.Segmenter(undefined, { granularity: "sentence" });
  for (const block of root.querySelectorAll<HTMLElement>(BLOCKS)) {
    if (block.querySelector(BLOCKS) || block.closest("pre")) continue;
    const nodes: Text[] = [];
    const walk = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest(".ts, pre, code, .katex, [data-noindex]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = walk.nextNode(); n; n = walk.nextNode()) nodes.push(n as Text);
    const text = nodes.map((n) => n.data).join("");
    const at = (offset: number, end: boolean): [Text, number] => {
      let i = 0;
      for (const n of nodes) {
        if (offset < i + n.data.length || (end && offset === i + n.data.length)) return [n, offset - i];
        i += n.data.length;
      }
      const last = nodes[nodes.length - 1]!;
      return [last, last.data.length];
    };
    for (const s of seg.segment(text)) {
      const lead = s.segment.length - s.segment.trimStart().length;
      const body = s.segment.trim();
      if (!/\p{L}|\p{N}/u.test(body)) continue;
      const r = document.createRange();
      r.setStart(...at(s.index + lead, false));
      r.setEnd(...at(s.index + lead + body.length, true));
      out.push(r);
    }
  }
  return out;
}

/** The first sentence that starts at or below `top` (the top of the visible text). */
export function firstFrom(list: Range[], top: number): number {
  const i = list.findIndex((r) => r.getBoundingClientRect().bottom > top);
  return i < 0 ? 0 : i;
}

/** A speech error code (SpeechSynthesisErrorEvent.error) in plain words, for the toast. */
export function speechTrouble(why: string): string {
  if (why === "voice-unavailable" || why === "language-unavailable") return "the Mac has no voice for this language";
  if (why === "audio-busy" || why === "audio-hardware") return "the Mac's sound output was busy";
  if (why === "network") return "the voice needs the internet and couldn't reach it";
  if (why === "not-allowed") return "macOS didn't allow it";
  return "the Mac's voice couldn't read this part";
}

export const speechAvailable = () => typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";

/** Speaks `list` from a sentence on, one utterance per sentence. Pause, a new speed or a jump
 *  cancels and speaks the current sentence again, which every engine does the same way. */
export class Speaker {
  private token = 0;
  current: SpeechSynthesisUtterance | null = null; // held so WebKit keeps firing its events
  at = 0;
  constructor(
    private list: Range[],
    public rate: number,
    private on: { sentence: (i: number) => void; end: () => void; error: (why: string) => void },
  ) {}

  play(from = this.at) {
    const token = ++this.token;
    speechSynthesis.cancel();
    this.speak(from, token);
  }

  pause() {
    this.token++;
    speechSynthesis.cancel();
  }

  setRate(rate: number, playing: boolean) {
    this.rate = rate;
    if (playing) this.play();
  }

  private speak(i: number, token: number) {
    if (token !== this.token) return;
    if (i >= this.list.length) return this.on.end();
    this.at = i;
    this.on.sentence(i);
    const u = new SpeechSynthesisUtterance(this.list[i]!.toString().replace(/\s+/g, " "));
    u.rate = this.rate;
    u.onend = () => this.speak(i + 1, token);
    u.onerror = (e) => {
      // A cancel (pause, a new speed) ends the old utterance with an error; only a real one counts.
      if (token === this.token && e.error !== "canceled" && e.error !== "interrupted") this.on.error(e.error);
    };
    this.current = u;
    speechSynthesis.speak(u);
  }
}

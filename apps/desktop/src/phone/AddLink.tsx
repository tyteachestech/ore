// Adding a source on the iPhone (D235): the link is saved to the library's inbox at once, then the phone
// imports it itself with the Mac's importer; what it can't read (a video's transcript) the Mac brings in.
// The sheet is one field, as Raindrop's add-a-link is; a link already on the clipboard is offered by the
// field's own Paste (iOS), never read without his tap. Any other words pasted there are a text source, as in
// the Mac's Add box (paste.ts `entries`): added here at once, its exercises written by the Mac's catch-up.
import { Working } from "../Working";
import { useEffect, useRef, useState } from "react";
import { Grow } from "../Grow";
import { Trap } from "../Trap";
import { ore, oreWith, queuePicked } from "../ore";
import { addArgs, entries, pastedHtml, withHtml, type Pasted } from "../paste";
import { errorText, useFocusWhileMounted } from "../util";
import { letDown, sheetLayer, useSwipeDown } from "./sheet";

/** What the importers read from a file (FILE_TYPES in the core, less video, which needs the Mac's tools to hear). */
const PICKED = "image/*,.pdf,.epub,.md,.markdown,.txt,.html,.htm,.docx,.pptx,.rtf,.xlsx,.csv,.tsv,.ipynb,.srt,.vtt,.mp3,.m4a,.wav";

export type Waiting = { id: string; url: string; skills: string[]; error?: string };

/** A link typed and left with a tap outside, a swipe down or Esc, by where it was typed (a skill's page files it
 *  there): that sheet opens with it selected, so Add takes it and typing replaces it, as the Mac's Add box keeps
 *  his words (D342). In memory only: gone once it goes in. */
const leftLinks = new Map<string, string>();

/** A text source the sheet added, to open (as the Mac opens one added by hand, D109). */
export type AddedText = { id: string; title: string; kept?: boolean };

/** What the field holds: links (a pasted list too) are queued; anything else is the whole text, one source. */
export function phoneEntries(raw: string, pasted: Pasted | null) {
  const list = entries(raw);
  if (list.every((e) => e.kind === "link")) return list;
  // A file path is the Mac's to read; on the phone it is words like any other.
  return withHtml([{ kind: "text" as const, text: raw.trim() }], pasted);
}

/** `skill`: added from a skill's page, it is filed there. */
export function AddLink({ skill, onClose, onAdded }: { skill?: string; onClose: () => void; onAdded: (text?: AddedText) => void }) {
  const [url, setUrl] = useState(() => leftLinks.get(skill ?? "") ?? "");
  const [pasted, setPasted] = useState<Pasted | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useSwipeDown(box, onClose, true);
  // Focus goes back where it was when the sheet closes, however it closes (a tap outside too).
  useFocusWhileMounted(field);
  useEffect(() => field.current?.select(), []);
  const add = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    const to = skill ? ["--skill", skill] : [];
    try {
      let text: AddedText | undefined;
      for (const e of phoneEntries(url, pasted)) {
        if (e.kind === "link") await ore("inbox", "--add", e.url, ...to);
        else if (e.kind === "text") {
          const { args, stdin } = addArgs(e);
          text = await oreWith<AddedText>(stdin, ...args, ...to);
        }
      }
      leftLinks.delete(skill ?? "");
      onAdded(text);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
      field.current?.focus(); // back on the link he can fix, as the Mac's Add does (Codex sweep 3, a11y)
    }
  };
  // A file or a photo instead: iOS's own picker (Photo Library, Take Photo, Choose Files), as Notes' attach is.
  const picker = useRef<HTMLInputElement>(null);
  const pick = async (list: FileList | null) => {
    if (!list?.length || busy) return;
    setBusy(true);
    try {
      for (const f of list) await queuePicked(f.name, new Uint8Array(await f.arrayBuffer()), skill);
      onAdded();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return sheetLayer(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && letDown(box.current, onClose)}>
      <Trap>
        <form ref={box} noValidate className="panel sheet add-link" role="dialog" aria-modal="true" aria-label="Add a source" onSubmit={(e) => (e.preventDefault(), void add())} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), onClose())}>
          <Grow
            ref={field}
            className="field"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Paste a link or any text"
            aria-label="Link or text"
            aria-invalid={!!error}
            aria-describedby={error ? "add-link-error" : undefined}
            value={url}
            readOnly={busy}
            onChange={(e) => (setUrl(e.target.value), leftLinks.set(skill ?? "", e.target.value), e.target.value.trim() || setPasted(null), setError(null))}
            // The paste as it came, so a page's headings, tables and pictures come in with it, as on the Mac.
            onPaste={(e) => {
              const f = e.currentTarget;
              if (!f.value.trim() || f.selectionEnd - f.selectionStart === f.value.length) setPasted({ text: e.clipboardData.getData("text/plain"), html: pastedHtml(e.clipboardData) });
            }}
            // The keyboard's Go adds, as the one-line field's did; pasted text keeps its lines.
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && (e.preventDefault(), void add())}
          />
          {error && <p className="phone-error" id="add-link-error" role="alert">{error}</p>}
          <button className="pill-btn" type="submit" disabled={!url.trim() || busy}>
            Add
          </button>
          <button className="add-link-file" type="button" disabled={busy} onClick={() => picker.current?.click()}>
            Choose a file or photo
          </button>
          <input ref={picker} type="file" hidden multiple accept={PICKED} aria-label="File or photo" onChange={(e) => void pick(e.target.files)} />
        </form>
      </Trap>
    </div>,
  );
}

/** A link only the Mac can read (a video's transcript needs its tools) isn't a failure: it says where it
 *  comes in. Anything else the phone couldn't read keeps its reason, and the Mac tries it. */
export function macOnly(error: string): string | null {
  if (/is a playlist/.test(error)) return "Your Mac adds a playlist as a course, each video a lesson.";
  // The Mac tried the course and needs a tool it lacks: say so, not that it will come in.
  if (/course’s videos need yt-dlp/.test(error)) return "Your Mac needs yt-dlp for this course’s videos: run brew install yt-dlp there.";
  if (/yt-dlp/.test(error)) return "A video comes in through your Mac.";
  if (/Transcribing audio needs/.test(error)) return "Your Mac writes the transcript for a podcast.";
  if (/scanned pages/.test(error)) return "Your Mac reads the text in a picture or a scan.";
  if (/only on the Mac|on a Mac only/.test(error)) return "This one comes in through your Mac.";
  return null;
}

/** How core's refusals name the Mac's way in (core's FROM_TAB starts with it; phone-waiting.test.ts checks). */
export const MAC_WAY = "add it from the browser";

/** Why the phone couldn't read a link, without the Mac's own next steps (its Browser tab, `ore add --tab`,
 *  pasting the text into the add box), which the phone doesn't have: the Mac tries the link itself (D227.3).
 *  In each sentence the clause naming one of them goes, with the rest of that sentence; what came before it
 *  stays, and a sentence that was only that goes whole. */
export function phoneReason(error: string): string {
  const kept = error
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      // The Mac's ways in: its Browser tab, or pasting the text into its add box (said several ways).
      const at = Math.min(...[sentence.indexOf(MAC_WAY), sentence.search(/\bcopy (it|its|the)\b[^.]*\bpaste\b|\bpaste (it|its|the)\b[^.]*\bhere\b/i)].filter((i) => i >= 0));
      if (!Number.isFinite(at)) return sentence;
      const head = sentence.slice(0, at);
      const cut = Math.max(head.lastIndexOf("; "), head.lastIndexOf(", or "), head.lastIndexOf(", then "));
      const left = cut > 0 ? sentence.slice(0, cut).trim() : "";
      return left && (/[.!?]$/.test(left) ? left : `${left}.`);
    })
    .filter(Boolean)
    .join(" ");
  return kept || "Ore couldn’t read this page here.";
}

/** Links on their way in: one this phone is reading says so, and one it couldn't read says why and that
 *  the Mac tries it. */
export function WaitingLinks({ links, reading, onRemove }: { links: Waiting[]; reading: boolean; onRemove: (l: Waiting) => void }) {
  if (!links.length) return null;
  return (
    <section>
      <h2>Coming in</h2>
      <ul>
        {links.map((l) => (
          <li key={l.id} className="phone-waiting">
            <span className="phone-title">{l.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
            {l.error ? (
              macOnly(l.error) ? (
                <span className="phone-waiting-note phone-waiting-why">{macOnly(l.error)}</span>
              ) : (
                <span className="phone-error">{phoneReason(l.error)} Your Mac will try it.</span>
              )
            ) : (
              reading && (
                <span className="phone-waiting-note">
                  <Working label="Reading" stage="read" />
                </span>
              )
            )}
            <button className="phone-back" onClick={() => onRemove(l)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

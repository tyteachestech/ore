// Adding a source on the iPhone (D227): the link is saved to the library's inbox at once, then the phone
// imports it itself with the Mac's importer; what it can't read (a video's transcript) the Mac brings in.
// The sheet is one field, as Raindrop's add-a-link is; a link already on the clipboard is offered by the
// field's own Paste (iOS), never read without his tap.
import { useEffect, useRef, useState } from "react";
import { Trap } from "../Trap";
import { ore, queuePicked } from "../ore";
import { errorText } from "../util";
import { sheetLayer, useSwipeDown } from "./sheet";

/** What the importers read from a file (FILE_TYPES in the core, less video, which needs the Mac's tools to hear). */
const PICKED = "image/*,.pdf,.epub,.md,.markdown,.txt,.html,.htm,.docx,.pptx,.rtf,.xlsx,.csv,.tsv,.ipynb,.srt,.vtt,.mp3,.m4a,.wav";

export type Waiting = { id: string; url: string; skills: string[]; error?: string };

/** `skill`: added from a skill's page, it is filed there. */
export function AddLink({ skill, onClose, onAdded }: { skill?: string; onClose: () => void; onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useSwipeDown(box, onClose, true);
  useEffect(() => field.current?.focus(), []);
  const add = async () => {
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      await ore("inbox", "--add", url.trim(), ...(skill ? ["--skill", skill] : []));
      onAdded();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
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
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Trap>
        <form ref={box} noValidate className="panel sheet add-link" role="dialog" aria-modal="true" aria-label="Add a link" onSubmit={(e) => (e.preventDefault(), void add())} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), onClose())}>
          <input
            ref={field}
            className="field"
            type="url"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="go"
            placeholder="Paste a link"
            aria-label="Link"
            value={url}
            readOnly={busy}
            onChange={(e) => (setUrl(e.target.value), setError(null))}
          />
          {error && <p className="phone-error">{error}</p>}
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
  if (/yt-dlp/.test(error)) return "A video comes in through your Mac.";
  if (/Transcribing audio needs/.test(error)) return "Your Mac writes the transcript for a podcast.";
  if (/scanned pages/.test(error)) return "Your Mac reads the text in a picture or a scan.";
  if (/only on the Mac|on a Mac only/.test(error)) return "This one comes in through your Mac.";
  return null;
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
                <span className="phone-error">{l.error} Your Mac will try it.</span>
              )
            ) : (
              reading && <span className="phone-waiting-note">Reading…</span>
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

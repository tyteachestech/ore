// Adding a source on the iPhone (D223): a link waits in the library's inbox until the Mac imports it with the
// whole import and the AI (D96, D78.3). The sheet is one field, as Raindrop's add-a-link is; a link already on
// the clipboard is offered by the field's own Paste (iOS), never read without his tap.
import { useEffect, useRef, useState } from "react";
import { Trap } from "../Trap";
import { ore } from "../ore";
import { errorText, type Notify } from "../util";
import { sheetLayer, useSwipeDown } from "./sheet";

export type Waiting = { id: string; url: string; error?: string };

export function AddLink({ onClose, onAdded, notify }: { onClose: () => void; onAdded: () => void; notify: Notify }) {
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
      await ore("inbox", "--add", url.trim());
      notify("Added. Your Mac brings it in next time Ore is open there.", "info");
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
        </form>
      </Trap>
    </div>,
  );
}

/** Links added here that the Mac hasn't brought in yet: each says so, or why the Mac couldn't. */
export function WaitingLinks({ links, onRemove }: { links: Waiting[]; onRemove: (l: Waiting) => void }) {
  if (!links.length) return null;
  return (
    <section>
      <h2>Waiting for your Mac</h2>
      <ul>
        {links.map((l) => (
          <li key={l.id} className="phone-waiting">
            <span className="phone-title">{l.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
            {l.error && <span className="phone-error">{l.error}</span>}
            <button className="phone-back" onClick={() => onRemove(l)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

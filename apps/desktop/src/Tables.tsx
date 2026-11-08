import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cancelOre, ore, oreJob, PHONE, type Doc } from "./ore";
import { errorText } from "./util";
import { Working } from "./Working";

// Tables and display formulas in a PDF (D125): pdf.js reads them as lines of text; Docling, an optional
// download on the Mac, reads them properly. Offered in the PDF that has them (Tyler, 2026-11-06, option A),
// and removed from Settings › General › Import.

export type TablesState = { installed: boolean };
type Read = { changed: boolean; regions: number };

/** The one download, shared by every reader and Settings: leaving a PDF doesn't stop it, and the next
 *  PDF opened shows it still going. `step` is the stage the CLI reports. */
const JOB = "tables-install";
let installing: Promise<void> | null = null;
let step = "";
const subs = new Set<() => void>();
const changed = () => subs.forEach((f) => f());
const useStep = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => (installing ? step : null),
    () => null,
  );

export function installReader(): Promise<void> {
  if (installing) return installing;
  step = "";
  installing = (async () => {
    const stop = await listen<{ done: number; of: number; label: string }>("ore-progress", ({ payload: p }) => {
      // A tutor reply streams on the same channel (its payload has no count).
      if (installing && typeof p.done === "number") (step = ` (${p.done + 1} of ${p.of})`), changed();
    }).catch(() => () => {});
    try {
      await oreJob(JOB, null, "tables", "--install");
    } finally {
      stop();
      installing = null;
      changed();
    }
  })();
  changed();
  return installing;
}

/** Stops the download; what it fetched so far is thrown away on the next one. */
export const cancelInstall = () => cancelOre(JOB);

const what = (s: string[]) => (s.includes("tables") && s.includes("formulas") ? "Formulas and tables" : s.includes("tables") ? "Tables" : "Formulas");

/** The quiet line under a PDF's title while its tables or formulas still read as plain text. */
export function TablesLine({ doc, onRead }: { doc: Doc; onRead: (r: Read) => void }) {
  const downloading = useStep();
  const [have, setHave] = useState(!!doc.tables_reader);
  const [reading, setReading] = useState(doc.tables === "reading");
  const [error, setError] = useState(doc.tables_error);
  const cancelled = useRef(false);
  // Read in the background (the reader was there when he added the PDF): wait for that run to end.
  const background = useRef(doc.tables === "reading");
  useEffect(() => {
    if (!background.current) return;
    const t = setInterval(() => {
      ore<Doc>("tables", doc.id, "--status").then(
        (s) => {
          if (s.tables === "reading") return;
          clearInterval(t);
          background.current = false;
          setReading(false);
          if (s.tables === "read") onRead({ changed: true, regions: 0 });
          else setError(s.tables_error);
        },
        () => {},
      );
    }, 4000);
    return () => clearInterval(t);
  }, [doc.id]);

  if (PHONE || doc.type !== "pdf" || !doc.structure?.length || doc.tables === "read") return null;

  const read = async () => {
    setError(undefined);
    cancelled.current = false;
    try {
      if (!have) {
        await installReader();
        setHave(true);
      }
      setReading(true);
      onRead(await ore<Read>("tables", doc.id));
    } catch (e) {
      if (!cancelled.current) setError(errorText(e));
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="pdf-tables">
      {downloading !== null ? (
        <>
          <Working label={`Downloading the table and formula reader${downloading}…`} slow="A few minutes, once" />
          <button className="pdf-tables-btn" onClick={() => ((cancelled.current = true), void cancelInstall())}>
            Cancel
          </button>
        </>
      ) : reading ? (
        <Working label={`Reading the ${what(doc.structure).toLowerCase()}…`} slow="Up to a few minutes for a long paper" />
      ) : error ? (
        <>
          <span className="pdf-tables-err">{error}</span>
          <button className="pdf-tables-btn" onClick={() => void read()}>
            Try again
          </button>
        </>
      ) : (
        <>
          <span>{what(doc.structure)} in this PDF read as plain text.</span>
          <button className="pdf-tables-btn" onClick={() => void read()}>
            Read them properly
          </button>
          {!have && <span className="pdf-tables-size">about 2 GB, once</span>}
        </>
      )}
    </div>
  );
}

/** Settings › General › Import: get the reader before any PDF asks, or take its 2 GB back. `Row` is
 *  Settings' own row. */
export function TablesSetting({ notify, Row }: { notify: (msg: string, kind?: "info" | "error") => void; Row: (p: { title: string; text: string; children: ReactNode }) => ReactNode }) {
  const downloading = useStep();
  const [installed, setInstalled] = useState<boolean | null>(null);
  useEffect(() => {
    if (PHONE) return;
    ore<TablesState>("tables", "--status").then((s) => setInstalled(s.installed), () => setInstalled(false));
  }, [downloading]);
  if (PHONE || installed === null) return null;
  const get = () => installReader().then(() => setInstalled(true), (e) => notify(errorText(e), "error"));
  // Undo would be the whole download again, so Remove says how to get it back instead.
  const remove = async () => {
    setInstalled(false);
    try {
      await ore("tables", "--remove");
      notify("Removed the table and formula reader. A PDF with tables offers it again.");
    } catch (e) {
      setInstalled(true);
      notify(errorText(e), "error");
    }
  };
  return (
    <Row title="Tables and formulas in PDFs" text={installed ? "Reads them as real tables and typeset math, on this Mac. Uses about 2 GB." : "Reads them as real tables and typeset math, on this Mac. About a 2 GB download, once."}>
      {downloading !== null ? (
        <>
          <Working label={`Downloading${downloading}…`} />
          <button className="settings-btn" onClick={() => void cancelInstall()}>
            Cancel
          </button>
        </>
      ) : installed ? (
        <button className="settings-btn" onClick={() => void remove()}>
          Remove
        </button>
      ) : (
        <button className="settings-btn" onClick={() => void get()}>
          Download
        </button>
      )}
    </Row>
  );
}

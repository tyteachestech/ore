import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { Boundary } from "./Boundary";
import { loadPick } from "./ReviewPick";
import { loadSkills, type Skill } from "./ore";
import { Review } from "./Review";
import { useToast } from "./Toast";

/** The quick quiz (D76): the system-wide shortcut or the menu bar item shows this window over any app,
 *  with Review's queue, today's skill pick and rules. Each showing is its own review session. Esc
 *  puts it away and returns him to his app; a click elsewhere puts it away too, keeping a typed answer. */
export function QuickQuiz() {
  /** Counts showings, so each mounts a fresh Review with today's skill pick (D58); 0 while put away. */
  const [run, setRun] = useState(0);
  const [pick, setPick] = useState<string[] | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const { notify, clear, view } = useToast();
  const runRef = useRef(run);
  runRef.current = run;
  /** Showings so far: a showing right after putting it away (both in one task) still mounts a fresh Review. */
  const shows = useRef(0);

  /** `back`: hand focus back to the app he was in (he dismissed it). */
  const close = useCallback((back: boolean) => {
    if (!runRef.current) return;
    // Review ends its own session, by its id, as it closes.
    setRun(0);
    void invoke("quiz_hide", { back });
  }, []);

  useEffect(() => {
    const opened = listen("quiz-open", () => {
      clear();
      loadSkills().then(setSkills, () => {});
      setPick(loadPick());
      setRun(++shows.current);
    });
    // The shortcut again while it shows: put it away, as Esc does.
    const away = listen("quiz-away", () => close(true));
    const blur = getCurrentWindow().onFocusChanged(({ payload: focused }) => !focused && close(false));
    return () => {
      for (const p of [opened, away, blur]) void p.then((un) => un());
    };
  }, []);


  return (
    <div className="quick">
      {run > 0 && (
        <Boundary key={run} onBack={() => close(true)}>
          <Review
            quick
            pick={pick}
            skills={skills}
            onOpenSource={(item, at) => {
              setRun(0);
              void invoke("quiz_open_source", { item, at: at ?? null });
            }}
            onClose={(again) => {
              if (!again) return close(true);
              // Keep going reviews every skill, as in the main window: the end screen counts all that is due.
              setPick(null);
              setRun(++shows.current);
            }}
            notify={notify}
          />
        </Boundary>
      )}
      {view}
    </div>
  );
}

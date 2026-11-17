import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { localDay } from "../../../packages/core/src/ids";
import { Stone } from "./Forge";
import { Grow } from "./Grow";
import { Hint } from "./Hint";
import { X } from "./icons";
import { is, label, useKeymap } from "./keys";
import { Mole } from "./Mole";
import { ore, opt, PHONE, type Skill } from "./ore";
import { SkillChip } from "./Skills";
import { passageText } from "./text";
import { Trap } from "./Trap";
import { errorText, useFocusWhileMounted, type Notify } from "./util";

type Idea = { id: string; item: string; source: string; text: string; state?: "own" | "nudge" | "missed" };
export type Dig = { id: string; at: string; goal: string; text: string; ideas: Idea[]; asks?: { idea: string; q: string; answer?: string }[]; done_at?: string };

/** A skill a finished session asked to dig (D-new-dig): its page opens the Dig when it shows. */
let asked: string | null = null;
const waiting = new Set<() => void>();
export function askDig(skill: string | null) {
  asked = skill;
  for (const f of waiting) f();
}
export const useDigAsked = () =>
  useSyncExternalStore(
    (f) => (waiting.add(f), () => void waiting.delete(f)),
    () => asked,
  );

const drafts = new Map<string, string>();
const STATE = { own: "Came on its own", nudge: "Came with a nudge", missed: "Didn’t come" } as const;

/** The Dig (D-new-dig): the skill's goal done from memory over the blurred page; then the mole asks one
 *  or two questions at ideas left out, and the skill's key points show as stones: solid for an idea that
 *  came on its own, half fused for one a question pulled out, loose and grey for one that didn't come,
 *  which opens its passage. No grade. What he wrote is kept, dated, in the skill note as well. */
export function DigPopup({ skill, blocked, append, notify, onPassage, onClose }: { skill: Skill; blocked: boolean; append: (t: string, heading: string) => Promise<boolean>; notify: Notify; onPassage: (at: { item: string; id: string }) => void; onClose: () => void }) {
  const keys = useKeymap();
  const [text, setTextState] = useState(() => drafts.get(skill.id) ?? "");
  const setText = (t: string) => (setTextState(t), drafts.set(skill.id, t));
  const [dig, setDig] = useState<Dig | null>(null);
  const [busy, setBusy] = useState<"save" | "read" | null>(null);
  /** The step that failed, to run again. */
  const [failed, setFailed] = useState<(() => void) | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  // Closing gives the keys back to what opened it; opened from a finished session, to the goal's Dig button.
  useFocusWhileMounted(panel, () => document.querySelector<HTMLElement>(".skill-goal-row .pill-btn"), true, false);
  const step = !dig ? "write" : dig.done_at ? "map" : dig.asks ? "ask" : "read";
  useEffect(() => field.current?.focus(), [step, answers.length]);

  /** One call to the mole; a null answer (he is not there) is a failure like any other. */
  const mole = (run: () => Promise<Dig | null>) => {
    const go = async () => {
      setFailed(null);
      setBusy("read");
      try {
        const d = await run();
        if (!d) throw new Error("no answer");
        setDig(d);
      } catch {
        setFailed(() => go);
      }
      setBusy(null);
    };
    void go();
  };

  const save = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy("save");
    if (!(await append(t, `Dig, ${localDay(new Date())}`))) return setBusy(null);
    drafts.delete(skill.id);
    // The phone keeps the words; the Mac's mole reads a dig.
    if (PHONE) return notify("Saved in your note, under today’s date"), onClose();
    try {
      const d = await ore<Dig>("dig", skill.id, opt("text", t));
      notify("Dig kept, in your note under today’s date", "quiet", () => ore("dig", skill.id, opt("drop", d.id)));
      setDig(d);
      setBusy(null);
      if (!d.done_at) mole(() => ore<Dig | null>("dig", skill.id, "--ask"));
    } catch (e) {
      notify(errorText(e), "error");
      onClose();
    }
  };

  const reply = (a: string) => {
    const all = [...answers, a.trim()];
    setAnswers(all);
    setAnswer("");
    if (all.length < dig!.asks!.length) return;
    mole(() => (all.some(Boolean) ? ore<Dig | null>("dig", skill.id, ...all.map((x) => opt("answer", x))) : ore<Dig>("dig", skill.id, "--done")));
  };

  /** Left partway through the mole's questions: what was not answered didn't come. */
  const close = () => {
    if (dig && !dig.done_at && !PHONE) void ore("dig", skill.id, "--done").catch(() => {});
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (blocked) return;
      if (is(e, "finish")) {
        e.preventDefault();
        if (step === "write") void save();
        else if (step === "ask" && !busy && !failed && answer.trim()) reply(answer);
      } else if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ask = step === "ask" && !busy && !failed ? dig!.asks![answers.length] : undefined;
  const veins = [...new Set((dig?.ideas ?? []).map((i) => i.source))].map((source) => ({ source, ideas: dig!.ideas.filter((i) => i.source === source) }));
  return (
    <Trap>
      <div className="overlay recall" data-color={skill.color} onMouseDown={(e) => e.target === e.currentTarget && step === "write" && !text.trim() && onClose()}>
        <section ref={panel} className="panel skill-recall dig" data-gives-back="" role="dialog" aria-modal="true" aria-labelledby="dig-title" data-step={step}>
          <header className="skill-recall-head">
            <SkillChip skill={skill} />
            <span className="quiet">Dig, from memory</span>
            <Hint text={<>Close <kbd>Esc</kbd></>}>
              <button className="skill-recall-close" aria-label="Close" onClick={close}>
                <X size={14} weight="bold" aria-hidden="true" />
              </button>
            </Hint>
          </header>
          <h2 id="dig-title">{skill.goal}</h2>
          {step === "write" && (
            <>
              <Grow ref={field} className="field" aria-label="What you remember" value={text} onChange={(e) => setText(e.target.value)} readOnly={!!busy} spellCheck />
              <div className="skill-recall-foot">
                <button onClick={onClose}>
                  Cancel <kbd>Esc</kbd>
                </button>
                <button className="pill-btn" onClick={() => void save()} disabled={!text.trim() || !!busy}>
                  {busy ? "Saving…" : "Done"} <kbd>{label(keys.finish)}</kbd>
                </button>
              </div>
            </>
          )}
          {busy === "read" && (
            <p className="dig-mole" role="status" aria-label="The mole is reading">
              <Mole bare size={32} mood="thinking" />
            </p>
          )}
          {failed && (
            <div className="dig-mole" role="alert">
              <Mole bare size={32} mood="sad" />
              <span>The mole couldn’t read it. Your words are in your note.</span>
              <button className="settings-btn" onClick={failed}>Try again</button>
            </div>
          )}
          {ask && (
            <>
              <p className="dig-mole dig-q">
                <Mole bare size={32} mood="curious" />
                <span>{ask.q}</span>
              </p>
              <Grow ref={field} className="field dig-a" aria-label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} spellCheck />
              <div className="skill-recall-foot">
                <button onClick={() => reply("")}>Skip</button>
                <button className="pill-btn" onClick={() => reply(answer)} disabled={!answer.trim()}>
                  Answer <kbd>{label(keys.finish)}</kbd>
                </button>
              </div>
            </>
          )}
          {step === "map" && (
            <>
              {veins.length > 0 && (
                <div className="dig-map" role="group" aria-label="The ideas of this skill">
                  {veins.map((v) => (
                    <div className="dig-vein" key={v.source}>
                      <small>{v.source}</small>
                      <span>
                        {v.ideas.map((i) => (
                          <Hint key={i.id} text={`${STATE[i.state ?? "missed"]}: “${passageText(i.text)}”`}>
                            <button className="dig-idea" data-state={i.state ?? "missed"} aria-label={`${STATE[i.state ?? "missed"]}: ${passageText(i.text)}`} onClick={() => (onClose(), onPassage({ item: i.item, id: i.id }))}>
                              <Stone size={16} uses={i.state === "own" ? 2 : 0} waiting={(i.state ?? "missed") === "missed"} />
                            </button>
                          </Hint>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="skill-recall-foot">
                <button className="pill-btn" autoFocus onClick={onClose}>
                  Done <kbd>Esc</kbd>
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </Trap>
  );
}

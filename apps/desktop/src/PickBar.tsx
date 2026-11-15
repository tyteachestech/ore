import { Archive, ArrowCounterClockwise, Check, GraduationCap, X } from "./icons";
import { Hint } from "./Hint";
import { MoreButton, type MenuAction } from "./Menu";

/** The bar that stands while several sources are picked (D283; Linear's and Dice UI's action bar): how
 *  many, the actions that make sense for them all, and × to let go of the pick. The same actions as the pick's ⋯
 *  menu, out where he can see a pick can be acted on. */
export function PickBar({ n, actions, onClear }: { n: number; actions: MenuAction[]; onClear: () => void }) {
  const by = (id: string) => actions.find((a) => a.id === id);
  const move = by("done") ?? by("toread") ?? by("restore");
  const skills = by("skills");
  const archive = by("archive");
  return (
    <div className="pick-bar" role="toolbar" aria-label={`Actions for ${n} picked sources`}>
      <span className="pick-n" aria-live="polite">{n} picked</span>
      {move && (
        <Hint text={move.label}>
          <button onClick={move.run}>
            {move.id === "done" ? <Check size={16} aria-hidden="true" /> : <ArrowCounterClockwise size={16} aria-hidden="true" />}
            {move.id === "done" ? "Done" : move.id === "toread" ? "To read" : "Restore"}
          </button>
        </Hint>
      )}
      {skills?.sub && (
        <MoreButton label="Skills" hint="File them under skills" className="pick-skills" actions={skills.sub} align="start"
          icon={<><GraduationCap size={16} aria-hidden="true" />Skills</>} />
      )}
      {archive && (
        <Hint text={archive.label} keys="archive">
          <button onClick={archive.run}>
            <Archive size={16} aria-hidden="true" />
            Archive
          </button>
        </Hint>
      )}
      <i className="pick-sep" aria-hidden="true" />
      <Hint text={<>Clear the pick <kbd>Esc</kbd></>}>
        <button className="pick-x" aria-label="Clear the pick" onClick={onClear}>
          <X size={16} aria-hidden="true" />
        </button>
      </Hint>
    </div>
  );
}

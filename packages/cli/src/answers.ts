// What each command's `--json` answer holds, described once: each name here is the type the library or the
// command itself builds the answer with, so a field renamed there is a type error in every screen that reads it.
// Types only. The app (apps/desktop/src/ore.ts) imports these and nothing else from here; before this file it
// kept its own copies, and one had drifted (a search hit's `item` and `snippet`).
import type {
  AnchoredAnnotation, chapterRecallFeedback, cardHistory, DiagramResult, gradeAnswer, itemCardSkills, NotesResult, QuestionView, recallFeedback, research, transcriptOf, TryView,
} from "@ore/core";
import type { Highlighted, ListedSource, ShownSource } from "./cmd-items.ts";
import type { DueRow, ShownCard, SkillStatsRow } from "./cmd-study.ts";

export type { Backlink, CardGem, Evidence, Intent, Prequestion, Priority, SearchHit, Skill, SkillColor, Strength, Today, TryLine } from "@ore/core";
export type { SessionEnd } from "./cmd-study.ts";
/** An entry returned by `ore inbox`, whether a link or a shared file. */
export type { QueuedLink as Waiting } from "@ore/core";

/** One shape for an answer built in more than one way: what every way holds, and what only some do as it may be there. */
type Any<U> = Pick<U, keyof U> & { [K in U extends unknown ? keyof U : never]?: U extends unknown ? (K extends keyof U ? U[K] : never) : never };
/** An answer without the AI stamp the command prints beside it. */
type Said<F extends (...a: never[]) => unknown> = Omit<Awaited<ReturnType<F>>, "ai">;

export type Status = ShownSource["status"];
/** A source as a list row (`ore ls`) or as the reader holds it (`ore show`). */
export type Item = Any<ListedSource | Omit<ShownSource, "body" | "annotations" | "transcript" | "audio">>;
/** `ore show`. */
export type Doc = ShownSource;
/** `ore show` on a video source: the video and each transcript word's start time, `[seconds, word]`, in body order (D49). */
export type Transcript = NonNullable<ReturnType<typeof transcriptOf>>;
/** A highlight: with where it sits in the text now (`ore show`), or as just written (`ore highlight`, `ore annotate`). */
export type Annotation = Any<AnchoredAnnotation | Highlighted>;
/** `ore tries`, `ore try`, `ore tried`. */
export type Try = TryView;
/** `ore questions`. */
export type Question = QuestionView;
/** `ore stats --skill`: one row. */
export type SkillStats = SkillStatsRow;
/** `ore research`. */
export type Research = Said<typeof research>;
/** `ore notes`; `kept_from_feed` when the line he wrote kept a Feed post as a source. */
export type Notes = NotesResult & { kept_from_feed?: boolean };
/** `ore diagram`. */
export type Diagram = DiagramResult;
/** `ore recall --feedback`, and with `--chapter`. */
export type Feedback = Said<typeof recallFeedback>;
export type ChapterFeedback = Omit<Said<typeof chapterRecallFeedback>, "item" | "chapter">;
/** `ore due`: one exercise in queue order. */
export type DueEntry = DueRow;
/** `ore card show` and `ore card set`. */
export type CardFull = Any<ShownCard>;
export type CardHistory = ReturnType<typeof cardHistory>;
/** `ore edit --skills`: each of the source's exercises and its skills before (`cards_before`), passed back as --cards for Undo. */
export type CardSkills = ReturnType<typeof itemCardSkills>;
/** `ore grade`. */
export type Grade = Awaited<ReturnType<typeof gradeAnswer>>;

import { relative } from "node:path";
import {
  reimportSource,
  undoReimport,
  readTables,
  tablesState,
  doclingHome,
  doclingPath,
  installDocling,
  removeDocling,
  cutText,
  restoreCut,
  redoCut,
  addPageText,
  hasPageText,
  undoPageText,
  redoPageText,
  enrichLogs, markEnrichSkipped, type Item, type Library,
  acceptSuggestedSkill, keepPreview, addHighlight, addPoint, backfillSource, courseCoverFile, makeCourseCover, thumbnailFile, addSnippet, addSource, addTab, addText, anchorAnnotations, AnnotationStatus, dismissSuggestedSkill, findAnnotation, findItem, Intent, isQuestionOnly, ItemStatus, ItemType, undoSuggestedSkill,
  addCourse, courseLessons, isCourseUrl, planCourse, renameCourse, setCourseArchived, setCourseSkills,
  appendNote, attachToNote, backlinks, getDiagram, getNotes, linkDiagram, newDiagram, renameDiagram, setDiagram, listItems, answerQuestion, matchQuestion, listQuestions, listTries, markTried, loadSkills, readNotes, openLibrary, setSkillLook, archiveSkill, addSkill, arrangeSkills, SkillLayoutSchema, removeSkill, restoreSkill, renameItem, setItemAuthor, setItemArchived, setItemPinned, setItemSkills, SkillColor, sourceFile, reviseAnnotation, moveHighlight, setItemStatus, markOpened, transcriptOf, setNotes, setPrequestionAttempt, stringifyFrontmatter, audioOf,
  type AnchoredAnnotation, type AnnotationPatch,
} from "@ore/core";
import type { Command } from "./types.ts";

/** What follows an add, from `ore add` or a link the iPhone queued: enrichment in the background (also for a Feed
 *  post now kept, which wasn't yet), and a PDF's tables and formulas once the optional reader is installed (D125). */
function afterAdd(lib: Library, item: Awaited<ReturnType<typeof addSource>>, noEnrich: boolean): string {
  const kept = !!item.kept;
  const enrich = noEnrich || (kept && !item.fromFeed) ? "skipped" : startEnrich(lib, item.meta.id);
  if (noEnrich && !kept) markEnrichSkipped(lib, item.meta.id);
  if (!kept && item.meta.structure?.length && doclingPath()) startTables(lib, item.meta.id);
  return enrich;
}
import { fromBase64, int, need, oneOf, progress, readStdin, str, strs, table } from "./util.ts";
import { startEnrich, startEnrichMany, startTables } from "./background.ts";
import { importQueued, queueLink, queuedLinks, removeQueuedLink } from "@ore/core";

const INTENTS = Intent.options;

/** `enrich_error`: why background enrich failed, for a source it never enriched (the reader shows it at once);
 *  `enrich_skipped`: it was added with no enrich on its way, so nothing is writing its prequestions. */
const enrichFailure = (logs: ReturnType<typeof enrichLogs>, i: Item) => (i.meta.enriched_at ? {} : logs(i.meta.id));

function annotationLine(a: AnchoredAnnotation): string {
  const where = a.anchor ? `${a.anchor.start}-${a.anchor.end}${a.anchor.method === "position" ? "" : ` (${a.anchor.method})`}` : "ORPHANED";
  const quote = a.exact.replace(/\s+/g, " ");
  return `${a.id}  ${a.intent.padEnd(8)} ${a.status.padEnd(4)} ${where}\n    "${quote.length > 100 ? quote.slice(0, 97) + "…" : quote}"${a.note ? `\n    note: ${a.note}` : ""}`;
}

/** A course's skills and the lesson to show: the first one not done (done only when all are). */
function courseNow(lib: Library, id: string) {
  const lessons = listItems(lib).filter((i) => i.meta.course?.id === id).sort((a, b) => a.meta.course!.part - b.meta.course!.part);
  const first = lessons.find((l) => l.meta.status !== "done") ?? lessons[0];
  return { skills: first?.meta.skills ?? [], first: first && { id: first.meta.id, title: first.meta.title, status: first.meta.status } };
}

/** His first highlight or note line in a Feed post keeps it as a source, and starts its enrich. */
async function keptFromFeed(lib: Library, item: Item): Promise<boolean> {
  if (!item.meta.preview || !(await keepPreview(lib, item.meta.id))) return false;
  startEnrich(lib, item.meta.id);
  return true;
}

export const itemCommands: Record<string, Command> = {
  add: {
    usage: "<url|path> | --stdin [--html] | --tab [--skill s] [--type t] [--for <question>] [--course] [--no-enrich]   ingest → items/, status inbox (--stdin: pasted text as a Markdown source, --html: the paste is HTML, its headings, tables, math, code and images kept; --tab: the page open in the frontmost Safari or Chrome window, as signed in there, D96; --for: added for a question, D75; --course: every lesson of a Claude Academy course or YouTube playlist as its own source, D79); enrich runs in background",
    options: { skill: { type: "string", multiple: true }, type: { type: "string" }, stdin: { type: "boolean" }, html: { type: "boolean" }, tab: { type: "boolean" }, for: { type: "string" }, course: { type: "boolean" }, "no-enrich": { type: "boolean" } },
    async run([input], f) {
      const lib = openLibrary();
      if (f.course) {
        const plan = await planCourse(need(input, "<url>"));
        const r = await addCourse(lib, plan, { skills: strs(f.skill), onLesson: (done, of, t) => progress(done, of, plan.title, `Adding lesson ${done + 1} of ${of}: ${t}`) });
        // One background run enriches the lessons in course order, so the AI isn't asked 14 things at once.
        const enrich = f["no-enrich"] ? "skipped" : startEnrichMany(lib, r.added.map((i) => i.meta.id));
        if (f["no-enrich"]) for (const i of r.added) markEnrichSkipped(lib, i.meta.id);
        const lessons = r.added.map((i) => ({ id: i.meta.id, title: i.meta.title, type: i.meta.type, part: i.meta.course!.part }));
        const filled = r.filled.map((i) => ({ id: i.meta.id, title: i.meta.title, part: i.meta.course!.part }));
        const failed = r.failed.map((x) => `  lesson ${x.part} (${x.title}): ${x.error}`);
        return {
          // The course as it stands (skills, first lesson), so the app can say what adding it again did.
          data: { course: r.course, lessons, kept: r.kept, filled, failed: r.failed, filed: r.filed, restored: r.restored, enrich, ...courseNow(lib, r.course.id) },
          text: [`Added ${lessons.length} lesson${lessons.length === 1 ? "" : "s"} of ${r.course.title} (${r.course.id})${r.kept ? `; ${r.kept} already here` : ""}${filled.length ? `; added the page text to ${filled.length}` : ""}`, ...(failed.length ? ["Failed (run the same command again to retry just these):", ...failed] : [])].join("\n"),
          exitCode: r.failed.length && !lessons.length ? 1 : 0,
        };
      }
      // Transcribing audio takes minutes: it reports how far it has got (the app shows it on the add bar).
      const onProgress = (done: number, label?: string) => progress(Math.round(done * 100), 100, label ?? "Transcribing the audio", label ?? `Transcribing… ${Math.round(done * 100)}%`);
      if (f.html && !f.stdin) throw new Error("--html reads a paste on stdin: give --stdin too");
      const item: Awaited<ReturnType<typeof addSource>> = f.stdin
        ? await addText(lib, await readStdin(), { skills: strs(f.skill), html: !!f.html })
        : f.tab
          ? await addTab(lib, { skills: strs(f.skill), onProgress })
          : await addSource(lib, need(input, "<url|path>"), { type: oneOf(f.type, ItemType.options, "type"), skills: strs(f.skill), onProgress });
      if (f.for) await matchQuestion(lib, item.meta.id, str(f.for)!);
      const kept = !!item.kept;
      const enrich = afterAdd(lib, item, !!f["no-enrich"]);
      const path = relative(lib.root, item.docPath);
      return {
        data: { id: item.meta.id, title: item.meta.title, type: item.meta.type, path, enrich, ...(kept ? { kept, filed: item.filed, restored: item.restored, status: item.meta.status, skills: item.meta.skills } : {}) },
        text: kept ? `Already here: ${item.meta.title} (${item.meta.id})\n  skills ${item.meta.skills.join(", ") || "none"}` : `Added: ${item.meta.title} (${item.meta.id})\n  ${item.meta.type} → ${path}\n  enrichment ${enrich}`,
      };
    },
  },

  inbox: {
    usage: "[--add <url> [--skill s]] [--remove <id>] [--import]   links added on the iPhone, waiting for the Mac to import them (D223): --add queues one (the phone), --import adds each with the whole import and enrichment (the Mac), --remove drops one; with none, lists them",
    options: { add: { type: "string" }, skill: { type: "string", multiple: true }, remove: { type: "string" }, import: { type: "boolean" } },
    async run(_, f) {
      const lib = openLibrary();
      if (f.add !== undefined) {
        const l = queueLink(lib, str(f.add) ?? "", strs(f.skill));
        return { data: l, text: `Waiting for your Mac: ${l.url}` };
      }
      if (f.remove !== undefined) {
        removeQueuedLink(lib, need(str(f.remove), "<id>"));
        return { data: queuedLinks(lib), text: "Removed" };
      }
      if (f.import) {
        const r = await importQueued(lib, async (url, skills) => {
          const item = await addSource(lib, url, { skills });
          afterAdd(lib, item, false);
          return { id: item.meta.id, title: item.meta.title, kept: !!item.kept };
        });
        return { data: r, text: [`Added ${r.added.length} from the iPhone`, ...r.failed.map((l) => `  ${l.url}: ${l.error}`)].join("\n") };
      }
      const all = queuedLinks(lib);
      return { data: all, text: all.length ? table(all.map((l) => [l.id, l.url, l.error ?? "waiting"])) : "Nothing waiting" };
    },
  },

  course: {
    usage: "preview <url> | set <course> [--title t] [--skills a,b] | archive <course> [--undo] | lessons <course>   a course (D79): read a course link's lessons without adding them, rename it or file every lesson under these skills, archive every lesson, or list its lessons in order",
    options: { title: { type: "string" }, skills: { type: "string" }, undo: { type: "boolean" } },
    async run([sub, ref], f) {
      if (!["preview", "set", "archive", "lessons"].includes(sub ?? "")) throw new Error("give preview, set, archive or lessons");
      const lib = openLibrary();
      if (sub === "preview") {
        const url = need(ref, "<url>");
        if (!isCourseUrl(url)) throw new Error("That link isn’t a course Ore can read (a Claude Academy course or a YouTube playlist).");
        const plan = await planCourse(url);
        return { data: plan, text: [`${plan.title} · ${plan.lessons.length} lessons`, ...plan.lessons.map((l, i) => `  ${i + 1}. ${l.title}${l.video ? " (video)" : ""}`)].join("\n") };
      }
      const id = need(ref, "<course>");
      const out = (lessons: Item[]) => lessons.map((l) => ({ id: l.meta.id, title: l.meta.title, part: l.meta.course!.part, status: l.meta.status, archived: !!l.meta.archived_at }));
      if (sub === "lessons") {
        const lessons = courseLessons(lib, id, { archived: true });
        return { data: out(lessons), text: table(lessons.map((l) => [String(l.meta.course!.part), l.meta.status, l.meta.title])) };
      }
      if (sub === "set") {
        if (f.title === undefined && f.skills === undefined) throw new Error("nothing to change (--title or --skills)");
        let lessons = f.title !== undefined ? await renameCourse(lib, id, str(f.title) ?? "") : courseLessons(lib, id, { archived: true });
        if (f.skills !== undefined) lessons = await setCourseSkills(lib, id, strs(f.skills));
        return { data: out(lessons), text: `${lessons[0]!.meta.course!.title}: ${lessons.length} lessons under ${lessons[0]!.meta.skills.join(", ") || "no skill"}` };
      }
      if (sub === "archive") {
        const n = await setCourseArchived(lib, id, !f.undo);
        return { data: { course: id, changed: n }, text: `${f.undo ? "Restored" : "Archived"} ${n} lessons` };
      }
      throw new Error("give preview, set, archive or lessons");
    },
  },

  snippet: {
    usage: "--text <t> | --stdin [--url] [--app] [--intent] [--note] [--skill s] [--no-enrich]   capture a selection as a snippet item + annotation; enrich runs in background",
    options: {
      text: { type: "string" }, stdin: { type: "boolean" }, url: { type: "string" }, app: { type: "string" },
      intent: { type: "string" }, note: { type: "string" }, skill: { type: "string", multiple: true }, "no-enrich": { type: "boolean" },
    },
    async run(_, f) {
      const lib = openLibrary();
      const text = f.stdin ? await readStdin() : need(str(f.text), "--text or --stdin");
      const { item, annotation } = await addSnippet(lib, {
        text, url: str(f.url), app: str(f.app), intent: oneOf(f.intent, INTENTS, "intent"), note: str(f.note), skills: strs(f.skill),
      });
      const enrich = f["no-enrich"] ? "skipped" : startEnrich(lib, item.meta.id);
      if (f["no-enrich"]) markEnrichSkipped(lib, item.meta.id);
      return {
        data: { id: item.meta.id, title: item.meta.title, path: relative(lib.root, item.docPath), annotation, enrich },
        text: `Snippet ${item.meta.id} (${annotation.intent}) — annotation ${annotation.id}; enrichment ${enrich}`,
      };
    },
  },

  ls: {
    usage: "[--status s] [--skill s] [--topic t] [--archived]   --archived lists only archived sources",
    options: { status: { type: "string" }, skill: { type: "string" }, topic: { type: "string" }, archived: { type: "boolean" } },
    async run(_, f) {
      const lib = openLibrary();
      const status = oneOf(f.status, ItemStatus.options, "status");
      const items = listItems(lib, { archived: !!f.archived }).filter(
        (i) => !isQuestionOnly(i) && (!status || i.meta.status === status) && (!f.skill || i.meta.skills.includes(f.skill as string)) && (!f.topic || i.meta.topics.includes(f.topic as string)),
      );
      const logs = enrichLogs(lib);
      const data = items.map((i) => ({ ...i.meta, path: relative(lib.root, i.docPath), dir: i.dir, source_file: sourceFile(i), thumbnail: thumbnailFile(i), course_cover: i.meta.course ? courseCoverFile(i) : undefined, has_notes: readNotes(i).trim() !== "", ...enrichFailure(logs, i) }));
      const text = items.length
        ? table(items.map((i) => [i.meta.id, i.meta.status, i.meta.type, i.meta.enriched_at ? "enriched" : "-", i.meta.title]))
        : f.archived ? "No archived sources." : status || f.skill || f.topic ? "No sources match."
          : listItems(lib, { archived: true }).some((i) => !isQuestionOnly(i)) ? "No sources outside the archive. `ore ls --archived` lists them."
          : "No sources yet. Add one with `ore add <url|path>`.";
      return { data, text };
    },
  },

  backfill: {
    usage: "[item]                 fill in sources' missing thumbnails (and PDF authors), and courses' covers; all sources without an item",
    async run([ref]) {
      const lib = openLibrary();
      const items = ref ? [findItem(lib, ref)] : listItems(lib).filter((i) => !thumbnailFile(i) || (!i.meta.author && i.meta.type === "pdf"));
      const data = [];
      for (const item of items) data.push({ id: item.meta.id, title: item.meta.title, ...(await backfillSource(lib, item)) });
      const made = data.filter((d) => d.thumbnail).length;
      // A course's cover (its page's picture), once per course that has none.
      const courses = new Map<string, Item[]>();
      if (!ref) for (const i of listItems(lib)) if (i.meta.course?.url) courses.set(i.meta.course.id, [...(courses.get(i.meta.course.id) ?? []), i]);
      let covers = 0;
      for (const lessons of courses.values()) {
        if (lessons.some(courseCoverFile)) continue;
        const first = lessons.sort((a, b) => a.meta.course!.part - b.meta.course!.part)[0]!;
        covers += Number(!!(await makeCourseCover(first, first.meta.course!.url!)));
      }
      return { data, text: `${made} of ${data.length} sources have a thumbnail now${covers ? `; ${covers} course cover${covers > 1 ? "s" : ""} added` : ""}` };
    },
  },

  show: {
    usage: "<item> [--annotations]       frontmatter + body, or annotations with anchor status",
    options: { annotations: { type: "boolean" } },
    async run([ref], f) {
      const lib = openLibrary();
      const item = findItem(lib, need(ref, "<item>"));
      const annotations = anchorAnnotations(item);
      const data = {
        ...item.meta, prequestions: item.meta.prequestions ?? [], path: relative(lib.root, item.docPath), dir: item.dir, source_file: sourceFile(item), thumbnail: thumbnailFile(item), ...enrichFailure(enrichLogs(lib), item), ...tablesState(lib, item),
        body: item.body, annotations,
        ...((item.meta.type === "youtube" || item.meta.video) && { transcript: transcriptOf(item) }),
        ...(item.meta.type !== "youtube" && !item.meta.video && { audio: audioOf(item) ?? undefined }),
        ...(hasPageText(item) && { page_text: true }),
      };
      const text = f.annotations
        ? annotations.map(annotationLine).join("\n") || "No annotations."
        : stringifyFrontmatter(item.meta, item.body);
      return { data, text };
    },
  },

  highlight: {
    usage: '<item> --exact "<text>" --intent keep|card|question|apply [--note n] [--start N] | <item> --at N --note "<line>" [--intent card|question]   --at: a card (or question) from a line he typed with nothing selected, anchored at the sentence around offset N',
    options: { exact: { type: "string" }, intent: { type: "string" }, note: { type: "string" }, start: { type: "string" }, at: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const item = findItem(lib, need(ref, "<item>"));
      const at = int(f.at, "at");
      const a = at !== undefined
        ? addPoint(item, { at, note: need(str(f.note), "--note"), intent: oneOf(f.intent ?? "card", ["card", "question"] as const, "intent")! })
        : addHighlight(item, {
          exact: need(str(f.exact), "--exact"),
          intent: need(oneOf(f.intent, INTENTS, "intent"), "--intent"),
          note: str(f.note),
          start: int(f.start, "start"),
        });
      const kept = await keptFromFeed(lib, item);
      return { data: { ...a, ...(kept ? { kept_from_feed: true } : {}) }, text: `Highlight ${a.id} (${a.intent}) at ${a.start}-${a.end}${kept ? "\nKept from the Feed as a source" : ""}` };
    },
  },

  annotate: {
    usage: '<annotation> [--note n] [--intent i] [--status open|done|deleted] [--exact "<text>" [--start N]]   appends a new rev; deleted hides the highlight; --exact moves its passage (edges dragged)',
    options: { note: { type: "string" }, intent: { type: "string" }, status: { type: "string" }, exact: { type: "string" }, start: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const found = findAnnotation(lib, need(ref, "<annotation>"));
      const { item } = found;
      let annotation = found.annotation;
      if (f.exact !== undefined) annotation = moveHighlight(item, annotation, need(str(f.exact), "--exact"), int(f.start, "start"));
      const patch: AnnotationPatch = {};
      if (f.note !== undefined) patch.note = str(f.note) || undefined;
      if (f.intent !== undefined) patch.intent = oneOf(f.intent, INTENTS, "intent");
      if (f.status !== undefined) patch.status = oneOf(f.status, AnnotationStatus.options, "status");
      if (!Object.keys(patch).length) {
        if (f.exact !== undefined) return { data: annotation, text: `Annotation ${annotation.id} rev ${annotation.rev}` };
        throw new Error("nothing to change (--note, --intent, --status or --exact)");
      }
      const next = reviseAnnotation(item, annotation, patch);
      return { data: next, text: `Annotation ${next.id} rev ${next.rev}` };
    },
  },

  questions: {
    usage: "[--skill s | --item <source>]   his questions (D47, D75), open first, with his answer so far and the sources that may answer them; --item: the ones that source is read for",
    options: { skill: { type: "string" }, item: { type: "string" } },
    async run(_, f) {
      const lib = openLibrary();
      if (f.skill && !loadSkills(lib).skills.some((s) => s.id === f.skill)) throw new Error(`unknown skill "${f.skill}"`);
      const data = listQuestions(lib, { skill: str(f.skill), item: str(f.item) });
      const text = data.length
        ? data
            .map((q) =>
              [
                `${q.id}  ${q.status === "done" ? "answered" : "open    "}  ${q.item_title}${q.here ? `  (${q.here})` : ""}`,
                `    "${q.exact.replace(/\s+/g, " ")}"`,
                ...(q.note ? [`    note: ${q.note}`] : []),
                ...q.answers.map((c) => `    answer: ${c.text}${c.item_title ? ` (from ${c.item_title})` : ""}`),
                ...q.matches.map((m) => `    may answer: ${m.title}${m.quote ? ` "${m.quote}"` : ""}`),
              ].join("\n"),
            )
            .join("\n")
        : "No questions.";
      return { data, text };
    },
  },

  answer: {
    usage: '<question> [--text "<his words>" [--item <source>] [--quote "<passage>"]] [--done | --card] [--remove <ts> | --edit <ts> --text "<new words>"]   add to his answer (D75), or rewrite or remove one piece of it; --done closes it, --card closes it and drafts a card from his answer in the background',
    options: { text: { type: "string" }, item: { type: "string" }, quote: { type: "string" }, done: { type: "boolean" }, card: { type: "boolean" }, remove: { type: "string" }, edit: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const { question, item } = await answerQuestion(lib, need(ref, "<question>"), { text: str(f.text), item: str(f.item), quote: str(f.quote), done: !!f.done, card: !!f.card, remove: str(f.remove), edit: str(f.edit) });
      const enrich = f.card ? startEnrich(lib, item.meta.id) : "skipped";
      return { data: { ...question, enrich }, text: `Question ${question.id}: ${question.status === "done" ? "answered" : "open"}, ${question.answers?.length ?? 0} contribution(s)${f.card ? `; card draft ${enrich}` : ""}` };
    },
  },

  tries: {
    usage: "[--skill s]   techniques he plans to try on his own work (Apply highlights, D127), to try first, with his plan and, once tried, how it went",
    options: { skill: { type: "string" } },
    async run(_, f) {
      const lib = openLibrary();
      if (f.skill && !loadSkills(lib).skills.some((s) => s.id === f.skill)) throw new Error(`unknown skill "${f.skill}"`);
      const data = listTries(lib, { skill: str(f.skill) });
      const text = data.length
        ? data
            .map((t) =>
              [
                `${t.id}  ${t.status === "done" ? "tried " : "to try"}  ${t.item_title}`,
                `    "${t.exact.replace(/\s+/g, " ")}"`,
                ...(t.note ? [`    plan: ${t.note}`] : []),
                ...(t.uses ?? []).map((u) => `    used: ${u.plan ?? "(no plan)"}${u.reflection ? ` → ${u.reflection}` : ""}`),
                ...(t.reflection ? [`    how it went: ${t.reflection}`] : []),
              ].join("\n"),
            )
            .join("\n")
        : "Nothing to try.";
      return { data, text };
    },
  },

  tried: {
    usage: '<try> [--text "<how it went>"] [--next "<plan>"] [--undo]   check off a try (D127); with --text, a card is drafted from how it went in the background; --next "Next time I\'ll…" (D148) keeps the round and opens the try again with that plan; --undo steps back',
    options: { text: { type: "string" }, next: { type: "string" }, undo: { type: "boolean" } },
    async run([ref], f) {
      const lib = openLibrary();
      const { tried, item, card } = await markTried(lib, need(ref, "<try>"), { reflection: str(f.text), next: str(f.next), undo: !!f.undo });
      const enrich = card ? startEnrich(lib, item.meta.id) : "skipped";
      return { data: { ...tried, enrich }, text: `Try ${tried.id}: ${tried.status === "done" ? "tried" : "to try"}${card ? `; card draft ${enrich}` : ""}` };
    },
  },

  match: {
    usage: "<source> <question> [--drop]   mark a source as one that may answer a question (D75); --drop: not answered here",
    options: { drop: { type: "boolean" } },
    async run([source, question], f) {
      const lib = openLibrary();
      const meta = await matchQuestion(lib, need(source, "<source>"), need(question, "<question>"), { drop: !!f.drop });
      return { data: meta.question_matches ?? [], text: f.drop ? "Dropped." : "Matched." };
    },
  },

  notes: {
    usage: '<item> | --skill <s>  [--set "<text>" [--base "<text it was edited from>"] | --append "<text>" --heading "<h>" | --attach <image> | --attach - --ext <png|jpg|…>]   Source note (notes.md) or a skill note: print, replace (with --base, merges changes made to the file since), append under a heading (skipped if already present), or copy an image into images/ beside it (--attach -: the image bytes in base64 on stdin, as pasted)',
    options: { skill: { type: "string" }, set: { type: "string" }, append: { type: "string" }, heading: { type: "string" }, attach: { type: "string" }, ext: { type: "string" }, base: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const skill = str(f.skill);
      if (skill && ref) throw new Error("give an <item> or --skill, not both");
      const note = skill ? { skill } : need(ref, "<item> or --skill");
      if ([f.set, f.append, f.attach].filter((v) => v !== undefined).length > 1) throw new Error("give at most one of --set, --append or --attach");
      if ((f.heading !== undefined) !== (f.append !== undefined)) throw new Error("--append and --heading go together");
      if (f.base !== undefined && f.set === undefined) throw new Error("--base goes with --set");
      if (f.attach !== undefined) {
        const path = need(str(f.attach), "--attach");
        const r = await attachToNote(lib, note, path === "-" ? { ext: need(str(f.ext), "--ext"), data: fromBase64(await readStdin()) } : path);
        return { data: r, text: `Copied to ${r.attached} (beside ${r.path})` };
      }
      const r0 =
        f.set !== undefined ? await setNotes(lib, note, str(f.set) ?? "", f.base === undefined ? undefined : (str(f.base) ?? ""))
        : f.append !== undefined ? await appendNote(lib, note, str(f.append) ?? "", str(f.heading) ?? "")
        : getNotes(lib, note);
      // A line in a Feed post's note keeps the post (an emptied note doesn't).
      const kept = typeof note === "string" && (f.set !== undefined || f.append !== undefined) && r0.text.trim() !== "" && (await keptFromFeed(lib, findItem(lib, note)));
      const r = kept ? { ...r0, kept_from_feed: true } : r0;
      return { data: r, text: f.set !== undefined || f.append !== undefined ? `Saved ${r.path}` : r.text || "No notes yet." };
    },
  },

  backlinks: {
    usage: "<item> | --skill <s>   notes that link here (D39): the linking note, the heading above the link, and its line",
    options: { skill: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const skill = str(f.skill);
      const target = skill ? { kind: "skill" as const, id: skill } : { kind: "item" as const, id: findItem(lib, need(ref, "<item> or --skill")).meta.id };
      const links = backlinks(lib, target);
      const text = links.length ? links.map((l) => `${l.from.title}${l.heading ? ` › ${l.heading}` : ""}\n    ${l.line}`).join("\n") : "No links here yet.";
      return { data: links, text };
    },
  },

  diagram: {
    usage: "<item> <name> | --skill <s> <name>  [--set | --rename <new> [--follow-link] | --link] | <item> --new   diagrams/<name>.excalidraw beside the source note or a skill note: print, or replace with an Excalidraw scene read from stdin; --new picks a free name (writes nothing); --rename <new> renames the file (change the note's link yourself; --follow-link: the note already links <new>, as after an undo); --link adds a link to it at the end of the note unless it has one",
    options: { skill: { type: "string" }, set: { type: "boolean" }, new: { type: "boolean" }, rename: { type: "string" }, "follow-link": { type: "boolean" }, link: { type: "boolean" } },
    async run(args, f) {
      const lib = openLibrary();
      const skill = str(f.skill);
      const note = skill ? { skill } : need(args.shift(), "<item> or --skill");
      if (f.new) {
        const r = newDiagram(lib, note);
        return { data: r, text: r.name };
      }
      const name = need(args[0], "<name>");
      const to = str(f.rename);
      if (to) {
        const r = await renameDiagram(lib, note, name, to, { followLink: !!f["follow-link"] });
        return { data: r, text: `Renamed to ${r.path}` };
      }
      if (f.link) {
        const r = await linkDiagram(lib, note, name);
        return { data: r, text: `Linked in ${r.path}` };
      }
      const r = f.set ? await setDiagram(lib, note, name, await readStdin()) : getDiagram(lib, note, name);
      return { data: r, text: f.set ? `Saved ${r.path}` : r.scene ? JSON.stringify(r.scene) : "No diagram yet." };
    },
  },

  prequestion: {
    usage: '<item> <n> --before "<text>" | --after "<text>" [--confidence 1-3]   record an attempt before reading / closed-book at finish ("no idea" is fine; confidence 1 guess, 2 think so, 3 sure)',
    options: { before: { type: "string" }, after: { type: "string" }, confidence: { type: "string" } },
    async run([ref, nArg], f) {
      const lib = openLibrary();
      const item = need(ref, "<item>");
      const n = Number(need(nArg, "<n>"));
      if (!Number.isInteger(n)) throw new Error("<n> must be an integer");
      const r = await setPrequestionAttempt(lib, item, n, { before: str(f.before), after: str(f.after), confidence: int(f.confidence, "confidence") });
      return { data: r, text: `${n}. ${r.q}${r.before !== undefined ? `\n  before: ${r.before}` : ""}${r.after !== undefined ? `\n  after: ${r.after}` : ""}` };
    },
  },

  status: {
    usage: "<item> inbox|reading|done [--at <iso>]   set reading status (done records finished_at; --at puts back an earlier one)",
    options: { at: { type: "string" } },
    async run([ref, status], f) {
      const lib = openLibrary();
      const id = findItem(lib, need(ref, "<item>")).meta.id;
      const s = need(oneOf(status, ItemStatus.options, "<status>"), "<status> (inbox|reading|done)");
      const meta = await setItemStatus(lib, id, s, str(f.at));
      return { data: meta, text: `${meta.title}: ${meta.status}` };
    },
  },

  opened: {
    usage: "<item>   he opened it: starts it (inbox → reading) and records when, for To read's order",
    async run([ref]) {
      const lib = openLibrary();
      const meta = await markOpened(lib, findItem(lib, need(ref, "<item>")).meta.id);
      return { data: meta, text: `${meta.title}: opened` };
    },
  },

  edit: {
    usage: '<item> [--title "<t>"] [--author "<a>"] [--skills a,b]   rename a source, set its author ("" clears it), or file it under exactly these skills ("" for none; its cards follow)',
    options: { title: { type: "string" }, author: { type: "string" }, skills: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const id = findItem(lib, need(ref, "<item>")).meta.id;
      if (f.title === undefined && f.author === undefined && f.skills === undefined) throw new Error("nothing to change (--title, --author or --skills)");
      let meta = f.title !== undefined ? await renameItem(lib, id, str(f.title) ?? "") : findItem(lib, id).meta;
      if (f.author !== undefined) meta = await setItemAuthor(lib, id, str(f.author) ?? "");
      if (f.skills !== undefined) meta = await setItemSkills(lib, id, strs(f.skills));
      return { data: meta, text: `${meta.title}${meta.skills.length ? ` (${meta.skills.join(", ")})` : ""}` };
    },
  },

  pin: {
    usage: "<item> [--at <iso time>] [--undo]   list a source first, under Pinned; --at sets its place among the pinned (they list by that time); --undo unpins it",
    options: { undo: { type: "boolean" }, at: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const meta = await setItemPinned(lib, findItem(lib, need(ref, "<item>")).meta.id, !f.undo, str(f.at));
      return { data: meta, text: `${meta.pinned_at ? "Pinned" : "Unpinned"} ${meta.title}` };
    },
  },

  archive: {
    usage: "<item> [--undo]   hide a source from lists and search (files and cards kept); --undo brings it back",
    options: { undo: { type: "boolean" } },
    async run([ref], f) {
      const lib = openLibrary();
      const meta = await setItemArchived(lib, findItem(lib, need(ref, "<item>")).meta.id, !f.undo);
      return { data: meta, text: `${meta.archived_at ? "Archived" : "Restored"} ${meta.title}` };
    },
  },

  reimport: {
    usage: "<item> [--undo]   fetch a source's original again and update it in place: highlights re-anchor, ones whose passage is gone are removed (questions and cards stay); --undo puts the old version back, again redoes",
    options: { undo: { type: "boolean" } },
    async run([ref], f) {
      const lib = openLibrary();
      const id = findItem(lib, need(ref, "<item>")).meta.id;
      if (f.undo) {
        const item = await undoReimport(lib, id);
        return { data: { id, title: item.meta.title }, text: `Put back the previous version of ${item.meta.title}` };
      }
      const r = await reimportSource(lib, id);
      const data = { id, title: r.item.meta.title, changed: r.changed, moved: r.moved, removed: r.removed.map((a) => ({ id: a.id, exact: a.exact, intent: a.intent })) };
      const text = !r.changed ? `${r.item.meta.title} is up to date` : `Reimported ${r.item.meta.title}${r.removed.length ? `; removed ${r.removed.length} highlight(s) no longer in it` : ""}`;
      return { data, text };
    },
  },

  tables: {
    usage: "<item> [--status] | --install | --remove | --status   read a PDF's tables and display formulas with Docling and put them in its text in place of their lines; highlights stay (D125). Docling is an optional download of about 2 GB: --install gets it, --remove deletes it, --status says whether it is here. Undo with `ore reimport <item> --undo`",
    options: { install: { type: "boolean" }, remove: { type: "boolean" }, status: { type: "boolean" } },
    async run([ref], f) {
      if (f.status && ref) {
        // One PDF's tables: being read, read, or why the last reading failed (the reader waits on this).
        const lib = openLibrary();
        return { data: tablesState(lib, findItem(lib, ref)), text: "" };
      }
      if (f.status) {
        const installed = !!doclingPath();
        return { data: { installed, path: installed ? doclingHome() : undefined }, text: installed ? `The table and formula reader is installed (${doclingHome()})` : "The table and formula reader isn't installed. Get it with `ore tables --install`." };
      }
      if (f.remove) {
        await removeDocling();
        return { data: { installed: false }, text: "Removed the table and formula reader" };
      }
      if (f.install) {
        const home = await installDocling((done, of, label) => progress(done - 1, of, label, `${label}… (${done} of ${of})`));
        return { data: { installed: true, path: home }, text: `Installed the table and formula reader (${home})` };
      }
      const lib = openLibrary();
      const r = await readTables(lib, findItem(lib, need(ref, "<item>")).meta.id);
      const data = { id: r.item.meta.id, title: r.item.meta.title, changed: r.changed, regions: r.regions, moved: r.moved, removed: r.removed.map((a) => ({ id: a.id, exact: a.exact, intent: a.intent })) };
      return { data, text: !r.changed ? `Found no tables or formulas to add in ${r.item.meta.title}` : `Read ${r.regions} table(s) and formula(s) into ${r.item.meta.title}` };
    },
  },

  cut: {
    usage: "<item> --from N --to M [--section] | <item> --undo|--redo <cut-id>   remove junk from a source's text: every block the body offsets [N, M) touch, or with --section the heading at N and all under it; highlights after it shift, ones inside it go (cards and questions stay); --undo <cut-id> puts it back, --redo takes it out again",
    options: { from: { type: "string" }, to: { type: "string" }, section: { type: "boolean" }, undo: { type: "string" }, redo: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const id = findItem(lib, need(ref, "<item>")).meta.id;
      if (f.undo) {
        const item = await restoreCut(lib, id, str(f.undo)!);
        return { data: { id, title: item.meta.title }, text: `Put the removed text back in ${item.meta.title}` };
      }
      if (f.redo) {
        const c = await redoCut(lib, id, str(f.redo)!);
        return { data: { id: c.id, item: id, removed: c.removed.length }, text: `Removed the same text again` };
      }
      const from = int(need(str(f.from), "--from"), "from")!;
      const c = await cutText(lib, id, from, int(f.to, "to") ?? from, { section: !!f.section });
      const words = c.text.split(/\s+/).filter(Boolean).length;
      const data = { id: c.id, item: id, at: c.at, words, section: c.section, removed: c.removed.map((a) => ({ id: a.id, exact: a.exact, intent: a.intent })) };
      return { data, text: `Removed ${words} word(s)${c.removed.length ? ` and ${c.removed.length} highlight(s)` : ""}; undo with ore cut ${id} --undo ${c.id}` };
    },
  },

  "page-text": {
    usage: "<item> | <item> --undo|--redo <cut-id>   add an episode's own page text below its transcript (D215), from the page kept beside it (page.html): headings, links, images; highlights stay where they are; --undo <cut-id> takes it out again, --redo puts it back",
    options: { undo: { type: "string" }, redo: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const id = findItem(lib, need(ref, "<item>")).meta.id;
      if (f.undo) {
        const c = await undoPageText(lib, id, str(f.undo)!);
        return { data: { id: c.id, item: id, removed: c.removed.length }, text: "Took the page’s text out again" };
      }
      if (f.redo) {
        const item = await redoPageText(lib, id, str(f.redo)!);
        return { data: { id, title: item.meta.title }, text: `Put the page’s text back in ${item.meta.title}` };
      }
      const c = await addPageText(lib, id);
      const words = c.text.split(/\s+/).filter(Boolean).length;
      return { data: { id: c.id, item: id, words }, text: `Added the page’s text (${words} words); undo with ore page-text ${id} --undo ${c.id}` };
    },
  },

  skills: {
    usage: `[add <name> [--collection c] | rm <skill> [--archive] | restore '<json from rm>' | set <skill> [--name n] [--priority P1|P2|P3] [--icon mc:name] [--color ${SkillColor.options.join("|")}] [--collection c] [--hook "why I'm learning this"] [--goal "what I could show I can do"] | archive <skill> [--undo] | arrange '[{"collection":"Work","skills":["ai"]},{"collection":"","skills":[...]}]']   list skills, add one (Light, P3), delete one (untags its sources and cards, which stay; --archive also archives sources filed only under it), undo a delete (restore takes the "removed" that rm printed with --json), rename one, set its importance (P1 Focus, P2 Normal, P3 Light) or how it looks ("" clears), archive one (out of the sidebar's list, review, Home and enrich; --undo brings it back), or lay out the sidebar (collections and skills in order, every skill once)`,
    options: { archive: { type: "boolean" }, undo: { type: "boolean" }, priority: { type: "string" }, name: { type: "string" }, icon: { type: "string" }, color: { type: "string" }, collection: { type: "string" }, hook: { type: "string" }, goal: { type: "string" } },
    async run([sub, id], f) {
      const lib = openLibrary();
      if (sub === "set") {
        const skill = await setSkillLook(lib, need(id, "<skill>"), { name: str(f.name), priority: str(f.priority), icon: str(f.icon), color: str(f.color), collection: str(f.collection), hook: str(f.hook), goal: str(f.goal) });
        return { data: skill, text: `${skill.name}: ${[skill.icon, skill.color, skill.collection].filter(Boolean).join(", ") || "plain"}` };
      }
      if (sub === "add") {
        const skill = await addSkill(lib, need(id, "<name>"), str(f.collection));
        return { data: skill, text: `Added skill ${skill.name} (${skill.id})` };
      }
      if (sub === "archive") {
        const skill = await archiveSkill(lib, need(id, "<skill>"), !f.undo);
        return { data: skill, text: `${skill.archived ? "Archived" : "Brought back"} skill ${skill.name}` };
      }
      if (sub === "rm") {
        const r = await removeSkill(lib, need(id, "<skill>"), { archive: !!f.archive });
        return { data: r, text: `Deleted skill ${r.skill.name}: untagged ${r.untagged} sources${r.archived ? `, archived ${r.archived}` : ""}` };
      }
      if (sub === "restore") {
        const skill = await restoreSkill(lib, JSON.parse(need(id, "<json from rm>")));
        return { data: skill, text: `Restored skill ${skill.name}` };
      }
      if (sub === "arrange") {
        const skills = await arrangeSkills(lib, SkillLayoutSchema.parse(JSON.parse(need(id, "<layout json>"))));
        return { data: skills, text: `Arranged ${skills.length} skills` };
      }
      if (sub) throw new Error(`unknown subcommand "${sub}" (add|rm|restore|set|archive|arrange)`);
      const { skills } = loadSkills(lib);
      return { data: skills, text: table(skills.map((s) => [s.id, s.priority, s.icon ?? "", s.collection ?? "", s.name])) };
    },
  },

  "suggested-skill": {
    usage: "<item> accept|dismiss|undo <json>   accept creates the skill enrich suggested (if new, Light: P3; an archived one comes back) and files the item, its cards and topics under it; undo takes back an accept (its `undo`) or a dismiss ({\"suggestion\":…})",
    async run([ref, action, json]) {
      const lib = openLibrary();
      need(ref, "<item>");
      const a = need(oneOf(action, ["accept", "dismiss", "undo"] as const, "<action>"), "accept|dismiss|undo");
      if (a === "undo") {
        const meta = await undoSuggestedSkill(lib, need(ref, "<item>"), JSON.parse(need(json, "<json>")));
        return { data: meta, text: `${meta.title}: suggests ${meta.suggested_skill!.name} again` };
      }
      if (a === "dismiss") {
        const meta = await dismissSuggestedSkill(lib, need(ref, "<item>"));
        return { data: meta, text: `${meta.title}: suggestion dismissed` };
      }
      const r = await acceptSuggestedSkill(lib, need(ref, "<item>"));
      return { data: r, text: `${r.created ? "Created" : "Using"} skill ${r.skill.name} (${r.skill.id}); ${r.item.title} filed under it` };
    },
  },
};

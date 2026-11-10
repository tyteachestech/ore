import {
  catchUpItems, markCatchUp, optimize, optimizeDue, chapterRecallFeedback, checkPrequestion, enrichItem, setCovered, scopeFinish, writeKeyPoints, gradeAnswer, askAboutCard, askLibrary, type AskTurn, tutor, withSteps, addTutorCard, type TutorTurn, type TutorProgress, explainTerm, openLibrary, listChats, readChat, saveChat, deleteChat, attachToChat, pendingItems, recallFeedback, research, setChapterRecall, setRecall, type EnrichResult,
} from "@ore/core";
import type { Command } from "./types.ts";
import { int, need, readStdin, str, strs } from "./util.ts";

function enrichText(r: EnrichResult): string {
  if (r.skipped) return `${r.title}: skipped (${r.skipped})`;
  const lines = [`${r.title} (${r.item})`, `  skills: ${r.skills.join(", ")}`, `  topics: ${r.topics.join(", ")}${r.topics_created.length ? ` (new: ${r.topics_created.join(", ")})` : ""}`, "  prequestions:", ...r.prequestions.map((q, i) => `    ${i + 1}. ${q}`)];
  if (r.cards.length) {
    lines.push(`  drafts (${r.cards.length}):`);
    for (const c of r.cards) {
      lines.push(`    ${c.id}  ${c.kind}/${c.content_type}${c.from === "notes" ? " (from your notes)" : c.from === "prequestion" ? ` (from prequestion ${c.prequestion})` : ""}`, `      Q: ${c.question}`, `      A: ${c.answer.replace(/\n/g, " ")}`);
      for (const b of c.rubric) lines.push(`      - ${b}`);
    }
  }
  if (r.ai) lines.push(`  ai: ${r.ai.vendor} ${r.ai.model} ${r.ai.prompt_version}`);
  return lines.join("\n");
}

export const aiCommands: Record<string, Command> = {
  enrich: {
    usage: "[item...|--all-pending]          AI: prequestions, skills, topics, drafts from Card highlights, changed the source note and (once done) prequestions; several items run one after another",
    options: { "all-pending": { type: "boolean" } },
    async run(refs, f) {
      const lib = openLibrary();
      if (!refs.length && !f["all-pending"]) throw new Error("give an item id or --all-pending");
      const many = f["all-pending"] || refs.length > 1;
      const targets = f["all-pending"] ? pendingItems(lib).map((i) => i.meta.id) : refs;
      const results: (EnrichResult | { item: string; error: string })[] = [];
      for (const id of targets) {
        try {
          results.push(await enrichItem(lib, id));
        } catch (e) {
          if (!many) throw e;
          results.push({ item: id, error: (e as Error).message });
        }
      }
      const failed = results.filter((r) => "error" in r).length;
      const text = results.length
        ? results.map((r) => ("error" in r ? `${r.item}: FAILED ${r.error}` : enrichText(r))).join("\n\n")
        : "Nothing pending.";
      return { data: many ? results : results[0], text, exitCode: failed ? 1 : 0 };
    },
  },

  "catch-up": {
    usage: "                             the daily catch-up (D8, D10): enrich what is pending (not sources added in the last hour), which plans cards from the highlights of sources still being read once they are six hours old (D180), then refit FSRS when a month old; started in the background once a day",
    async run() {
      const lib = openLibrary();
      markCatchUp(lib);
      const ids = catchUpItems(lib).map((i) => i.meta.id);
      let failed = 0;
      for (const id of ids) {
        try {
          await enrichItem(lib, id);
        } catch (e) {
          failed++;
          console.error(`${id}: ${(e as Error).message}`);
        }
      }
      // A build without the optimizer (the release app) keeps the standard schedule.
      const opt = optimizeDue(lib) ? await optimize(lib).catch(() => null) : null;
      return {
        data: { enriched: ids.length - failed, failed, optimized: !!opt?.optimized },
        text: `Enriched ${ids.length - failed} of ${ids.length}${opt?.optimized ? "; FSRS parameters refit" : ""}`,
        exitCode: failed ? 1 : 0,
      };
    },
  },

  grade: {
    usage: '<card> --answer "<text>" [--variant v]   AI proposes a rating against the rubric (does not log); --variant grades the remixed version shown',
    options: { answer: { type: "string" }, variant: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const r = await gradeAnswer(lib, need(ref, "<card>"), need(str(f.answer), "--answer"), str(f.variant));
      const text = [`Proposed rating: ${r.rating}`, ...(r.gaps.length ? ["Gaps:", ...r.gaps.map((g) => `  - ${g}`)] : ["Gaps: none"]), `Feedback: ${r.feedback}`, `(${r.ai.vendor} ${r.ai.model} ${r.ai.prompt_version})`].join("\n");
      return { data: r, text };
    },
  },

  ask: {
    usage: '<card> --message "<text>" [--answer "<his answer>"] [--session id] [--variant v]   Ask about this (D61): a chat turn about a card he has answered; may propose a better card (apply with card set)',
    options: { message: { type: "string" }, answer: { type: "string" }, session: { type: "string" }, variant: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const r = await askAboutCard(lib, need(ref, "<card>"), { message: need(str(f.message), "--message"), answer: str(f.answer), session: str(f.session), variant: str(f.variant) });
      const text = [r.reply, ...(r.proposal ? ["", "Proposed card:", `Q: ${r.proposal.question}`, `A: ${r.proposal.answer}`] : []), "", `(session ${r.session})`].join("\n");
      return { data: r, text };
    },
  },

  "ask-library": {
    usage: '"<question>" [--earlier <json>]   Ask your library: an answer from your sources, each claim cited to a passage (start/end in its doc.md), or says the library doesn\'t cover it; --earlier is [{question, answer}] for a follow-up',
    options: { earlier: { type: "string" } },
    async run(words, f) {
      const lib = openLibrary();
      let earlier: AskTurn[] = [];
      if (str(f.earlier)) {
        try { earlier = JSON.parse(str(f.earlier)!); } catch { throw new Error("--earlier must be JSON: [{question, answer}]"); }
      }
      const r = await askLibrary(lib, need(words.join(" ") || undefined, '"<question>"'), earlier);
      const text = [r.answer, ...r.citations.map((c) => `  [${c.n}] ${c.title}${c.heading ? ` › ${c.heading}` : ""}: "${c.text}" (${c.item} ${c.start}-${c.end})`)].join("\n");
      return { data: r, text };
    },
  },

  tutor: {
    usage: '"<message>" [--item <source>] [--source <source>]… [--skill <skill>]… [--earlier <json>] [--files <json>] [--stream <id>]   The tutor (D128): one chat turn, from your sources with citations (start/end in each doc.md), else from the web (cited by URL) or general knowledge, hints instead of answers on practice; --item is the source being read, --source and --skill what he @-mentioned, --earlier is [{message, reply, exercise?, files?}] (a turn that set an exercise carries it, so feedback judges against its card), --files is what he attached to this message, [{name, path}] as `ore chat --attach` returned them (D189), --stream <id> writes the reply as it comes as {"progress": {stream, reply}} lines on stderr (and {stream, searching} when a web search starts or ends)',
    options: { item: { type: "string" }, source: { type: "string", multiple: true }, skill: { type: "string", multiple: true }, earlier: { type: "string" }, files: { type: "string" }, stream: { type: "string" } },
    async run(words, f) {
      const lib = openLibrary();
      let earlier: TutorTurn[] = [];
      if (str(f.earlier)) {
        try { earlier = JSON.parse(str(f.earlier)!); } catch { throw new Error("--earlier must be JSON: [{message, reply, exercise?}]"); }
      }
      // --stream <id>: the reply as it is written, and a web search starting, as `{"progress": {stream, …}}`
      // lines on stderr, which the app shows on the turn with that id (claude only).
      const stream = str(f.stream);
      const onProgress = stream ? (p: TutorProgress) => void process.stderr.write(JSON.stringify({ progress: { stream, ...p } }) + "\n") : undefined;
      let files: { name: string; path: string }[] = [];
      if (str(f.files)) {
        try { files = JSON.parse(str(f.files)!); } catch { throw new Error("--files must be JSON: [{name, path}]"); }
      }
      const r = await tutor(lib, need(words.join(" ") || undefined, '"<message>"'), { earlier, files, item: str(f.item), sources: strs(f.source), skills: strs(f.skill), onProgress });
      const text = [withSteps(r), ...(r.exercise?.cases ?? []).map((c, i) => `  ${"AB"[i]}: ${c}`), ...r.marks.map((m) => `  ${m.covered ? "got" : "missed"}: ${m.point}${m.quote ? ` (“${m.quote}”)` : ""}`), ...(r.general ? ["  (general knowledge, not from your sources)"] : []), ...r.citations.map((c) => ("url" in c ? `  [${c.n}] ${c.title || c.site}: "${c.text}" ${c.url}` : `  [${c.n}] ${c.title}${c.heading ? ` › ${c.heading}` : ""}: "${c.text}" (${c.item} ${c.start}-${c.end})`))].join("\n");
      return { data: r, text };
    },
  },

  chat: {
    usage: "[<id> [--set [--keep-time] | --delete]] | --attach <file> | --attach - --name <name>   The tutor's saved chats (D172), chats/<id>.json: list them (last changed first), print one, replace one with the chat JSON on stdin ({id, title, carry, turns}; --keep-time keeps its `updated`, as Undo of a delete does), or delete one (prints it, so it can be set back). --attach copies a file for a message into chats/files/ (an image, a PDF or a text file, 20 MB at most; --attach -: its bytes in base64 on stdin, as pasted) and prints {name, path, kind} (D189)",
    options: { set: { type: "boolean" }, "keep-time": { type: "boolean" }, delete: { type: "boolean" }, attach: { type: "string" }, name: { type: "string" } },
    async run([id], f) {
      const lib = openLibrary();
      if (str(f.attach)) {
        const from = str(f.attach)!;
        const c = await attachToChat(lib, from === "-" ? { name: need(str(f.name), "--name"), data: Buffer.from(await readStdin(), "base64") } : from);
        return { data: { ...c, root: lib.root }, text: `Attached ${c.name} as ${c.path}` };
      }
      if (f.set) {
        const json = await readStdin();
        const given = (() => { try { return (JSON.parse(json) as { id?: unknown }).id; } catch { return undefined; } })();
        if (id && given !== id) throw new Error(`the chat on stdin is ${String(given)}, not ${id}`);
        const c = await saveChat(lib, json, { touch: !f["keep-time"] });
        return { data: c, text: `Saved chat ${c.id}` };
      }
      if (f.delete) {
        const c = await deleteChat(lib, need(id, "<id>"));
        return { data: c, text: `Deleted chat ${c.id}` };
      }
      if (id) {
        const c = readChat(lib, id);
        return { data: { ...c, root: lib.root }, text: [c.title, ...c.turns.map((t) => `\n> ${t.message}\n${typeof t.reply === "string" ? t.reply : ""}`)].join("\n") };
      }
      const rows = listChats(lib);
      return { data: rows, text: rows.map((r) => `${r.id}  ${r.updated.slice(0, 16).replace("T", " ")}  ${r.title}`).join("\n") || "No chats yet." };
    },
  },

  "tutor-card": {
    usage: '<source> --card <json> --ai <json>   Keep the card a tutor reply proposed (D128): {kind, content_type, question, answer, rubric} as `ore tutor` returned it, with that reply\'s ai stamp; it goes into review as a draft',
    options: { card: { type: "string" }, ai: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const json = (v: string | undefined, name: string) => {
        try { return JSON.parse(need(v, `--${name}`)); } catch (e) { throw (e as Error).message.startsWith("missing") ? e : new Error(`--${name} must be JSON`); }
      };
      const c = await addTutorCard(lib, need(ref, "<source>"), json(str(f.card), "card"), json(str(f.ai), "ai"));
      return { data: { id: c.meta.id, item: c.meta.item, kind: c.meta.kind, question: c.question }, text: `Added card ${c.meta.id}` };
    },
  },

  recall: {
    usage: '<item> [--chapter N [--heading "<title>"]] --text "<text>" | --feedback   store free recall, also appended to the source note (clears old feedback) / AI feedback on it (+ after-answers when not a chapter)',
    options: { text: { type: "string" }, feedback: { type: "boolean" }, chapter: { type: "string" }, heading: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const item = need(ref, "<item>");
      if ((f.text !== undefined) === Boolean(f.feedback)) throw new Error("give exactly one of --text or --feedback");
      const chapter = int(f.chapter, "chapter");
      if (chapter !== undefined) {
        if (f.text !== undefined) {
          const r = await setChapterRecall(lib, item, chapter, str(f.text) ?? "", str(f.heading));
          return { data: r, text: `Chapter ${chapter} recall saved for ${r.item} (${r.recall.at}); added to the source note` };
        }
        const { ai, ...r } = await chapterRecallFeedback(lib, item, chapter);
        const text = [r.feedback, ...(r.section_lines ? [`Section lines: ${r.section_lines}`] : []), ...(r.missed.length ? ["Missed:", ...r.missed.map((m) => `  - ${m}`)] : []), `(${ai.vendor} ${ai.model} ${ai.prompt_version})`].join("\n");
        return { data: r, text };
      }
      if (f.text !== undefined) {
        const r = await setRecall(lib, item, str(f.text) ?? "");
        return { data: r, text: `Recall saved for ${r.item} (${r.recall.at}); added to the source note` };
      }
      const { ai, ...r } = await recallFeedback(lib, item);
      const text = [
        r.feedback,
        ...(r.section_lines ? [`Section lines: ${r.section_lines}`] : []),
        ...r.questions.map((q) => `${q.n}. ${q.feedback}`),
        ...(r.missed.length ? ["Missed:", ...r.missed.map((m) => `  - ${m}`)] : []),
        `(${ai.vendor} ${ai.model} ${ai.prompt_version})`,
      ].join("\n");
      return { data: r, text };
    },
  },

  "key-points": {
    usage: "<item>                       AI: 2–4 key points per prequestion with the passages that support them (D56); skips prequestions that have them",
    async run([ref]) {
      const lib = openLibrary();
      const r = await writeKeyPoints(lib, need(ref, "<item>"));
      const text = r.prequestions
        .map((p, i) => [`${i + 1}. ${p.q}`, ...(p.points ?? []).map((k) => `  - ${k.text} (${k.evidence.length} passage${k.evidence.length === 1 ? "" : "s"})`)].join("\n"))
        .join("\n");
      return { data: r, text };
    },
  },

  scope: {
    usage: "<item> [--reached N] [--leave-out \"text\"]   a partway finish (D100): leaves out prequestions answered only past body offset N, and (AI) those his note rules out",
    options: { reached: { type: "string" }, "leave-out": { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const reached = int(f.reached, "reached");
      const r = await scopeFinish(lib, need(ref, "<item>"), { reached, leaveOut: str(f["leave-out"]) });
      const text = r.prequestions.map((p, i) => `${i + 1}. ${p.skipped ? `(left out: ${p.skipped === "past" ? "past where you stopped" : "your note"}) ` : ""}${p.q}`).join("\n");
      return { data: r, text };
    },
  },

  check: {
    usage: "<item> <n> [--covered 1,0,1]     AI marks which key points the closed-book answer covers; --covered stores your own marks instead",
    options: { covered: { type: "string" } },
    async run([ref, nArg], f) {
      const lib = openLibrary();
      const item = need(ref, "<item>");
      const n = Number(need(nArg, "<n>"));
      if (!Number.isInteger(n)) throw new Error("<n> must be an integer");
      const marks = str(f.covered);
      if (marks !== undefined && !/^[01](,[01])*$/.test(marks)) throw new Error("--covered is a comma list of 1 and 0, one per key point");
      const r = marks === undefined ? await checkPrequestion(lib, item, n) : await setCovered(lib, item, n, marks.split(",").map((x) => x === "1"));
      const text = [`${n}. ${r.q}`, ...(r.points ?? []).map((k, i) => `  ${r.check?.covered[i] ? "✓" : "○"} ${k.text}`)].join("\n");
      return { data: r, text };
    },
  },

  explain: {
    usage: "<item> --exact \"<term>\" [--start N]   AI explains a term he doesn't know, in its paragraph and in general (side quests); writes nothing",
    options: { exact: { type: "string" }, start: { type: "string" } },
    async run([ref], f) {
      const lib = openLibrary();
      const r = await explainTerm(lib, need(ref, "<item>"), need(str(f.exact), "--exact"), int(f.start, "start"));
      return { data: r, text: `Here: ${r.here}\nIn general: ${r.general}\n(${r.ai.vendor} ${r.ai.model} ${r.ai.prompt_version})` };
    },
  },

  research: {
    usage: "<question>                    AI finds 3–5 sources for one of his questions; `ore add <url> --for <question>` any of them",
    async run([ref]) {
      const lib = openLibrary();
      const r = await research(lib, need(ref, "<question>"));
      const text = [
        ...r.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.site} · ${s.type}\n   ${s.url}\n   ${s.why}`),
        `(${r.ai.vendor} ${r.ai.model} ${r.ai.prompt_version})`,
      ].join("\n");
      return { data: r, text };
    },
  },
};

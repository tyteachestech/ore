import {
  catchUpItems, markCatchUp, optimize, optimizeDue, chapterRecallFeedback, checkPrequestion, enrichItem, setCovered, scopeFinish, writeKeyPoints, gradeAnswer, askAboutCard, askLibrary, type AskTurn, explainTerm, openLibrary, pendingItems, recallFeedback, research, setChapterRecall, setRecall, type EnrichResult,
} from "@ore/core";
import type { Command } from "./types.ts";
import { int, need, str } from "./util.ts";

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
    usage: "                             the daily catch-up (D8, D10): enrich what is pending (not sources added in the last hour), then refit FSRS when a month old; started in the background once a day",
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
      const opt = optimizeDue(lib) ? await optimize(lib) : null;
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
      const text = [r.answer, ...r.citations.map((c) => `  [${c.n}] ${c.title}${c.heading ? ` › ${c.heading}` : ""}: "${c.quote}" (${c.item} ${c.start}-${c.end})`)].join("\n");
      return { data: r, text };
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

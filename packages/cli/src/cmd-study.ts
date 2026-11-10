import { readFileSync } from "node:fs";
import { relative } from "node:path";
import {
  CardState, cardStates, calibration, raterStats, addFigureCard, figureFile, findItem, cardsToRemix, firstEndThisWeek, readReviews, doctor, findVariant, inHeadOk, cardHistory, loadSkills, rejectVariant, remixCard, restoreVariant, remixStats, reviewVersion, setVariant, dueQueue, endSession, findCard, libraryStats, listCards, openIndex, openLibrary, optimize, paths,
  readCardFile, rebuildIndex, recordReview, reminderNote, reviewSettings, setAiVendor, setAiModel, savedModel, listModels, chooseVendor, setReviewSettings, skillGrowth, skillStrength, snapshot, startSession, reopenSession, today, undoReview, withLock, writeCardContent, writeCardMeta, type Card, type Library, type Variant,
} from "@ore/core";
import { startCatchUp, startRemix } from "./background.ts";
import type { Command } from "./types.ts";
import { int, need, oneOf, str, strs, table } from "./util.ts";

const cardJson = (lib: Library, c: Card, state = cardStates(lib)(c)) => ({ ...c.meta, state, question: c.question, answer: c.answer, rubric: c.rubric, path: relative(lib.root, c.path) });
/** With a figure card (D166), where its image is, so review can show it. */
const figureJson = (lib: Library, c: Card) => {
  if (!c.meta.figure) return {};
  try {
    return { figure_file: figureFile(findItem(lib, c.meta.item), c.meta.figure.src) };
  } catch {
    return {}; // its source is gone: the card's text stands alone (D166)
  }
};
// A card as a variant shows it (D66): the variant's question, answer and key points, typed and
// graded like an Explain card, with the original alongside.
const variantJson = (lib: Library, c: Card, v: Variant) => ({
  ...cardJson(lib, c), kind: "prompt" as const, question: v.question, answer: v.answer, rubric: v.rubric,
  variant: v.id, original: { question: c.question, answer: c.answer, rubric: c.rubric },
});
const pct = (x: number) => `${Math.round(x * 100)}%`;
const oneLine = (s: string, n = 90) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

export const studyCommands: Record<string, Command> = {
  cards: {
    usage: "[--state s] [--item i] [--skill s]",
    options: { state: { type: "string" }, item: { type: "string" }, skill: { type: "string" } },
    async run(_, f) {
      const lib = openLibrary();
      const state = oneOf(f.state, CardState.options, "state");
      const item = str(f.item)?.toUpperCase();
      const stateOf = cardStates(lib);
      const cards = listCards(lib).filter(
        (c) => (!state || stateOf(c) === state) && (!item || c.meta.item === item || c.meta.item.endsWith(item)) && (!f.skill || c.meta.skills.includes(f.skill as string)),
      );
      return {
        data: cards.map((c) => cardJson(lib, c, stateOf(c))),
        text: cards.length ? table(cards.map((c) => [c.meta.id, stateOf(c), c.meta.kind, c.meta.content_type, oneLine(c.question, 70)])) : "No cards.",
      };
    },
  },

  card: {
    usage: 'show|edit|set|retire|restore <id> [--review] [--variant v] [--question "<q>"] [--answer "<a>"] [--point "<key point>"]... [--state draft|live]   show parses the card (--review: the version review shows now, a variant in its turn, D66); edit opens $EDITOR; set replaces the question, answer or key points (--point, one per key point, in order: the whole rubric an Explain card is graded against; --variant edits that variant, its points one for one); retire removes it from review; restore undoes a retire, back to --state; figure <source> --src <image> --box x,y,w,h --answer <label>: a Fact card that hides that box of one of the source’s figures (fractions of its size, D166)',
    options: { question: { type: "string" }, answer: { type: "string" }, point: { type: "string", multiple: true }, state: { type: "string" }, review: { type: "boolean" }, variant: { type: "string" }, src: { type: "string" }, box: { type: "string" } },
    async run([sub, ref], f) {
      if (!["show", "edit", "set", "retire", "restore", "figure"].includes(sub ?? "")) throw new Error("usage: ore card show|edit|set|retire|restore <id> | figure <source>");
      const lib = openLibrary();
      const id = need(ref, "<id>");
      if (sub === "figure") {
        const box = need(str(f.box), "--box x,y,w,h").split(",").map((n) => (n.trim() === "" ? NaN : Number(n)));
        const c = await addFigureCard(lib, id, { src: need(str(f.src), "--src <image>"), box, label: need(str(f.answer), "--answer <what’s under the box>") });
        return { data: { ...cardJson(lib, c), ...figureJson(lib, c) }, text: `Made card ${c.meta.id}: ${c.answer}` };
      }
      if (sub === "show") {
        const c = findCard(lib, id);
        const v = f.review ? reviewVersion(lib, c) : f.variant ? findVariant(lib, c.meta.id, str(f.variant)!) : null;
        if (v) return { data: { ...variantJson(lib, c, v), ...(f.review ? { history: cardHistory(lib, c.meta.id) } : {}) }, text: `${relative(lib.root, c.path)} · variant ${v.id} (${v.type})\n\n${v.question}\n---\n${v.answer}\n${v.rubric.map((p) => `- ${p}`).join("\n")}` };
        // in_head_ok: review may offer "In my head" on this Explain card (D68); history: its reviews and
        // where each rating puts the next (D149).
        return { data: { ...cardJson(lib, c), ...figureJson(lib, c), ...(f.review ? { in_head_ok: inHeadOk(lib, c), history: cardHistory(lib, c.meta.id) } : {}) }, text: `${relative(lib.root, c.path)}\n\n${readFileSync(c.path, "utf8")}` };
      }
      if (sub === "edit") {
        const c = findCard(lib, id);
        const editor = process.env.VISUAL || process.env.EDITOR || "vi";
        const proc = Bun.spawn(["sh", "-c", `${editor} "$1"`, "sh", c.path], { stdio: ["inherit", "inherit", "inherit"] });
        await proc.exited;
        const after = readCardFile(c.path);
        return { data: cardJson(lib, after), text: `Saved ${after.meta.id}` };
      }
      if (sub === "set") {
        const question = str(f.question), answer = str(f.answer), rubric = f.point === undefined ? undefined : ([] as string[]).concat(f.point as string | string[]); // not strs: a point may hold a comma
        if (!question?.trim() && !answer?.trim() && !rubric) throw new Error("give --question, --answer or --point");
        if (f.variant) {
          const v = await setVariant(lib, id, str(f.variant)!, { question, answer, rubric });
          return { data: variantJson(lib, findCard(lib, id), v), text: `Saved variant ${v.id}` };
        }
        const c = await withLock(paths.lock(lib), () => writeCardContent(findCard(lib, id), { question, answer, rubric }));
        return { data: { ...cardJson(lib, c), ...figureJson(lib, c) }, text: `Saved ${c.meta.id}` };
      }
      if (sub === "retire" || sub === "restore") {
        const state = sub === "retire" ? "retired" : need(oneOf(f.state, ["draft", "live"] as const, "state"), "--state draft|live");
        const c = await withLock(paths.lock(lib), () => {
          const c = findCard(lib, id);
          writeCardMeta(c, { ...c.meta, state });
          return findCard(lib, id);
        });
        return { data: { ...cardJson(lib, c), ...figureJson(lib, c) }, text: `${sub === "retire" ? "Retired" : "Restored"} ${c.meta.id}` };
      }
      throw new Error("usage: ore card show|edit|set|retire|restore <id>");
    },
  },

  due: {
    usage: "[--limit N] [--skill s]... [--all] [--start]   ordered review queue: due cards, then up to the day's new drafts (review.new_per_day); --skill keeps cards of those skills; --all: every unseen draft, past the day's new-card limits; --start: a session's first fetch, opening on the likeliest recall of the first ten (D176)",
    options: { limit: { type: "string" }, skill: { type: "string", multiple: true }, all: { type: "boolean" }, start: { type: "boolean" } },
    async run(_, f) {
      const lib = openLibrary();
      const picked = strs(f.skill);
      const all = dueQueue(lib, new Date(), { skills: picked.length ? picked : undefined, newLimit: !f.all, start: !!f.start });
      const limit = int(f.limit, "limit");
      if (limit !== undefined && limit < 0) throw new Error("--limit must be 0 or more"); // slice(0, -1) would drop the last
      const q = limit === undefined ? all : all.slice(0, limit);
      const data = q.map((e) => ({
        id: e.id, kind: e.kind, state: e.state, content_type: e.content_type, item: e.item, skills: e.skills, topics: e.topics,
        priority: e.priority, question: e.question, due: e.due, retrievability: Number(e.retrievability.toFixed(4)),
        relearn: e.relearn,
      }));
      const text = q.length
        ? q.map((e, i) => `${String(i + 1).padStart(2)}. ${e.id}  ${e.kind}${e.state === "draft" ? " (draft)" : ""}${e.relearn ? " (relearn)" : ""}  ${e.skills.join(",") || "-"} · ${e.topics.join(",") || "-"}\n    ${oneLine(e.question)}`).join("\n") +
          (q.length < all.length ? `\n(${all.length - q.length} more due)` : "")
        : "Nothing due.";
      return { data, text };
    },
  },

  review: {
    usage: "<card> --rating 1-4 --confidence 1-3 [--answer a] [--ai-rating r --ai-by 'vendor model prompt@n'] [--elapsed-ms n] [--finishing] [--session id] [--variant v] [--in-head] | <card> --undo <ts>   --variant: the remixed version shown (D66); --in-head: answered in his head, self-marked (D68); --undo: takes back the card's latest review (its ts from the review's output)",
    options: {
      undo: { type: "string" },
      rating: { type: "string" }, confidence: { type: "string" }, answer: { type: "string" }, "ai-rating": { type: "string" }, "ai-by": { type: "string" },
      "elapsed-ms": { type: "string" }, finishing: { type: "boolean" }, session: { type: "string" }, variant: { type: "string" }, "in-head": { type: "boolean" },
    },
    async run([ref], f) {
      const lib = openLibrary();
      need(ref, "<card>");
      if (f.undo !== undefined) {
        await undoReview(lib, ref!, str(f.undo)!);
        return { data: { card: ref, undone: f.undo }, text: `Took back the review of ${ref} at ${f.undo}` };
      }
      const rating = need(int(f.rating, "rating"), "--rating");
      const confidence = need(int(f.confidence, "confidence"), "--confidence");
      const aiRating = int(f["ai-rating"], "ai-rating");
      if (rating < 1 || rating > 4) throw new Error("--rating must be 1-4");
      if (confidence < 1 || confidence > 3) throw new Error("--confidence must be 1-3");
      if (aiRating !== undefined && (aiRating < 1 || aiRating > 4)) throw new Error("--ai-rating must be 1-4");
      // The stamp `ore grade` printed with its rating: vendor, model and prompt version, in that order.
      // The model is whatever sits between the two (a name with a space, or none): a rating is never lost to its stamp.
      const by = str(f["ai-by"])?.trim().split(/\s+/);
      if (by && by.length < 2) throw new Error('--ai-by takes "vendor model prompt@n", as `ore grade` prints them');
      const r = await recordReview(lib, need(ref, "<card>"), {
        rating: rating as 1 | 2 | 3 | 4, confidence, answer: str(f.answer), ai_rating: aiRating, ai: by && { vendor: by[0]!, model: by.slice(1, -1).join(" "), prompt_version: by.at(-1)! },
        elapsed_ms: int(f["elapsed-ms"], "elapsed-ms"), finishing: Boolean(f.finishing), session: str(f.session), variant: str(f.variant), in_head: Boolean(f["in-head"]),
      });
      // A card that just became remixable, or used up its variants, gets new ones written ahead.
      startRemix(lib, cardsToRemix(lib, [findCard(lib, r.card)]));
      const days = Math.round((Date.parse(r.due_next) - Date.now()) / 86_400_000);
      return { data: r, text: `Logged ${r.card}: rating ${r.rating}${r.finishing ? " (finished draft → live)" : ""}. Next due ${r.due_next.slice(0, 10)} (${days}d).` };
    },
  },

  stats: {
    usage: "[--skill s]                   per skill: items read, items live, cards live, reviews, retention (all, own words, no note), session starts",
    options: { skill: { type: "string" } },
    async run(_, f) {
      const lib = openLibrary();
      // One sync of the files for all three views (each opened its own: ~35 ms apiece at 950 sources).
      const index = openIndex(lib);
      try {
        const s = libraryStats(lib, index);
        const rows = f.skill ? s.skills.filter((x) => x.skill === f.skill) : s.skills;
        if (f.skill && !rows.length) throw new Error(`unknown skill "${f.skill}"`);
        const ret = (r: number | null, n: number) => (r === null ? `– (n=${n}, needs 10)` : `${pct(r)} (n=${n})`);
        const text = table([
          ["Skill", "Pri", "Read", "Items live", "Cards live", "Reviews", "Sessions", "Retention", "Own words", "No note"],
          ...[...rows.map((x) => ({ ...x, label: x.name, pri: x.priority })), ...(f.skill ? [] : [{ ...s.total, label: "All", pri: "" }])].map((x) => [
            x.label, x.pri, String(x.items_read), String(x.items_live), String(x.cards_live), String(x.reviews), String(x.session_starts),
            ret(x.retention, x.retention_n), ret(x.retention_own_words, x.retention_own_words_n), ret(x.retention_no_note, x.retention_no_note_n),
          ]),
        ]);
        // remix: variant vs original pass rates, for us to watch the prompts (D66); ai_agreement and explain:
        // his rating against the AI's, typed against in-head answers. The app never shows them.
        const now = new Date();
        return { data: f.skill ? rows.map((x) => ({ ...x, strength: skillStrength(lib, x.skill, now, index), growth: skillGrowth(lib, x.skill, now, 12, index) })) : { ...s, remix: remixStats(lib), calibration: calibration(readReviews(lib)), ...raterStats(readReviews(lib)) }, text };
      } finally {
        index.close();
      }
    },
  },

  today: {
    usage: "                             Home's Today (D58, D60): the daily goal, active minutes, what is due, this week, and each skill's due cards and strength",
    async run() {
      const lib = openLibrary();
      startCatchUp(lib); // Home opening is the day's usual first command (D8)
      const t = today(lib);
      const min = (ms: number) => `${Math.round(ms / 60_000)} min`;
      const text = [
        `Goal ${t.goal_minutes} min${t.weekdays_only ? " (weekdays)" : ""}: ${min(t.active_ms)} done${t.met ? " · met" : t.counts ? "" : " · day off"}`,
        `${t.due} to review (~${min(t.estimate_ms)})${t.caught_up ? " · all caught up" : ""}${t.new_waiting ? ` · ${t.new_waiting} new waiting (${t.new_per_day ? `up to ${t.new_per_day} a day` : "new cards are off"})` : ""}`,
        `This week: ${t.week.map((d) => (d.status === "met" ? "●" : d.status === "off" ? "–" : "○")).join(" ")} · ${t.days_met} days met`,
      ].join("\n");
      return { data: t, text };
    },
  },

  goal: {
    usage: '[--minutes N] [--weekdays-only true|false] [--new-per-day N] [--remix true|false] [--plan "<cue>"] [--reminder HH:MM|off]   daily review settings (D60) in skills.yaml; --remix: cards he knows come back as variants (D66); --plan: "After <cue>, I review." ("" clears it); --reminder: one notification a day (D67)',
    options: { minutes: { type: "string" }, "weekdays-only": { type: "string" }, "new-per-day": { type: "string" }, remix: { type: "string" }, plan: { type: "string" }, reminder: { type: "string" } },
    async run(_, f) {
      const lib = openLibrary();
      const bool = (k: string) => {
        const v = oneOf(f[k], ["true", "false"] as const, k);
        return v === undefined ? undefined : v === "true";
      };
      const r = await setReviewSettings(lib, {
        goal_minutes: int(f.minutes, "minutes"),
        weekdays_only: bool("weekdays-only"),
        new_per_day: int(f["new-per-day"], "new-per-day"),
        remix: bool("remix"),
        plan: str(f.plan),
        reminder: f.reminder === "off" ? "" : str(f.reminder),
      });
      if (r.remix) startRemix(lib, cardsToRemix(lib, listCards(lib)));
      return { data: r, text: `Goal ${r.goal_minutes} min a day${r.weekdays_only ? ", weekdays only" : ""}; up to ${r.new_per_day} new cards a day; remix ${r.remix ? "on" : "off"}${r.plan ? `\nAfter ${r.plan}, I review.` : ""}${r.reminder ? `\nReminder at ${r.reminder}` : ""}` };
    },
  },

  remind: {
    usage: "                             the day's one reminder (D67): notify only when a reminder is set, today counts, the goal is unmet and cards wait → {notify, title, body}",
    async run() {
      const lib = openLibrary();
      startCatchUp(lib); // the reminder agent runs with the app closed (D8)
      const r = reminderNote(lib);
      return { data: r, text: r.notify ? `${r.title}\n${r.body}` : "No reminder now." };
    },
  },

  settings: {
    usage: "[--ai claude|codex] [--model m]   the app's Settings: library folder, AI vendor (ORE_AI overrides it), its model (\"\" for the default; ORE_AI_MODEL overrides) and daily review",
    options: { ai: { type: "string" }, model: { type: "string" } },
    async run(_, f) {
      const lib = openLibrary();
      const ai = oneOf(f.ai, ["claude", "codex"] as const, "ai");
      if (ai) await setAiVendor(lib, ai);
      const vendor = chooseVendor(lib);
      if (typeof f.model === "string") await setAiModel(lib, vendor, f.model);
      const env = process.env.ORE_AI || null;
      const modelEnv = process.env.ORE_AI_MODEL || null;
      const r = { library: lib.root, ai: loadSkills(lib).ai ?? "claude", ai_env: env, model: savedModel(lib, vendor), model_env: modelEnv, review: reviewSettings(lib) };
      return { data: r, text: `Library ${r.library}\nAI ${r.ai}${env ? ` (ORE_AI=${env} overrides)` : ""}\nModel ${modelEnv ?? (r.model || "default")}${modelEnv ? " (ORE_AI_MODEL overrides)" : ""}` };
    },
  },

  models: {
    usage: "[claude|codex]                the models to pick from for a vendor (default: the current one): Claude's aliases, or what `codex debug models` lists → [{id, label, description}]; id \"\" is Codex's own default",
    async run([v]) {
      const lib = openLibrary();
      const vendor = oneOf(v, ["claude", "codex"] as const, "<vendor>") ?? chooseVendor(lib);
      const list = await listModels(vendor, savedModel(lib, vendor));
      return { data: list, text: list.map((m) => `${m.id || "(default)"}\t${m.label}`).join("\n") };
    },
  },

  session: {
    usage: "start|end [<id>]|reopen <id>  review session receipts; end: that session (the last one started by default); reopen: an ended session again (an undo on its end screen)",
    async run([sub, id]) {
      const lib = openLibrary();
      if (sub === "start") {
        const r = await startSession(lib);
        // Catch up on variants missed while the Mac slept (D8); this session shows the originals.
        startRemix(lib, cardsToRemix(lib, listCards(lib)));
        startCatchUp(lib);
        return { data: { id: r.id, ts: r.ts }, text: `Session ${r.id} started` };
      }
      if (sub === "end") {
        const r = await endSession(lib, new Date(), dueQueue(lib).length === 0, id);
        snapshot(lib, { force: true });
        // Calibration on the week's first end screen only, never during a card (D69).
        const cal = (r.reviews ?? 0) > 0 && firstEndThisWeek(lib) ? calibration(readReviews(lib)) : null;
        const data = { ...r, calibration: cal?.sure_right != null ? cal : null };
        return { data, text: `Session ${r.id} ended (${r.reviews} reviews, ${r.kept} kept, ${r.rescued} rescued)` };
      }
      if (sub === "reopen") {
        await reopenSession(lib, need(id, "<id>"));
        return { data: { id }, text: `Session ${id} reopened` };
      }
      throw new Error("usage: ore session start|end [<id>]|reopen <id>");
    },
  },

  remix: {
    usage: "[<card>...] [--pending]       write variants ahead for these cards, or every card that needs them (D66); runs in the background after a review",
    options: { pending: { type: "boolean" } },
    async run(refs, f) {
      const lib = openLibrary();
      const ids = refs.length ? refs : f.pending ? cardsToRemix(lib, listCards(lib)) : [];
      if (!ids.length) throw new Error(refs.length || f.pending ? "nothing to remix" : "give card ids or --pending");
      const out = [];
      for (const id of ids) out.push(await remixCard(lib, id));
      const text = out.map((r) => `${r.card}: ${r.written.length} written, ${r.rejected} rejected${r.dropped.length ? `, dropped (${r.dropped.join("; ")})` : ""}`).join("\n");
      return { data: out, text };
    },
  },

  variant: {
    usage: 'reject|restore <card> <variant> [--reason "<why>"]   B in review, "Bad version" (D66): drops the variant, and the reason goes to the writer next time; restore undoes it',
    options: { reason: { type: "string" } },
    async run([sub, card, variant], f) {
      if (sub !== "reject" && sub !== "restore") throw new Error("usage: ore variant reject|restore <card> <variant>");
      const lib = openLibrary();
      if (sub === "restore") {
        const v = await restoreVariant(lib, need(card, "<card>"), need(variant, "<variant>"));
        return { data: v, text: `Restored variant ${v.id}` };
      }
      const v = await rejectVariant(lib, need(card, "<card>"), need(variant, "<variant>"), str(f.reason));
      startRemix(lib, cardsToRemix(lib, [findCard(lib, v.card)]));
      return { data: v, text: `Rejected variant ${v.id}` };
    },
  },

  search: {
    usage: "<query> [--limit N]           full-text search over docs, annotations, the source note, cards, topics",
    options: { limit: { type: "string" } },
    async run(positionals, f) {
      const lib = openLibrary();
      const query = need(positionals.join(" ").trim() || undefined, "<query>");
      const index = openIndex(lib);
      try {
        const limit = int(f.limit, "limit") ?? 20;
        if (limit < 1) throw new Error("--limit must be 1 or more");
        const hits = index.search(query, limit);
        const text = hits.length ? hits.map((h) => `${h.kind.padEnd(10)} ${h.ref}  ${oneLine(h.title, 60)}\n    ${oneLine(h.snippet, 110)}`).join("\n") : "No matches.";
        return { data: hits, text };
      } finally {
        index.close();
      }
    },
  },

  reindex: {
    usage: "                              rebuild .index from files",
    async run() {
      const lib = openLibrary();
      const r = rebuildIndex(lib);
      return { data: r, text: `Indexed ${r.changed} files${r.errors.length ? `; ${r.errors.length} unreadable (ore doctor)` : ""}` };
    },
  },

  doctor: {
    usage: "[--fix]                       validate files, anchors, orphans; --fix re-anchors edited docs",
    options: { fix: { type: "boolean" } },
    async run(_, f) {
      const lib = openLibrary();
      const r = await doctor(lib, { fix: Boolean(f.fix) });
      const lines = [
        ...r.fixed.map((x) => `fixed  ${x}`),
        ...r.issues.map((i) => `${i.level.padEnd(5)}  ${i.path}: ${i.message}`),
        `${r.errors} error(s), ${r.warnings} warning(s)`,
      ];
      return { data: r, text: lines.join("\n"), exitCode: r.ok ? 0 : 1 };
    },
  },

  optimize: {
    usage: "                              FSRS optimizer when ≥1,000 reviews; writes fsrs-params.json",
    async run() {
      const lib = openLibrary();
      const r = await optimize(lib);
      return {
        data: r,
        text: r.optimized ? `Optimized FSRS parameters from ${r.reviews} reviews → fsrs-params.json` : `Not enough reviews to optimize (${r.reviews} of ${"needed" in r ? r.needed : 1000}).`,
      };
    },
  },
};


---

# Your focus (`json`): every command's answer, exit code and failure
`packages/cli/src/answers.ts` types what each command's `--json` answer holds; the app reads those types (`apps/desktop/src/ore.ts`). Ore's contract: every command takes `--json`, prints one valid JSON value, exits non-zero on failure with `{"error": "..."}` that says what to do next, and writes nothing when it fails.
1. **Shape against type.** For each command and subcommand, run it with good input and `--json`, and check the answer against its type in `answers.ts` (write a small checker: keys present, types, `null` vs missing, arrays never `undefined`). A key the type promises and the answer lacks, or one the app reads that the CLI never sends, is a finding. Prioritise the commands added or changed since 2026-11-15.
2. **Bad input.** A missing id, a prefix that matches two, an unknown skill, a wrong or repeated flag, an empty string, `--rating 0` or `9`, `--confidence 4`, a date or time in the wrong format, `--limit -1` or `abc`, malformed `--earlier`/`--cards`/`--files` JSON, a flag with no value at the end. Is the exit code non-zero, is stdout still one JSON value (no stack trace, no extra lines), does stderr stay clean of a second JSON, and is nothing half-written (diff the library folder before and after)?
3. **Text mode.** Without `--json`, does a failure still exit non-zero and say the next step in words?
4. **Ids.** Every command that takes an id: full id, unique prefix, ambiguous prefix, an archived source, a retired card, a deleted annotation. Same answer everywhere?

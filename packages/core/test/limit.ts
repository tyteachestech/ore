// Each test's time limit, preloaded for every `bun test` (bunfig.toml). Bun's own default is 5 s, which measured how
// busy the machine was, not the test: a test that starts the `ore` CLI five times, or adds its first PDF cold, took
// 1 to 3 s alone and ran past 5 s on a Mac running three testers or a CI runner at full load (F348, F575: both
// reproduced by running twelve copies of the intake tests beside them). A test that hangs still fails, at 30 s.
// Reopen if a run of the whole suite gets slow because a hanging test now waits 30 s to fail.
import { setDefaultTimeout } from "bun:test";

setDefaultTimeout(30_000);

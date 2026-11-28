import {fresh} from "./harness.ts";
import {startSession} from "../../packages/core/src/sessions.ts";
const lib=await fresh("session-no-git");await startSession(lib,new Date("2026-11-27T12:00:00Z"));

if(process.env.PROBE_NO_REPO){const {rmSync}=await import("node:fs");rmSync(lib.root+"/.git",{recursive:true});}

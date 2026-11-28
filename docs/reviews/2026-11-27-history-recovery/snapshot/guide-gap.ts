import {check} from "./harness.ts";
import {readFileSync} from "node:fs";
import {commands} from "../../packages/cli/src/commands.ts";
const paths=["packages/core/src/templates/library-agents.md","skills/ore/SKILL.md"];
for(const p of paths){const t=readFileSync(p,"utf8");console.log(JSON.stringify({path:p,tellsAgentToStop:/say so.*(?:stop|instead of editing)/s.test(t),gitRecoveryCommands:/git (?:restore|checkout|revert|log|show|reflog)/.test(t)}));check(/git (?:restore|checkout|revert|log|show|reflog)/.test(t)||Object.keys(commands).some(c=>/^(history|recover|snapshot)$/.test(c)),"agent has a documented way to recover an overwritten file: "+p);}
console.log("Recovery commands:",Object.keys(commands).filter(c=>/^(history|recover|snapshot)$/.test(c)));

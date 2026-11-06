import type * as YAMLLib from "yaml";

// A Markdown file with a YAML frontmatter block. The body is kept byte-exact:
// anchoring offsets and text_sha256 refer to it.
export interface FrontmatterDoc<T = Record<string, unknown>> {
  data: T;
  body: string;
}

const OPEN = "---\n";

/** The `yaml` package, loaded on the first write: reads use Bun's parser, so commands that only read
 *  never pay its load time. */
export const loadYaml = (): typeof YAMLLib => require("yaml");

/** Bun's native YAML parser reads the same values as the `yaml` package (YAML 1.2) about 20 times
 *  faster, which matters because every list reads every source's frontmatter. Writes stay on `yaml`. */
export const parseYaml = (text: string): unknown => (typeof Bun !== "undefined" && Bun.YAML ? Bun.YAML.parse(text) : loadYaml().parse(text));

export function parseFrontmatter<T = Record<string, unknown>>(text: string): FrontmatterDoc<T> {
  const src = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!src.startsWith(OPEN)) return { data: {} as T, body: src };
  const close = src.indexOf("\n---\n", OPEN.length - 1);
  const closeAtEnd = src.endsWith("\n---") ? src.length - 4 : -1;
  const end = close !== -1 ? close : closeAtEnd;
  if (end === -1) throw new Error("frontmatter: missing closing ---");
  const yaml = src.slice(OPEN.length, end + 1);
  const body = close !== -1 ? src.slice(close + 5) : "";
  const data = (parseYaml(yaml) ?? {}) as T;
  if (typeof data !== "object" || Array.isArray(data)) throw new Error("frontmatter: not a mapping");
  return { data, body };
}

export function stringifyFrontmatter(data: object, body: string): string {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const yaml = loadYaml().stringify(clean, { lineWidth: 0 });
  return `${OPEN}${yaml}---\n${body}`;
}

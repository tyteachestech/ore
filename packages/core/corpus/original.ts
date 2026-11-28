// What an original holds, read straight from its own bytes and not through Ore's import: its words in
// order, and how many headings, code blocks, tables, formulas and pictures it has. The corpus audit
// (audit.ts) holds each doc.md against this, so text, structure or order lost on the way in shows up
// for any file, with no hand-written key.
import { strFromU8 } from "fflate";
import { parseHTML } from "linkedom";
import { posix } from "node:path";
import { unzip } from "../src/ingest/unzip.ts";
import { pageTexts } from "../src/ingest/pdf.ts";

export interface Original {
  /** Every word of the text, in reading order, as `words()` splits it. */
  words: string[];
  title?: string;
  author?: string;
  headings?: number;
  code?: number;
  tables?: number;
  math?: number;
  images?: number;
}

/** Lowercased words of letters and digits, the same split for an original and a doc.md. Chinese and
 *  Japanese letters each count as one word, since those scripts put no spaces between words. */
export function words(text: string): string[] {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[­​-‍﻿]/g, "") // soft hyphens and zero-width marks
      .replace(/([\p{L}])-\s*\n\s*([\p{Ll}])/gu, "$1$2") // a word broken at a line end
      .replace(/[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/gu, " $& ")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

const decode = (b: Uint8Array) => strFromU8(b);

/** An EPUB's spine, read in order: the text of every chapter and what each holds. */
function epub(data: Uint8Array): Original {
  const files = unzip(data);
  const container = decode(files["META-INF/container.xml"] ?? new Uint8Array());
  const opfPath = container.match(/full-path="([^"]+)"/)?.[1] ?? "";
  const opf = decode(files[opfPath] ?? new Uint8Array());
  const base = posix.dirname(opfPath);
  const { document: pkg } = parseHTML(opf.replace(/<(\/?)[\w-]+:/g, "<$1"));
  const manifest = new Map<string, string>();
  for (const el of pkg.querySelectorAll("item")) manifest.set(el.getAttribute("id") ?? "", el.getAttribute("href") ?? "");
  const spine = [...pkg.querySelectorAll("itemref")].map((el) => manifest.get(el.getAttribute("idref") ?? "") ?? "");
  const out: Original = { words: [], headings: 0, code: 0, tables: 0, math: 0, images: 0 };
  out.title = pkg.querySelector("title")?.textContent?.trim() || undefined;
  out.author = pkg.querySelector("creator")?.textContent?.trim() || undefined;
  for (const href of spine) {
    const path = posix.normalize(posix.join(base, decodeURIComponent(href.split("#")[0])));
    const raw = files[path];
    if (!raw) continue;
    const { document } = parseHTML(decode(raw));
    const body = document.querySelector("body") ?? document.documentElement;
    if (!body) continue;
    out.headings! += body.querySelectorAll("h1,h2,h3,h4,h5,h6").length;
    out.code! += body.querySelectorAll("pre").length;
    out.tables! += [...body.querySelectorAll("table")].filter((t) => !t.querySelector("table") && t.querySelectorAll("tr").length > 1).length;
    out.math! += body.querySelectorAll("math").length;
    out.images! += body.querySelectorAll("img, svg image, image").length;
    for (const el of body.querySelectorAll("script, style, annotation, annotation-xml")) el.remove();
    // Blocks end in a line break, so words in two blocks never run together.
    for (const el of body.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, pre, td, th, br, tr, dt, dd, blockquote, figcaption"))
      el.after(document.createTextNode("\n"));
    out.words.push(...words(body.textContent ?? ""));
  }
  return out;
}

/** A Word file's paragraphs, headings, tables, equations and pictures, from its document.xml. */
function docx(data: Uint8Array): Original {
  const files = unzip(data);
  const xml = decode(files["word/document.xml"] ?? new Uint8Array());
  const core = decode(files["docProps/core.xml"] ?? new Uint8Array());
  const text = xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);|&#x([\da-f]+);/gi, (_, d, h) => String.fromCodePoint(d ? Number(d) : parseInt(h, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return {
    words: words(text),
    title: core.match(/<dc:title>([^<]*)<\/dc:title>/)?.[1]?.trim() || undefined,
    author: core.match(/<dc:creator>([^<]*)<\/dc:creator>/)?.[1]?.trim() || undefined,
    headings: (xml.match(/<w:pStyle w:val="(?:Heading|heading|Title)\d*"/g) ?? []).length,
    tables: (xml.match(/<w:tbl>/g) ?? []).length,
    math: (xml.match(/<m:oMath>/g) ?? []).length,
    images: (xml.match(/<a:blip /g) ?? []).length,
  };
}

/** A deck's slides in order, each slide's words. */
function pptx(data: Uint8Array): Original {
  const files = unzip(data);
  // In the deck's order: presentation.xml lists its slides' ids, each a relationship to a slide file.
  const rels = new Map([...decode(files["ppt/_rels/presentation.xml.rels"] ?? new Uint8Array()).matchAll(/<Relationship\b[^>]*>/g)].map((m) => [m[0].match(/Id="([^"]+)"/)?.[1], m[0].match(/Target="([^"]+)"/)?.[1]]));
  const ordered = [...decode(files["ppt/presentation.xml"] ?? new Uint8Array()).matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => `ppt/${rels.get(m[1])?.replace(/^\/?ppt\//, "")}`).filter((f) => files[f]);
  const slides = ordered.length
    ? ordered
    : Object.keys(files)
        .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const text = slides.map((s) => decode(files[s]).replace(/<\/a:p>/g, "\n").replace(/<[^>]+>/g, "")).join("\n");
  return { words: words(text.replace(/&amp;/g, "&")), headings: slides.length };
}

async function pdf(data: Uint8Array): Promise<Original> {
  return { words: words((await pageTexts(data)).join("\n")) };
}

/** What an original holds, or undefined for a kind it can't be read from directly. */
export async function readOriginal(data: Uint8Array, ext: string): Promise<Original | undefined> {
  switch (ext.toLowerCase().replace(/^\./, "")) {
    case "epub":
      return epub(data);
    case "docx":
      return docx(data);
    case "pptx":
      return pptx(data);
    case "pdf":
      return pdf(data);
    case "md":
    case "txt":
      return { words: words(decode(data)) };
  }
  return undefined;
}

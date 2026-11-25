import { describe, expect, test } from "bun:test";
import { backPages, frontPages, pageKind, type PageFacts } from "../src/ingest/front-matter.ts";

// Which of a book's first pages fold away as front matter (F-new-front-matter). Each case is the shape of a page
// in a real book from one of 59 checked (trade, academic and self-published EPUBs, Standard Ebooks, Project
// Gutenberg), with its words rewritten. The rule under test: fold only on evidence, and never the author's text.

const page = (p: Partial<PageFacts>): PageFacts => ({ types: [], labels: [], text: "", links: 0, linkWords: 0, ...p });
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const TITLE = ["The Slow Lamp", "Ada Learner"];

describe("a publisher's page folds", () => {
  const folds: [string, Partial<PageFacts>][] = [
    ["marked a title page", { types: ["frontmatter", "titlepage"], text: "The Slow Lamp Ada Learner Lantern House" }],
    ["marked a copyright page", { types: ["copyright-page"], text: words(280) }],
    ["a copyright page only the book's guide names", { types: ["copyright-page"], heading: "Important Disclaimer", text: `© 2016 Lantern House. ALL RIGHTS RESERVED. ${words(370)}` }],
    ["marked a dedication", { types: ["frontmatter", "dedication"], text: "To the night shift" }],
    ["an epigraph the contents names", { labels: ["Epigraph"], text: "The intelligent want self-control; children want candy." }],
    ["a contents page, by its heading", { heading: "Contents", text: `Contents ${words(140)}`, links: 31, linkWords: 139 }],
    ["a detailed contents page of 1,800 words", { heading: "CONTENTS", text: words(1800) }],
    ["a list of figures", { types: ["frontmatter"], heading: "LIST OF FIGURES, TABLES, AND EXHIBITS", text: words(200) }],
    ["a praise page of 900 words", { heading: "Praise for The Slow Lamp", text: words(920) }],
    ["a praise page its publisher marks a preface", { types: ["preface"], heading: "Praise for The Slow Lamp", text: words(1790) }],
    ["an unmarked praise page", { text: `PRAISE FOR THE SLOW LAMP ${words(660)}` }],
    ["an Also by page", { heading: "Also by Ada Learner", text: "Also by Ada Learner Tide Tables Give and Take" }],
    ["about the author, before the text", { heading: "About the Authors", text: words(230) }],
    ["a Standard Ebooks imprint", { types: ["imprint", "frontmatter"], heading: "Imprint", text: words(195) }],
    ["an unmarked title page that only names the book", { text: "THE SLOW LAMP Ada Learner" }],
    ["an unmarked copyright page", { text: `Copyright © 2019 by Ada Learner All rights reserved. ISBN 978-0-00-000000-2 ${words(60)}` }],
    ["a one-line rights notice", { types: ["frontmatter"], text: "The author and publisher have provided this e-book to you for your personal use only. Copyright infringement is against the law." }],
    ["a newsletter page", { text: "Thank you for downloading this Lantern House eBook. Sign up for our newsletter and receive special offers." }],
    ["a page of links that starts Begin Reading, though the book says reading starts there", { types: ["text"], labels: ["Welcome"], text: `Begin Reading Table of Contents Newsletters Copyright Page In accordance with the U.S. Copyright Act of 1976 ${words(60)}`, links: 5, linkWords: 8 }],
    ["an unmarked dedication", { text: "For Julie" }],
    ["an unmarked contents page made of links", { text: "Introduction One Two Three Four Five Six", links: 7, linkWords: 7 }],
  ];
  for (const [name, p] of folds) test(name, () => expect(pageKind(page(p), TITLE)).toBe("fold"));
});

describe("the author's text never folds", () => {
  const stays: [string, Partial<PageFacts>][] = [
    ["a prologue its publisher marks frontmatter", { types: ["frontmatter", "prologue"], heading: "Prologue: The First Evening", text: words(4200) }],
    ["a foreword", { types: ["frontmatter", "foreword"], heading: "FOREWORD TO THE FIRST EDITION", text: words(1050) }],
    ["a preface the contents names", { labels: ["Preface"], text: `PREFACE ${words(900)}` }],
    ["an introduction of 200 words", { heading: "Introduction", text: words(211) }],
    ["a 58-word author's note where the book says reading starts", { types: ["text", "bodymatter"], heading: "AUTHOR’S NOTE", text: words(58) }],
    ["a short note to the reader", { labels: ["A Note to the Reader"], text: "A NOTE TO THE READER Read chapter 1 with a real tide table open beside you." }],
    ["acknowledgments", { heading: "Acknowledgments", text: words(490) }],
    ["a part page of three words", { types: ["bodymatter", "part"], heading: "Part I", text: "Part I Light" }],
    ["a chapter that opens with a marked epigraph", { types: ["chapter", "epigraph"], heading: "1", text: words(3000) }],
    ["an unmarked chapter that opens with a marked epigraph", { types: ["epigraph"], text: words(3000) }],
    ["a chapter that quotes a copyright notice", { heading: "Chapter 7", text: `Copyright © 1976 All rights reserved, the page said. ${words(3000)}` }],
    ["one file holding the title page and the whole book", { labels: ["Title Page", "Copyright", "Chapter 1", "Chapter 2"], text: words(27000) }],
    ["a file the contents calls the title page but that holds 5,000 words", { labels: ["Title Page"], text: words(5000) }],
    ["a long first page with no marks", { text: words(434) }],
  ];
  for (const [name, p] of stays) test(name, () => expect(pageKind(page(p), TITLE)).not.toBe("fold"));
});

describe("where the front matter ends", () => {
  const title = page({ types: ["titlepage"], text: "The Slow Lamp" });
  const rights = page({ types: ["copyright-page"], text: words(200) });
  const contents = page({ heading: "Contents", text: words(100) });
  const dedication = page({ types: ["dedication"], text: "To the night shift" });
  const blurb = page({ heading: "Summary", text: words(125) });
  const chapter = page({ heading: "1", text: words(3000) });
  const preface = page({ heading: "Preface", text: words(600) });

  test("at the first page of the author's text", () => expect(frontPages([title, rights, dedication, contents, preface, chapter])).toBe(4));
  test("a book that starts on its text has none", () => expect(frontPages([chapter, chapter])).toBe(0));
  test("a book whose text starts early: the copyright page after the preface stays where it is", () => expect(frontPages([title, preface, rights, contents, chapter])).toBe(1));
  test("a short unmarked page between two of the publisher's pages goes with them", () => expect(frontPages([blurb, rights, preface, chapter])).toBe(2));
  test("a short unmarked page after the last of them stays with the text", () => expect(frontPages([title, rights, page({ text: words(47) }), chapter])).toBe(2));
  test("a long unmarked page ends it, and what follows stays", () => expect(frontPages([title, page({ text: words(238) }), rights, chapter])).toBe(1));
  test("a book that is all front matter is not folded", () => expect(frontPages([title, rights, contents])).toBe(0));
});

// The same at a book's end (Tyler 2026-11-25: fold the publisher's last pages too): only what is plainly theirs,
// read from the last page back. Shapes from the same 59 books.
describe("a book's last pages", () => {
  const stays: [string, Partial<PageFacts>][] = [
    ["an afterword", { heading: "Afterword", text: words(170) }],
    ["an epilogue the book marks backmatter", { types: ["backmatter"], heading: "Epilogue", text: words(260) }],
    ["acknowledgments", { heading: "ACKNOWLEDGMENTS", text: words(60) }],
    ["notes", { types: ["backmatter"], heading: "Notes", text: words(9000) }],
    ["a short notes page", { heading: "NOTES AND SOURCES", text: "NOTES AND SOURCES" }],
    ["an index that is all links", { heading: "Index", text: words(3000), links: 2900, linkWords: 2900 }],
    ["an unnamed index page of links", { text: words(90), links: 80, linkWords: 88 }],
    ["a bibliography", { labels: ["Selected Bibliography"], text: words(84) }],
    ["a glossary", { types: ["glossary"], text: words(150) }],
    ["an appendix", { heading: "Appendix: Ten Tools", text: words(180) }],
    ["illustration credits, with their copyright signs", { heading: "Illustration Credits", text: `© 2019 Ada Learner. © 2018 Ben Reviewer. All rights reserved. ${words(100)}` }],
    ["further reading", { heading: "Further Reading", text: words(120) }],
    ["discussion questions", { heading: "Discussion Questions", text: words(140) }],
    ["a last page that names the author, as a poem's close does", { text: "Ada Learner, at the harbour, in winter" }],
    ["a last page that starts To…", { text: "To be continued in the second volume" }],
    ["endnotes with no heading that cite an edition's copyright", { types: ["backmatter", "endnotes"], text: `First published in 1962. Copyright © 1999 by the estate. ${words(280)}` }],
    ["picture credits with no heading", { text: `© Ada Learner, page 3. © Ben Reviewer, page 9. ${words(60)}` }],
    ["a long excerpt from another title", { heading: "An Excerpt from The Quiet Kettle", text: words(2600) }],
  ];
  for (const [name, p] of stays) test(`stays: ${name}`, () => expect(pageKind(page(p), TITLE, true)).not.toBe("fold"));

  const folds: [string, Partial<PageFacts>][] = [
    ["about the author", { heading: "About the Author", text: words(160) }],
    ["an Also by page with no heading", { text: "ALSO BY ADA LEARNER The Quiet Kettle" }],
    ["a newsletter page", { text: "Thank you for buying this Lantern House ebook. To receive special offers, sign up for our newsletters." }],
    ["a what's-next advert", { types: ["backmatter"], text: "What's next on your reading list? Discover your next great read! Sign up now." }],
    ["a second contents page", { heading: "Contents", text: words(170), links: 40, linkWords: 160 }],
    ["a copyright page", { text: `Lantern House 120 Broadway Copyright © 2019 by Ada Learner All rights reserved ISBN 978-0-00-000000-2 ${words(40)}` }],
    ["about the publisher", { heading: "About the Publisher", text: words(77) }],
    ["a colophon", { types: ["colophon", "backmatter"], heading: "Colophon", text: words(170) }],
  ];
  for (const [name, p] of folds) test(`folds: ${name}`, () => expect(pageKind(page(p), TITLE, true)).toBe("fold"));

  const chapter = page({ heading: "9", text: words(3000) });
  const thanks = page({ heading: "Acknowledgments", text: words(300) });
  const notes = page({ heading: "Notes", text: words(5000) });
  const also = page({ heading: "Also by Ada Learner", text: "Also by Ada Learner The Quiet Kettle" });
  const bio = page({ heading: "About the Author", text: words(90) });
  const second = page({ text: words(50) }); // the second author's lines, with no name on the page
  const advert = page({ text: "Sign up for our newsletter and receive special offers." });
  const rights = page({ types: ["copyright-page"], text: words(180) });
  const figure = page({ heading: "Extended image description for Figure 4.1", text: words(84) });

  test("start at the first of the publisher's pages after the text", () => expect(backPages([chapter, thanks, notes, also, bio, advert, rights])).toBe(3));
  test("a book that ends on its text, its notes or its index has none", () => {
    expect(backPages([chapter, chapter])).toBe(2);
    expect(backPages([chapter, thanks, notes])).toBe(3);
  });
  test("a publisher's page before the notes stays where it is", () => expect(backPages([chapter, also, notes, advert])).toBe(3));
  test("a short unmarked page between two of them goes with them", () => expect(backPages([chapter, bio, second, advert])).toBe(1));
  test("short pages after the last of them keep the whole end unfolded: they may be figure descriptions", () => expect(backPages([chapter, advert, figure, figure])).toBe(4));
  test("the page after the front matter is never folded, and with no page of text before them nothing is", () => {
    expect(backPages([rights, chapter, bio, advert], [], 1)).toBe(2);
    expect(backPages([rights, bio, advert], [], 1)).toBe(3);
  });
  test("a one-page book has none", () => expect(backPages([bio])).toBe(1));
  test("a book of short pages keeps them all: two in a row end the fold, however a page far up reads", () => {
    const poem = page({ text: words(90) });
    const half = page({ labels: ["Contents"], text: words(30) }); // a poem called "Contents", mid-book
    expect(backPages([chapter, poem, half, poem, poem, poem, bio])).toBe(6);
  });
  test("a sample that is all publisher's pages is left whole, as the front leaves it", () => {
    const title = page({ types: ["titlepage"], text: "The Slow Lamp" });
    const contents = page({ heading: "Contents", text: words(100) });
    expect(frontPages([title, rights, contents])).toBe(0);
    expect(backPages([title, rights, contents], [], 0)).toBe(3);
    expect(backPages([title, page({ text: words(120) }), rights, also], [], 0)).toBe(4);
  });
});

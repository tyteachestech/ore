import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { nativeMenu } from "../src/native-menu";

// Right-click (AGENTS.md conventions): the Mac's own menu only where it means something; the
// webview's page menu (Reload, AutoFill) never shows.
test("the Mac's menu stays in fields, selected text and the reader's text, nowhere else", () => {
  const { document } = new Window();
  document.body.innerHTML = `
    <nav class="sidebar"><button id="row">Skill</button><div id="space"></div><input id="field"></nav>
    <div contenteditable="true"><p id="note">My note</p><div class="note-diagram" contenteditable="false"><svg id="drawing"></svg></div></div>
    <article class="doc"><p id="text">Some <a id="link" href="https://x.com">link</a> text</p></article>
    <p id="row-text">Row text</p>`;
  const $ = (id: string) => document.getElementById(id) as unknown as Element;
  const none = document.getSelection() as unknown as Selection;
  expect(nativeMenu($("space"), none)).toBe(false);
  expect(nativeMenu($("row"), none)).toBe(false);
  expect(nativeMenu($("field"), none)).toBe(true);
  expect(nativeMenu($("note"), none)).toBe(true);
  expect(nativeMenu($("drawing"), none)).toBe(false); // a diagram in a note has its own menu
  expect(nativeMenu($("text"), none)).toBe(true);
  expect(nativeMenu($("text").firstChild as unknown as EventTarget, none)).toBe(true); // a text node
  expect(nativeMenu($("link"), none)).toBe(false); // its "Open Link" would load the page in the window
  expect(nativeMenu($("row-text"), none)).toBe(false);
  const sel = document.getSelection()!;
  sel.selectAllChildren(document.getElementById("row-text")!);
  expect(nativeMenu($("row-text"), sel as unknown as Selection)).toBe(true);
  expect(nativeMenu($("space"), sel as unknown as Selection)).toBe(false);
  expect(nativeMenu(null, none)).toBe(false);
});

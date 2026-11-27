// The Mac and the iPhone open at once on one library (D222): the journey's page is the Mac, `phoneOnMacLibrary()` the
// phone, and both write the same folder, as both apps do on his iCloud library.
import { type Page } from "playwright";
import { AGENTS, journey, ore, openSource, phoneOnMacLibrary, phoneSource, tap, until } from "../harness";

const STORY = "The Story Spine";
const idOf = async (title: string) => ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === title)!.id;
const noteOf = async (id: string) => ((await ore("notes", id)) as { text: string }).text;

/** The phone's writes, in the folder. */
const phoneSaved = (phone: Page) => until("the phone's writes are in the folder", () => phone.evaluate(async (fs) => (await import(fs)).syncState().unsent === 0, "/src/phone/fs.ts"));
/** Until the phone's last scan is older than `fresh`'s spacing, so its next command reads the folder first. */
const scanDue = (phone: Page) => until("the phone's next command scans the folder", () => phone.evaluate(async (fs) => { const m = await import(fs); return Date.now() - m.syncState().scanned >= m.FRESH_MS; }, "/src/phone/fs.ts"), 3000);
/** An `ore` command run in the phone's own core, as its screens run them. */
const phoneOre = (phone: Page, ...args: string[]) => phone.evaluate(async ([core, args]) => (await import(core!)).run(args, null), ["/src/phone/core.ts", args] as const);

journey("two devices: a note line the Mac wrote is kept when the phone, open on that note, types in it before its next scan (F760)", async (mac) => {
  const id = await idOf(AGENTS);
  const phone = await phoneOnMacLibrary();
  try {
    await phoneSource(phone, AGENTS);
    await tap(phone, phone.locator(".phone-tools button").filter({ hasText: "Note" }));
    const note = phone.locator(".phone-reader [contenteditable=true]").first();
    await note.waitFor();
    // The Mac writes a line in the source note. The phone, on screen, scans the folder only every 30 s.
    await openSource(mac, AGENTS);
    await mac.locator(".note-editor [contenteditable=true]").first().click();
    await mac.keyboard.type("Mac wrote this line");
    await until("the Mac's line is saved", async () => (await noteOf(id)).includes("Mac wrote this line"), 8000);
    // A scan more than a second old is read again before the phone's next command (fs.ts `fresh`).
    await scanDue(phone);
    await note.click();
    await phone.keyboard.type("Phone typed this");
    await phoneSaved(phone);
    await until("the folder's note keeps both lines", async () => /Mac wrote this line[\s\S]*Phone typed this|Phone typed this[\s\S]*Mac wrote this line/.test(await noteOf(id)), 8000);
  } finally {
    await phone.close();
  }
});

journey("two devices: a rename and an archive made on the Mac aren't undone by the phone's next tap on that source (F760)", async (mac) => {
  const id = await idOf(STORY);
  const phone = await phoneOnMacLibrary();
  try {
    await phone.locator(".home-read").first().waitFor();
    // On the Mac: renamed, then archived, while the phone shows Today.
    await ore("edit", id, "--title", "Spine, renamed on the Mac");
    await ore("archive", id);
    await mac.reload();
    await scanDue(phone);
    // On the phone: Pin, which writes the same source.md.
    await phoneOre(phone, "pin", id);
    await phoneSaved(phone);
    const shown = (await ore("show", id)) as { title: string; archived_at?: string; pinned_at?: string };
    if (shown.title !== "Spine, renamed on the Mac") throw new Error(`the phone's write put the title back to “${shown.title}”`);
    if (!shown.archived_at) throw new Error("the phone's write brought the archived source back");
    if (!shown.pinned_at) throw new Error("the phone's pin was lost");
  } finally {
    await ore("archive", id, "--undo").catch(() => {});
    await phone.close();
  }
});

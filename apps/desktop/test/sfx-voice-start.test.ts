import { expect, test } from "bun:test";

// Mole's voice came in (D330) as a switch of its own, on by default; before it, his pop answered to Sound effects.
// Someone who had turned Sound effects off must not start hearing him: the new switch starts where the old one was.
test("Mole's voice, never set, starts off when Sound effects was turned off before it came in", async () => {
  const kept = new Map([["ore.sounds", "off"]]);
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
  try {
    // A fresh copy of the module, which reads the switches as it loads.
    const sfx = await import("../src/sfx?voice-start");
    const heard: string[] = [];
    sfx.setPlayer((id) => heard.push(id));
    sfx.sfx("pop");
    sfx.sfx("cheer");
    sfx.setPlayer(null);
    expect(heard).toEqual([]);
  } finally {
    delete (globalThis as Record<string, unknown>).localStorage;
  }
});

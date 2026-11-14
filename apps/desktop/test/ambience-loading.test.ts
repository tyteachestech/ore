import { afterAll, expect, test } from "bun:test";

// D254: exercise the real channel store with delayed files and a recorded Web Audio graph.
const wasFetch = globalThis.fetch, wasAudio = globalThis.AudioContext;
const pending = new Map<string, (r: Response) => void>();
const sources: { loop: boolean; loopStart: number; loopEnd: number; starts: number; stops: number[] }[] = [];
class Gain {
  gain = { value: 0, setTargetAtTime() {} };
  connect(node: unknown) { return node; }
}
class Audio {
  state = "running"; currentTime = 12; destination = {};
  createGain() { return new Gain(); }
  createAnalyser() { return { fftSize: 512, connect() {}, getByteTimeDomainData(a: Uint8Array) { a.fill(128); } }; }
  async decodeAudioData() { return { duration: 3 }; }
  createBufferSource() {
    const source = { loop: false, loopStart: 0, loopEnd: 0, starts: 0, stops: [] as number[],
      connect(node: unknown) { return node; }, start() { this.starts++; }, stop(at: number) { this.stops.push(at); } };
    sources.push(source);
    return source;
  }
}
globalThis.AudioContext = Audio as unknown as typeof AudioContext;
globalThis.fetch = ((url: string) => new Promise<Response>((resolve) => pending.set(url, resolve))) as typeof fetch;
const { ambienceState, toggle, stop } = await import("../src/ambience");
afterAll(() => { stop(); globalThis.fetch = wasFetch; globalThis.AudioContext = wasAudio; });
const reply = (id: string, status = 200) => {
  const url = `/sounds/${id}.mp3`, resolve = pending.get(url);
  expect(resolve).toBeDefined();
  pending.delete(url);
  resolve!(new Response(new Uint8Array([1]), { status }));
};

test("D254: off at launch; late channel files never override a newer pick or Stop; a missing file can recover", async () => {
  expect(ambienceState()).toMatchObject({ playing: null, loading: null });
  expect(sources).toHaveLength(0);
  const cave = toggle("cave");
  const rain = toggle("rain");
  reply("rain"); await rain;
  expect(ambienceState()).toMatchObject({ playing: "rain", loading: null });
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatchObject({ loop: true, starts: 1 });
  reply("cave"); await cave;
  expect(ambienceState().playing).toBe("rain");
  expect(sources).toHaveLength(1);

  // Switching channels fades the old source; stopping the load cannot start its delayed result.
  const lamp = toggle("lamp");
  expect(sources[0]!.stops).toHaveLength(1);
  stop(); reply("lamp"); await lamp;
  expect(ambienceState()).toMatchObject({ playing: null, loading: null });
  expect(sources).toHaveLength(1);

  // A second press while loading is also Stop.
  const focus = toggle("focus");
  await toggle("focus"); reply("focus"); await focus;
  expect(ambienceState()).toMatchObject({ playing: null, loading: null });
  expect(sources).toHaveLength(1);

  const missing = toggle("mine"); reply("mine", 404); await missing;
  expect(ambienceState()).toMatchObject({ playing: null, loading: null, missing: ["mine"] });
  const recovered = toggle("mine"); reply("mine"); await recovered;
  expect(ambienceState()).toMatchObject({ playing: "mine", loading: null, missing: [] });
  expect(sources).toHaveLength(2);
  await toggle("mine");
  expect(ambienceState().playing).toBeNull();
  expect(sources[1]!.stops).toHaveLength(1);
});

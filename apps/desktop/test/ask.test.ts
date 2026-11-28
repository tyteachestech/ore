import { expect, test } from "bun:test";
import { join } from "node:path";

// Run the real component in Happy DOM in a child: its native-boundary mocks cannot leak into other tests.
test("a reopened Explain suggestion shows its key point changes and applies them with the AI stamp", async () => {
  const p = Bun.spawn([process.execPath, join(import.meta.dir, "fixtures/ask-provenance.tsx")], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  expect({ code, output: code ? out + err : "" }).toEqual({ code: 0, output: "" });
});

for (const mode of ["stop", "normal"]) {
  test(`Ask owns the request after listener registration (${mode})`, async () => {
    const p = Bun.spawn([process.execPath, join(import.meta.dir, "fixtures/ask-stop.tsx"), mode], { stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
    expect({ code, output: code ? out + err : "" }).toEqual({ code: 0, output: "" });
  });
}

import { expect, test } from "bun:test";
import { guarded, isPrivate } from "../src/guard.ts";

// The server opens links people send it, so none may reach its own network (#549 review).
test("loopback, LAN, link-local (cloud metadata) and unique-local addresses are private; public ones aren't", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe"]) expect([ip, isPrivate(ip)]).toEqual([ip, true]);
  for (const ip of ["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111"]) expect([ip, isPrivate(ip)]).toEqual([ip, false]);
});

test("a link to a private address, or one that redirects to it, is refused before it is fetched", async () => {
  const asked: string[] = [];
  const real = (async (u: string | URL) => {
    asked.push(String(u));
    if (String(u) === "https://public.test/go") return new Response(null, { status: 302, headers: { location: "http://inside.test/admin" } });
    if (String(u) === "https://public.test/hop") return new Response(null, { status: 301, headers: { location: "/page" } });
    return new Response("ok");
  }) as typeof fetch;
  const f = guarded(real, async (h) => (h === "inside.test" ? ["10.0.0.5"] : ["93.184.216.34"]));
  await expect(f("http://169.254.169.254/latest/meta-data/")).rejects.toThrow("public web");
  await expect(f("http://[::1]:8080/")).rejects.toThrow("public web");
  await expect(f("http://[::ffff:127.0.0.1]/")).rejects.toThrow("public web");
  await expect(f("https://inside.test/")).rejects.toThrow("public web");
  await expect(f("https://public.test/go")).rejects.toThrow("public web");
  await expect(f("file:///etc/passwd")).rejects.toThrow("only opens web links");
  expect(await (await f("https://public.test/hop")).text()).toBe("ok");
  expect(asked).toEqual(["https://public.test/go", "https://public.test/hop", "https://public.test/page"]);
});

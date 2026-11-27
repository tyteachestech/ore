import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Ore Cloud fetches the links people send it, so a link must never reach the server's own network: its
 *  loopback, the LAN, or the cloud's metadata address (#549 review, `/security-and-hardening`). Every
 *  fetch the import makes (the page, its images, a redirect's next hop) goes through this: the host is
 *  resolved first, and any private address refuses it. Left open: a name that resolves to a public address
 *  here and a private one a moment later (DNS rebinding); the deploy's firewall (#550) closes that. */

/** Whether an address is one only the server's own network can reach. */
export function isPrivate(ip: string): boolean {
  // An IPv4 address mapped into IPv6 (`::ffff:127.0.0.1`, which a URL writes `::ffff:7f00:1`) is that IPv4 one.
  const m = ip.toLowerCase().match(/^::ffff:(?:([\d.]+)|([\da-f]{1,4}):([\da-f]{1,4}))$/);
  const v4 = m ? (m[1] ?? [m[2]!, m[3]!].flatMap((h) => [parseInt(h, 16) >> 8, parseInt(h, 16) & 255]).join(".")) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b < 128) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b < 32) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  const x = ip.toLowerCase();
  return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff");
}

type Resolve = (host: string) => Promise<string[]>;
const dns: Resolve = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

const MAX_HOPS = 5;

/** `fetch`, but only to public addresses, following redirects itself so each hop is checked. */
export function guarded(real: typeof fetch, resolve: Resolve = dns): typeof fetch {
  const check = async (url: URL) => {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`Ore's server only opens web links, not ${url.protocol}`);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const ips = isIP(host) ? [host] : await resolve(host);
    if (!ips.length || ips.some(isPrivate)) throw new Error(`Ore's server can't open ${url.host}: it isn't on the public web.`);
  };
  return (async (input: string | URL | Request, init?: RequestInit) => {
    let url = new URL(input instanceof Request ? input.url : String(input));
    const follow = (init?.redirect ?? "follow") === "follow";
    for (let hop = 0; ; hop++) {
      await check(url);
      const res = await real(url, { ...init, redirect: "manual" });
      const to = res.headers.get("location");
      if (!follow || res.status < 300 || res.status >= 400 || !to) return res;
      if (hop >= MAX_HOPS) throw new Error("That link redirects too many times.");
      await res.body?.cancel().catch(() => {});
      url = new URL(to, url);
    }
  }) as typeof fetch;
}

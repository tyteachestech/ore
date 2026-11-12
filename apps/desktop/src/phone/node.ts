// Node and native modules the core imports for Mac-only work (thumbnails with sips, the Swift helpers,
// the FSRS optimizer). On iPhone they exist so the bundle loads, and fail if called. Hashing is real:
// an import names each saved image by its hash.
import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

const mac = () => {
  throw new Error("only on the Mac");
};
export const execFile = mac;
export const spawn = mac;
/** A promisified Mac tool rejects, as a missing tool would, so callers' own `.catch` still runs. */
export const promisify = () => async () => mac();
export function createHash(kind: string) {
  if (kind !== "sha256") throw new Error(`no ${kind} on iPhone`);
  const h = sha256.create();
  const hash = {
    update: (data: string | Uint8Array) => (h.update(typeof data === "string" ? new TextEncoder().encode(data) : data), hash),
    digest: (_enc?: "hex") => bytesToHex(h.digest()),
  };
  return hash;
}
export const computeParameters = mac;
export class FSRSBindingItem {}
export class FSRSBindingReview {}
export default { execFile, spawn, promisify, createHash, computeParameters };

// Node and native modules the core imports for Mac-only work (thumbnails with sips, saved images,
// the Swift helpers, the FSRS optimizer). On iPhone they exist so the bundle loads, and fail if called.
const mac = () => {
  throw new Error("only on the Mac");
};
export const execFile = mac;
export const spawn = mac;
export const promisify = () => mac;
export const createHash = mac;
export const computeParameters = mac;
export class FSRSBindingItem {}
export class FSRSBindingReview {}
export default { execFile, spawn, promisify, createHash, computeParameters };

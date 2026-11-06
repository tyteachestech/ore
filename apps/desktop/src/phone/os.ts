// node:os on iPhone: the library path is fixed (core.ts), so these only need to exist.
export const homedir = () => "/";
export const tmpdir = () => "/tmp";
export const hostname = () => "iphone";
export default { homedir, tmpdir, hostname };

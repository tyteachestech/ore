// node:os on iPhone: the library path is fixed (core.ts), so these only need to exist. `release` is
// Darwin's on a Mac (audio.ts's canTranscribe); the phone hears through its shell instead (core.ts `hear`), so it reads as none.
export const homedir = () => "/";
export const tmpdir = () => "/tmp";
export const hostname = () => "iphone";
export const release = () => "0.0.0";
/** No boot to date a lock by (lock.ts): the phone's `.ore` is rebuilt each launch. */
export const uptime = () => NaN;
export default { homedir, tmpdir, hostname, release, uptime };

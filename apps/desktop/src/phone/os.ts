// node:os on iPhone: the library path is fixed (core.ts), so these only need to exist. `release` is
// Darwin's on a Mac (audio.ts's canTranscribe); the phone never transcribes, so it reads as none.
export const homedir = () => "/";
export const tmpdir = () => "/tmp";
export const hostname = () => "iphone";
export const release = () => "0.0.0";
export default { homedir, tmpdir, hostname, release };

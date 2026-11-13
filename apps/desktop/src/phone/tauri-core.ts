// @tauri-apps/api/core on iPhone (aliased in vite.config.ts): the same, except convertFileSrc maps the core's
// /lib/... paths to Ore's folder on disk, so a source's saved images load through the asset protocol.
import { core } from "@tauri-apps/api";

export const { Channel, PluginListener, Resource, SERIALIZE_TO_IPC_FN, addPluginListener, checkPermissions, invoke, isTauri, requestPermissions, transformCallback } = core;
let map = (p: string) => p;
export function setLibraryRoot(prefix: string, root: string) {
  map = (p) => (p === prefix || p.startsWith(prefix + "/") ? root + p.slice(prefix.length) : p);
}
export const convertFileSrc = (p: string, protocol?: string) => core.convertFileSrc(map(p), protocol);

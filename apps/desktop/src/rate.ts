export const MIN_RATE = 0.5;
export const MAX_RATE = 2;
export const PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/** A saved or typed speed, in range and on the slider's 0.05 steps. */
export const clampRate = (r: number) => Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(r * 20) / 20));

/** A speed dragged within a hair of a preset lands on it, so 1× is one loose drag away (D282). Only for a drag:
 *  an arrow key steps 0.05, which this would pull straight back onto the preset it left. */
export const snapRate = (r: number) => PRESETS.find((p) => Math.abs(p - r) <= 0.05 + 1e-9) ?? r;

/** What the finish panel's Continue says while it works. `scoped`: the questions past where he stopped are being
 *  left out (D100), which waits for the AI's key points, up to a minute: that is not a save. */
export const finishBusy = (leave: string, scoped: boolean) => (leave.trim() ? "Leaving that out…" : scoped ? "Finding the key points…" : "Saving…");

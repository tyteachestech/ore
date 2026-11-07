/** Whether a key pressed on this element is the element's own, not the player's: a slider keeps its
 *  arrows and Space, and a focused button keeps Space, which presses it (a speed preset, Skip), as
 *  on every Mac control. The player's other keys (←, →, [ ]) still reach the player from a button. */
export const ownsMediaKey = (target: Element | null, key: string): boolean => !!target?.closest?.("[role=slider]") || (key === " " && !!target?.closest?.("button"));

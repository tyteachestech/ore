// "Other" is what the sidebar and Home call the skills in no collection, so no collection may take
// that name. No imports: the app's fields (apps/desktop) check names with these same functions.

/** A collection's name as saved: trimmed, with runs of spaces made one. */
export const tidyCollection = (name: string): string => name.trim().replace(/\s+/g, " ");

/** Whether a name, tidied, is "Other" in any case. */
export const isOther = (name: string): boolean => tidyCollection(name).toLowerCase() === "other";

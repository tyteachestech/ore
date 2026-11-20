// The launch screen's colour (share-target.ts writes it into the generated Xcode project).

/** The window's dark (#121212, tauri.conf.json "backgroundColor"), as a storyboard colour. */
export const DARK = '<color key="backgroundColor" red="0.0706" green="0.0706" blue="0.0706" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>';

/** The storyboard with every background in the window's dark, in place of iOS's system background (white on a light
 *  phone): the app is held dark, so a white launch screen flashed before its first frame (Codex native scout). */
export const darkLaunch = (storyboard: string) => storyboard.replace(/<color key="backgroundColor"[^>]*\/>/g, DARK);

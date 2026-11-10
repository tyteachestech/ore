import "./phone/env";

import { useDismissableLayerSurface } from "@radix-ui/react-dismissable-layer";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { PHONE } from "./ore";
import { PhoneApp } from "./phone/PhoneApp";
import { HintProvider } from "./Hint";
import { suppressPageMenu } from "./native-menu";
import { QuickQuiz } from "./QuickQuiz";
import "./styles.css";
import "./retro.css";
import "./tailwind.css";

suppressPageMenu(document);

/** A click on a control that stops its own event still closes an open popover: Radix counts one that doesn't reach the document as
 *  taken, so it stays open, unless the click lands on a surface registered here (the whole page). */
function PopoverSurface() {
  const surface = useDismissableLayerSurface();
  useEffect(() => surface(document.body as HTMLElement as HTMLDivElement), [surface]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PopoverSurface />
    <HintProvider>
      {/* The same page serves the quick quiz window (D76). */}
      {PHONE ? <PhoneApp /> : getCurrentWindow().label === "quiz" ? <QuickQuiz /> : <App />}
    </HintProvider>
  </StrictMode>,
);
